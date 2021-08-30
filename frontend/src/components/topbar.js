import React from "react";

import { ThemeProvider } from "@material-ui/core/styles";
import IconButton from "@material-ui/core/IconButton";
import { Refresh, Fullscreen, AccountCircle } from "@material-ui/icons";

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
  const name = props.ingest ? " / " + props.ingest.radar : "";
  const prefix = "v" + version + name;
  const [message, setMessage] = React.useState("");
  let status, notify;
  if (props.ingest) {
    status = <StatusBody message={props.ingest.message} />;
    notify = <Notification message={props.ingest.response ?? message} />;
  } else {
    status = <StatusBody message="Some text" />;
    notify = <Notification message={message} />;
  }
  return (
    <div>
      <div id="topbar">
        <h1>RadarHub</h1>
        <div id="statusPrefix">{prefix}</div>
        {status}
        {notify}
        <Console
          isMobile={props.isMobile}
          handleAccount={() => {
            setMessage(
              "<h3>Nothing 🍔</h3>Coming soon to v0.8<div class='emotion'>🤷🏻‍♀️</div>"
            );
            setTimeout(() => {
              setMessage("");
            }, 3500);
          }}
        />
      </div>
    </div>
  );
}

export function Console(props) {
  const [fullscreen, setFullscreen] = React.useState(
    window.innerHeight == screen.height
  );
  return (
    <div id="console">
      <ThemeProvider theme={theme}>
        <IconButton
          aria-label="Refresh"
          onClick={() => {
            window.location.reload();
          }}
        >
          <Refresh style={{ color: "white" }} />
        </IconButton>
        {!props.isMobile && !fullscreen && (
          <IconButton
            aria-label="Fullscreen"
            onClick={() => {
              document.documentElement.webkitRequestFullScreen();
              setFullscreen(true);
            }}
          >
            <Fullscreen style={{ color: "white" }} />
          </IconButton>
        )}
        <IconButton
          aria-label="Account"
          onClick={() => {
            props.handleAccount();
          }}
        >
          <AccountCircle style={{ color: "white" }} />
        </IconButton>
      </ThemeProvider>
    </div>
  );
}
