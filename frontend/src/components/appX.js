import React from "react";

import { ThemeProvider } from "@mui/material/styles";

import BottomNavigation from "@mui/material/BottomNavigation";
import BottomNavigationAction from "@mui/material/BottomNavigationAction";

import RadarIcon from "@mui/icons-material/Radar";
import EventNoteIcon from "@mui/icons-material/EventNote";
import MonitorHeartIcon from "@mui/icons-material/MonitorHeart";
import GamepadIcon from "@mui/icons-material/Gamepad";

import { colorDict, makeTheme } from "./theme";
import { TopBar } from "./topbar";
import { Browser } from "./browser-mobile";
import { Product } from "./product";

import { Archive } from "./archive";
import { MenuUpdate } from "./menu-update";
import { MenuArrow } from "./menu-arrow";

const useConstructor = (callback = () => {}) => {
  const used = React.useRef(false);
  if (used.current) return;
  callback();
  used.current = true;
};

function Navigation(props) {
  return (
    <BottomNavigation
      id="navbar"
      className="blur"
      value={props.value}
      onChange={props.onChange}
      showLabels
    >
      <BottomNavigationAction label="View" icon={<RadarIcon />} />
      <BottomNavigationAction label="Archive" icon={<EventNoteIcon />} />
    </BottomNavigation>
  );
}

Navigation.defaultProps = {
  value: 0,
  onChange: () => {},
};

export function App(props) {
  const [value, setValue] = React.useState(0);
  const [theme, setTheme] = React.useState(makeTheme());
  const [colors, setColors] = React.useState(colorDict());

  const archive = React.useRef(null);

  const [, forceUpdate] = React.useReducer((x) => x + 1, 0);

  useConstructor(() => {
    document
      .getElementById("device-style")
      .setAttribute("href", `/static/css/mobile.css?h=${props.css_hash}`);

    archive.current = new Archive(props.radar);
    archive.current.onupdate = forceUpdate;
  });

  const setMode = (mode) => {
    document.documentElement.setAttribute("theme", mode);
    setColors(() => colorDict(mode));
    setTheme(() => makeTheme(mode));
  };

  const handleOverlayLoaded = () => {
    console.log(`AppX.handleOverlayLoaded()`);
    archive.current.catchup();
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

  const handleDoubleLeft = () => {
    console.log("AppX.handleDoubleLeft()");
    archive.current.navigateBackwardScan();
  };

  const handleLeft = () => {
    archive.current.navigateBackward();
  };

  const handleRight = () => {
    archive.current.navigateForward();
  };

  const handleDoubleRight = () => {
    archive.current.navigateForwardScan();
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
            sweep={archive.current?.data.sweep}
            onOverlayLoaded={handleOverlayLoaded}
          />
          <MenuArrow
            onDoubleLeft={handleDoubleLeft}
            onLeft={handleLeft}
            onRight={handleRight}
            onDoubleRight={handleDoubleRight}
          />
        </div>
        <div className={value === 1 ? "active" : "inactive"}>
          <Browser archive={archive.current} onLoad={handleLoad} />
        </div>
        <Navigation value={value} onChange={handleNavigationChange} />
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
