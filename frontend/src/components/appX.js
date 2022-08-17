import React, { useRef, useReducer } from "react";

import { ThemeProvider } from "@mui/material/styles";

import BottomNavigation from "@mui/material/BottomNavigation";
import BottomNavigationAction from "@mui/material/BottomNavigationAction";

import RadarIcon from "@mui/icons-material/Radar";
import EventNoteIcon from "@mui/icons-material/EventNote";
import MonitorHeartIcon from "@mui/icons-material/MonitorHeart";
import GamepadIcon from "@mui/icons-material/Gamepad";

import { colorDict, makeTheme } from "./theme";
import { TopBar } from "./topbar";
import { Browser } from "./browser-v2";
import { Product } from "./product";
import { RandomList } from "./random-list";

import { Archive } from "./archive";
import { Preference } from "./preference";

const useConstructor = (callback = () => {}) => {
  const used = useRef(false);
  if (used.current) return;
  callback();
  used.current = true;
};

export default function App(props) {
  const [value, setValue] = React.useState(1);
  const [theme, setTheme] = React.useState(makeTheme());
  const [colors, setColors] = React.useState(colorDict());
  const [archive, setArchive] = React.useState();

  const [, forceUpdate] = useReducer((x) => x + 1, 0);

  useConstructor(() => {
    const engine = new Archive(props.radar);
    engine.onupdate = forceUpdate;
    setArchive(engine);
  });

  const setMode = (mode) => {
    document.documentElement.setAttribute("theme", mode);
    setColors(() => colorDict(mode));
    setTheme(() => makeTheme(mode));
  };

  const handleOverlayLoaded = () => {
    console.log(`AppX.handleOverlayLoaded()`);
    archive.catchup();
  };

  const handleThemeChange = () => {
    console.log("AppX.handleThemeChange()");
    let mode = colors.name == "light" ? "dark" : "light";
    setMode(mode);
  };

  const handleNavigationChange = (event, newValue) => {
    setValue(newValue);
  };

  const handleLoad = (k) => {
    console.log(`AppX.handleLoad()  k = ${k}`);
    setTimeout(() => {
      setValue(0);
    }, 300);
  };

  React.useEffect(() => {
    window
      .matchMedia("(prefers-color-scheme: dark)")
      .addEventListener("change", (e) => {
        let mode = e.matches ? "dark" : "light";
        setMode(mode);
      });
    document.documentElement.setAttribute("theme", theme.palette.mode);
  }, []);

  return (
    <div className="fullHeight">
      <TopBar isMobile={true} onThemeChange={handleThemeChange} />
      <ThemeProvider theme={theme}>
        <div className={value === 0 ? "active" : "inactive"}>
          <Product
            gravity="top"
            colors={colors}
            origin={props.origin}
            sweep={archive?.data.sweep}
            onOverlayLoaded={handleOverlayLoaded}
          />
        </div>
        <div className={value === 1 ? "active" : "inactive"}>
          <Browser archive={archive} radar={props.radar} onLoad={handleLoad} />
        </div>
        <div className={value === 2 ? "active" : "inactive"}>
          <RandomList />
        </div>
        <BottomNavigation
          id="navbar"
          showLabels
          value={value}
          onChange={handleNavigationChange}
        >
          <BottomNavigationAction label="View" icon={<RadarIcon />} />
          <BottomNavigationAction label="Archive" icon={<EventNoteIcon />} />
          <BottomNavigationAction label="Health" icon={<MonitorHeartIcon />} />
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
