module.exports = app => {
  const cors = require('cors');

  // enable CORS - Cross Origin Resource Sharing
  app.use(cors());
};
