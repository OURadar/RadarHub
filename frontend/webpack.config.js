const path = require("path");

module.exports = {
  entry: {
    index: {
      import: "./src/index.js",
      dependOn: "shared",
    },
    main: {
      import: "./src/main.js",
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
    polygon: "./src/components/polygon.worker.js",
    opacity: "./src/components/overlay.worker.js",
    archive: "./src/components/archive.worker.js",
    ingest: "./src/components/ingest.worker.js",
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
