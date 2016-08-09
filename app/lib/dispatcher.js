const cwd = require('cwd');
const _ = require('lodash');
const moment = require('moment-timezone');
const Bluebird = require('bluebird');
const request = require('request');
const Botkit = require('botkit'); // Used for slack conversation mgmt
const SlackBot = require('slackbots'); // Simple one way slack communications

const slackifier = require(cwd('app/lib/slackifier'));
const userMgmt = require(cwd('app/lib/userManagement'));
const COMMANDS = require(cwd('app/lib/botCommands'));
const MESSAGES = require(cwd('app/lib/botMessages'));
const TIC_INTERVAL = 60 * 1000; // once a minute
const attachmentsBuilder = require(cwd('app/lib/attachmentsBuilder'));

const debugDefaultPath = cwd('app/lib/appDebug');
const debugDispatcher = require(debugDefaultPath)('dispatcher');
const debugStopMessage = require(debugDefaultPath)('dispatcher:send:stopped-message');
const debugSendSnippet = require(debugDefaultPath)('dispatcher:send:snippet');
const debugQuestionsMessages = require(debugDefaultPath)('dispatcher:send:questions-message');
const debugStatusSummary = require(debugDefaultPath)('dispatcher:send:status-summary');
const debugUserSettings = require(debugDefaultPath)('dispatcher:send:user-settings');
const debugReceiveResponse = require(debugDefaultPath)('dispatcher:receive:response');
const debugTicToc = require(debugDefaultPath)('dispatcher:tic');
const debugSimpleSend = require(debugDefaultPath)('dispatcher:send:simple-message');

let smartBot = null;
let dumbBot = null;
let ticTock = null;

function init() {
  smartBot = Botkit.slackbot();
  dumbBot = new SlackBot({
    token: process.env.SLACK_BOT_TOKEN,
    name: process.env.SLACK_BOT_NAME
  });

  const onSmartBotStart = new Bluebird((resolve, reject) => {
    smartBot
      .spawn({
        token: process.env.SLACK_BOT_TOKEN
      })
      .startRTM((err, bot, payload) => {
        if (err) {
          return reject(err);
        }

        const team = payload.team;
        const users = payload.users.filter(u => !u.deleted && !!u.profile);

        userMgmt.init(team, users);

        return resolve();
      })
      ;
  });

  const onSmartBotSocketOpen = new Bluebird(resolve => {
    smartBot.on('rtm_open', bot => resolve(bot));
  });

  const onDumbBotStart = new Bluebird(resolve => {
    dumbBot.on('start', () => resolve());
  });

  return Bluebird
    .all([onSmartBotStart, onSmartBotSocketOpen, onDumbBotStart])
    .then(() => {
      registerSmartBotListeners();

      return new Bluebird(resolve => {
        ticTock = setTimeout(() => {
          startTicking();
          resolve();
        }, 1000);
      });
    })
    .error(() => {
      console.log(debugDispatcher.c.red('Error'));
    })
    ;
}

