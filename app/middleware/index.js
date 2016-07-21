module.exports = app => {
  const cwd = require('cwd');
  const readDir = require(cwd('app/lib/readDir'));
  const orderedMiddlewares = [
    'body-parser',
    'cookie-parser',
    'compression',
    'method-override',
    'cors'
  ].map(mw => cwd(__dirname, mw)); // Convert to absolute paths

  // Get middleware from current directory
  const middleware = readDir.getRequires(cwd(__dirname), orderedMiddlewares);

  middleware.forEach(mw => require(cwd(mw))(app));
};
