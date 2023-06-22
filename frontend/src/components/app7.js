//
//  app7.js - Virtual Scroll Playground
//  RadarHub
//
//  This is a controller
//
//  Created by Boonleng Cheong
//

import React from "react";

import { ThemeProvider } from "@mui/material/styles";

import { colorDict, makeTheme } from "./theme";

import { TopBar } from "./topbar";

import { Archive } from "./archive";

import { Browser } from "./browser-continuous";
import { User } from "./user";

const useConstructor = (callback = () => {}) => {
  const used = React.useRef(false);
  if (used.current) return;
  callback();
  used.current = true;
};

const getItemHeight = (theme) => {
  let h = 20;
  theme.components.MuiButton.variants.forEach((variant) => {
    if (variant.props.variant == "file") h = variant.style.height;
  });
  // console.log(`h = ${h}`);
  return h;
};

export function App(props) {
  const [theme, setTheme] = React.useState(makeTheme());
  const [colors, setColors] = React.useState(colorDict());
  const [message, setMessage] = React.useState("");
  const [disabled, setDisabled] = React.useState([false, false, false, false]);

  const archive = React.useRef(null);
  const user = React.useRef(null);

  const [, handleUpdate] = React.useReducer((x) => x + 1, 0);

  const handleLoad = () => {
    setDisabled(archive.current?.grid.pathsActive.map((x) => !x));
  };

  const [h, setH] = React.useState(getItemHeight(theme));

  const handleUserMessage = (message) => setMessage(message);

  const setDocumentTheme = (mode) => {
    document.documentElement.setAttribute("theme", mode);
    setColors(colorDict(mode));
    setTheme(makeTheme(mode));
  };

  const handleThemeChange = () => {
    console.log("App7.handleThemeChange()");
    let theme = colors.name == "light" ? "dark" : "light";
    setDocumentTheme(theme);
  };

  useConstructor(() => {
    document.getElementById("device-style").setAttribute("href", `/static/css/mobile.css?h=${props.css_hash}`);

    archive.current = new Archive(props.pathway, props.name);
    archive.current.onUpdate = handleUpdate;
    archive.current.onLoad = handleLoad;

    user.current = new User();
    user.current.onMessage = handleUserMessage;
  });

  React.useEffect(() => {
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
      let mode = e.matches ? "dark" : "light";
      setDocumentTheme(mode);
    });
    document.documentElement.setAttribute("theme", theme.palette.mode);
  }, []);

  return (
    <div>
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
          <Browser archive={archive.current} h={h} />
        </ThemeProvider>
      </div>
    </div>
  );
}
