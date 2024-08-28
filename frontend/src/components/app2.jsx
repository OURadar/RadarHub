//
//  app2.jsx - Draw Text
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

import { TopBar } from "./topbar";
import { Layout } from "./layout";
import { Health } from "./health";
import { ScopeB } from "./scope-b";

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

    ingest.current.connect();
  }, []);

  const view = (
    <div className="fullHeight">
      <div className="spacerTop" />
      <div className="fullHeightMinusTopbar">
        <ScopeB fifo={ingest.current?.data.ray} colors={user.current.preference.colors} />
      </div>
    </div>
  );
  const dashboard = (
    <div className="fullHeightScrollable">
      <div className="spacerTop" />
      <Health dict={ingest.current.data.health} />
    </div>
  );
  return (
    <div>
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
            </div>
          )}
        </ThemeProvider>
      </div>
    </div>
  );
}