function registerSmartBotListeners() {
  smartBot.hears([regWrapCmd(COMMANDS.start.text)], ['direct_message'], (bot, userMsg) => {
    const configs = userMgmt.getUserConfigs(userMsg.user);

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
            pattern: regWrapCmd(index + 1),
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
          const questions = buildQuestions(configs[selectedConfigIndex], userMsg.user, bot);

          bot.startConversation(userMsg, questions[0]);
        });
      });
    }
    else {
      const questions = buildQuestions(configs[0], userMsg.user, bot);

      bot.startConversation(userMsg, questions[0]);
    }
  });

  smartBot.hears([regWrapCmd(COMMANDS.help.text)], ['direct_message'], (bot, userMsg) => {
    sendHelpMessage(userMsg.user);
  });

  smartBot.hears([regWrapCmd(COMMANDS.questions.text)], ['direct_message'], (bot, userMsg) => {
    const configs = userMgmt.getUserConfigs(userMsg.user);

    if (configs.length > 1) {
      const leadMsg = `Which team? Please enter a number [1-${configs.length}]`;
      const configMsg = configs.map((config, index) => `${index + 1}) ${config.id}`).join('\n>');
      let selectedConfigIndex = -1; // eslint-disable-line no-unused-vars

      bot.startConversation(userMsg, (err, convo) => {
        const choices = configs.map((config, index) => { // eslint-disable-line arrow-body-style
          return {
            pattern: regWrapCmd(index + 1),
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

  smartBot.hears([regWrapCmd(COMMANDS.usage.text)], ['direct_message'], (bot, userMsg) => {
    sendUsageMessage(userMsg.user);
  });

  smartBot.hears([regWrapCmd(COMMANDS.config.text)], ['direct_message'], (bot, userMsg) => {
    const configs = userMgmt.getUserConfigs(userMsg.user);

    if (!configs.length) {
      // User is not in any config, requires setup
      sendSignUpMessage(userMsg.user);

      return;
    }

    const user = userMgmt.getSlackUser(userMsg.user);
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
            pattern: regWrapCmd(index + 1),
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

  smartBot.hears([regWrapCmd(COMMANDS.me.text)], ['direct_message'], (bot, userMsg) => {
    sendUserSettings(userMsg.user);
  });
}

function startStatusConversation(config) {
  if (!config || !config.members || !config.members.length) {
    return; // No configured users, nothing to do
  }

  config
    .members
    .filter(member => !member.disableReminderMessage)
    .forEach(member => sendStatusIntroMessage(member.username, config));
}

function regWrapCmd(cmd) {
  return new RegExp(`^${cmd}$`, 'ig');
}

function startTicking(interval) {
  clearInterval(ticTock);

  if (interval) {
    ticTock = setInterval(processNowForCheckins, TIC_INTERVAL);
  }
  else {
    // First run
    const startInSeconds = 60 - moment().second() + 1; // Start 1 sec into the top of the minute

    debugTicToc(debugTicToc.c.cyan(`Schedule processing will start at the top of the minute (${startInSeconds}sec)`));

    setTimeout(() => {
      debugTicToc(debugTicToc.c.cyan('Schedule processing started'));
      processNowForCheckins();
      startTicking(TIC_INTERVAL);
    }, process.env.FORCE_START ? 0 : startInSeconds * 1000);
  }
}

function processNowForCheckins() {
  const now = moment().tz('America/New_York');

  // debugTicToc(`Server time ${now.format()}`);

  userMgmt.getConfigs().forEach(config => {
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

    const todaysDoNotDisturbDate = userMgmt.getTodaysDoNotDisturbDate(config);
    const isGoTime = now.minute() === checkinTime.minute() && now.hour() === checkinTime.hour() && !todaysDoNotDisturbDate;

    if (todaysDoNotDisturbDate) {
      debugTicToc(debugTicToc.c.yellow(`Today is ${todaysDoNotDisturbDate.name}. No status messages today for ${config.id}.`));

      return;
    }

    debugTicToc(`Checkin time for ${config.id} ${checkinTime.format()}`, JSON.stringify({
      schedule: schedule,
      isGoTime: isGoTime
    }));

    if (!isGoTime) {
      return;
    }

    startStatusConversation(config);
  });
}

function buildQuestions(config, username, bot) {
  const questions = config.questions.map((question, questionIndex) => (response, convo) => {
    wireUpConvoEndHandler(username, convo, config);

    debugReceiveResponse(JSON.stringify(response));

    convo.ask(slackifier.slackifyMessage(question, '_'), (response, convo) => {
      switch (response.text) {
        case COMMANDS.start.text:
          convo.isRestarted = true;
          convo.stop();
          convo.next();
          bot.startConversation(response, questions[0]);
          return;
        case COMMANDS.back.text:
          if (questionIndex - 1 < 0) {
            questions[0](response, convo);
          }
          else {
            questions[questionIndex - 1](response, convo);
          }
          break;
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

function wireUpConvoEndHandler(username, convo, config) {
  if (convo.hasWiredUpConvoEndHandler) {
    return;
  }

  convo.hasWiredUpConvoEndHandler = true;

  convo.on('end', convo => {
    switch (convo.status) {
      case 'completed':
        const users = userMgmt.getConfiguredUsers(username, config.id);
        const responses = _(convo.responses).keys().map(key => { // eslint-disable-line
          return {
            question: key,
            answer: convo.responses[key].text
          };
        });

        const statusSummary = {
          id: username,
          user: users[0],
          responses: responses
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
        if (convo.isRestarted) {
          sendRestartMessage(username);
        }
        else {
          sendStoppedMessage(username);
        }
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
  msgs.push('>    Waiting for <https://github.com/doc/flux-capacitor/compare/master...marty:hoverboard|:mag_right: CR doc/flux-capacitor:master...marty:delorean> to get merged');

  sendSimpleMessage(username, msgs.join('\n'));
}

function sendStoppedMessage(username) {
  debugStopMessage(JSON.stringify(username));
  sendSimpleMessage(username, MESSAGES.stop);
}

function sendRestartMessage(username) {
  debugStopMessage(JSON.stringify(username));
  sendSimpleMessage(username, MESSAGES.restart);
}

function sendQuestionsMessages(username, configId) {
  const configs = userMgmt.getUserConfigs(username, configId);

  if (!configs || !configs.length) {
    sendSignUpMessage(username);

    return;
  }

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
  const message = slackifier.slackifyMessage(
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
  const redactedConfig = userMgmt.redactConfig(config);

  sendSnippet(username, title, JSON.stringify(redactedConfig, null, 2), 'javascript');
}

function sendUserSettings(username) {
  const user = userMgmt.getSlackUser(username);
  const configs = userMgmt.getUserConfigs(username);

  if (!configs || !configs.length) {
    sendSignUpMessage(username);

    return;
  }

  const settingsIntro = `${MESSAGES.settingsIntro}`;

  const attachments = configs.map(config => {
    const member = config.members.find(m => m.username === user.name);

    return buildUserSettingsAttacment(config, member);
  });

  const message = slackifier.slackifyMessage(settingsIntro, '', attachments);

  debugUserSettings(JSON.stringify(message));

  dumbBot.postMessageToUser(user.name, '', message);

  function buildUserSettingsAttacment(config, member) {
    let msg = _.keys(member)
      .filter(key => key !== 'username')
      .map(key => `${key}: ${member[key]}`)
      .join('\n') || `color: ${process.env.ANSWER_FALLBACK_HEX_COLOR} (default)`
      ;

    if ((config.admins || []).find(a => a.username === member.username)) {
      msg = `isAdmin: true\n${msg}`;
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

function sendSnippet(username, title, content, filetype) {
  const data = {
    token: process.env.SLACK_BOT_TOKEN,
    title: title,
    content: content,
    filename: title,
    filetype: filetype,
    channels: `@${username}`,
    username: 'Status Bot',
    icon_url: 'http://loadion.com/ii/69999096_00d791ea82.gif' // eslint-disable-line
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

function sendStatusIntroMessage(username, config) {
  const user = userMgmt.getSlackUser(username);
  const introMessage = slackifier.slackifyMessage(MESSAGES.start
    .replace(/\$\{user\.profile\.first_name\}/ig, `${user.profile.first_name}`)
    .replace(/\$\{configId\}/ig, `${config.id}`)
    .replace(/\$\{COMMANDS\.start\.text\}/ig, `${COMMANDS.start.text}`)
  );

  dumbBot.postMessageToUser(username, '', introMessage);
}

function sendSimpleMessage(username, msg) {
  const user = userMgmt.getSlackUser(username);

  const message = slackifier.slackifyMessage(msg);

  debugSimpleSend(JSON.stringify(message));

  dumbBot.postMessageToUser(user.name, '', message);
}

module.exports = {
  init: init
};
