const fs = require('fs');
const json2yaml = require('json2yaml');
const cwd = require('cwd');
const chalk = require('chalk');

const DOCKER_INPUT_FILE = cwd('docker/docker-compose.json');
const DOCKER_OUTPUT_FILE = cwd('docker-compose.yaml');
const NVMRC_OUTPUT_FILE = cwd('.nvmrc');

const pkg = require(cwd('package.json'));
const dockerObj = require(DOCKER_INPUT_FILE);

fs.writeFileSync(DOCKER_OUTPUT_FILE, json2yaml.stringify(dockerObj));
fs.writeFileSync(NVMRC_OUTPUT_FILE, pkg.engines.node);

console.log(chalk.green('Successfully built files.'));
