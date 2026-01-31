const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  entry: {
    'service-worker': './src/background/service-worker.js',
    'linkedin-scraper': './src/content/linkedin-scraper.js',
    'sidepanel': './src/sidepanel/sidepanel.js',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    clean: true,
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        type: 'javascript/auto',
      },
    ],
  },
  resolve: {
    extensions: ['.js'],
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: 'manifest.json', to: '.' },
        { from: 'icons', to: 'icons' },
        { from: 'src/sidepanel/sidepanel.html', to: '.' },
        { from: 'src/sidepanel/sidepanel.css', to: '.' },
      ],
    }),
  ],
  optimization: {
    minimize: false,
  },
};
