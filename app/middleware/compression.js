module.exports = app => {
  const compress = require('compression');

  app.use(compress());
};
