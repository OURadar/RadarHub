//
//  appX.js - Replacement of app6 & app9
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
import { HelpPage } from "./help";
import { TermPopup, TermSheet } from "./term";

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
  });
  return h;
};

export function App(props) {
  const nameStyle = "background-color: #667788; color: white; padding: 2px 4px; border-radius: 3px; margin: -2px 0";
  const nextMode = { auto: "light", light: "dark", dark: "auto" };

  const [load, setLoad] = React.useState(0);
  const [panel, setPanel] = React.useState(0);
  const [theme, setTheme] = React.useState(makeTheme());
  const [colors, setColors] = React.useState(colorDict());
  const [message, setMessage] = React.useState("");
  const [showHelp, setShowHelp] = React.useState(false);
  const [showTermPopup, setShowTermPopup] = React.useState(false);

  const archive = React.useRef(null);
  const user = React.useRef(null);

  const h = getItemHeight(theme);
  const isMobile = detectMob();

  let key = 0;
  let timeout = null;

  const setColorMode = (mode) => {
    const newColors = colorDict(mode);
    user.current.setMode(mode);
    setTheme(makeTheme(mode));
    setColors(newColors);
    document.documentElement.setAttribute("theme", newColors.name);
  };

  const [, handleUpdate] = React.useReducer((x) => {
    // console.debug(`AppX.handleUpdate x = ${x}`);
    return x + 1;
  }, 0);

  // const [state, dispatch] = React.useReducer(reducer, { myState: 0 });

  const handleUserAgree = () => {
    user.current.setAgree();
    setShowTermPopup(false);
  };

  const handleBlur = (_e) => {
    console.info(`%cApp.event.blur%c updateMode = ${user.current.preference.update}`, nameStyle, "");
    user.current.setUpdate(archive.current.state.liveUpdate);
    if (archive.current.state.liveUpdate != "offline") {
      console.info("%cApp.event.blur%c Setting timeout for disconnect ...", nameStyle, "");
      timeout = setTimeout(() => {
        archive.current.disableLiveUpdate();
        timeout = null;
      }, 5000);
    }
  };
  const handleFocus = (_e) => {
    console.info(`%cApp.event.focus%c updateMode = ${user.current.preference.update}`, nameStyle, "");
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
    if (user.current.preference.update != "offline" && archive.current.state.liveUpdate == "offline") {
      archive.current.enableLiveUpdate();
    }
  };

  useConstructor(() => {
    if (!isMobile) {
      document.getElementById("device-style").setAttribute("href", `/static/css/desktop.css?h=${props.css_hash}`);
    }

    archive.current = new Archive(props.pathway, props.name);
    archive.current.onUpdate = handleUpdate;

    user.current = new User();
    user.current.onMessage = setMessage;

    setColorMode(user.current.preference.mode);
    setShowTermPopup(!user.current.preference.agree);
  });

  React.useEffect(() => {
    document.documentElement.setAttribute("theme", theme.palette.mode);
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
      setColorMode(e.matches ? "dark" : "light");
    });
    window.addEventListener("keydown", (e) => {
      if (!["Alt", "Control", "Meta", "Shift"].includes(e.key)) {
        key = e.key;
      }
    });
    window.addEventListener("keyup", (e) => {
      if (e.key == "Meta") {
        if (key == "i") {
          console.log(`%cApp.event.keyup%c Removing blur/focus listeners ...`, nameStyle, "");
          window.removeEventListener("blur", handleBlur);
          window.removeEventListener("focus", handleFocus);
        } else if (key == "u") {
          console.log(`%cApp.event.keyup%c Reset agreement ...`, nameStyle, "");
          user.current.setAgree(false);
        }
        return;
      }
      if (e.key != key) {
        return;
      }
      let symbol = e.key.toUpperCase();
      const styles = ["Z", "V", "W", "D", "P", "R"];
      if (styles.includes(symbol)) {
        archive.current.switch(symbol);
      } else if (symbol == "L") {
        archive.current.toggleLiveUpdate();
      } else if (e.key == " ") {
        archive.current.playPause();
      } else if (e.target == document.body) {
        if (e.key == "ArrowRight") {
          archive.current.navigateRight();
        } else if (e.key == "ArrowLeft") {
          archive.current.navigateLeft();
        } else if (e.key == "ArrowUp") {
          archive.current.navigateUp();
        } else if (e.key == "ArrowDown") {
          archive.current.navigateDown();
        }
      }
    });

    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);
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
          if (e.target.id == "symbol" || e.target.id == "text") {
            archive.current.nextProduct();
          } else if (e.target.id == "colorbar") {
            if (isMobile) {
              if (e.pageX / e.target.offsetWidth < 0.5) {
                archive.current.prevProduct();
              } else {
                archive.current.nextProduct();
              }
            } else {
              let dy = e.pageY - e.target.offsetTop;
              if (dy / e.target.offsetHeight < 0.5) {
                archive.current.nextProduct();
              } else {
                archive.current.prevProduct();
              }
            }
          }
        }}
        onMiddleViewTap={() => archive.current.playPause()}
        debug={false}
      />
      <MenuArrow ingest={archive.current} />
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
          onThemeChange={() => setColorMode(nextMode[user.current.preference.mode])}
          onInfoRequest={() => setShowHelp(true)}
          onAccount={() => user.current.greet()}
          onDismiss={(e) => {
            if (
              e.clientX - e.target.offsetLeft < 0.1 * e.target.offsetWidth &&
              e.clientY - e.target.offsetTop > 0.5 * e.target.offsetHeight
            ) {
              console.log(`%cApp.TopBar.onDismiss%c Reset agreement ...`, nameStyle, "");
              user.current.setAgree(false);
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
              <HelpPage open={showHelp} onClose={() => setShowHelp(false)} />
            </div>
          )}
          {showTermPopup && <TermPopup onClose={handleUserAgree} />}
        </ThemeProvider>
      </div>
    </div>
  );
}
