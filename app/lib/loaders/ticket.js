const url = require('url');
const cwd = require('cwd');
const debug = require(cwd('app/lib/appDebug'))('app:lib:loaders:ticket');
const ticketLoader = () => {};

ticketLoader.load = (msg, urlTmp = process.env.FALLBACK_ISSUE_BASE_URL) => {
  const urlObj = url.parse(urlTmp);
  const lDelim = '9a567ca4-05db-4754-8792-ff53a8c2cc54'; // guid for sake of randomness
  const rDelim = '1511484d-b642-45da-b3b1-4a96fe675943'; // guid for sake of randomness
  let output = `${msg}`; // eslint-disable-line

  urlObj.pathname = urlObj.pathname.replace(/\/+$/, '');

  const urlBase = urlObj.format();

  const ticketReg = /(^([A-Z][A-Z][A-Z]*-[1-9][\d]*)|[\s]([A-Z][A-Z][A-Z]*-[1-9][\d]*)+\s?)/gim;
  const matches = output.match(ticketReg) || [];

  const uniqueMatches = [];

  matches.forEach(m => {
    const trimmedKey = m.trim();

    if (uniqueMatches.indexOf(trimmedKey) !== -1) {
      return;
    }

    uniqueMatches.push(trimmedKey);
  });

  const pivotalTicketReg = /([\s]?[#][1-2][0-9]{7,})/gm;
  const ptMatches = output.match(pivotalTicketReg) || [];

  ptMatches.forEach(m => {
    const trimmedKey = m.replace(/[^0-9]+/gim, '');

    if (uniqueMatches.indexOf(trimmedKey) !== -1) {
      return;
    }

    uniqueMatches.push(trimmedKey);
  });

  uniqueMatches.sort((a, b) => b.length - a.length);

  debug(
    JSON.stringify({
      uniqueMatches: uniqueMatches
    })
  );

  uniqueMatches.forEach((key, i) => {
    while (output.indexOf(key) > -1) {
      output = output.replace(key, `${lDelim}${i}${rDelim}`);
    }
  });

  uniqueMatches.forEach((key, i) => {
    const trimmedKey = key.trim();
    const reg = new RegExp(`${lDelim}${i}${rDelim}`, 'ig');

    output = output.replace(reg, `<${urlBase}/${trimmedKey}|${key}>`);
  });

  debug(
    JSON.stringify({
      before: msg,
      after: output,
      matches: uniqueMatches
    })
  );

  return output;
};

module.exports = ticketLoader;
