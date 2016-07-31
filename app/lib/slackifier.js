function slackifyMessage(origMessage, wrapChar = '', attachments = [], overrides = {}) {
  const iconUrl = overrides.icon_url || process.env.SLACK_BOT_ICON_URL || null; // eslint-disable-line camelcase
  const username = process.env.SLACK_BOT_NAME;

  const message = {
    /* eslint-disable camelcase */
    mrkdwn: overrides.mrkdown || true,
    link_names: overrides.link_names || true,
    parse: overrides.parse || 'none',
    text: `${wrapChar}${origMessage}${wrapChar}`,
    attachments: attachments
    /* eslint-enable camelcase */
  };

  if (username) {
    message.username = username;
  }

  if (iconUrl) {
    message.icon_url = iconUrl; // eslint-disable-line camelcase
  }

  return message;
}

module.exports = {
  slackifyMessage: slackifyMessage
};
