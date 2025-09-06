const Path = require('path');
const Config = require('../src/Config');

describe('Config statics', () => {
  test('parseDir', () => {
    expect(Config.parseDir(Path.resolve(__dirname, 'config'))).toEqual({
      nested: {
        dir: { a: 'a' },
        folder: { b: 'b' },
        person: { name: 'coderich' },
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
});
