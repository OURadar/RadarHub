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
  console.log(`h = ${h}`);
  return h;
};

export function App(props) {
  const [theme, setTheme] = React.useState(makeTheme());
  const [colors, setColors] = React.useState(colorDict());
  const [message, setMessage] = React.useState("");
  const [disabled, setDisabled] = React.useState([false, false, false, false]);

  const archive = React.useRef(null);

  const [, handleUpdate] = React.useReducer((x) => x + 1, 0);

  const handleLoad = () => {
    setDisabled(archive.current?.grid.pathsActive.map((x) => !x));
  };

  const [h, setH] = React.useState(getItemHeight(theme));

  useConstructor(() => {
    document.getElementById("device-style").setAttribute("href", `/static/css/mobile.css?h=${props.css_hash}`);

    archive.current = new Archive(props.pathway, props.name);
    archive.current.onUpdate = handleUpdate;
    archive.current.onLoad = handleLoad;
  });

  return (
    <div>
      <ThemeProvider theme={theme}>
        <Browser archive={archive.current} h={h} />
      </ThemeProvider>
    </div>
  );
}
