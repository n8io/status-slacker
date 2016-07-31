const cwd = require('cwd');
const color = require('tinycolor2');
const debug = require(cwd('app/lib/appDebug'))('app:lib:attachments-builder');

const messageBuilder = require(cwd('app/lib/messageBuilder'));

const attachmentsBuilder = () => {};

attachmentsBuilder.build = buildAttachments;

module.exports = attachmentsBuilder;

function buildAttachments(status) {
  const responses = buildQuestionsColorScheme(status.user, status.responses);

  return responses.map(response => buildAttachment(response));
}

function buildAttachment(response) {
  debug('buildAttachment', JSON.stringify({
    inputs: {
      response: response
    }
  }));

  const attachment = {
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

  return attachment;
}

function buildQuestionsColorScheme(user, responses) {
  const colorScheme = getColorScheme(user.color, responses);

  return responses.map((response, index) => {
    response.color = colorScheme[index];

    return response;
  });
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
