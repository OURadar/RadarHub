import React from "react";

import IconButton from "@mui/material/IconButton";
import {
  Refresh,
  Fullscreen,
  WebAsset,
  AccountCircle,
  LightMode,
  DarkMode,
  Info,
} from "@mui/icons-material";
import { ThemeProvider, createTheme } from "@mui/material/styles";

import { RadarHubIcon } from "./radarhub-icon";
import { Notification } from "./notification";

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

function RightDash(props) {
  const [fullscreen, setFullscreen] = React.useState(
    () => window.innerHeight == screen.height
  );
  return (
    <div className="topbarComponent right">
      {!props.isMobile && (
        <IconButton aria-label="Info" onClick={props.onInfoRequest}>
          <Info />
        </IconButton>
      )}
      <IconButton
        aria-label="Refresh"
        onClick={() => {
          window.location.reload();
        }}
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
        >
          {(fullscreen && <WebAsset />) || <Fullscreen />}
        </IconButton>
      )}
      <IconButton aria-label="Change Mode" onClick={props.onThemeChange}>
        {(props.mode == "light" && <LightMode />) || <DarkMode />}
      </IconButton>
      <IconButton aria-label="Account" onClick={props.onAccount}>
        <AccountCircle />
      </IconButton>
    </div>
  );
}

function LeftDash(props) {
  const ok = props.ingest !== undefined && props.ingest !== null;
  const name = ok ? props.ingest.label : "";
  const online = (ok && props.ingest.state.liveUpdate) || "unknown";
  const message = ok ? props.ingest.message : "";
  // const message = "PX-20200202-123456-E1.0-Z loaded and ready";
  return (
    <div className="topbarComponent left">
      <IconButton
        aria-label="Home"
        onClick={() => {
          document.location = "/";
        }}
      >
        <RadarHubIcon />
      </IconButton>
      <div className="statusWrapper">
        <div className={online} id="statusLed"></div>
        <div id="radarName">{`${name}`}</div>
        <Notification id="statusBody" message={message} timeout={10000} />
      </div>
    </div>
  );
}

function getMessage() {
  const randomIndex = Math.floor((Math.random() * 100) % messages.length);
  console.log(randomIndex);
  return messages[randomIndex];
}

// Supply props with
// - ingest - real-time data ingest
// - xxx - archived data ingest

export function TopBar(props) {
  const [message, setMessage] = React.useState(props.message);
  React.useEffect(() => {
    if (props.test == 1) {
      let k = 0;
      setInterval(() => {
        if (k % 2 == 0) setMessage("");
        else setMessage(getMessage());
        k += 1;
      }, 1000);
    } else if (props.test == 2) {
      setInterval(() => setMessage(getMessage()), 2000);
    }
  }, []);
  return (
    <ThemeProvider theme={topbarTheme}>
      <div id="topbar" role="banner" className="blur">
        <LeftDash {...props} />
        <RightDash {...props} onAccount={props.onAccount} />
      </div>
      {props.test > 0 && <Notification message={message} />}
      <Notification id="appMessage" message={props.message} />
      {!props.isMobile && (
        <Notification
          id="ingestResponse"
          message={props.ingest?.response || ""}
        />
      )}
    </ThemeProvider>
  );
}

TopBar.defaultProps = {
  ingest: null,
  mode: "light",
  message: "",
  isMobile: false,
  test: 0,
  onThemeChange: () => {
    console.log("Topbar.onThemeChange()");
  },
  onInfoRequest: () => {
    console.log("Topbar.onInfoRequest()");
  },
  onAccount: () => {
    console.log("Topbar.onAccount()");
  },
};

const messages = [
  "New Reciple",
  "Radar Online",
  "Maintenance",
  "Archiving ...",
];
