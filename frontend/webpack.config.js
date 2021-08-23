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
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: ["babel-loader"],
      },
    ],
  },
  optimization: {
    minimize: true,
  },
};
