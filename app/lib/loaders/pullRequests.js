const cwd = require('cwd');
const debug = require(cwd('app/lib/appDebug'))('app:lib:loaders:pull-request');
const prLoader =  () => {};

prLoader.load = (msg) => {
  const lDelim = '3cc45087-a932-4383-8e8c-cc615e0a8eee'; // guid for sake of randomness
  const rDelim = '2dbb3797-5a97-4f8a-bd6d-7b17c2262e97'; // guid for sake of randomness
  const prReg = /[ ]?(https[:]\/\/(www\.)?github[.a-z0-9-]*.com\/[a-z-0-9]+\/[a-z-0-9]+\/pull\/[0-9]+)[ ]?/ig; // Finds all the https://github.ua.com/lib/ua-price-util/pull/432
  const repoPlusNoReg = /https[:]\/\/(www\.)?github[.a-z0-9-]*.com\/([a-z-0-9]+\/[a-z-0-9]+)\/pull\/([0-9]+)/ig; // Breaks up the above into [ 'lib/ua-price-util', '432' ]
  const urlMatches = [];
  let output = `${msg}`;
  let prMatches;

  while ((prMatches = prReg.exec(output)) !== null) {
    debug(JSON.stringify({prMatches: prMatches}));

    if (prMatches.index === prReg.lastIndex) {
      prReg.lastIndex++;
    }

    if (prMatches && prMatches.length > 2) {
      urlMatches.push(prMatches[1]);
    }
  }

  urlMatches.sort((a, b) => b.length - a.length);

  debug(JSON.stringify({urlMatches: urlMatches}));

  urlMatches.forEach((url, i) => {
    const reg = regify(url);

    output = output.replace(reg, `${lDelim}${i}${rDelim}`);
  });

  urlMatches.forEach((key, i) => {
    let pullMatches;

    while ((pullMatches = repoPlusNoReg.exec(key)) !== null) {
      debug(JSON.stringify({pullMatches: pullMatches}));

      if (pullMatches.index === repoPlusNoReg.lastIndex) {
        repoPlusNoReg.lastIndex++;
      }

      const reg = new RegExp(`${lDelim}${i}${rDelim}`, 'ig');

      output = output.replace(reg, `${key}|PR #${pullMatches[3]} for ${pullMatches[2]}`);
    }
  });

  debug(JSON.stringify({
    before: msg,
    after: output,
    matches: urlMatches
  }));

  return output;

  function regify(str) {
    const output = str.replace(/\//ig, '\/');

    debug(JSON.stringify({output: output}));

    return new RegExp(output, 'ig');
  }
};

module.exports = prLoader;
