import React from "react";

import { ThemeProvider } from "@mui/material/styles";

import { Splash } from "./splash";
import { colorDict, makeTheme } from "./theme";

import { TopBar } from "./topbar";
import { Browser } from "./browser-mobile";
import { Product } from "./product";
import { Navigation } from "./navigation";

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

export function App(props) {
  const [load, setLoad] = React.useState(0);
  const [panel, setPanel] = React.useState(0);
  const [theme, setTheme] = React.useState(makeTheme());
  const [colors, setColors] = React.useState(colorDict());
  const [message, setMessage] = React.useState("");
  const [disabled, setDisabled] = React.useState([false, false, false, false]);

  const archive = React.useRef(null);

  const [, handleUpdate] = React.useReducer((x) => x + 1, 0);

  const handleLoad = () => {
    setDisabled(archive.current?.grid.pathsActive.map((x) => !x));
  };

  const setDocumentTheme = (mode) => {
    document.documentElement.setAttribute("theme", mode);
    setColors(() => colorDict(mode));
    setTheme(() => makeTheme(mode));
  };

  const handleThemeChange = () => {
    console.log("AppX.handleThemeChange()");
    let theme = colors.name == "light" ? "dark" : "light";
    setDocumentTheme(theme);
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

  const handleLiveModeChange = (_, value) =>
    archive.current.toggleLiveUpdate(value);

  const handleDoubleLeft = () => archive.current.navigateBackwardScan();
  const handleLeft = () => archive.current.navigateBackward();
  const handleRight = () => archive.current.navigateForward();
  const handleDoubleRight = () => archive.current.navigateForwardScan();

  useConstructor(() => {
    document
      .getElementById("device-style")
      .setAttribute("href", `/static/css/mobile.css?h=${props.css_hash}`);

    archive.current = new Archive(props.radar, props.name);
    archive.current.onUpdate = handleUpdate;
    archive.current.onLoad = handleLoad;
  });

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
    <div>
      <Splash progress={load} />
      <div id="main" className="fullHeight">
        <TopBar
          mode={colors.name}
          isMobile={true}
          message={message}
          ingest={archive.current}
          onAccount={handleAccount}
          onThemeChange={handleThemeChange}
        />
        <ThemeProvider theme={theme}>
          <div className={panel === 0 ? "active" : "inactive"}>
            <Product
              gravity="top"
              colors={colors}
              origin={props.origin}
              sweep={archive.current?.data.sweep}
              onOverlayLoad={handleOverlayLoad}
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
          <div className={panel === 1 ? "active" : "inactive"}>
            <Browser archive={archive.current} onSelect={handleBrowserSelect} />
          </div>
          <Navigation value={panel} onChange={handleNavigationChange} />
        </ThemeProvider>
      </div>
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
