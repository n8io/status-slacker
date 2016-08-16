const cwd = require('cwd');
const color = require('tinycolor2');
const debug = require(cwd('app/lib/appDebug'))('app:lib:attachments-builder');

const messageBuilder = require(cwd('app/lib/messageBuilder'));

const attachmentsBuilder = () => {};

attachmentsBuilder.build = build;

module.exports = attachmentsBuilder;

function build(statusSummary) {
  const responses = buildQuestionsColorScheme(statusSummary.user, statusSummary.responses);
  const attachments = responses.filter(response => !isEmptyResponse(response.answer)).map(response => buildAttachment(response)); // eslint-disable-line prefer-const
  const nonResponses = responses.filter(response => isEmptyResponse(response.answer)).map(response => response);
  const output = [];

  attachments.forEach(a => output.push(a));

  const nonResponseMessage = buildNonResponseMessage(nonResponses);

  if (nonResponseMessage) {
    output.push(nonResponseMessage);
  }

  return {
    attachments: output,
    nonResponseSummary: buildNonResponseMessage(nonResponses)
  };
}

function buildNonResponseMessage(nonResponses) {
  const input = [];

  nonResponses.forEach(nr => input.push(nr));

  if (!input.length) {
    return null;
  }

  return {
    /* eslint-disable camelcase */
    fallback: '',
    color: '#FFFFFF',
    mrkdwn_in: [
      'text'
    ],
    text: `_...with no update provided for ${input.length} other question(s)_`
    /* eslint-enable camelcase */
  };
}

function buildAttachment(response) {
  return {
    /* eslint-disable camelcase */
    fallback: '',
    color: response.color,
    pretext: response.question,
    mrkdwn_in: [
      'pretext',
      'text'
    ],
    text: messageBuilder.build(response.answer)
    /* eslint-enable camelcase */
  };
}

function buildQuestionsColorScheme(user, responses) {
  const colorScheme = getColorScheme(user.color, responses);

  return responses.map((response, index) => {
    response.color = colorScheme[index];

    return response;
  });
}

function isEmptyResponse(text) {
  let temp = (text || '').trim();

  if (temp.split(' ').length > 1) {
    return false;
  }

  temp = temp.toLowerCase();

  switch (temp) {
    case 'no':
    case 'nope':
    case 'none':
    case 'nothing':
    case 'nada':
    case 'na':
    case 'nah':
    case '.':
    case '..':
    case '...':
    case '-':
    case '--':
      return true;
    default:
      //
  }

  return false;
}

function getColorScheme(baseColor = process.env.FALLBACK_ANSWER_HEX_COLOR || color.random().toHexString(), responses) {
  let responsesLen = 0;

  responses.forEach(() => responsesLen++); // No idea why I can't just use Array.length here

  const factor = parseInt(100.00 / (responsesLen - 1.00), 10);
  const arr = [...Array(responsesLen).keys()];

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

  return colorScheme;
}
