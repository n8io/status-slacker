const cwd = require('cwd');
const debug = require(cwd('app/lib/appDebug'))('app:lib:loaders:trim-start');
const trimStartLoader =  () => {};

trimStartLoader.load = (msg) => {
  let output = `${msg}`; // eslint-disable-line

  const leadingCharReg = /^([ -]+)/igm;

  output = output.replace(leadingCharReg, '');

  debug(JSON.stringify({
    before: msg,
    after: output
  }));

  return output;
};

module.exports = trimStartLoader;
