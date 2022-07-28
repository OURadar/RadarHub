import React from "react";

import IconButton from "@mui/material/IconButton";
import {
  Refresh,
  Fullscreen,
  WebAsset,
  AccountCircle,
  LightMode,
  DarkMode,
  HelpCenter,
} from "@mui/icons-material";
import { ThemeProvider, createTheme } from "@mui/material/styles";

import { RadarHubIcon } from "./radarhub-icon";
import { Notification } from "./notification";

const version = require("/package.json").version;

const emojis = require("emoji-name-map");

const topbarTheme = createTheme({
  components: {
    MuiSvgIcon: {
      styleOverrides: {
        root: {
          color: "white",
        },
      },
    },
  },
});

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
  const [message, setMessage] = React.useState("");
  let name, online, status, notify;
  if (props.ingest) {
    name = " / " + props.ingest.radar;
    online = props.ingest.state.liveUpdate === null ? "offline" : "online";
    status = <StatusBody message={props.ingest.message} />;
    notify = <Notification message={props.ingest.response || message} />;
  } else {
    name = "";
    online = "offline";
    status = <StatusBody />;
    notify = <Notification message={message} />;
  }
  return (
    <div>
      <ThemeProvider theme={topbarTheme}>
        <div id="topbar" role="banner" className="darkBackground">
          <div className="topbarComponent left">
            <IconButton
              onClick={() => {
                document.location = "/";
              }}
            >
              <RadarHubIcon />
            </IconButton>
            <div className="statusWrapper">
              <div className={online} id="statusLed"></div>
              <div id="versionTag">{`v${version}${name}`}</div>
              {status}
              {notify}
            </div>
          </div>
          <Console
            {...props}
            handleAccount={() => {
              setMessage("Fetching User Information ...");
              fetch("/profile/")
                .then((response) => {
                  if (response.status == 200) {
                    response.json().then(({ user, ip, emoji }) => {
                      let title =
                        user == "None" ? "Anonymous User" : `Hello ${user}`;
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
            }}
          />
        </div>
      </ThemeProvider>
    </div>
  );
}

TopBar.defaultProps = {
  ingest: null,
  mode: "light",
  handleThemeChange: () => {
    console.log(`Topbar.handleThemeChange()`);
  },
};

export function Console(props) {
  const [fullscreen, setFullscreen] = React.useState(
    window.innerHeight == screen.height
  );
  return (
    <div className="topbarComponent right">
      <IconButton
        aria-label="Help"
        onClick={props.handleHelpRequest}
        size="large"
      >
        <HelpCenter />
      </IconButton>
      <IconButton
        aria-label="Refresh"
        onClick={() => {
          window.location.reload();
        }}
        size="large"
      >
        <Refresh />
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
          {(fullscreen && <WebAsset />) || <Fullscreen />}
        </IconButton>
      )}
      <IconButton
        aria-label="Change Mode"
        onClick={props.handleThemeChange}
        size="large"
      >
        {(props.mode == "light" && <LightMode />) || <DarkMode />}
      </IconButton>
      <IconButton
        aria-label="Account"
        onClick={() => props.handleAccount()}
        size="large"
      >
        <AccountCircle />
      </IconButton>
    </div>
  );
}
