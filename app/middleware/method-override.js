module.exports = app => {
  const methodOverride = require('method-override');

  app.use(methodOverride());
};
