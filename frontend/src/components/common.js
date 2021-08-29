//
//  common.js
//  RadarHub
//
//  Created by Boonleng Cheong
//
//  A collection of common functions
//

export function clamp(x, lo, hi) {
  return Math.min(Math.max(x, lo), hi);
}

export function ticksInRange(count, min, max, choices) {
  const ticks = [];
  // Attempt to fit (count) ticks in range
  const range = (max - min) / count;
  let score = 1;
  let delta = choices[0];
  choices.forEach((x) => {
    let tmp = Math.abs(range - x) / x;
    if (score >= tmp) {
      score = tmp;
      delta = x;
    }
  });
  for (let k = Math.floor(min / delta); k < Math.ceil(max / delta); k++) {
    ticks.push(k * delta);
  }
  return ticks;
}

export function tickChoices(i, count) {
  var a = [];
  for (let k = 0; k < count; k++) {
    let e = i * 10 ** k;
    a.push([e, 2 * e, 2.5 * e, 5 * e]);
  }
  return a.flat();
}

export function prettyString(input) {
  return input
    .replace(/degC/g, "°C")
    .replace(/degF/g, "°F")
    .replace(/(?:[\s])deg/g, "°");
}

export function array2rgba(array) {
  return (
    "rgba(" +
    (array[0] * 255).toFixed(0) +
    ", " +
    (array[1] * 255).toFixed(0) +
    ", " +
    (array[2] * 255).toFixed(0) +
    ", " +
    array[3].toFixed(2) +
    ")"
  );
}

export function colorDict(theme) {
  // Retrieve the body color so we can match the canvas with it
  let body = window.getComputedStyle(document.body).backgroundColor;
  body = body.match(/\d+/g).map((x) => x / 255);
  if (body.length == 3) {
    body.push(1);
  }
  // Check for browser preference if 'theme' was not specified
  if (theme === undefined) {
    const matchMedia = window.matchMedia("(prefers-color-scheme: dark)");
    if (matchMedia.media != "not all") {
      if (matchMedia.matches === true) {
        theme = "dark";
      } else {
        theme = "light";
      }
    }
  }
  // If the previous step failed, choose based on the brightness of the body
  if (theme === undefined || theme == "auto") {
    let brightness = 0.2125 * body[0] + 0.7152 * body[1] + 0.0722 * body[2];
    if (brightness > 0.5) {
      theme = "light";
    } else {
      theme = "dark";
    }
  }
  // Pick the dictionary according to the final theme value
  const themes = {
    light: {
      name: "light",
      canvas: body,
      background: [1, 1, 1, 1],
      foreground: [0, 0, 0, 1],
      lines: [
        [0.25, 0.25, 0.25, 0.5],
        [0.31, 0.78, 0.78, 1.0], // teal
        [0.81, 0.71, 0.22, 1.0], // mustard
        [0.42, 0.65, 0.89, 1.0], // blue
        [0.99, 0.36, 0.74, 1.0], // pink
        [0.21, 0.78, 0.35, 1.0], // green
        [0.95, 0.62, 0.11, 1.0], // orange
        [0.72, 0.41, 0.99, 1.0], // purple
        [0.99, 0.41, 0.41, 1.0], // red
        [0.11, 0.79, 0.48, 1.0], // mint
      ],
      spline: [0.6, 0.6, 0.6, 1],
      pane: [0.988, 0.988, 1, 1],
      grid: [0.3, 0.3, 0.3, 0.6],
      tint: 0.7,
    },
    dark: {
      name: "dark",
      canvas: body,
      background: [0, 0, 0, 1],
      foreground: [1, 1, 1, 1],
      lines: [
        [0.4, 0.4, 0.4, 0.6],
        [0.2, 1.0, 1.0, 1.0], // teal
        [1.0, 0.9, 0.2, 1.0], // mustard
        [0.4, 0.6, 1.0, 1.0], // blue
        [1.0, 0.4, 0.7, 1.0], // pink
        [0.5, 1.0, 0.2, 1.0], // green
        [1.0, 0.7, 0.2, 1.0], // orange
        [0.6, 0.4, 1.0, 1.0], // purple
        [1.0, 0.4, 0.4, 1.0], // red
        [0.2, 1.0, 0.8, 1.0], // mint
      ],
      spline: [0.8, 0.8, 0.8, 1],
      pane: [0.05, 0.05, 0.08, 1],
      grid: [1.0, 1.0, 1.0, 0.18],
      tint: 1.0,
    },
    vibrant: {
      name: "vibrant",
      canvas: [0, 0.07, 0.07, 1],
      background: [0, 0.07, 0.07, 1],
      foreground: [1, 1, 1, 1],
      lines: [
        [0.3, 0.3, 0.3, 0.7],
        [1.0, 0.5, 0.0, 1.0], // orange
        [1.0, 0.9, 0.0, 1.0], // yellow
        [0.2, 0.6, 1.0, 1.0], // blue
        [0.2, 1.0, 0.8, 1.0], // mint
        [0.6, 0.4, 1.0, 1.0], // purple
        [1.0, 0.4, 0.7, 1.0], // pink
        [1.0, 0.0, 0.0, 1.0], // red
        [0.0, 1.0, 1.0, 1.0], // teal
        [0.6, 1.0, 0.0, 1.0], // green
      ],
      spline: [0.8, 0.8, 0.8, 1],
      pane: [0.0, 0.07, 0.07, 1],
      grid: [1.0, 1.0, 1.0, 0.18],
      tint: 1.0,
    },
    sat: {
      name: "sat",
      canvas: body,
      background: [0, 0, 0, 1],
      foreground: [1, 1, 1, 1],
      lines: [
        [0.5, 0.5, 0.5, 0.7],
        [0.369, 0.741, 0.243, 1.0], // green
        [1.0, 0.725, 0.0, 1.0], // yellow
        [0.969, 0.51, 0.0, 1.0], // orange
        [0.886, 0.22, 0.22, 1.0], // red
        [0.592, 0.224, 0.6, 1.0], // purple
        [0.0, 0.612, 0.875, 1.0], // blue
      ],
      spline: [0.8, 0.8, 0.8, 1],
      pane: [0.988, 0.988, 1, 1],
      grid: [0.3, 0.3, 0.3, 0.6],
      tint: 1.0,
    },
    baby: {
      name: "baby",
      canvas: body,
      background: [0, 0, 0, 1],
      foreground: [1, 1, 1, 1],
      lines: [
        [0.5, 0.5, 0.5, 0.7],
        [0.925, 0.529, 0.725, 1.0], // light pink
        [0.984, 0.741, 0.306, 1.0], // orange
        [0.557, 0.82, 0.71, 1.0], // mint
        [0.992, 0.827, 0.286, 1.0], // yellow
        [0.267, 0.69, 0.776, 1.0], // blue
        [0.906, 0.369, 0.639, 1.0], // dark pink
        [0.333, 0.796, 0.796, 1.0], // light blue
        [0.459, 0.478, 0.804, 1.0], // violet
        [0.886, 0.447, 0.835, 1.0], // pink
      ],
      spline: [0.8, 0.8, 0.8, 1],
      pane: [0.988, 0.988, 1, 1],
      grid: [0.3, 0.3, 0.3, 0.6],
      tint: 1.0,
    },
  };
  return themes[theme];
}

