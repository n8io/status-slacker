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

module.exports = {
  slackifyMessage: slackifyMessage
};
