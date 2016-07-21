module.exports = app => {
  const cwd = require('cwd');
  const readDir = require(cwd('app/lib/readDir'));
  const routePrefix = '/api';

  // Get routes from current directory
  const routes = readDir.getRequires(cwd(__dirname));

  // Finally register the routes with the app
  routes.forEach(mw => require(mw)(app, routePrefix));
};
