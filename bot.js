const cwd = require('cwd');
const dispatcher = require(cwd('app/lib/dispatcher'));
const debugDefaultPath = cwd('app/lib/appDebug');
const debugBot = require(debugDefaultPath)('bot');

// Load in .env
require('dotenv-safe').load({
  sample: cwd('.env.sample'),
  allowEmptyValues: true,
  silent: true
});

dispatcher
  .init()
  .then(() => {
    // console.log(debugBot.c.green('All Slack RTM bots are now running.'));
  })
  ;
