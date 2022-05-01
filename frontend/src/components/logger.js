// Logger
//
// Inspired by a post from
// https://www.bennadel.com/blog/3941-styling-console-log-output-formatting-with-css.htm

//
export const logger = (function () {
  function using(consoleFunction) {
    function consoleFunctionProxy() {
      var inputs = [];
      var modifiers = [];

      // console.log(arguments);

      inputs.push("%c" + arguments[0] + "%c ");
      modifiers.push(
        "display:inline-block; background-color: goldenrod; color: black; padding: 2px 7px ; border-radius: 3px",
        ""
      );

      for (var i = 1; i < arguments.length; i++) {
        inputs.push(arguments[i]);
      }
      // console.log(inputs.join(""));
      // console.log(modifiers);

      consoleFunction(inputs.join(""), ...modifiers);
    }
    return consoleFunctionProxy;
  }

  return {
    log: using(console.log),
    info: using(console.info),
    warn: using(console.warn),
    error: using(console.error),
    trace: using(console.trace),
    group: using(console.group),
    groupEnd: using(console.groupEnd),
  };
})();
