// import { createTheme } from "@mui/material/styles";
import { Hidden } from "@mui/material";
import { createTheme } from "@mui/material/styles";

function reviseMode(mode) {
  // Retrieve the body color so we can match the canvas with it
  let bg = window.getComputedStyle(document.body).backgroundColor;
  let body = new Array(bg.match(/\d+/g).map((x) => x / 255));
  if (body.length == 3) {
    body.push(1.0);
  }
  // Check for browser preference if 'theme' was not specified
  if (mode === undefined) {
    const matchMedia = window.matchMedia("(prefers-color-scheme: dark)");
    if (matchMedia.media != "not all") {
      if (matchMedia.matches === true) {
        mode = "dark";
      } else {
        mode = "light";
      }
    }
  }
  // If the previous step failed, choose based on the brightness of the body
  if (mode === undefined || mode == "auto") {
    let brightness = 0.2125 * body[0] + 0.7152 * body[1] + 0.0722 * body[2];
    if (brightness > 0.5) {
      mode = "light";
    } else {
      mode = "dark";
    }
  }
  return { body, mode };
}

export function makeTheme(inputMode) {
  let { mode } = reviseMode(inputMode);
  let theme = createTheme({
    palette: {
      mode,
      ...(mode === "light"
        ? {
            primary: {
              main: "rgb(0, 199, 190)",
              light: "rgba(0, 199, 190, 0.2)",
              dark: "rgba(0, 199, 190, 0.3)",
            },
            secondary: {
              main: "rgb(162, 132, 94)",
              light: "rgba(162, 132, 94, 0.2)",
              dark: "rgba(162, 132, 94, 0.3)",
            },
            divider: "rgba(0, 0, 0, 0.04)",
          }
        : {
            primary: {
              main: "rgb(102, 212, 207)",
              light: "rgba(102, 212, 207, 0.2)",
              dark: "rgba(102, 212, 207, 0.3)",
            },
            secondary: {
              main: "rgb(172, 142, 104)",
              light: "rgba(172, 142, 104, 0.2)",
              dark: "rgba(172, 142, 104, 0.3)",
            },
            divider: "rgba(255, 255, 255, 0.04)",
          }),
    },
    typography: {
      fontFamily: [
        "-apple-system",
        "BlinkMacSystemFont",
        '"Segoe UI"',
        "Roboto",
        '"Helvetica Neue"',
        "Arial",
        "sans-serif",
        '"Apple Color Emoji"',
        '"Segoe UI Emoji"',
        '"Segoe UI Symbol"',
      ].join(","),
    },
    shape: {
      borderRadius: "var(--button-border-radius)",
      color: "var(--system-foreground)",
    },
  });
  theme = createTheme(theme, {
    components: {
      MuiButton: {
        variants: [
          {
            props: { variant: "control" },
            style: {
              boxSizing: "border-box",
              borderTop: "var(--button-border-top)",
              borderRight: "var(--button-border-right)",
              borderBottom: "var(--button-border-bottom)",
              borderLeft: "var(--button-border-left)",
              display: "inline-block",
              fontSize: "var(--font-size)",
              marginBottom: "var(--button-margin-bottom)",
              overflow: "hidden",
              padding: "0 30px",
              textTransform: "none",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              width: "100%",
            },
          },
          {
            props: { variant: "file" },
            style: {
              borderRadius: 0,
              borderBottom: "solid 1px var(--gray5)",
              color: theme.palette.text.secondary,
              display: "inline-block",
              padding: "0 20px",
              textTransform: "none",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              width: "100%",
              "&:last-child": {
                borderBottom: "none",
              },
            },
          },
          // {
          //   props: { variant: "file", selected: false },
          //   style: {
          //     "&:nth-of-type(even)": {
          //       backgroundColor: theme.palette.divider,
          //     },
          //   },
          // },
          {
            props: { variant: "file", selected: true },
            style: {
              color: theme.palette.secondary.main,
              "&:hover": {
                color: "white",
              },
              backgroundColor: theme.palette.secondary.light,
              "&:hover": {
                backgroundColor: theme.palette.secondary.dark,
              },
              height: 32,
              fontWeight: 600,
            },
          },
          {
            props: { variant: "hour" },
            style: {
              color: theme.palette.text.secondary,
              height: 32,
              width: "25%",
            },
          },
          {
            props: { variant: "hour", selected: true },
            style: {
              color: theme.palette.primary.main,
              "&:hover": {
                color: "white",
              },
              backgroundColor: theme.palette.primary.light,
              "&:hover": {
                backgroundColor: theme.palette.primary.dark,
              },
              fontWeight: 600,
            },
          },
        ],
      },
      MuiListItemText: {
        styleOverrides: {
          root: {
            display: "inline-block",
            color: theme.palette.text.secondary,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          },
        },
      },
    },
  });
  return theme;
}

