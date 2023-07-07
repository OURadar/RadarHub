//
//  app8.js - Replacement of app6
//  RadarHub
//
//  This is a controller
//
//  Created by Boonleng Cheong
//

import React from "react";

import { ThemeProvider } from "@mui/material/styles";

import { colorDict, makeTheme } from "./theme";
import { detectMob } from "./common";
import { Archive } from "./archive";
import { User } from "./user";

import { Splash } from "./splash";
import { TopBar } from "./topbar";
import { Layout } from "./layout";
import { Browser } from "./browser-class";
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

const getItemHeight = (theme) => {
  let h = 20;
  theme.components.MuiButton.variants.forEach((variant) => {
    if (variant.props.variant == "file" && variant.style.height !== undefined) {
      h = variant.style.height;
      return false;
    }
    // console.log(variant);
  });
  return h;
};

export function App(props) {
  const [load, setLoad] = React.useState(0);
  const [panel, setPanel] = React.useState(0);
  const [theme, setTheme] = React.useState(makeTheme());
  const [colors, setColors] = React.useState(colorDict());
  const [message, setMessage] = React.useState("");
  const [disabled, setDisabled] = React.useState([false, false, false, false]);

  const archive = React.useRef(null);
  const user = React.useRef(null);

  const h = getItemHeight(theme);
  const isMobile = detectMob();

  const setColorMode = (mode) => {
    user.current.setMode(mode);
    let colors = colorDict(mode);
    document.documentElement.setAttribute("theme", colors.name);
    setColors(colors);
    setTheme(makeTheme(mode));
  };

  const [, handleUpdate] = React.useReducer((x) => x + 1, 0);

  const handleLoad = () => {
    setDisabled(archive.current?.grid.pathsActive.map((x) => !x));
  };

  const handleUserMessage = (message) => setMessage(message);

  const handleThemeChange = () => {
    console.log("AppX.handleThemeChange()");
    if (user.current.mode == "auto") setColorMode("light");
    else if (user.current.mode == "light") setColorMode("dark");
    else setColorMode("auto");
  };

  const handleOverlayLoad = (x = 1) => {
    setLoad(x);
    if (x == 1 && archive.current.state.liveUpdate === null) {
      archive.current.catchup();
    }
  };

  const handleNavigationChange = (_, value) => setPanel(value);

  const handleBrowserSelect = (k) => {
    // console.log(`AppX.handleBrowserSelect()  k = ${k}`);
    setTimeout(() => setPanel(0), 300);
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

  useConstructor(() => {
    if (!isMobile)
      document.getElementById("device-style").setAttribute("href", `/static/css/desktop.css?h=${props.css_hash}`);

    archive.current = new Archive(props.pathway, props.name);
    archive.current.onUpdate = handleUpdate;
    archive.current.onLoad = handleLoad;

    user.current = new User();
    user.current.onMessage = handleUserMessage;

    setColorMode(user.current.mode);
  });

  React.useEffect(() => {
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
      let mode = e.matches ? "dark" : "light";
      setDocumentTheme(mode);
    });
    document.documentElement.setAttribute("theme", theme.palette.mode);
    handleOverlayLoad();
  }, []);

  if (isMobile)
    return (
      <div>
        <Splash progress={load} />
        <div id="main" className="fullHeight">
          <TopBar
            mode={colors.name}
            isMobile={true}
            message={message}
            ingest={archive.current}
            onAccount={user.current.greet}
            onThemeChange={handleThemeChange}
          />
          <ThemeProvider theme={theme}>
            <div className={`fullHeight panel ${panel === 0 ? "active" : "inactive"}`}>
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
            <div className={`fullHeight panel ${panel === 1 ? "active" : "inactive"}`}>
              <Browser archive={archive.current} h={h} onSelect={handleBrowserSelect} />
            </div>
            <Navigation value={panel} onChange={handleNavigationChange} />
          </ThemeProvider>
        </div>
      </div>
    );
  else
    return (
      <div>
        <Splash progress={load} />
        <div id="main" className="fullHeight">
          <TopBar
            mode={colors.name}
            isMobile={true}
            message={message}
            ingest={archive.current}
            onAccount={user.current.greet}
            onThemeChange={handleThemeChange}
          />
          <ThemeProvider theme={theme}>
            <Layout
              name="split-archive-width"
              left={
                <Product
                  colors={colors}
                  origin={props.origin}
                  sweep={archive.current?.data.sweep}
                  onOverlayLoad={handleOverlayLoad}
                  onColorbarTouch={handleColorbarTouch}
                />
              }
              right={<Browser archive={archive.current} h={h} onSelect={handleBrowserSelect} />}
            />
          </ThemeProvider>
        </div>
      </div>
    );
}
