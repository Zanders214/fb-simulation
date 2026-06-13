module.exports = function (api) {
  api.cache(true);
  return {
    // unstable_transformImportMeta rewrites `import.meta` so the web bundle runs
    // as a classic browser script (it otherwise throws "Cannot use 'import.meta'
    // outside a module"). Harmless on native (Hermes).
    presets: [['babel-preset-expo', { unstable_transformImportMeta: true }]],
  };
};
