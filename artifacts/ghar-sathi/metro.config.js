const { getDefaultConfig } = require('expo/metro-config');
const { spawnSync } = require('node:child_process');

const config = getDefaultConfig(__dirname);
const watchmanCheck = spawnSync('watchman', ['--version'], { stdio: 'ignore' });
config.resolver.useWatchman = watchmanCheck.status === 0;

module.exports = config;
