const Bluebird = require('bluebird');
const cwd = require('cwd');
const _ = require('lodash');
const moment = require('moment-timezone');
const Botkit = require('botkit'); // Used for slack conversation mgmt
const SlackBot = require('slackbots'); // Simple one way slack communications
const smartBot = Botkit.slackbot();
const debug = require(cwd('app/lib/appDebug'))('botkit');
const attachmentsBuilder = require(cwd('app/lib/attachmentsBuilder'));

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
    info: 'Lists out the set of questions that will be asked'
  },
  usage: {
    text: `${CMD_PREFIX}usage`,
    info: 'Provides a few usage examples'
  },
  config: {
    text: `${CMD_PREFIX}config`,
    info: 'Starts the config dialogue.'
  },
  help: {
    text: `${CMD_PREFIX}help`,
    info: 'Presents this help text.'
  }
};
const MESSAGES = {
  start: 'Hey there ${user.profile.first_name}, I need your status. Type \`${COMMANDS.start.text}\` to get started.', // This is a string and not a template on purpose
  stop: `Status update stopped. Type \`${COMMANDS.start.text}\` to start over.`,
  confirmation: 'Thanks, we\'re all set :thumbsup:. View the #${user.channel} channel to see your summary.', // This is a string and not a template on purpose
  timeout: `I feel neglected, plus you took too long. Type \`${COMMANDS.start.text}\` to start over.`,
  statusTitle: '*Status summary for ${statusSummary.user.profile.real_name}* @${statusSummary.user.name}', // This is a string and not a template on purpose
  signUp: `Your team is not currently configured with *${process.env.SLACK_BOT_NAME}*. Send a request to your team lead to get setup.`
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
  const config = getConfig(userMsg.user);

  if (!config) {
    // User is not in any config, requires setup
    sendSignUpMessage(userMsg.user);

    return;
  }

  const questions = config.questions.map((question, questionIndex) => (response, convo) => {
    if (questionIndex === 0) { // Only wire up the end event once
      wireUpConvoEndHandler(userMsg.user, convo);
    }

    const responseDebug = require(cwd('app/lib/appDebug'))('receive:response');

    responseDebug(JSON.stringify(response));

    convo.ask(slackifyMessage(question, '_'), (response, convo) => {
      switch (response.text) {
        case COMMANDS.start.text:
        case COMMANDS.stop.text:
          convo.stop();
          break;
        case COMMANDS.help.text:
          sendHelpMessage(userMsg.user);
          convo.repeat();
          break;
        case COMMANDS.questions.text:
          sendQuestionsMessage(userMsg.user);
          convo.repeat();
          break;
        case COMMANDS.usage.text:
          sendUsageMessage(userMsg.user);
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

  bot.startConversation(userMsg, questions[0]);
});

smartBot.hears([COMMANDS.help.text], ['direct_message'], (bot, userMsg) => {
  sendHelpMessage(userMsg.user);
});

smartBot.hears([COMMANDS.questions.text], ['direct_message'], (bot, userMsg) => {
  sendQuestionsMessage(userMsg.user);
});

smartBot.hears([COMMANDS.usage.text], ['direct_message'], (bot, userMsg) => {
  sendUsageMessage(userMsg.user);
});

smartBot.hears([COMMANDS.config.text], ['direct_message'], (bot, userMsg) => {
  const config = getConfig(userMsg.user);

  if (!config) {
    // User is not in any config, requires setup
    sendSignUpMessage(userMsg.user);

    return;
  }

  const user = getUser(userMsg.user);

  if (!(config.admins || []).find(a => a.username === user.name)) {
    sendSimpleMessage(userMsg.user, 'Sorry, only admins can view configuration.');

    return;
  }

  sendSimpleMessage(user.name, `\`\`\`${JSON.stringify(config, null, 2)}\`\`\``);
});

function startStatusConversation(username) {
  const user = getFullUser(username);

  if (!user) {
    return;
  }

  const introMessage = slackifyMessage(MESSAGES.start
    .replace(/\$\{user\.profile\.first_name\}/ig, `${user.profile.first_name}`)
    .replace(/\$\{COMMANDS\.start\.text\}/ig, `${COMMANDS.start.text}`));

  dumbBot.postMessageToUser(username, '', introMessage);
}

function getUser(name) {
  return store.users && store.users.find(u => u.name === name || u.id === name);
}

function getFullUser(name) {
  const user = getUser(name);
  const config = getConfig(user.name);
  const configUser = config && config.members.find(m => m.username === user.name);

  if (configUser) {
    user.channel = config.channel;
    user.color = configUser.color;
  }

  return user;
}

function getConfig(username) {
  const user = getUser(username);

  return getConfigs().find(sc => !!sc.members.find(m => m.username === user.name));
}

function getConfigs() {
  const configsFile = cwd('data/configs.json');

  delete require.cache[configsFile]; // Kill it in cache so we pickup changes made since this process started

  return require(configsFile);
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
  msgs.push('>    Waiting for <https://github.com/doc/flux-capacitor/pull/4|PR #4 for doc/flux-capacitor>');

  sendSimpleMessage(username, msgs.join('\n'));
}

function sendStoppedMessage(username) {
  const stopMessageDebug = require(cwd('app/lib/appDebug'))('send:stopped-message');

  stopMessageDebug(JSON.stringify(username));
  sendSimpleMessage(username, MESSAGES.stop);
}

function sendQuestionsMessage(username) {
  const questionsMessageDebug = require(cwd('app/lib/appDebug'))('send:questions-message');
  const config = getConfig(username);

  if (!config) {
    // User is not setup, send signUp msg instead
    sendSignUpMessage(username);

    return;
  }

  const questionsMessages = config.questions.map((question, index) => `\n>${index + 1}) _${question}_`).join('');
  const message = `Here are the questions you will be asked:${questionsMessages}`;

  questionsMessageDebug(JSON.stringify({
    username: username,
    questionMessage: message
  }));

  sendSimpleMessage(username, message);
}

function sendStatusSummary(statusSummary, userId) {
  const message = slackifyMessage(
    MESSAGES.statusTitle
      .replace(/\$\{statusSummary\.user\.profile\.real_name\}/ig, `${statusSummary.user.profile.real_name}`)
      .replace(/\$\{statusSummary\.user\.name\}/ig, `${statusSummary.user.name}`),
    '',
    attachmentsBuilder.build(statusSummary)
  );

  const statusSummaryDebug = require(cwd('app/lib/appDebug'))('send:statusSummary');

  statusSummaryDebug(JSON.stringify(statusSummary));

  if (userId) {
    dumbBot.postMessageToUser(userId, message);
  }
  else {
    dumbBot.postMessageToChannel(statusSummary.user.channel, '', message);
  }
}

function sendSignUpMessage(username) {
  sendSimpleMessage(username, MESSAGES.signUp);
}

function sendSimpleMessage(username, msg) {
  const user = getFullUser(username);

  const message = slackifyMessage(msg);

  debug(debug.c.cyan(JSON.stringify(message)));

  dumbBot.postMessageToUser(user.name, '', message);
}

function wireUpConvoEndHandler(username, convo) {
  convo.on('end', convo => {
    switch (convo.status) {
      case 'completed':
        const user = getFullUser(username);
        const statusSummary = {
          id: username,
          user: user,
          responses: _(convo.responses).keys().map(key => { // eslint-disable-line
            return {
              question: key,
              answer: convo.responses[key].text
            };
          })
        };

        sendStatusSummary(statusSummary);
        sendSimpleMessage(username, MESSAGES.confirmation.replace(/\$\{user\.channel\}/ig, `${user.channel}`));
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

    debug(`Checkin time for ${config.id}`, checkinTime.format());

    if (now.minute() !== checkinTime.minute() || now.hour() !== checkinTime.hour()) {
      return; // Not this minute and/or hour;
    }

    config.members.forEach(member => startStatusConversation(member.username)); // DM each team member
  });
}

function slackifyMessage(origMessage, wrapChar = '', attachments = []) {
  const message = {
    /* eslint-disable camelcase */
    mrkdwn: true,
    link_names: true,
    parse: 'none',
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
