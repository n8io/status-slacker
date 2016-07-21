module.exports = app => {
  const cookieParser = require('cookie-parser');

  app.use(cookieParser());
};
