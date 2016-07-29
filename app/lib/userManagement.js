const store = {};
const cwd = require('cwd');
const _ = require('lodash');

module.exports = {
  init: init,
  getSlackUser: getSlackUser,
  getConfiguredUsers: getConfiguredUsers,
  getUserConfigs: getUserConfigs,
  getConfigs: getConfigs
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

  return require(configsFile);
}
