const cwd = require('cwd');
const COMMANDS = require(cwd('app/lib/botCommands'));

module.exports = {
  start: 'Hey there ${user.profile.first_name}, I need your status for *${configId}*. Type \`${COMMANDS.start.text}\` to get started.', // This is a string and not a template on purpose
  stop: 'Your status update was stopped.',
  restart: 'Your status update has been restarted.',
  confirmation: 'Thanks, we\'re all set :thumbsup:. I\'ve posted your summary in the ${channels}.', // This is a string and not a template on purpose
  timeout: `I feel neglected, plus you took too long. Type \`${COMMANDS.start.text}\` to start over.`,
  statusTitle: '*${config.id} status summary for ${statusSummary.user.profile.real_name}* @${statusSummary.user.name}', // This is a string and not a template on purpose
  signUp: `Your team is not currently configured with *${process.env.SLACK_BOT_NAME}*. Send a request to your team lead to get setup.`,
  noAccess: 'You do not have access to view configurations.',
  whichTeam: 'Which team? Please enter a number [1-${configs.length}]',
  settingsIntro: 'Here are your settings'
};
