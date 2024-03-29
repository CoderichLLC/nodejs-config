/* eslint-disable no-template-curly-in-string */

const Config = require('../src/Config');

// Create a default config instance
const config = new Config({
  arr: [],
  env: '${env:GOZIO_ENV, dev}',
  self: {
    test: '${self:app.name}',
  },
  lib: {
    env: '${self:GOZIO_ENV, dev}',
    $env: '${self:env}',
    app: '${self:app}',
    utilities: {
      aws: {
        lambda: {
          locationResolver: 'location-resolver-${self:lib.env}',
        },
      },
    },
  },
  app: {
    a: 'a',
    b: 'b',
    c: 'c',
    arr: ['${self:app.a}', '${self:app.b}', '${self:app.c}'],
    arrRef: '${self:app.arr}',
    'tricky-self-name': 'tricky-${self:app.gozio-config}-${self:app.name}-${self:app.name}',
    'gozio-config': '${self:app.name}',
    secret: '${sm:atlas.apiPublicKey}',
    secret2: '${self:app.${sm:name}}',
    name: 'gozio-config',
    defaultUndefined: '${self:app.nothing}',
    defaultUndefined2: '${self:app.nothing, "undefined"}',
    defaultBoolean: '${self:app.nothing, true}',
    defaultString: "${self:app.nothing, 'true'}",
    apostrophe: "${self:app.nothing, rich's world}",
    absoluteSingleQuote: "${self:app.nothing, ''hello''}",
    absoluteDoubleQuote: "${self:app.nothing, '\"hello\"'}",
    selfRef: '${self:self.test}',
    anotherEnv: 'another-${self:env}',
    dynamicDefault: '${self:app.secret, ${self:lib.utilities.aws.lambda.locationResolver}}',
    dynamicHttpDefault: '${sm:auth0.audience, https://gozio-dev.auth0.com/api/v2/}',
    lib: '${self:lib}',
    bool: '@{eq:${self:app.name}, gozio-config}',
  },
}, {
  eq: (a, b) => Boolean(a === b),
});

//
const secrets = { name: 'name', atlas: { apiPublicKey: 'foobar' } };

// Predefining environment variables in order to test them
process.env.testMe = 'testMe';
process.env.test__me__nested = 'testMeNested';
process.env.GOZIO_ENV = 'test';
config.merge(Config.parseEnv({ pick: ['testMe', 'test__me__nested'] }));
config.merge(Config.parseArgs({ pick: ['config'] }));

// Helper function to make sure merging did not mess things up
const baseAssert = () => {
  expect(config.get('name')).toBeUndefined();
  expect(config.get('config')).toEqual('jest.config.js');
  expect(config.get('app.defaultUndefined')).toBeUndefined();
  expect(config.get('app.defaultUndefined2')).toBe('undefined');
  expect(config.get('app.defaultBoolean')).toBe(true);
  expect(config.get('app.defaultString')).toBe('true');
  expect(config.get('testMe')).toBe('testMe');
  expect(config.get('test.me.nested')).toBe('testMeNested');
  expect(config.get('lib:utilities:aws:lambda:locationResolver')).toBe('location-resolver-dev');
  expect(config.get('app.apostrophe')).toBe("rich's world");
  expect(config.get('app.absoluteSingleQuote')).toBe("'hello'");
  expect(config.get('app.absoluteDoubleQuote')).toBe('"hello"');
  expect(config.get('app.arr')).toEqual(['a', 'b', 'c']);
  expect(config.get('app.arrRef')).toEqual(['a', 'b', 'c']);
};

