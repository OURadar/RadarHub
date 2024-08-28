//
//  appX.js - Replacement of app5
//  RadarHub
//
//  This is a controller
//
//  Created by Boonleng Cheong
//

import React from "react";

import { ThemeProvider } from "@mui/material/styles";

import { detectMob } from "./common";
import { Live } from "./live";
import { User } from "./user";

import { Splash } from "./splash";
import { TopBar } from "./topbar";
import { Layout } from "./layout";
import { Health } from "./health";
import { Control } from "./control";
import { Scope2 } from "./scope2";
import { Sweep } from "./sweep";
import { Navigation } from "./navigation";
import { HelpPage } from "./help";

const useConstructor = (callback = () => {}) => {
  const used = React.useRef(false);
  if (used.current) return;
  callback();
  used.current = true;
};

export function App(props) {
  const nameStyle = "background-color: #667788; color: white; padding: 2px 4px; border-radius: 3px; margin: -2px 0";

  const [panel, setPanel] = React.useState(0);
  const [message, setMessage] = React.useState("");
  const [progress, setProgress] = React.useState(0.1);
  const [showHelpSheet, setShowHelpSheet] = React.useState(false);

  const ingest = React.useRef(null);
  const user = React.useRef(null);

  const isMobile = detectMob();

  let key = 0;
  let timeout = null;

  const [, handleUpdate] = React.useReducer((x) => {
    // console.debug(`AppC.handleUpdate x = ${x}`);
    return x + 1;
  }, 0);

  const handleBlur = (_e) => {
    console.info(`%cApp.event.blur%c`, nameStyle, "");
    // user.current.setUpdate(ingest.current.state.liveUpdate);
    if (ingest.current.state.liveUpdate != "offline") {
      console.info("%cApp.event.blur%c Setting timeout for disconnect ...", nameStyle, "");
      timeout = setTimeout(() => {
        // ingest.current.disableLiveUpdate();
        console.info("%cApp.event.blur%c Disconnecting (fake) ...", nameStyle, "");
        timeout = null;
      }, 5000);
    }
  };
  const handleFocus = (_e) => {
    console.info(`%cApp.event.focus%c`, nameStyle, "");
    // if (timeout) {
    //   clearTimeout(timeout);
    //   timeout = null;
    // }
    // if (user.current.preference.update != "offline" && ingest.current.state.liveUpdate == "offline") {
    //   ingest.current.enableLiveUpdate();
    // }
  };

  useConstructor(() => {
    if (!isMobile) {
      document.getElementById("device-style").setAttribute("href", `/static/css/desktop.css?h=${props.css_hash}`);
    }

    console.log(`%cApp.constructor%c pathway = ${props.pathway}`, nameStyle, "");

    ingest.current = new Live(props.pathway);
    ingest.current.onUpdate = handleUpdate;

    user.current = new User();
    user.current.onMessage = setMessage;
    user.current.onUpdate = handleUpdate;
  });
  React.useEffect(() => {
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
      if (key == "c") {
        console.log(`%cApp.event.keyup%c c key ...`, nameStyle, "");
        ingest.current.clearView();
      }
    });

    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);
  }, []);

  const view = (
    <div className="fullHeight">
      <Sweep
        gravity={(isMobile && "top") || "right"}
        colors={user.current.preference.colors}
        fifo={ingest.current?.data.ray}
        origin={props.origin}
        onOverlayLoad={(x = 1) => {
          if (x == 1 && ingest.current.state.liveUpdate === false) {
            ingest.current.connect();
          }
          setProgress(Math.min(x + 0.5, 1.0));
        }}
      />
    </div>
  );
  const dashboard = (
    <div className="fullHeightScrollable">
      <div className="spacerTop" />
      <Health dict={ingest.current.data.health} />
      <Control ingest={ingest.current} />
      <Scope2 data={ingest.current.data} colors={user.current.preference.colors} />
    </div>
  );
  return (
    <div>
      <Splash progress={progress} />
      <div id="main" className="fullHeight">
        <TopBar
          mode={user.current.preference.mode}
          isMobile={isMobile}
          message={message}
          ingest={ingest.current}
          onThemeChange={() => user.current.nextMode()}
          onInfoRequest={() => setShowHelpSheet(true)}
          onAccount={() => user.current.greet()}
          onDismiss={(e) => {
            if (
              e.clientX - e.target.offsetLeft < 0.1 * e.target.offsetWidth &&
              e.clientY - e.target.offsetTop > 0.5 * e.target.offsetHeight
            ) {
              user.current.setAgree(false);
            }
          }}
        />
        <ThemeProvider theme={user.current.preference.theme}>
          {(isMobile && (
            <div>
              <div className={`fullHeight panel ${panel === 0 ? "active" : "inactive"}`}>{product}</div>
              <div className={`fullHeight panel ${panel === 1 ? "active" : "inactive"}`}>{browser}</div>
              <Navigation value={panel} onChange={(_, value) => setPanel(value)} />
            </div>
          )) || (
            <div>
              <Layout name="split-live-width" left={view} right={dashboard} />
              <HelpPage open={showHelpSheet} onClose={() => setShowHelpSheet(false)} />
            </div>
          )}
        </ThemeProvider>
      </div>
    </div>
  );
}
