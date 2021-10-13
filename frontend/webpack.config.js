const path = require("path");

module.exports = {
  entry: {
    main: {
      import: "./src/index.js",
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
        use: [
          {
            loader: "babel-loader",
            options: {
              presets: ["@babel/preset-env"],
            },
          },
        ],
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
};
