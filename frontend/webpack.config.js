const Path = require("path");

const BundleTracker = require("webpack-bundle-tracker");

module.exports = [
  {
    entry: {
      archive: {
        import: "./src/archive.jsx",
      },
      control: {
        import: "./src/control.jsx",
      },
      develop: {
        import: "./src/develop.jsx",
      },
      index: {
        import: "./src/index.jsx",
      },
    },
    output: {
      filename: "[name].[chunkhash:8].js",
      path: Path.resolve(__dirname, "static/frontend"),
      publicPath: "/static/frontend/",
      clean: true,
    },
    resolve: {
      alias: { components: Path.resolve(__dirname, "src/components") },
      extensions: [".js", ".jsx", ".json"],
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
      splitChunks: { chunks: "all" },
    },
    plugins: [new BundleTracker({ path: __dirname, filename: "webpack-output.json" })],
    watchOptions: {
      ignored: "**/node_modules",
    },
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
