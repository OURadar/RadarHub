import * as React from "react";

import { ThemeProvider, createTheme } from "@mui/material/styles";

import BottomNavigation from "@mui/material/BottomNavigation";
import BottomNavigationAction from "@mui/material/BottomNavigationAction";

import RadarIcon from "@mui/icons-material/Radar";
import EventNoteIcon from "@mui/icons-material/EventNote";
import MonitorHeartIcon from "@mui/icons-material/MonitorHeart";
import GamepadIcon from "@mui/icons-material/Gamepad";

import { colorDict, makeTheme, makeDarkPalette } from "./theme";
import { TopBar } from "./topbar";
import { GLView } from "./glview";
import { RandomList } from "./random-list";

export default function App(props) {
  const [value, setValue] = React.useState(1);
  const [theme, setTheme] = React.useState(() => makeTheme());
  const [colors, setColors] = React.useState(() => colorDict());

  const [view, setView] = React.useState(<div></div>);

  const glView = <GLView colors={colors} />;
  const listView = <RandomList />;
  const list2 = <RandomList />;

  const handleChange = (event, newValue) => {
    setValue(newValue);
  };

  React.useEffect(() => {
    console.log(`value = ${value}`);
    if (value == 0) {
      setView(glView);
    } else if (value == 1) {
      setView(listView);
    } else {
      setView(list2);
    }
  }, [value]);

  return (
    <div className="fullHeight">
      <TopBar isMobile={true} />
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
