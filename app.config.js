/** @type {import('expo/config').ConfigContext} */
module.exports = ({ config }) => ({
  ...config,
  extra: {
    ...config.extra,
    yvpAppKey: process.env.YVP_APP_KEY,
    pexelsApiKey: process.env.PEXELS_API_KEY,
  },
});
