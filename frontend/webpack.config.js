const path = require("path");

module.exports = {
  entry: {
    main: {
      import: "./src/index.js",
      dependOn: "shared",
    },
    archive: {
      import: "./src/archive.js",
      dependOn: "shared",
    },
    shared: ["react", "react-dom", "regl", "gl-matrix", "stats-js"],
  },
  output: {
    filename: "[name].js",
    path: path.resolve(__dirname, "static/frontend"),
  },
  module: {
    rules: [
      {
        test: /\.worker\.js$/i,
        exclude: /node_modules/,
        use: [
          {
            loader: "worker-loader",
            options: {
              publicPath: path.resolve(__dirname, "static/frontend"),
              filename: "[name].js",
              esModule: false,
              inline: "fallback",
            },
          },
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
        exclude: [/node_modules/, /\.worker\.js$/],
        use: ["babel-loader"],
      },
    ],
  },
  optimization: {
    minimize: true,
  },
};
