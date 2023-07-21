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
  const [disabled, setDisabled] = React.useState([true, true, true, true]);

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
    setDisabled(archive.current?.grid.pathsActive.map((x) => !x) || [true, true, true, true]);
  };

  const handleUserMessage = (message) => setMessage(message);

  useConstructor(() => {
    if (!isMobile)
      document.getElementById("device-style").setAttribute("href", `/static/css/desktop.css?h=${props.css_hash}`);

    archive.current = new Archive(props.pathway, props.name);
    archive.current.onUpdate = handleUpdate;
    archive.current.onLoad = handleLoad;

    user.current = new User();
    user.current.onMessage = handleUserMessage;

    setColorMode(user.current.preference.mode);
  });

  let key = 0;

  React.useEffect(() => {
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
      let mode = e.matches ? "dark" : "light";
      setDocumentTheme(mode);
    });
    document.documentElement.setAttribute("theme", theme.palette.mode);
    window.addEventListener("keydown", (e) => (key = e.key));
    window.addEventListener("keyup", (e) => {
      if (e.key != key) {
        return;
      }
      let symbol = e.key.toUpperCase();
      const styles = ["Z", "V", "W", "D", "P", "R"];
      if (styles.indexOf(symbol) != -1) {
        archive.current.switch(symbol);
      } else if (symbol == "L") {
        archive.current.toggleLiveUpdate();
      } else if (e.target == document.body) {
        if (e.key == "ArrowRight") {
          archive.current.navigateForwardScan();
        } else if (e.key == "ArrowLeft") {
          archive.current.navigateBackwardScan();
        } else if (e.key == "ArrowUp") {
          archive.current.navigateBackward();
        } else if (e.key == "ArrowDown") {
          archive.current.navigateForward();
        } else if (e.key == " ") {
          archive.current.playPause();
          // } else {
          //   console.log(e.key);
        }
      }
    });

    let timeout;
    window.addEventListener("blur", (_e) => {
      console.log(`Off focus   user updateMode = ${archive.current.state.liveUpdate}`);
      user.current.setUpdate(archive.current.state.liveUpdate);
      if (archive.current.state.liveUpdate != "offline") {
        console.log("Setting timeout for disconnect ...");
        timeout = setTimeout(() => {
          archive.current.disableLiveUpdate();
          timeout = null;
        }, 5000);
      }
    });
    window.addEventListener("focus", (_e) => {
      console.log(`On focus   user updateMode = ${user.current.preference.update}`);
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
      if (user.current.preference.update != "offline" && archive.current.state.liveUpdate == "offline") {
        archive.current.enableLiveUpdate();
      }
    });
  }, []);

  const product = (
    <div className={`fullHeight`}>
      <Product
        gravity={(isMobile && "top") || "right"}
        colors={colors}
        origin={props.origin}
        sweeps={archive.current?.data.sweeps}
        onOverlayLoad={(x = 1) => {
          setLoad(x);
          if (x == 1 && archive.current.state.liveUpdate === null) {
            archive.current.catchup();
          }
        }}
        onColorbarClick={(e) => {
          if (isMobile) {
            if (e.pageX / e.target.offsetWidth < 0.5) {
              archive.current.prevProduct();
            } else {
              archive.current.nextProduct();
            }
          } else {
            let dy = e.pageY - e.target.offsetTop;
            if (dy / e.target.offsetHeight < 0.5) {
              archive.current.prevProduct();
            } else {
              archive.current.nextProduct();
            }
          }
        }}
        onMiddleViewTap={() => archive.current.playPause()}
        debug={false}
      />
      <MenuArrow
        tic={archive.current?.grid?.tic}
        doubleLeftDisabled={disabled[0]}
        leftDisabled={disabled[1]}
        rightDisabled={disabled[2]}
        doubleRightDisabled={disabled[3]}
        play={archive.current?.data.sweeps.length > 1 || false}
        onDoubleLeft={() => archive.current.navigateBackwardScan()}
        onLeft={() => archive.current.navigateBackward()}
        onPlay={() => archive.current.playPause()}
        onRight={() => archive.current.navigateForward()}
        onDoubleRight={() => archive.current.navigateForwardScan()}
      />
      <MenuUpdate
        value={archive.current?.state.liveUpdate}
        onChange={(_, value) => archive.current.toggleLiveUpdate(value || "offline")}
      />
    </div>
  );
  const browser = <Browser archive={archive.current} h={h} onSelect={() => setTimeout(() => setPanel(0), 300)} />;

  return (
    <div>
      <Splash progress={load} />
      <div id="main" className="fullHeight">
        <TopBar
          mode={user.current.preference.mode}
          isMobile={isMobile}
          message={message}
          ingest={archive.current}
          onAccount={() => user.current.greet()}
          onThemeChange={() => {
            if (user.current.preference.mode == "auto") {
              // if (document.documentElement.getAttribute("theme") === "light") {
              //   setColorMode("dark");
              // } else {
              //   setColorMode("auto");
              // }
              setColorMode("light");
            } else if (user.current.preference.mode == "light") {
              setColorMode("dark");
            } else {
              setColorMode("auto");
            }
          }}
        />
        <ThemeProvider theme={theme}>
          {(isMobile && (
            <div>
              <div className={`fullHeight panel ${panel === 0 ? "active" : "inactive"}`}>{product}</div>
              <div className={`fullHeight panel ${panel === 1 ? "active" : "inactive"}`}>{browser}</div>
              <Navigation value={panel} onChange={(_, value) => setPanel(value)} />
            </div>
          )) || (
            <div>
              <Layout name="split-archive-width" left={product} right={browser} />
            </div>
          )}
        </ThemeProvider>
      </div>
    </div>
  );
}
