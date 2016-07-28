const Bluebird = require('bluebird');
const cwd = require('cwd');
const _ = require('lodash');
const request = require('request');
const moment = require('moment-timezone');
const Botkit = require('botkit'); // Used for slack conversation mgmt
const SlackBot = require('slackbots'); // Simple one way slack communications
const smartBot = Botkit.slackbot();
const debug = require(cwd('app/lib/appDebug'))('botkit');
const attachmentsBuilder = require(cwd('app/lib/attachmentsBuilder'));

// Load debuggers
const debugDefaultPath = cwd('app/lib/appDebug');
const debugTicToc = require(debugDefaultPath)('tic');
const debugReceiveResponse = require(debugDefaultPath)('receive:response');
const debugStopMessage = require(debugDefaultPath)('send:stopped-message');
const debugSendSnippet = require(debugDefaultPath)('send:snippet');
const debugQuestionsMessages = require(debugDefaultPath)('send:questions-message');
const debugStatusSummary = require(debugDefaultPath)('send:status-summary');
const debugUserSettings = require(debugDefaultPath)('send:user-settings');
const debugSimpleSend = require(debugDefaultPath)('send:simple-message');

// Load in .env
require('dotenv-safe').load({
  sample: cwd('.env.sample'),
  allowEmptyValues: true,
  silent: true
});

