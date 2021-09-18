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
    polygon: "./src/components/polygon.worker.js",
    opacity: "./src/components/overlay.worker.js",
    ingest: "./src/components/ingest.worker.js",
    shared: [
      "react",
      "react-dom",
      "regl",
      "gl-matrix",
      "stats-js",
      "binary-parser",
    ],
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
