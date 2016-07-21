const cwd = require('cwd');
const chalk = require('chalk');

const app = require(cwd('app'));
const pkg = require(cwd('package.json'));

require('dotenv-safe').load({
  sample: cwd('.env.sample')
});

const server = app.listen(process.env.PORT, () => {
  console.log(
    chalk.green('%s@%s started on port %s'),
    pkg.name,
    pkg.version,
    server.address().port
  );
});

module.exports = server;
