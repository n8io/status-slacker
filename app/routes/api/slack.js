module.exports = (app, routePrefix) => {
  const cwd = require('cwd');
  const express = require('express');
  const router = express.Router();

  const slackController = require(cwd('app/controllers/api/slack'));

  router.get('/slack', slackController.get);

  app.use(routePrefix || '/', router);
};
