import * as React from "react";

import { ThemeProvider, createTheme } from "@mui/material/styles";

import Box from "@mui/material/Box";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";

import RadarIcon from "@mui/icons-material/Radar";
import EventNoteIcon from "@mui/icons-material/EventNote";
import MonitorHeartIcon from "@mui/icons-material/MonitorHeart";
import GamepadIcon from "@mui/icons-material/Gamepad";

import { colorDict, makeTheme, makeDarkPalette } from "./theme";
import { TopBar } from "./topbar";
import { GLView } from "./glview";

const darkPalette = makeDarkPalette();
const topbarTheme = createTheme({
  ...darkPalette,
  components: {
    MuiSvgIcon: {
      styleOverrides: {
        root: {
          color: "white",
        },
      },
    },
  },
});

export default function App(props) {
  const [view, setView] = React.useState(<div className="fullHeight"></div>);
  const [value, setValue] = React.useState(0);
  const [theme, setTheme] = React.useState(() => makeTheme());
  const [colors, setColors] = React.useState(() => colorDict());

  const glView = <GLView colors={colors} />;

  const listView = (
    <div className="fullHeight paper">
      <Box sx={{ pt: 15, bgColor: "var(--system-background)" }}>
        <div className="spacerTop">Something here</div>
      </Box>
    </div>
  );

  const handleChange = (event, newValue) => {
    setValue(newValue);
  };

  React.useEffect(() => {
    console.log(`value = ${value}`);
    if (value == 0) {
      setView(glView);
    } else {
      setView(listView);
    }
  }, [value]);

  return (
    <div>
      <TopBar />
      <ThemeProvider theme={topbarTheme}>
        <Tabs
          id="tabbar"
          value={value}
          onChange={handleChange}
          aria-label="icon tabs"
          className="fullWidth"
          variant="fullWidth"
          sx={{ position: "fixed", top: 56, zIndex: 1 }}
        >
          <Tab icon={<RadarIcon />} aria-label="view" />
          <Tab icon={<EventNoteIcon />} aria-label="archive" />
          <Tab icon={<MonitorHeartIcon />} aria-label="health" />
          <Tab icon={<GamepadIcon />} aria-label="control" disabled />
        </Tabs>
      </ThemeProvider>
      <ThemeProvider theme={theme}>{view}</ThemeProvider>
    </div>
  );
}
