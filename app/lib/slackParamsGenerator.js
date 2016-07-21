const cwd = require('cwd');
const chance = require('chance').Chance();
const attachmentsGenerator = require(cwd('app/lib/attachmentsGenerator'));

const slackParamsGenerator = () => {};

slackParamsGenerator.gen = () => getParams();

module.exports = slackParamsGenerator;

function getParams() {
  const person = getPerson();
  const params = {
    /* eslint-disable camelcase */
    mrkdwn: true,
    link_names: true,
    parse: 'none',
    text: `*Status summary for ${person.display}*`,
    attachments: attachmentsGenerator.gen()
    /* eslint-enable camelcase */
  };

  if (process.env.SLACK_BOT_ICON_URL) {
    params['icon_url'] = process.env.SLACK_BOT_ICON_URL;
  }

  return params;
}

function getPerson() {
  const fName = chance.first();
  const lName = chance.last();

  return {
    display: `${fName} ${lName}`,
    username: `${fName}.${lName}`.toLowerCase()
  };
}
