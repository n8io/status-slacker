const heartbeatController = () => {};
const cwd = require('cwd');
const debug = require(cwd('app/lib/appDebug'))('controllers:heartbeart');

heartbeatController.get = (req, res) => {
  debug(debug.chalk.yellow('test'));

  return res.send('OK');
};

module.exports = heartbeatController;
