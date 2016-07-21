const express = require('express');
const cwd = require('cwd');

const app = express();

// Apply app level settings
require(cwd('app/settings'))(app);

// Register middleware
require(cwd('app/middleware'))(app);

// Register custom routes
require(cwd('app/routes'))(app);

module.exports = app;
