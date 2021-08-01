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

export function TopBar(props) {
  const prefix = "v" + version + " / " + props.ingest.radar;
  const [message, setMessage] = React.useState("");
  return (
    <div>
      <div id="topbar">
        <h1>RadarHub</h1>
        <div id="statusPrefix">{prefix}</div>
        <StatusBody message={props.ingest.message} />
        <Notification message={props.ingest.response || message} />
        <Console
          isMobile={props.isMobile}
          handleAccount={() => {
            setMessage(
              "<h3>Nothing 🍔</h3>Coming soon to v0.8<div class='emotion'>🤷🏻‍♀️</div>"
            );
            setTimeout(() => {
              setMessage("");
            }, 2000);
          }}
        />
      </div>
    </div>
  );
}

export function Console(props) {
  return (
    <div id="console">
      <ThemeProvider theme={theme}>
        <IconButton
          aria-label="Refresh"
          onClick={() => {
            window.location.reload();
          }}
        >
          <Refresh style={{ color: "var(--system-background)" }} />
        </IconButton>
        {!props.isMobile && (
          <IconButton
            aria-label="Fullscreen"
            onClick={() => {
              document.documentElement.webkitRequestFullScreen();
            }}
          >
            <Fullscreen style={{ color: "var(--system-background)" }} />
          </IconButton>
        )}
        <IconButton
          aria-label="Account"
          onClick={() => {
            props.handleAccount();
          }}
        >
          <AccountCircle style={{ color: "var(--system-background)" }} />
        </IconButton>
      </ThemeProvider>
    </div>
  );
}