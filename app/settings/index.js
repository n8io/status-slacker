module.exports = app => {
  const cwd = require('cwd');
  const readDir = require(cwd('app/lib/readDir'));

  // Get routes from current directory
  const routes = readDir.getRequires(cwd(__dirname));

  // Finally apply app settings to app
  routes.forEach(mw => require(mw)(app));
};
