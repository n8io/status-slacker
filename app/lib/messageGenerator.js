const cwd = require('cwd');
const loaders = [
  require(cwd('app/lib/loaders/ticket'))
];
const chance = require('chance').Chance();

const messageGenerator = () => {};

messageGenerator.gen = () => chance.n(getWorkItem, chance.weighted([1, 2, 3, 4, 5, 6], [10, 50, 100, 30, 30, 10])).join('\n');

module.exports = messageGenerator;

function getWorkItem() {
  const ticketNo = `${getTicketCategory()}-${get4Digit()}`;
  const ticketMessage = `${ticketNo} ${chance.n(chance.sentence, 1, {words: chance.integer({min: 4, max: 20})})}`;
  const multilineMessage = getMultilineMessage();

  const message = chance.weighted([ticketMessage, multilineMessage], [100, 5]);
  let output = `${message}`;

  loaders.forEach(ldr => output = ldr.load(output));

  return output;
}

function getTicketCategory() {
  const ticketCategories = ['TOP', 'POST', 'ENG', 'TECH'];

  return chance.pickone(ticketCategories).toUpperCase();
}

function get4Digit() {
  return chance.integer({min: 0, max: 9999});
}

function getMultilineMessage() {
  const msgs = [
    chance.n(chance.sentence, 1, {words: chance.integer({min: 4, max: 20})})
  ];
  let lineCount = chance.integer({min: 2, max: 5});

  while (lineCount--) {
    msgs.push(chance.n(chance.sentence, 1, {words: chance.integer({min: 4, max: 20})}));
  }

  return msgs.join('\n- ');
}
