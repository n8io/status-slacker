const CMD_PREFIX = process.env.COMMAND_PREFIX || ':-';

module.exports = {
  start: {
    text: `${CMD_PREFIX}start`,
    info: 'Starts or restarts a status update.'
  },
  back: {
    text: `${CMD_PREFIX}back`,
    info: 'Go back and resubmit a new response for the previous question.'
  },
  stop: {
    text: `${CMD_PREFIX}stop`,
    info: 'Stops a current status update.'
  },
  questions: {
    text: `${CMD_PREFIX}questions`,
    info: 'Lists out the set of questions that will be asked.'
  },
  me: {
    text: `${CMD_PREFIX}me`,
    info: 'Shows your user settings.'
  },
  usage: {
    text: `${CMD_PREFIX}usage`,
    info: 'Provides a few usage examples.'
  },
  config: {
    text: `${CMD_PREFIX}config`,
    info: 'Echos back the current configuration.'
  },
  help: {
    text: `${CMD_PREFIX}help`,
    info: 'Presents this help text.'
  }
};
