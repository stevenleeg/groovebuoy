const OFF = 0, WARN = 1, ERROR = 2;

module.exports = {
  'parser': 'babel-eslint',
  'extends': 'airbnb',
  'rules': {
    'func-names': OFF,
    'object-shorthand': OFF,
    'object-curly-spacing': OFF,
  },
};
