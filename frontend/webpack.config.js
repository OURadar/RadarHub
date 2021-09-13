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
    shared: [
      "react",
      "react-dom",
      "regl",
      "gl-matrix",
      "stats-js",
      "shapefile",
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
          // {
          //   loader: "worker-loader",
          //   options: {
          //     publicPath: path.resolve(__dirname, "static/frontend"),
          //     filename: "[name].js",
          //     inline: "no-fallback",
          //   },
          // },
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
