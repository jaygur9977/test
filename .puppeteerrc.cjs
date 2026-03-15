const {join} = require('path');

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
  // Ye Puppeteer ko batayega ki Chrome kahan install karna hai
  cacheDirectory: join(__dirname, '.cache', 'puppeteer'),
};