describe('Config', () => {
  test('config.get', () => {
    expect(config.get('arr')).toEqual([]);
    expect(config.get('env')).toEqual('dev');
    expect(config.get('app.name')).toEqual('gozio-config');
    expect(config.get('app.selfRef')).toBe('gozio-config');
    expect(config.get('self.test')).toBe('gozio-config');
    expect(config.get('app.secret')).toBeUndefined();
    expect(config.get('app.secret2')).toBeUndefined();
    expect(config.get('app.anotherEnv')).toEqual('another-dev');
    expect(config.get('app.gozio-config')).toEqual('gozio-config');
    expect(config.get('app.tricky-self-name')).toEqual('tricky-gozio-config-gozio-config-gozio-config');
    expect(config.get('app.dynamicDefault')).toEqual('location-resolver-dev');
    expect(config.get('app.dynamicHttpDefault')).toEqual('https://gozio-dev.auth0.com/api/v2/');
    expect(config.get('app.bool')).toBe(true);

    expect(config.get()).toMatchObject({
      config: 'jest.config.js',
      testMe: 'testMe',
      test: { me: { nested: 'testMeNested' } },
      app: expect.objectContaining({
        name: 'gozio-config',
        'gozio-config': 'gozio-config',
        'tricky-self-name': 'tricky-gozio-config-gozio-config-gozio-config',
        defaultUndefined: undefined,
        defaultUndefined2: 'undefined',
        defaultBoolean: true,
        defaultString: 'true',
      }),
    });

    expect(config.get('app')).toMatchObject({
      name: 'gozio-config',
      'gozio-config': 'gozio-config',
      'tricky-self-name': 'tricky-gozio-config-gozio-config-gozio-config',
      defaultUndefined: undefined,
      defaultUndefined2: 'undefined',
      defaultBoolean: true,
      defaultString: 'true',
    });

    baseAssert();
  });

  test('config.merge', () => {
    // YML Config
    config.merge(Config.parseFile(`${__dirname}/config/config.yml`));
    expect(config.get('lib.name')).toEqual('config.yml');
    expect(config.get('app.name')).toEqual('config.yml');
    expect(config.get('app.bool')).toBe(false);
    expect(config.get('app.description')).toEqual('YML Configuration');
    expect(config.get('app.gozio-config')).toEqual('config.yml');
    expect(config.get('app.tricky-self-name')).toEqual('tricky-config.yml-config.yml-config.yml');
    baseAssert();

    // JSON Config
    config.merge(Config.parseFile(`${__dirname}/config/config.json`));
    expect(config.get('lib.name')).toEqual('config.json');
    expect(config.get('app.name')).toEqual('config.json');
    expect(config.get('app.bool')).toBe(false);
    expect(config.get('app.description')).toEqual('JSON Configuration');
    expect(config.get('app.gozio-config')).toEqual('config.json');
    expect(config.get('app.tricky-self-name')).toEqual('tricky-config.json-config.json-config.json');
    baseAssert();

    // JS Config
    config.merge(Config.parseFile(`${__dirname}/config/config.js`));
    expect(config.get('lib.name')).toEqual('config.js');
    expect(config.get('app.name')).toEqual('config.js');
    expect(config.get('app.bool')).toBe(false);
    expect(config.get('app.description')).toEqual('JS Configuration');
    expect(config.get('app.nothing', 'hello world')).toEqual('hello world');
    expect(config.get('app.gozio-config')).toEqual('config.js');
    expect(config.get('app.tricky-self-name')).toEqual('tricky-config.js-config.js-config.js');
    baseAssert();
  });

  test('config.resolve', () => {
    config.resolve({ sm: secrets, env: process.env });
    expect(config.get('app.secret')).toEqual('foobar');
    expect(config.get('app.secret2')).toEqual('config.js');
    expect(config.get('app.dynamicDefault')).toEqual('foobar'); // woot!
    expect(config.get('env')).toEqual('test');
    expect(config.get('app.anotherEnv')).toEqual('another-test');
    baseAssert();

    // Add more to sm (test that it does not clobber dictionary)
    config.resolve({ sm: { atlas: { more: 'attributes' } } });
    expect(config.get('app.secret')).toEqual('foobar');
    expect(config.get('app.secret2')).toEqual('config.js');
    expect(config.get('env')).toEqual('test');
    expect(config.get('app.anotherEnv')).toEqual('another-test');
    baseAssert();
  });

  test('config.set', () => {
    config.set('lib.name', 'newName');
    expect(config.get('lib.name')).toBe('newName');
    baseAssert();
  });

  test('Private variables', () => {
    expect(config.config).toBeUndefined();
    expect(config.substitutionRegex).toBeUndefined();
    expect(config.substitute).toBeUndefined();
  });

  test('Substitution values preserved', () => {
    config.merge({ newData: '${env:GOZIO_ENV}' });
    expect(config.get('newData')).toEqual('test');
  });

  test('Mutating resolved variable', () => {
    expect(config.get('app.secret')).toEqual('foobar');
    secrets.atlas.apiPublicKey = 'hacked'; // This won't work because reference is lost
    config.set('something', 'else'); // Just to see if it re-resolves
    expect(config.get('app.secret')).toEqual('foobar');
  });

  test('Mutating arrays (get ref)', () => {
    const arr = config.get('app.arr');
    expect(arr).toEqual(['a', 'b', 'c']);
    arr.push('d');
    const arr2 = config.get('app.arr');
    expect(arr2).toEqual(['a', 'b', 'c', 'd']); // The reference is kept!
  });

  test('Dynamic object by reference (ref is lost!)', () => {
    const obj = { a: 'a' };
    config.set('app.object', obj);
    expect(config.get('app.object')).toEqual({ a: 'a' });
    obj.b = 'b';
    expect(config.get('app.object')).toEqual({ a: 'a' }); // Because obj is declared outside of config!
  });

  test('Mutating objects (get ref)', () => {
    const obj = config.get('app.object');
    expect(obj).toEqual({ a: 'a' });
    obj.b = 'b';
    expect(config.get('app.object')).toEqual({ a: 'a', b: 'b' }); // The reference is kept!
  });

  test('Object reference', () => {
    expect(config.get('lib.$env')).toBe('test');
    expect(config.get('app.lib.$env')).toBe('test');
    expect(config.get('app.lib')).toEqual({
      env: 'dev',
      $env: 'test',
      name: 'newName',
      app: expect.any(Object),
      utilities: {
        aws: {
          lambda: {
            locationResolver: 'location-resolver-dev',
          },
        },
      },
    });
    expect(config.get('app.lib.app.arr')).toEqual(['a', 'b', 'c', 'd']);
    expect(config.get('app.lib.nothing.arr')).toBeUndefined();
  });

  test('Cannot resolve with "self" key', () => {
    expect(() => config.resolve({ self: 'blah' })).toThrow(/reserved key/gi);
  });

  test('delayed merge of data', () => {
    config.merge({ 'very.nested.object': { a: 'a', b: ['b'] } });
    config.merge({ 'app.delayed': ['${self:very.nested.object}'] });
    expect(config.get('app.delayed')).toEqual([{ a: 'a', b: ['b'] }]);
  });

  test('print', () => {
    expect(config.print()).toBeDefined();
  });
});
