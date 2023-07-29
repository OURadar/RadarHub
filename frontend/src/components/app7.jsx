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

import { Archive } from "./archive";
import { User } from "./user";

import { TopBar } from "./topbar";
import { Browser } from "./browser-class";

const useConstructor = (callback = () => {}) => {
  const used = React.useRef(false);
  if (used.current) return;
  callback();
  used.current = true;
};

export function App(props) {
  const nameStyle = "background-color: #667788; color: white; padding: 2px 4px; border-radius: 3px; margin: -2px 0";

  const [h, setH] = React.useState(16);
  const [message, setMessage] = React.useState("");
  const [progress, setProgress] = React.useState(0.1);

  const archive = React.useRef(null);
  const user = React.useRef(null);

  const [, handleUpdate] = React.useReducer((x) => x + 1, 0);

  const handleUserMessage = (message) => setMessage(message);

  const handleThemeChange = () => {
    console.log("App7.handleThemeChange()");
    if (user.current.mode == "auto") setColorMode("light");
    else if (user.current.mode == "light") setColorMode("dark");
    else setColorMode("auto");
  };

  const handleOverlayLoad = (x = 1) => {
    setProgress(x);
    if (x == 1 && archive.current.state.liveUpdate === null) {
      archive.current.catchup();
    }
  };

  useConstructor(() => {
    // document.getElementById("device-style").setAttribute("href", `/static/css/desktop.css?h=${props.css_hash}`);

    archive.current = new Archive(props.pathway, props.name);
    archive.current.onUpdate = handleUpdate;

    user.current = new User();
    user.current.onMessage = handleUserMessage;
    user.current.onUpdate = handleUpdate;

    setH(user.current.getThemeItemHeight());
  });

  React.useEffect(() => {
    handleOverlayLoad();
  }, []);

  return (
    <div>
      <div id="main" className="fullHeight">
        <TopBar
          mode={user.current.preference.mode}
          isMobile={true}
          message={message}
          ingest={archive.current}
          onAccount={user.current.greet}
          onThemeChange={() => user.current.nextMode()}
        />
        <ThemeProvider theme={user.current.preference.theme}>
          <Browser archive={archive.current} h={h} />
        </ThemeProvider>
      </div>
    </div>
  );
}
