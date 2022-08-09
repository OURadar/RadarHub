import * as React from "react";

import { ThemeProvider } from "@mui/material/styles";

import BottomNavigation from "@mui/material/BottomNavigation";
import BottomNavigationAction from "@mui/material/BottomNavigationAction";

import RadarIcon from "@mui/icons-material/Radar";
import EventNoteIcon from "@mui/icons-material/EventNote";
import MonitorHeartIcon from "@mui/icons-material/MonitorHeart";
import GamepadIcon from "@mui/icons-material/Gamepad";

import { colorDict, makeTheme } from "./theme";
import { TopBar } from "./topbar";
import { Product } from "./product";
import { RandomList } from "./random-list";

export default function App(props) {
  const [value, setValue] = React.useState(0);
  const [theme, setTheme] = React.useState(() => makeTheme());
  const [colors, setColors] = React.useState(() => colorDict());

  const [view, setView] = React.useState(<div></div>);

  const setMode = (mode) => {
    document.documentElement.setAttribute("theme", mode);
    setColors(() => colorDict(mode));
    setTheme(() => makeTheme(mode));
  };

  const handleChange = (event, newValue) => {
    setValue(newValue);
  };

  const handleThemeChange = () => {
    console.log("appX.handleThemeChange()");
    let mode = colors.name == "light" ? "dark" : "light";
    setMode(mode);
  };

  React.useEffect(() => {
    if (value == 0) {
      setView(<Product colors={colors} />);
    } else if (value == 1) {
      setView(<RandomList />);
    } else {
      setView(<RandomList label="2" seed={42} />);
    }
  }, [value, colors]);

  React.useEffect(() => {
    window
      .matchMedia("(prefers-color-scheme: dark)")
      .addEventListener("change", (e) => {
        let mode = e.matches ? "dark" : "light";
        setMode(mode);
      });
  }, []);

  return (
    <div className="fullHeight">
      <TopBar isMobile={true} handleThemeChange={handleThemeChange} />
      <ThemeProvider theme={theme}>
        {view}
        <BottomNavigation
          id="navbar"
          showLabels
          value={value}
          onChange={handleChange}
        >
          <BottomNavigationAction label="View" icon={<RadarIcon />} />
          <BottomNavigationAction label="Archive" icon={<EventNoteIcon />} />
          <BottomNavigationAction label="Health" icon={<MonitorHeartIcon />} />
          <BottomNavigationAction label="Control" icon={<GamepadIcon />} />
        </BottomNavigation>
      </ThemeProvider>
    </div>
  );
}

App.defaultProps = {
  radar: "px1000",
  origin: {
    longitude: -97.422413,
    latitude: 35.25527,
  },
  debug: false,
  profileGL: false,
  autoLoad: true,
};
