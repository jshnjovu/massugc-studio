module.exports = {
  plugins: [
    // Enable default optimizations
    'preset-default',
    
    // Custom optimizations for better web performance
    {
      name: 'removeViewBox',
      active: false // Keep viewBox for responsive scaling
    },
    {
      name: 'removeDimensions',
      active: false // Keep width/height for proper sizing
    },
    {
      name: 'cleanupIds',
      params: {
        minify: true,
        preserve: ['warmGradient'] // Preserve our custom gradient IDs
      }
    },
    {
      name: 'removeUselessStrokeAndFill',
      active: true
    },
    {
      name: 'removeUnknownsAndDefaults',
      active: true
    },
    {
      name: 'collapseGroups',
      active: true
    },
    {
      name: 'convertStyleToAttrs',
      active: true
    },
    {
      name: 'convertColors',
      params: {
        currentColor: true
      }
    }
  ]
};
