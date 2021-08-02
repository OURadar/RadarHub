import { createTheme } from "@material-ui/core/styles";

export const theme = createTheme({
  palette: {
    primary: {
      main: "#ff4400",
    },
    secondary: {
      light: "#0066ff",
      main: "#0044ff",
      contrastText: "#ffcc00",
    },
    contrastThreshold: 3,
    tonalOffset: 0.2,
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
  },
});
