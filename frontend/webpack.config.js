const path = require("path");

module.exports = {
  entry: {
    control: {
      import: "./src/control.js",
      dependOn: "shared",
    },
    archive: {
      import: "./src/archive.js",
      dependOn: "shared",
    },
    dev: {
      import: "./src/dev.js",
      dependOn: "shared",
    },
    shared: [
      "react",
      "react-dom",
      "react-window",
      "regl",
      "gl-matrix",
      "stats-js",
      "binary-parser",
      "split.js",
      "memoize-one",
    ],
    "polygon.worker": "./src/components/polygon.worker.js",
    "overlay.worker": "./src/components/overlay.worker.js",
    "archive.worker": "./src/components/archive.worker.js",
    "ingest.worker": "./src/components/ingest.worker.js",
  },
  output: {
    filename: "[name].js",
    path: path.resolve(__dirname, "static/frontend"),
  },
  module: {
    rules: [
      {
        test: /\.worker\.js$/,
        exclude: /node_modules/,
        use: "babel-loader",
      },
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
};

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