const TIC_INTERVAL = 60 * 1000; // once a minute
const CMD_PREFIX = ':-';
const COMMANDS = {
  start: {
    text: `${CMD_PREFIX}start`,
    info: 'Starts or restarts a status update.'
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
const MESSAGES = {
  start: 'Hey there ${user.profile.first_name}, I need your status for *${configId}*. Type \`${COMMANDS.start.text}\` to get started.', // This is a string and not a template on purpose
  stop: `Status update stopped. Type \`${COMMANDS.start.text}\` to start over.`,
  confirmation: 'Thanks, we\'re all set :thumbsup:. I\'ve posted your summary in the ${channels}.', // This is a string and not a template on purpose
  timeout: `I feel neglected, plus you took too long. Type \`${COMMANDS.start.text}\` to start over.`,
  statusTitle: '*${config.id} status summary for ${statusSummary.user.profile.real_name}* @${statusSummary.user.name}', // This is a string and not a template on purpose
  signUp: `Your team is not currently configured with *${process.env.SLACK_BOT_NAME}*. Send a request to your team lead to get setup.`,
  noAccess: 'You do not have access to view configurations.',
  whichTeam: 'Which team? Please enter a number [1-${configs.length}]',
  settingsIntro: 'Here are your settings'
};
const store = {}; // In memory datastore for team and users info
const dumbBot = new SlackBot({
  token: process.env.SLACK_BOT_TOKEN,
  name: process.env.SLACK_BOT_NAME
});

let ticTock = null; // interval placeholder

const onSmartBotStart = new Bluebird((resolve, reject) => {
  smartBot
    .spawn({
      token: process.env.SLACK_BOT_TOKEN
    })
    .startRTM((err, bot, payload) => {
      // console.log(JSON.stringify(payload, null, 2));
      if (err) {
        return reject(err);
      }

      store.team = payload.team;
      store.users = payload.users.filter(u => !u.deleted && !!u.profile);

      return resolve(store);
    })
    ;
});

const onSmartBotSocketOpen = new Bluebird(resolve => {
  smartBot.on('rtm_open', bot => resolve(bot));
});

const onDumbBotStart = new Bluebird(resolve => {
  dumbBot.on('start', () => resolve());
});

Bluebird
  .all([onSmartBotStart, onSmartBotSocketOpen, onDumbBotStart])
  .then(() => {
    console.log(debug.c.green('All Slack RTM bots are now running.'));

    getConfigs();

    setTimeout(startTicking, 1000);
  })
  .error(() => {
    console.log(debug.c.red('Error'));
  });

smartBot.hears([COMMANDS.start.text], ['direct_message'], (bot, userMsg) => {
  const configs = getUserConfigs(userMsg.user);

  if (!configs.length) {
    // User is not in any config, requires setup
    sendSignUpMessage(userMsg.user);

    return;
  }
  else if (configs.length > 1) {
    const leadMsg = MESSAGES.whichTeam.replace(/\$\{configs\.length\}/, `${configs.length}`);
    const configMsg = configs.map((config, index) => `${index + 1}) ${config.id}`).join('\n>');
    let selectedConfigIndex = -1; // eslint-disable-line no-unused-vars

    bot.startConversation(userMsg, (err, convo) => {
      const choices = configs.map((config, index) => { // eslint-disable-line arrow-body-style
        return {
          pattern: (index + 1).toString(),
          callback: (response, convo) => {
            selectedConfigIndex = index;
            convo.say(`*${configs[index].id}* status update started.`);
            convo.next();
          }
        };
      });

      choices.push({
        default: true,
        callback: (response, convo) => {
          convo.repeat();
          convo.next();
        }
      });

      convo.ask(`${leadMsg}\n>${configMsg}`, choices);

      convo.on('end', () => {
        const questions = buildQuestions(configs[selectedConfigIndex], userMsg.user);

        bot.startConversation(userMsg, questions[0]);
      });
    });
  }
  else {
    const questions = buildQuestions(configs[0], userMsg.user);

    bot.startConversation(userMsg, questions[0]);
  }
});

smartBot.hears([COMMANDS.help.text], ['direct_message'], (bot, userMsg) => {
  sendHelpMessage(userMsg.user);
});

smartBot.hears([COMMANDS.questions.text], ['direct_message'], (bot, userMsg) => {
  const configs = getUserConfigs(userMsg.user);

  if (configs.length > 1) {
    const leadMsg = `Which team? Please enter a number [1-${configs.length}]`;
    const configMsg = configs.map((config, index) => `${index + 1}) ${config.id}`).join('\n>');
    let selectedConfigIndex = -1; // eslint-disable-line no-unused-vars

    bot.startConversation(userMsg, (err, convo) => {
      const choices = configs.map((config, index) => { // eslint-disable-line arrow-body-style
        return {
          pattern: (index + 1).toString(),
          callback: (response, convo) => {
            selectedConfigIndex = index;
            sendQuestionsMessages(userMsg.user, configs[index].id);
            convo.next();
          }
        };
      });

      choices.push({
        default: true,
        callback: (response, convo) => {
          convo.repeat();
          convo.next();
        }
      });

      convo.ask(`${leadMsg}\n>${configMsg}`, choices);
    });
  }
  else if (configs.length === 1) {
    sendQuestionsMessages(userMsg.user, configs[0].id);
  }
  else {
    sendSignUpMessage(userMsg.user);
  }
});

smartBot.hears([COMMANDS.usage.text], ['direct_message'], (bot, userMsg) => {
  sendUsageMessage(userMsg.user);
});

smartBot.hears([COMMANDS.config.text], ['direct_message'], (bot, userMsg) => {
  const configs = getUserConfigs(userMsg.user);

  if (!configs.length) {
    // User is not in any config, requires setup
    sendSignUpMessage(userMsg.user);

    return;
  }

  const user = getSlackUser(userMsg.user);
  const accessibleConfigs = configs.filter(config => config.admins.find(a => a.username === user.name));

  if (!accessibleConfigs.length) {
    sendSimpleMessage(userMsg.user, MESSAGES.noAccess);

    return;
  }

  if (accessibleConfigs.length > 1) {
    const leadMsg = MESSAGES.whichTeam.replace(/\$\{configs\.length\}/, `${accessibleConfigs.length}`);
    const configMsg = accessibleConfigs.map((config, index) => `${index + 1}) ${config.id}`).join('\n>');

    bot.startConversation(userMsg, (err, convo) => {
      const choices = accessibleConfigs.map((config, index) => { // eslint-disable-line arrow-body-style
        return {
          pattern: (index + 1).toString(),
          callback: (response, convo) => {
            sendConfigMessage(user.name, accessibleConfigs[index]);
            convo.next();
          }
        };
      });

      choices.push({
        default: true,
        callback: (response, convo) => {
          convo.repeat();
          convo.next();
        }
      });

      convo.ask(`${leadMsg}\n>${configMsg}`, choices);
    });
  }
  else if (accessibleConfigs.length === 1) {
    sendConfigMessage(user.name, accessibleConfigs[0]);
  }
});

smartBot.hears([COMMANDS.me.text], ['direct_message'], (bot, userMsg) => {
  sendUserSettings(userMsg.user);
});

function startStatusConversation(config) {
  if (!config || !config.members || !config.members.length) {
    return; // No configured users, nothing to do
  }

  console.log(JSON.stringify({config: config}, null, 2));

  config.members.forEach(member => {
    const user = getSlackUser(member.username);
    const introMessage = slackifyMessage(MESSAGES.start
      .replace(/\$\{user\.profile\.first_name\}/ig, `${user.profile.first_name}`)
      .replace(/\$\{configId\}/ig, `${config.id}`)
      .replace(/\$\{COMMANDS\.start\.text\}/ig, `${COMMANDS.start.text}`)
    );

    dumbBot.postMessageToUser(member.username, '', introMessage);
  });
}

function getSlackUser(name) {
  return store.users && store.users.find(u => u.name === name || u.id === name);
}

function getConfiguredUsers(name, configId) {
  const user = getSlackUser(name);
  const configs = getUserConfigs(user.name, configId);

  return configs
    .filter(config => config.members.find(m => m.username === user.name))
    .map(config => {
      const userInfo = config.members.find(m => m.username === user.name);

      return _.assign(user, {
        configId: config.id,
        name: userInfo.username,
        color: userInfo.color
      });
    })
    ;
}

function getUserConfigs(username, configId) {
  const user = getSlackUser(username);
  const configs = getConfigs().filter(config => {
    if (configId) {
      return config.id === configId;
    }
    else {
      return config.members.find(m => m.username === user.name);
    }
  });

  return _.sortBy(configs, 'id');
}

function getConfigs() {
  const configsFile = cwd('data/configs.json');

  delete require.cache[configsFile]; // Kill it in cache so we pickup changes made since this process started

  return require(configsFile);
}

function buildQuestions(config, username) {
  const questions = config.questions.map((question, questionIndex) => (response, convo) => {
    if (questionIndex === 0) { // Only wire up the end event once
      wireUpConvoEndHandler(username, convo, config);
    }

    debugReceiveResponse(JSON.stringify(response));

    convo.ask(slackifyMessage(question, '_'), (response, convo) => {
      switch (response.text) {
        case COMMANDS.start.text:
        case COMMANDS.stop.text:
          convo.stop();
          break;
        case COMMANDS.help.text:
          sendHelpMessage(username);
          convo.repeat();
          break;
        case COMMANDS.questions.text:
          sendQuestionsMessages(username, config.id);
          convo.repeat();
          break;
        case COMMANDS.usage.text:
          sendUsageMessage(username);
          convo.repeat();
          break;
        default:
          if (questionIndex < config.questions.length - 1) { // Only ask the next question if there is one to ask
            questions[questionIndex + 1](response, convo);
          }
          break;
      }

      convo.next();
    });
  });

  return questions;
}

function sendHelpMessage(username) {
  const msgs = [];

  msgs.push('Available commands:');

  _(COMMANDS)
    .keys()
    .forEach(key => msgs.push(`> \`${COMMANDS[key].text}\` ${COMMANDS[key].info}`))
    ;

  sendSimpleMessage(username, msgs.join('\n'));
}

function sendUsageMessage(username) {
  const msgs = [];

  msgs.push('*Usage Examples*');
  msgs.push('Ticket links');
  msgs.push('> When you enter something like:');
  msgs.push('>    Finished work on BUG-123');
  msgs.push('> Status Bot will automatically linkify the ticket number for you:');
  msgs.push('>    Finished work on <https://underarmour.atlassian.net/browse/BUG-123|BUG-123>');
  msgs.push('Pull Request links');
  msgs.push('> When you enter a PR url like:');
  msgs.push('>    Waiting for https://github.com/doc/flux-capacitor/pull/4 to get merged');
  msgs.push('> Status Bot will automatically linkify and replace the url with a cleaner message:');
  msgs.push('>    Waiting for <https://github.com/doc/flux-capacitor/pull/4|:arrow_heading_up: PR #4 for doc/flux-capacitor>');
  msgs.push('Code Review links');
  msgs.push('> When you enter a CR url like:');
  msgs.push('>    Waiting for https://github.com/doc/flux-capacitor/compare/master...marty:hoverboard to get merged');
  msgs.push('> Status Bot will automatically linkify and replace the url with a cleaner message:');
  msgs.push('>    Waiting for <https://github.com/doc/flux-capacitor/compare/master...marty:hoverboard|:mag_right: CR doc/flux-capacitor:master...marty:delorean>');

  sendSimpleMessage(username, msgs.join('\n'));
}

function sendStoppedMessage(username) {
  debugStopMessage(JSON.stringify(username));
  sendSimpleMessage(username, MESSAGES.stop);
}

function sendQuestionsMessages(username, configId) {
  const configs = getUserConfigs(username, configId);

  configs.forEach(config => {
    const questionsMessages = config.questions.map((question, index) => `\n>${index + 1}) _${question}_`).join('');
    const message = `Here are the questions you will be asked for *${config.id}*:${questionsMessages}`;

    debugQuestionsMessages(JSON.stringify({
      username: username,
      questionMessage: message
    }));

    sendSimpleMessage(username, message);
  });
}

function sendStatusSummary(statusSummary, config) {
  const message = slackifyMessage(
    MESSAGES.statusTitle
      .replace(/\$\{config\.id\}/ig, `${config.id}`)
      .replace(/\$\{statusSummary\.user\.profile\.real_name\}/ig, `${statusSummary.user.profile.real_name}`)
      .replace(/\$\{statusSummary\.user\.name\}/ig, `${statusSummary.user.name}`),
    '',
    attachmentsBuilder.build(statusSummary)
  );

  debugStatusSummary(JSON.stringify(statusSummary));

  config.channels.forEach(channel => {
    dumbBot.postMessageToChannel(channel, '', message);
  });
}

function sendSignUpMessage(username) {
  sendSimpleMessage(username, MESSAGES.signUp);
}

function sendConfigMessage(username, config) {
  const title = `${_.snakeCase(config.id).replace(/[_]/ig, '-')}.json`;

  sendSnippet(username, title, JSON.stringify(config, null, 2), 'javascript');
}

function sendUserSettings(username) {
  const user = getSlackUser(username);
  const configs = getUserConfigs(user.name);
  const settingsIntro = `${MESSAGES.settingsIntro}`;

  const attachments = configs.map(config => {
    const member = config.members.find(m => m.username === user.name);

    return buildUserSettingsAttacment(config, member);
  });

  const message = slackifyMessage(settingsIntro, '', attachments);

  debugUserSettings(JSON.stringify(message));

  dumbBot.postMessageToUser(user.name, '', message);

  function buildUserSettingsAttacment(config, member) {
    let msg = _.keys(member)
      .filter(key => key !== 'username')
      .map(key => `${_.capitalize(key)}: ${member[key]}`)
      .join('\n') || `Color: ${process.env.ANSWER_FALLBACK_HEX_COLOR} (default)`
      ;

    if ((config.admins || []).find(a => a.username === member.username)) {
      msg = `Admin: true\n${msg}`;
    }

    const attachment = {
      /* eslint-disable camelcase */
      fallback: '',
      color: member.color || process.env.ANSWER_FALLBACK_HEX_COLOR,
      pretext: `*${config.id}*`,
      mrkdwn_in: [
        'pretext',
        'text'
      ],
      text: msg
      /* eslint-enable camelcase */
    };

    return attachment;
  }
}

function sendSimpleMessage(username, msg) {
  const user = getSlackUser(username);

  const message = slackifyMessage(msg);

  debugSimpleSend(JSON.stringify(message));

  dumbBot.postMessageToUser(user.name, '', message);
}

function sendSnippet(username, title, content, filetype) {
  const data = {
    token: process.env.SLACK_BOT_TOKEN,
    title: title,
    content: content,
    filename: title,
    filetype: filetype,
    channels: `@${username}`
  };

  const requestOptions = {
    url: 'https://slack.com/api/files.upload',
    formData: data
  };

  debugSendSnippet(JSON.stringify(requestOptions));

  request.post(requestOptions, (err, httpResponse, body) => {
    debugSendSnippet({
      response: body
    });
  });

  // TODO: POST to web api
}

function wireUpConvoEndHandler(username, convo, config) {
  convo.on('end', convo => {
    switch (convo.status) {
      case 'completed':
        const users = getConfiguredUsers(username, config.id);
        const statusSummary = {
          id: username,
          user: users[0],
          responses: _(convo.responses).keys().map(key => { // eslint-disable-line
            return {
              question: key,
              answer: convo.responses[key].text
            };
          })
        };

        sendStatusSummary(statusSummary, config);

        let channels = '';

        if (config.channels.length === 2) {
          channels = `#${config.channels[0]} and #${config.channels[1]} channels`;
        }
        else if (config.channels.length > 2) {
          config.channels.forEach((channel, index) => {
            if (index === config.channels.length - 1) {
              channels += `and #${channel} channels`;
            }
            else {
              channels += `#${channel}, `;
            }
          });
        }
        else {
          channels = `#${config.channels[0]} channel`;
        }

        sendSimpleMessage(username, MESSAGES.confirmation.replace(/\$\{channels\}/ig, `${channels}`));
        break;
      case 'stopped':
        sendStoppedMessage(username);
        break;
      case 'timeout':
        sendSimpleMessage(username, MESSAGES.timeout);
        break;
      default:
        // Do nothing
        break;
    }
  });
}

function startTicking() {
  if (ticTock) {
    clearInterval(ticTock);
  }
  else {
    // First run
    processNowForCheckins();
  }

  ticTock = setInterval(processNowForCheckins, TIC_INTERVAL);
}

function processNowForCheckins() {
  const now = moment().tz('America/New_York');

  debug('Server time', now.format());

  getConfigs().forEach(config => {
    const schedule = config.schedules.find(s => s.day === now.day());

    if (!schedule) {
      return; // Not set to run today
    }

    const checkinTime = moment()
      .tz(config.tz || 'America/New_York')
      .startOf('day')
      .add(schedule.hour, 'hour')
      .add(schedule.minute, 'minute')
      ;

    const isGoTime = now.minute() === checkinTime.minute() && now.hour() === checkinTime.hour();

    debugTicToc(`Checkin time for ${config.id}`, checkinTime.format() + ' ' + JSON.stringify({
      schedule: schedule,
      isGoTime: isGoTime
    }));

    if (!isGoTime) {
      return;
    }

    startStatusConversation(config);
  });
}

function slackifyMessage(origMessage, wrapChar = '', attachments = [], overrides = {}) {
  const message = {
    /* eslint-disable camelcase */
    mrkdwn: overrides.mrkdown || true,
    link_names: overrides.link_names || true,
    parse: overrides.parse || 'none',
    text: `${wrapChar}${origMessage}${wrapChar}`,
    attachments: attachments
    /* eslint-enable camelcase */
  };

  if (process.env.SLACK_BOT_NAME) {
    message.username = process.env.SLACK_BOT_NAME;
  }

  if (process.env.SLACK_BOT_ICON_URL) {
    message.icon_url = process.env.SLACK_BOT_ICON_URL; // eslint-disable-line camelcase
  }

  return message;
}
