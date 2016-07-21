function readDir() {}

readDir.getRequires = (dir, prioritized = []) => {
  const fs = require('fs');
  const cwd = require('cwd');
  const routes = prioritized.concat();

  fs.readdirSync(dir).forEach(file => {
    if (file.toLowerCase() === 'index.js') {
      return; // We don't want to require index.js's
    }

    const filePath = cwd(dir, file.split('.js').join(''));

    // If route isn't in the list already, lets add it to the list
    if (routes.indexOf(filePath) === -1) {
      routes.push(filePath);
    }
  });

  return routes;
};

module.exports = readDir;