//
// Copied from
// https://stackoverflow.com/questions/11381673/detecting-a-mobile-browser
//
export function detectMob() {
  const toMatch = [
    /Android/i,
    /webOS/i,
    /iPhone/i,
    /iPad/i,
    /iPod/i,
    /BlackBerry/i,
    /Windows Phone/i,
  ];

  return toMatch.some((toMatchItem) => {
    return navigator.userAgent.match(toMatchItem);
  });
}

//
// Copied from
// https://radiatingstar.com/blog/the-fastest-way-to-get-time-stamps-in-javascript/
//
var checkTimerPerformance = function () {
  var perf = window.performance,
    t,
    stampDateNow,
    stampPerfNow,
    i;

  // Store the initial time.
  stampDateNow = Date.now();

  // Run Date.now() performance test.
  for (i = 0; i < 100000; i += 1) {
    t = Date.now();
  }

  // Find out how long the Date.now() test took.
  stampDateNow = Date.now() - stampDateNow;

  // Run the test for performance.now() only if the browser supports it.
  if (perf) {
    // Start the timer for performance.now();
    stampPerfNow = Date.now();

    // Run performance.now() test.
    for (i = 0; i < 100000; i += 1) {
      t = perf.now();
    }

    // Check the time of performance.now();
    stampPerfNow = Date.now() - stampPerfNow;
  } else {
    // If the browser doesn't have the performance.now method,
    // the Date.now() will be used by default.
    stampPerfNow = 0;
  }

  // If the Date.now() was faster, return it.
  if (stampPerfNow > stampDateNow) {
    return function () {
      return Date.now();
    };

    // Otherwise use the performance.now() method.
  } else {
    return function () {
      console.log("Using perf.now()");
      return perf.now();
    };
  }
};

export const getTime = checkTimerPerformance();
