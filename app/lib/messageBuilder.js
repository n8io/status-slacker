const cwd = require('cwd');
const debug = require(cwd('app/lib/appDebug'))('app:lib:message-builder');
const loaders = [
  require(cwd('app/lib/loaders/ticket')),
  require(cwd('app/lib/loaders/codeReview')),
  require(cwd('app/lib/loaders/pullRequest')),
  require(cwd('app/lib/loaders/trimStart'))
];

const messageBuilder = () => {};

messageBuilder.build = buildWorkItem;

module.exports = messageBuilder;

function buildWorkItem(message) {
  debug(JSON.stringify({
    inputs: {
      message: message
    }
  }));

  let output = `${message}`;

  loaders.forEach(ldr => output = ldr.load(output));

  return output;
}
