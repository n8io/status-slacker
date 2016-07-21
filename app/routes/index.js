module.exports = app => {
  const cwd = require('cwd');
  const readDir = require(cwd('app/lib/readDir'));
  const routePrefix = '/';
  const prioritizedRoutes = [
    'heartbeat'
  ].map(rt => cwd(__dirname, rt)); // Convert to absolute paths

  // Get routes from current directory
  const routes = readDir.getRequires(cwd(__dirname), prioritizedRoutes);

  // Finally register the routes with the app
  routes.forEach(mw => require(mw)(app, routePrefix));
};
