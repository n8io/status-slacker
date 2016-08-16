const store = {};
const cwd = require('cwd');
const _ = require('lodash');
const moment = require('moment-timezone');

module.exports = {
  init: init,
  getSlackUser: getSlackUser,
  getConfiguredUsers: getConfiguredUsers,
  getUserConfigs: getUserConfigs,
  getConfigs: getConfigs,
  redactConfig: redactConfig,
  getTodaysDoNotDisturbDate: getTodaysDoNotDisturbDate
};

function init(team, users) {
  store.team = team;
  store.users = users;
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

  delete require.cache[require.resolve(configsFile)]; // Kill it in cache so we pickup changes made since this process started

  return require(configsFile)
    .map(config => {
      config._doNotDisturbDates = mergeDoNotDisturbDates(config.doNotDisturbDates, config.doNotDisturbOverrideDates);
      config.isADoNotDisturbDay = getTodaysDoNotDisturbDate(config) || false;

      config._questions = config.questions;
      config.questions = normalizeQuestions(config.questions, config.schedules);

      return config;
    });
}

function normalizeQuestions(questions, schedules) {
  const mergedQuestions = [].concat(questions.map(question => {
    let q = {
      key: (new Date()).getTime().toString(),
      text: ''
    };

    if (_.isObject(question)) {
      q = _.pick(question, [
        'key',
        'text'
      ]);
    }
    else if (_.isString(question)) {
      q.key = _.kebabCase(question);
      q.text = question;
    }

    return q;
  }));

  const day = (new Date()).getDay();

  return mergedQuestions.map(question => {
    const scheduleIndex = _.findLastIndex(schedules, schedule => schedule.day === day);

    if (scheduleIndex === -1) {
      return question;
    }

    const schedule = schedules[scheduleIndex];

    if (!schedule.questions) {
      return question;
    }

    const overrideQuestion = _.find(schedule.questions, {key: question.key});

    if (overrideQuestion) {
      question.text = overrideQuestion.text;
    }

    return question;
  });
}

function redactConfig(config) {
  const cfg = Object.assign({}, config);

  cfg.questions = cfg._questions;

  return Object.assign({}, _.omit(cfg, [
    'isADoNotDisturbDay',
    '_doNotDisturbDates',
    '_questions'
  ]));
}

function getGlobalDoNotDisturbDates() {
  const holidaysFile = cwd('data/holidays.json');

  delete require.cache[require.resolve(holidaysFile)]; // Kill it in cache so we pickup changes made since this process started

  return normalizeDoNotDisturbDates(require(holidaysFile));
}

function normalizeDoNotDisturbDates(doNotDisturbDates) {
  return (doNotDisturbDates || [])
    .filter(dnd => moment(dnd.date).isValid(dnd))
    .map(dnd => {
      const dndDate = moment(dnd.date);

      if (!dndDate.isValid()) {
        dnd.date = moment('1900-01-01T00:00:00Z').utc().format(); // Set to a past date
      }
      else {
        dnd.date = dndDate.utc().startOf('day').format();
      }

      return dnd;
    });
}

function mergeDoNotDisturbDates(doNotDisturbDates, overrides) {
  const normalizedPrimeDoNotDisturbDates = normalizeDoNotDisturbDates(doNotDisturbDates);
  const normalizedOverrides = normalizeDoNotDisturbDates(overrides);
  const globalDoNotDisturbDates = getGlobalDoNotDisturbDates() || [];
  const concattedDoNotDisturbDates = globalDoNotDisturbDates.concat(normalizedPrimeDoNotDisturbDates);

  if (!concattedDoNotDisturbDates.length) {
    return [];
  }

  const concattedMap = _.groupBy(concattedDoNotDisturbDates, 'date');
  const mergedDoNotDisturbDates = _.keys(concattedMap)
    .map(key => concattedMap[key][concattedMap[key].length - 1])
    ;

  const overrideMap = _.groupBy(normalizedOverrides);

  return _.chain(mergedDoNotDisturbDates)
    .filter(dnd => !overrideMap[dnd.date]) // Filter out those dates that we want to treat as a normal day
    .sortBy(mergedDoNotDisturbDates, 'date')
    .value()
    ;
}

function getTodaysDoNotDisturbDate(config) {
  const key = moment().utc().startOf('day').format();

  return (config._doNotDisturbDates || []).find(dnd => dnd.date === key);
}
