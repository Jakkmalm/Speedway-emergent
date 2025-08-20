// // Load configuration from environment or config file
// const path = require('path');

// // Environment variable overrides
// const config = {
//   disableHotReload: process.env.DISABLE_HOT_RELOAD === 'true',
// };

// module.exports = {
//   webpack: {
//     alias: {
//       '@': path.resolve(__dirname, 'src'),
//     },
//     configure: (webpackConfig) => {

//       // Disable hot reload completely if environment variable is set
//       if (config.disableHotReload) {
//         // Remove hot reload related plugins
//         webpackConfig.plugins = webpackConfig.plugins.filter(plugin => {
//           return !(plugin.constructor.name === 'HotModuleReplacementPlugin');
//         });

//         // Disable watch mode
//         webpackConfig.watch = false;
//         webpackConfig.watchOptions = {
//           ignored: /.*/, // Ignore all files
//         };
//       } else {
//         // Add ignored patterns to reduce watched directories
//         webpackConfig.watchOptions = {
//           ...webpackConfig.watchOptions,
//           ignored: [
//             '**/node_modules/**',
//             '**/.git/**',
//             '**/build/**',
//             '**/dist/**',
//             '**/coverage/**',
//             '**/public/**',
//           ],
//         };
//       }

//       return webpackConfig;
//     },
//   },
// };

// NY TEST HÄR:
// craco.config.js

const path = require('path');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');

// Environment variable overrides
const config = {
  disableHotReload: process.env.DISABLE_HOT_RELOAD === 'true',
};

module.exports = {
  webpack: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
    configure: (webpackConfig) => {
      // --- HMR / Watch-hantering ---
      if (config.disableHotReload) {
        // Ta bort HMR-plugin
        webpackConfig.plugins = webpackConfig.plugins.filter(
          (plugin) => plugin?.constructor?.name !== 'HotModuleReplacementPlugin'
        );

        // Stäng av watch helt
        webpackConfig.watch = false;
        webpackConfig.watchOptions = {
          ignored: /.*/, // ignorera allt
        };
      } else {
        // Begränsa vad som bevakas i dev för bättre prestanda
        webpackConfig.watchOptions = {
          ...webpackConfig.watchOptions,
          ignored: [
            '**/node_modules/**',
            '**/.git/**',
            '**/build/**',
            '**/dist/**',
            '**/coverage/**',
            '**/public/**',
          ],
        };
      }

      // --- Css Minimizer patch (fixar postcss-calc-kraschen) ---
      if (webpackConfig.optimization && Array.isArray(webpackConfig.optimization.minimizer)) {
        webpackConfig.optimization.minimizer = webpackConfig.optimization.minimizer.map((min) => {
          // Ersätt standard CssMinimizerPlugin med en som stänger av calc-optimering
          if (min?.constructor?.name === 'CssMinimizerPlugin') {
            return new CssMinimizerPlugin({
              minimizerOptions: {
                // cssnano preset med calc avstängt
                preset: ['default', { calc: false }],
              },
            });
          }
          return min;
        });
      }

      return webpackConfig;
    },
  },
};
