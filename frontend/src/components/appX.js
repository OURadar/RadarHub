import * as React from "react";

import { ThemeProvider, createTheme } from "@mui/material/styles";

import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";

import RadarIcon from "@mui/icons-material/Radar";
import EventNoteIcon from "@mui/icons-material/EventNote";
import MonitorHeartIcon from "@mui/icons-material/MonitorHeart";
import GamepadIcon from "@mui/icons-material/Gamepad";

import { colorDict, makeTheme, makePalette } from "./theme";
import { TopBar } from "./topbar";
import { GLView } from "./glview";
import { RandomList } from "./random-list";

const darkTheme = createTheme({
  ...makePalette("dark"),
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

export function App(props) {
  const [value, setValue] = React.useState(0);
  const [theme, setTheme] = React.useState(() => makeTheme());
  const [colors, setColors] = React.useState(() => colorDict());

  const [view, setView] = React.useState(<div className="fullHeight"></div>);

  const glView = <GLView colors={colors} />;
  const listView = <RandomList />;

  const handleChange = (event, newValue) => {
    setValue(newValue);
  };

  React.useEffect(() => {
    if (value == 0) {
      setView(glView);
    } else {
      setView(listView);
    }
  }, [value]);

  return (
    <div>
      <TopBar isMobile={true} />
      <ThemeProvider theme={darkTheme}>
        <Tabs
          id="tabbar"
          value={value}
          onChange={handleChange}
          aria-label="icon tabs"
          className="fullWidth"
          variant="fullWidth"
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