export const theme = makeTheme();

/*
overrides: {
  MuiButton: {
    root: {
      width: "100%",
      height: "var(--button-height)",
      padding: "0 30px",
      borderRadius: "var(--button-border-radius)",
      borderTop: "var(--button-border-top)",
      borderRight: "var(--button-border-right)",
      borderBottom: "var(--button-border-bottom)",
      borderLeft: "var(--button-border-left)",
      marginBottom: "var(--button-margin-bottom)",
      boxSizing: "border-box",
    },
    text: {
      color: "var(--system-foreground)",
      fontSize: "var(--font-size)",
      lineHeight: "var(--font-size)",
      overflow: "hidden",
      textOverflow: "ellipsis",
      textTransform: "none",
      boxSizing: "border-box",
    },
    label: {
      fontSize: "var(--font-size)",
      lineHeight: "var(--font-size)",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
      textTransform: "none",
      boxSizing: "border-box",
    },
  },
}
*/

export function hex2rgb(hex) {
  const r = parseInt(hex.slice(0, 2), 16) / 255.0;
  const g = parseInt(hex.slice(2, 4), 16) / 255.0;
  const b = parseInt(hex.slice(4, 6), 16) / 255.0;
  const a = hex.length > 6 ? parseInt(hex.slice(6, 8), 16) / 255.0 : 1.0;
  return [r, g, b, a];
}

export function hex2luminance(hex) {
  [r, g, b, _] = hex2rgb(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function array2rgba(array) {
  const r = (array[0] * 255).toFixed(0);
  const g = (array[1] * 255).toFixed(0);
  const b = (array[2] * 255).toFixed(0);
  const a = array[3].toFixed(3);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

export function colorDict(inputMode) {
  let { body, mode } = reviseMode(inputMode);
  // console.log(`body = ${body}`);
  // Pick the dictionary according to the final theme value
  const themes = {
    light: {
      name: "light",
      canvas: body,
      glview: hex2rgb("f9f5ed"),
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
      label: {
        face: "#000000",
        face2: "#333333",
        stroke: "#f9f5ed",
        shadow: "#ffffff",
        ring: "#00bbff",
        blur: 3,
      },
      ring: hex2rgb("00bbff"),
      state: hex2rgb("40bf91"),
      county: hex2rgb("40bf91"),
      street: hex2rgb("e6b955"),
    },
    dark: {
      name: "dark",
      canvas: body,
      glview: hex2rgb("22252a"),
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
      label: {
        face: "#ffffff",
        face2: "#cccccc",
        stroke: "#22252a",
        shadow: "#000000",
        ring: "#78dcff",
        blur: 3,
      },
      ring: hex2rgb("78dcffff"),
      state: hex2rgb("96e6c8ff"),
      county: hex2rgb("83e2bfff"),
      street: hex2rgb("e6b955"),
    },
    vibrant: {
      name: "vibrant",
      canvas: [0, 0.07, 0.07, 1],
      glview: [0, 0.07, 0.07, 1],
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
      label: {
        face: "#ffffff",
        stroke: "#000000",
        shadow: "#000000",
        blur: 3,
      },
    },
    sat: {
      name: "sat",
      canvas: body,
      glview: body,
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
      label: {
        face: "#ffffff",
        stroke: "#000000",
        shadow: "#000000",
        blur: "3px",
      },
    },
    baby: {
      name: "baby",
      canvas: body,
      glview: body,
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
      label: {
        face: "#ffffff",
        stroke: "#000000",
        shadow: "#000000",
        blur: "3px",
      },
    },
  };
  return themes[mode];
}
