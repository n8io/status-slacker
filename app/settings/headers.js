module.exports = app => {
  // disable 'X-Powered-By' header in response
  app.disable('x-powered-by');
};
