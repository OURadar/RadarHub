import React from "react";

import { ThemeProvider, StyledEngineProvider } from "@mui/material/styles";
import IconButton from "@mui/material/IconButton";
import {
  Refresh,
  Fullscreen,
  WebAsset,
  AccountCircle,
  LightMode,
  DarkMode,
} from "@mui/icons-material";
// import logo from "/static/images/radarhub-outline.png";

import { Notification } from "./notification";
import { theme } from "./theme";

const version = require("/package.json").version;

class StatusBody extends Notification {
  render() {
    return (
      <div id="statusBody" className={this.state.class}>
        {this.state.message}
      </div>
    );
  }
}

function StatusBodyQuick(props) {
  if (props.message.length > 1) {
    return <div id="statusBody">{props.message}</div>;
  }
  return <div className="invisible"></div>;
}

// Supply props with
// - ingest - real-time data ingest
// - xxx - archived data ingest

export function TopBar(props) {
  const name = props.ingest ? ` / ${props.ingest.radar}` : "";
  const [message, setMessage] = React.useState("");
  let online, status, notify;
  if (props.ingest) {
    online = props.ingest.state?.liveUpdate ? "online" : "offline";
    status = <StatusBody message={props.ingest.message} />;
    notify = <Notification message={props.ingest.response || message} />;
  } else {
    online = "offline";
    status = <StatusBody message={`Some text / props.mode = ${props.mode}`} />;
    notify = <Notification message={message} />;
  }
  return (
    <div>
      <div id="topbar" role="banner">
        <div className="topbarComponent" id="topbarHead">
          <img id="topbarLogo" />
          <div className="statusWrapper">
            <div id="statusLed" className={online}></div>
            <div id="versionTag">{`v${version}${name}`}</div>
            {status}
            {notify}
          </div>
        </div>
        <Console
          isMobile={props.isMobile || false}
          handleAccount={() => {
            setMessage(
              "<h3>Nothing 🍔</h3>Coming soon to v0.8<div class='emotion'>🤷🏻‍♀️</div>"
            );
            setTimeout(() => {
              setMessage("");
            }, 3500);
          }}
          handleModeChange={props.handleModeChange}
          mode={props.mode}
        />
      </div>
    </div>
  );
}

TopBar.defaultProps = {
  ingest: null,
  mode: "light",
  handleModeChange: () => {
    console.log(`handleModeChange()`);
  },
};

export function Console(props) {
  const [fullscreen, setFullscreen] = React.useState(
    window.innerHeight == screen.height
  );
  return (
    <ThemeProvider theme={theme}>
      <div className="topbarComponent" id="topbarTail">
        <IconButton
          aria-label="Refresh"
          onClick={() => {
            window.location.reload();
          }}
          size="large"
        >
          <Refresh style={{ color: "white" }} />
        </IconButton>
        {!props.isMobile && (
          <IconButton
            aria-label="Fullscreen"
            onClick={() => {
              if (fullscreen) document.webkitExitFullscreen();
              else document.documentElement.webkitRequestFullScreen();
              setFullscreen(!fullscreen);
            }}
            size="large"
          >
            {(fullscreen && <WebAsset style={{ color: "white" }} />) || (
              <Fullscreen style={{ color: "white" }} />
            )}
          </IconButton>
        )}
        <IconButton
          aria-label="Change Mode"
          onClick={props.handleModeChange}
          size="large"
        >
          {(props.mode == "light" && (
            <LightMode style={{ color: "white" }} />
          )) || <DarkMode style={{ color: "white" }} />}
        </IconButton>
        <IconButton
          aria-label="Account"
          onClick={() => {
            props.handleAccount();
          }}
          size="large"
        >
          <AccountCircle style={{ color: "white" }} />
        </IconButton>
      </div>
    </ThemeProvider>
  );
}
