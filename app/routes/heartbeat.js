module.exports = (app, routePrefix) => {
  const cwd = require('cwd');
  const express = require('express');
  const router = express.Router();

  const heartbeatController = require(cwd('app/controllers/heartbeat'));

  router.get('/heartbeat', heartbeatController.get);

  app.use(routePrefix || '/', router);
};
