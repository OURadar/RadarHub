import React from "react";

import { ThemeProvider } from "@mui/material/styles";

import BottomNavigation from "@mui/material/BottomNavigation";
import BottomNavigationAction from "@mui/material/BottomNavigationAction";

import RadarIcon from "@mui/icons-material/Radar";
import EventNoteIcon from "@mui/icons-material/EventNote";
import MonitorHeartIcon from "@mui/icons-material/MonitorHeart";
import GamepadIcon from "@mui/icons-material/Gamepad";

import { removeSplash } from "./splash";
import { colorDict, makeTheme } from "./theme";
import { TopBar } from "./topbar";
import { Browser } from "./browser-mobile";
import { Product } from "./product";

import { Archive } from "./archive";
import { MenuUpdate } from "./menu-update";
import { MenuArrow } from "./menu-arrow";

const emojis = require("emoji-name-map");

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
  onChange: () => console.log("Navigation.onChange"),
};

export function App(props) {
  const [value, setValue] = React.useState(0);
  const [theme, setTheme] = React.useState(makeTheme());
  const [colors, setColors] = React.useState(colorDict());
  const [message, setMessage] = React.useState("");
  const [disabled, setDisabled] = React.useState([false, false, false, false]);

  const archive = React.useRef(null);

  const [, handleUpdate] = React.useReducer((x) => x + 1, 0);

  const handleLoad = () => {
    setDisabled(archive.current?.grid.pathsActive.map((x) => !x));
  };

  useConstructor(() => {
    document
      .getElementById("device-style")
      .setAttribute("href", `/static/css/mobile.css?h=${props.css_hash}`);

    archive.current = new Archive(props.radar);
    archive.current.onUpdate = handleUpdate;
    archive.current.onLoad = handleLoad;
  });

  const setDocumentTheme = (mode) => {
    document.documentElement.setAttribute("theme", mode);
    setColors(() => colorDict(mode));
    setTheme(() => makeTheme(mode));
  };

  const handleOverlayLoaded = () => {
    console.log(`AppX.handleOverlayLoaded()`);
    archive.current.catchup();
    removeSplash();
  };

  const handleThemeChange = () => {
    console.log("AppX.handleThemeChange()");
    let theme = colors.name == "light" ? "dark" : "light";
    setDocumentTheme(theme);
  };

  const handleLiveModeChange = (_, value) => {
    archive.current.toggleLiveUpdate(value);
  };

  const handleAccount = () => {
    setMessage("Fetching User Information ...");
    fetch("/profile/")
      .then((response) => {
        if (response.status == 200) {
          response.json().then(({ user, ip, emoji }) => {
            let title = user == "None" ? "Anonymous User" : `Hello ${user}`;
            let symbol = emojis.get(emoji) || "";
            setMessage(
              user == "None"
                ? "<h3>Guest</h3><a class='link darken' href='/accounts/signin/?next=" +
                    window.location.pathname +
                    "'>Sign In Here</a><div class='emotion'>⛅️</div>"
                : `<h3>${title}</h3>${ip}<div class='emotion'>${symbol}</div>`
            );
            setTimeout(() => setMessage(""), 3500);
          });
        } else {
          setMessage(
            `<h3>Error</h3>Received ${response.status}<div class='emotion'>🤷🏻‍♀️</div>`
          );
        }
      })
      .catch((_error) => {
        setMessage(
          `<h3>Error</h3>Received ${response.status}<div class='emotion'>🤷🏻‍♀️</div>`
        );
        setTimeout(() => setMessage(""), 3500);
      });
  };

  const handleNavigationChange = (event, newValue) => {
    setValue(newValue);
  };

  const handleSelect = (k) => {
    console.log(`AppX.handleSelect()  k = ${k}`);
    setTimeout(() => setValue(0), 300);
  };

  const handleDoubleLeft = () => archive.current.navigateBackwardScan();
  const handleLeft = () => archive.current.navigateBackward();
  const handleRight = () => archive.current.navigateForward();
  const handleDoubleRight = () => archive.current.navigateForwardScan();

  React.useEffect(() => {
    window
      .matchMedia("(prefers-color-scheme: dark)")
      .addEventListener("change", (e) => {
        let mode = e.matches ? "dark" : "light";
        setDocumentTheme(mode);
      });
    document.documentElement.setAttribute("theme", theme.palette.mode);
  }, []);

  return (
    <div className="fullHeight">
      <TopBar
        isMobile={true}
        message={message}
        ingest={archive.current}
        onAccount={handleAccount}
        onThemeChange={handleThemeChange}
      />
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
            doubleLeftDisabled={disabled[0]}
            leftDisabled={disabled[1]}
            rightDisabled={disabled[2]}
            doubleRightDisabled={disabled[3]}
            onDoubleLeft={handleDoubleLeft}
            onLeft={handleLeft}
            onRight={handleRight}
            onDoubleRight={handleDoubleRight}
          />
          <MenuUpdate
            value={archive.current?.state.liveUpdate}
            onChange={handleLiveModeChange}
          />
        </div>
        <div className={value === 1 ? "active" : "inactive"}>
          <Browser archive={archive.current} onSelect={handleSelect} />
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
