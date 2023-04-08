const FS = require('fs');
const Util = require('util');
const Flat = require('flat');
const Yaml = require('js-yaml');
const get = require('lodash.get');
const set = require('lodash.set');
const merge = require('lodash.merge');

/**
 * Config
 *
 * A general-purpose class to help manage custom configuration data.
 *
 */
module.exports = class Config {
  #data = {}; // The resolved config data
  #config = {}; // The config definition (left as-is)
  #dictionary = { self: this.#config };
  #substitutionRegex = /\${(?!.*?\$)(.*?)}/g;

  /**
   * @param {object} [data] - An optional object to seed the configuration data
   */
  constructor(data) {
    this.merge(data);
  }

  /**
   * Get a config value by key (if key is omitted entire config is returned).
   *
   * @param {string} [key] - A key in dot.notation or colon:notation
   * @param {*} [defaultValue] - A value to return if config[key] is undefined
   * @returns {*} - A value by key or entire config when key is omitted
   */
  get(key, defaultValue) {
    if (!key) return this.#data;
    return get(this.#data, key.replace(/:/g, '.'), defaultValue);
  }

  /**
   * Set a config value by key and resolve all substitution values.
   *
   * @param {string} key - A key in dot.notation or colon:notation
   * @param {*} value - A value to set at the provided key
   */
  set(key, value) {
    set(this.#config, key.replace(/:/g, '.'), value);
    this.resolve();
    return this;
  }

  /**
   * Deep merge data and resolve all substitution values.
   *
   * @param {object} data - An object to deep merge with the config
   */
  merge(data) {
    if (data != null) {
      merge(this.#config, Flat.unflatten(data));
      this.resolve();
    }
    return this;
  }

  /**
   * Resolve all substitution values against a data dictionary.
   *
   * @param {object} [dictionary = {self:config}] - An object with key:value pairs that match variable namespace:data substitutions
   */
  resolve(dictionary = {}) {
    if (dictionary.self) throw new Error('Cannot use reserved key "self"');
    merge(this.#dictionary, dictionary);

    // Traverse all the key/value pairs and special handle any default string substitution values
    Object.entries(Flat.flatten(this.#config)).forEach(([key, value]) => {
      const $value = this.#substitute(value, this.#dictionary);
      if ($value === value || typeof $value !== 'string') return set(this.#data, key, $value);
      if ($value === 'undefined') return set(this.#data, key, undefined);
      if ($value === 'null') return set(this.#data, key, null);
      if ($value === 'true') return set(this.#data, key, true);
      if ($value === 'false') return set(this.#data, key, false);
      return set(this.#data, key, $value.replace(/^['"](.*)['"]$/, '$1'));
    });

    return this;
  }

  /**
   * Substitue a string value against a data dictionary.
   *
   * @param {string} value - A string value to substitute
   * @param {object} dictionary - A data dictionary used to substitute the value
   */
  #substitute(value, dictionary, depth = 0) {
    // Determine if substitution is allowed/needed
    if (value == null || typeof value !== 'string' || ++depth > 5 || !value.match(this.#substitutionRegex)) return value;

    // Recursively substitute the value from the inside out
    return this.#substitute(value.replace(this.#substitutionRegex, (el, val) => {
      const [, namespace, tuple = ''] = val.match(/^(.*)?:(.*)$/) || [];
      const [key, defaultValue] = tuple.split(',').map(t => t.trim());
      return get(dictionary[namespace], key, defaultValue);
    }), dictionary, depth);
  }

  /**
   * Print out the current config data.
   *
   * @param {boolean} [options.flat] - Print the config with keys flat
   * @param {boolean} [options.sort] - Print the config with keys sorted
   * @param {boolean} [options.debug] - Print the possible prolematic keys only
   */
  print(options = {}) {
    const { flat = false, sort = false, debug = false } = options;

    // Format the config according to passed in options
    const data = Object.keys(Flat.flatten(this.#data)).sort((a, b) => (sort ? a.localeCompare(b) : 0)).reduce((prev, key) => {
      const value = get(this.#data, key);
      if (!debug || value === undefined || `${value}`.match(this.#substitutionRegex)) return Object.assign(prev, { [key]: value });
      return prev;
    }, {});

    const config = Object.keys(Flat.flatten(this.#config)).sort((a, b) => (sort ? a.localeCompare(b) : 0)).reduce((prev, key) => {
      const value = get(this.#config, key);
      if (!debug || value === undefined || `${value}`.match(this.#substitutionRegex)) return Object.assign(prev, { [key]: value });
      return prev;
    }, {});

    // Pretty print!
    return Util.inspect(Flat[flat ? 'flatten' : 'unflatten']({ config, data }), { depth: null, showHidden: false, colors: true });
  }

  /* ------------------------------------------------------------------------------------------------------ */

  /**
   * Parse environment variables.
   *
   * @param {[string]} [options.pick] - Specify an array of variables to pick (default pick all)
   * @param {string} [options.delim="__"] - Specify the string delimitere (default "__")
   * @returns {object} - An object with parsed environment variables
   */
  static parseEnv(options = {}) {
    const { delim = '__', pick } = options;
    const keys = pick || Object.keys(process.env);

    return Flat.unflatten(keys.reduce((prev, key) => {
      return Object.assign(prev, { [key.replace(new RegExp(delim, 'g'), '.')]: process.env[key] });
    }, {}));
  }

  /**
   * Parse all command line arguments.
   *
   * @param {[string]} [options.pick] - Specify an array of variables to pick (default pick all)
   * @param {string} [options.delim="__"] - Specify the string delimitere (default "__")
   * @returns {object} - An object with parsed command line arguments
   */
  static parseArgs(options = {}) {
    const { delim = '__', pick } = options;

    return Flat.unflatten(process.argv.slice(2).reduce((prev, curr) => {
      const [key, value = 'true'] = curr.split('='); // The presence of a key with no value default to "true"
      const $key = key.replace(/^[^a-zA-z]*(.*)$/, '$1'); // Remove any leading nonsense from the key (eg. --key=value)
      if (pick && !pick.includes($key)) return prev;
      return Object.assign(prev, { [$key.replace(new RegExp(delim, 'g'), '.')]: value.trim() });
    }, {}));
  }

  /**
   * Synchronously parse a data file from disk.
   *
   * @param {string} filepath - An absolute filepath to a file on disk
   * @returns {object} - A fully parsed data object
   */
  static parseFile(filepath) {
    switch (filepath.split('.').pop().toLowerCase()) {
      case 'js': return require(filepath); // eslint-disable-line import/no-dynamic-require, global-require
      case 'yml': case 'yaml': return Yaml.load(Config.#readFileSync(filepath, 'utf8'));
      case 'json': return JSON.parse(Config.#readFileSync(filepath, 'utf8'));
      default: throw new Error(`Unsupported file type ${filepath}`);
    }
  }

  /**
   * Synchronously read file from a path.
   *
   * Here we explicitly open/close the file descriptor due to a strange behavior found with node/lambda
   * running out of file descriptor resources
   */
  static #readFileSync(filePath, ...args) {
    const descriptor = FS.openSync(filePath);
    const content = FS.readFileSync(descriptor, ...args);
    FS.closeSync(descriptor);
    return content;
  }

  static flatten(...args) {
    return Flat.flatten(...args);
  }

  static unflatten(...args) {
    return Flat.unflatten(...args);
  }
};
