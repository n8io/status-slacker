module.exports = (moduleName) => {
  const cwd = require('cwd');
  const pkg = require(cwd('package.json'));
  const debug = require('debug')(`${pkg.name}:${moduleName}`);

  debug.c = require('chalk');

  return debug;
};
