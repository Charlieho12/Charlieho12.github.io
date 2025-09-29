const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  timeout: 30000,
  use: {
    browserName: 'chromium',
    headless: true,
  },
  projects: [
    {
      name: 'Chromium',
      use: { browserName: 'chromium' },
    },
    {
      name: 'Firefox',
      use: { browserName: 'firefox' },
    },
    {
      name: 'WebKit',
      use: { browserName: 'webkit' },
    },
  ],
});