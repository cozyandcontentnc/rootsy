// metro.config.js (project root)
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// keep your existing block list
const FUNCTIONS_RE = /(^|[\/\\])functions([\/\\].*)?$/;
config.resolver.blockList = FUNCTIONS_RE;
config.resolver.blacklistRE = config.resolver.blacklistRE || FUNCTIONS_RE;

// ✅ allow .csv to be bundled as an asset
const { assetExts } = config.resolver;
config.resolver.assetExts = [...assetExts, 'csv'];

module.exports = config;
