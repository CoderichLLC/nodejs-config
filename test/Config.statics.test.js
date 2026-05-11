const FS = require('node:fs');
const Path = require('node:path');
const Config = require('../src/Config');

describe('Config statics', () => {
  test('parseDir', () => {
    expect(Config.parseDir(Path.resolve(__dirname, 'config'))).toEqual({
      nested: {
        dir: { a: 'a' },
        folder: { b: 'b' },
        person: { name: 'coderich' },
        level1: {
          level2: {
            level3: {
              found: 'treasure',
            },
          },
        },
      },
      config: {
        app: {
          name: 'config.yml',
          description: 'YML Configuration',
        },
        lib: {
          name: 'config.yml',
        },
      },
      dir: { a: 'a' },
    });
  });

  test('dirPaths', () => {
    const ignored = (parsed) => {
      if (parsed.name.startsWith('.')) return true;
      const stat = FS.statSync(Path.join(parsed.dir, `${parsed.name}${parsed.ext}`));
      if (stat?.isDirectory()) return false;
      return !['.yml', '.yaml'].includes(parsed.ext.toLowerCase());
    };

    const arr = Config.dirPaths(Path.resolve(__dirname, 'config'), ignored);

    const yaml = arr.reduce((prev, { paths, data }) => {
      const path = paths.join('.');
      if (!path.length) return prev.concat(data);
      const indented = data.split('\n').map(line => (line.trim() ? `  ${line}` : line)).join('\n');
      return prev.concat(`${path}:\n${indented}`);
    }, '');

    expect(Config.parseYaml(yaml)).toEqual({
      nested: {
        dir: { a: 'a' },
        folder: { b: 'b' },
      },
      'nested.level1.level2.level3': { found: 'treasure' },
      config: {
        app: {
          name: 'config.yml',
          description: 'YML Configuration',
        },
        lib: {
          name: 'config.yml',
        },
      },
      dir: { a: 'a' },
    });
  });
});
