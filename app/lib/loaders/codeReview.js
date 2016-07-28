const cwd = require('cwd');
const debug = require(cwd('app/lib/appDebug'))('app:lib:loaders:code-review');
const prLoader =  () => {};

prLoader.load = (msg) => {
  const lDelim = '7dc45087-a932-4383-8e8c-cc615e0a8eee'; // guid for sake of randomness
  const rDelim = '8cbb3797-5a97-4f8a-bd6d-7b17c2262e97'; // guid for sake of randomness
  const crReg = /[ ]?(https[:]\/\/(www\.)?github[.a-z0-9-]*.com\/[a-z-0-9]+\/[a-z-0-9]+\/compare\/[a-z-0-9.:?=&#]+)[ ]?/ig; // Finds all the https://github.ua.com/lib/ua-price-util/compare/next...nclark:TOP-2702
  const repoPlusNoReg = /https[:]\/\/(www\.)?github[.a-z0-9-]*.com\/([a-z-0-9]+\/[a-z-0-9]+)\/compare\/([a-z-0-9\.\:]+)/ig; // Breaks up the above into [ 'lib/ua-price-util', '432' ]
  const urlMatches = [];
  let output = `${msg}`;
  let crMatches;

  while ((crMatches = crReg.exec(output)) !== null) {
    debug(JSON.stringify({crMatches: crMatches}));

    if (crMatches.index === crReg.lastIndex) {
      crReg.lastIndex++;
    }

    if (crMatches && crMatches.length > 2) {
      urlMatches.push(crMatches[1]);
    }
  }

  urlMatches.sort((a, b) => b.length - a.length);

  debug(JSON.stringify({urlMatches: urlMatches}));

  urlMatches.forEach((url, i) => {
    while (output.indexOf(url) > -1) {
      output = output.replace(url, `${lDelim}${i}${rDelim}`);
    }
  });

  urlMatches.forEach((key, i) => {
    let codeReviewMatches;

    while ((codeReviewMatches = repoPlusNoReg.exec(key)) !== null) {
      if (codeReviewMatches.index === repoPlusNoReg.lastIndex) {
        repoPlusNoReg.lastIndex++;
      }

      const reg = new RegExp(`${lDelim}${i}${rDelim}`, 'ig');

      output = output.replace(reg, `${key}|:mag_right: CR ${codeReviewMatches[2]}:${codeReviewMatches[3]}`);
    }
  });

  debug(JSON.stringify({
    before: msg,
    after: output,
    matches: urlMatches
  }));

  return output;
};

module.exports = prLoader;
