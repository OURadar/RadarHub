//
//  app9.js - Archive Browser Mobile UI
//  RadarHub
//
//  This is a controller
//
//  Created by Boonleng Cheong
//

import React from "react";

import { ThemeProvider } from "@mui/material/styles";

import { colorDict, makeTheme } from "./theme";
import { Archive } from "./archive";
import { User } from "./user";

import { Splash } from "./splash";
import { TopBar } from "./topbar";
import { Browser } from "./browser-mobile";
import { Product } from "./product";
import { Navigation } from "./navigation";
import { MenuUpdate } from "./menu-update";
import { MenuArrow } from "./menu-arrow";

const useConstructor = (callback = () => {}) => {
  const used = React.useRef(false);
  if (used.current) return;
  callback();
  used.current = true;
};

export function App(props) {
  const [load, setLoad] = React.useState(0);
  const [panel, setPanel] = React.useState(0);
  const [theme, setTheme] = React.useState({});
  const [colors, setColors] = React.useState({});
  const [message, setMessage] = React.useState("");
  const [disabled, setDisabled] = React.useState([false, false, false, false]);

  const archive = React.useRef(null);
  const user = React.useRef(null);

  const [, handleUpdate] = React.useReducer((x) => x + 1, 0);

  const handleLoad = () => {
    setDisabled(archive.current?.grid.pathsActive.map((x) => !x));
  };

  const handleUserMessage = (message) => setMessage(message);

  const setColorMode = (mode) => {
    user.current.setMode(mode);
    let colors = colorDict(mode);
    document.documentElement.setAttribute("theme", colors.name);
    setColors(colors);
    setTheme(makeTheme(mode));
  };

  const handleThemeChange = () => {
    // auto, light, dark
    if (user.current.mode == "auto") setColorMode("light");
    else if (user.current.mode == "light") setColorMode("dark");
    else setColorMode("auto");
  };

  useConstructor(() => {
    document.getElementById("device-style").setAttribute("href", `/static/css/mobile.css?h=${props.css_hash}`);

    archive.current = new Archive(props.pathway, props.name);
    archive.current.onUpdate = handleUpdate;
    archive.current.onLoad = handleLoad;

    user.current = new User();
    user.current.onMessage = handleUserMessage;

    setColorMode(user.current.mode);
  });

  const handleNavigationChange = (_, value) => setPanel(value);

  const handleBrowserSelect = (k) => {
    console.log(`AppX.handleBrowserSelect()  k = ${k}`);
    setTimeout(() => setPanel(0), 300);
  };

  const handleOverlayLoad = (x = 1) => {
    setLoad(x);
    if (x == 1 && archive.current.state.liveUpdate === null) {
      archive.current.catchup();
    }
  };

  const handleLiveModeChange = (_, value) => archive.current.toggleLiveUpdate(value);

  const handleDoubleLeft = () => archive.current.navigateBackwardScan();
  const handleLeft = () => archive.current.navigateBackward();
  const handleRight = () => archive.current.navigateForward();
  const handleDoubleRight = () => archive.current.navigateForwardScan();

  const handleColorbarTouch = (e) => {
    // console.log(e);
    if (e.pageX / e.target.offsetWidth < 0.5) {
      archive.current.prevProduct();
    } else {
      archive.current.nextProduct();
    }
  };

  React.useEffect(() => {
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
      let mode = e.matches ? "dark" : "light";
      setColorMode(mode);
    });
    document.documentElement.setAttribute("theme", theme.palette.mode);
  }, []);

  return (
    <div>
      <Splash progress={load} />
      <div id="main" className="fullHeight">
        <TopBar
          mode={user.current?.mode || "auto"}
          isMobile={true}
          message={message}
          ingest={archive.current}
          onAccount={user.current.greet}
          onThemeChange={handleThemeChange}
        />
        <ThemeProvider theme={theme}>
          <div className={`${panel === 0 ? "active" : "inactive"} panel`}>
            <Product
              gravity="top"
              colors={colors}
              origin={props.origin}
              sweep={archive.current?.data.sweep}
              onOverlayLoad={handleOverlayLoad}
              onColorbarTouch={handleColorbarTouch}
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
            <MenuUpdate value={archive.current?.state.liveUpdate} onChange={handleLiveModeChange} />
          </div>
          <div className={`${panel === 1 ? "active" : "inactive"} panel`}>
            <Browser archive={archive.current} onSelect={handleBrowserSelect} />
          </div>
          <Navigation value={panel} onChange={handleNavigationChange} />
        </ThemeProvider>
      </div>
    </div>
  );
}

App.defaultProps = {
  pathway: "px1000",
  origin: {
    longitude: -97.422413,
    latitude: 35.25527,
  },
  debug: false,
  profileGL: false,
  autoLoad: true,
};
