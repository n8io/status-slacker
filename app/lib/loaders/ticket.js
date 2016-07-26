const cwd = require('cwd');
const debug = require(cwd('app/lib/appDebug'))('app:lib:loaders:ticket');
const ticketLoader =  () => {};

ticketLoader.load = (msg, urlBase = process.env.ISSUE_BASE_URL) => {
  const lDelim = '9a567ca4-05db-4754-8792-ff53a8c2cc54'; // guid for sake of randomness
  const rDelim = '1511484d-b642-45da-b3b1-4a96fe675943'; // guid for sake of randomness
  let output = `${msg}`; // eslint-disable-line

  const ticketReg = /([A-Z][A-Z][A-Z]*-[1-9][\d]*)+/ig;
  const matches = output.match(ticketReg) || [];

  const uniqueMatches = [];

  matches.forEach(m => {
    if (uniqueMatches.indexOf(m) !== -1) {
      return;
    }

    uniqueMatches.push(m);
  });

  uniqueMatches.sort((a, b) => b.length - a.length);

  debug(JSON.stringify({
    uniqueMatches: uniqueMatches
  }, null, 2));

  uniqueMatches.forEach((key, i) => {
    const reg = new RegExp(key, 'ig');

    output = output.replace(reg, `${lDelim}${i}${rDelim}`);
  });

  uniqueMatches.forEach((key, i) => {
    const reg = new RegExp(`${lDelim}${i}${rDelim}`, 'ig');

    output = output.replace(reg, `<${urlBase}${key}|${key}>`);
  });

  debug(JSON.stringify({
    before: msg,
    after: output,
    matches: uniqueMatches
  }));

  return output;
};

module.exports = ticketLoader;
