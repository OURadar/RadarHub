const Path = require("path");
const { CleanWebpackPlugin } = require("clean-webpack-plugin");
const BundleTracker = require("webpack-bundle-tracker");

const cleaner = new CleanWebpackPlugin({
  cleanOnceBeforeBuildPatterns: ["**/*"],
  verbose: true,
});

module.exports = [
  {
    entry: {
      archive: {
        import: "./src/archive.js",
        dependOn: "shared",
      },
      control: {
        import: "./src/control.js",
        dependOn: "shared",
      },
      index: {
        import: "./src/index.js",
        dependOn: "shared",
      },
      dev: {
        import: "./src/dev.js",
        dependOn: "shared",
      },
      shared: [
        "emoji-name-map",
        "react",
        "react-dom",
        "react-window",
        "split.js",
        "gl-matrix",
        "regl",
        "stats-js",
      ],
    },
    output: {
      filename: "[name].[chunkhash:8].js",
      path: Path.resolve(__dirname, "static/frontend"),
    },
    module: {
      rules: [
        {
          test: /\.(js|jsx)$/,
          exclude: /node_modules/,
          use: [
            {
              loader: "babel-loader",
              options: {
                presets: ["@babel/preset-env"],
              },
            },
          ],
        },
      ],
    },
    optimization: {
      minimize: true,
    },
    watchOptions: {
      ignored: "**/node_modules",
    },
    plugins: [cleaner, new BundleTracker({ filename: "webpack-output.json" })],
  },
];

//
// If webpack display messages like this
//
//     Watchpack Error (watcher): Error: ENOSPC: System limit for number of file watchers reached
//
// Add the following line to /etc/sysctl.conf
//
//     fs.inotify.max_user_watches=16384
//
// Then, run
//
//     sudo sysctl -p
//
