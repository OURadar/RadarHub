import React, { useRef } from "react";

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

import { Archive } from "./archive";
import { Preference } from "./preference";

const useConstructor = (callback = () => {}) => {
  const hasBeenCalled = useRef(false);
  if (hasBeenCalled.current) return;
  callback();
  hasBeenCalled.current = true;
};
export default function App(props) {
  const [value, setValue] = React.useState(0);
  const [theme, setTheme] = React.useState(() => makeTheme());
  const [colors, setColors] = React.useState(() => colorDict());
  // const [view, setView] = React.useState(<div></div>);
  const [archive, setArchive] = React.useState();

  const [, updateState] = React.useState();
  const forceUpdate = React.useCallback(() => updateState({}), []);

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
    console.log(`App.handleOverlayLoaded()`);
    archive.catchup();
  };

  const handleThemeChange = () => {
    console.log("appX.handleThemeChange()");
    let mode = colors.name == "light" ? "dark" : "light";
    setMode(mode);
  };

  const handleNavigationChange = (event, newValue) => {
    console.log(`handleNavigationChange() -> ${newValue}`);
    setValue(newValue);
  };

  // const glView = (
  //   <Product colors={colors} gravity="top" sweep={archive.data.sweep} />
  // );

  // React.useEffect(() => {
  //   if (value == 0) {
  //     setView(glView);
  //   } else if (value == 1) {
  //     setView(<RandomList />);
  //   } else {
  //     setView(<RandomList label="2" seed={42} />);
  //   }
  // }, [value, colors]);

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
      <TopBar isMobile={true} onThemeChange={handleThemeChange} />
      <ThemeProvider theme={theme}>
        <Product
          gravity="top"
          colors={colors}
          origin={props.origin}
          sweep={archive?.data.sweep}
          onOverlayLoaded={handleOverlayLoaded}
        />
        <BottomNavigation
          id="navbar"
          showLabels
          value={value}
          onChange={handleNavigationChange}
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
