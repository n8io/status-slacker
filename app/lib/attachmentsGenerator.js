const cwd = require('cwd');
const color = require('tinycolor2');
const chance = require('chance').Chance();
const debug = require(cwd('app/lib/appDebug'))('app:lib:attachments-generator');

const msgGen = require(cwd('app/lib/messageGenerator'));

const attachmentGenerator = () => {};

attachmentGenerator.gen = () => getAttachments();

module.exports = attachmentGenerator;

function getAttachments() {
  const usernames = getUsers().map(u => u.username);
  const username = chance.pickone(usernames);
  const questions = getQuestionsForUser(username);

  return questions.map(q => getAttachment(q));
}

function getAttachment(question) {
  const attachment = {
    /* eslint-disable camelcase */
    fallback: '',
    color: question.color,
    pretext: `_${question.text}_`,
    mrkdwn_in: [
      'pretext',
      'text'
    ],
    text: msgGen.gen()
    /* eslint-enable camelcase */
  };

  return attachment;
}

function getQuestionsForUser(username) {
  const user = getUserByUsername(username);

  const questions = require(cwd('data/questions.json'));

  const colorScheme = getColorScheme(user.color, questions.length);

  return questions.map(function(q, i) {
    return {
      text: q,
      color: colorScheme[i]
    };
  });
}

function getColorScheme(baseColor = process.env.ANSWER_FALLBACK_HEX_COLOR || color.random().toHexString(), questionCount) {
  const factor = parseInt(100 / (questionCount - 1), 10);
  const arr = [...Array(questionCount).keys()];

  const colorScheme = arr.map(i => {
    const desaturateBy = i * factor;

    if (!desaturateBy) { // First pass, take the base color
      return baseColor;
    }

    return color(baseColor)
      .desaturate(desaturateBy)
      .toHexString()
      ;
  });

  debug(JSON.stringify({
    baseColor: baseColor,
    factor: factor,
    arr: arr,
    colorScheme: colorScheme
  }));

  return colorScheme;
}

function getUserByUsername(username) {
  const users = getUsers();

  return users.filter(u => u.username === username)[0];
}

function getUsers() {
  return require(cwd('data/users.json'));
}
