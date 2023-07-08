//
//  topbar.js - Top Bar
//  RadarHub
//
//  This is a view
//
//  Created by Boonleng Cheong
//

import React from "react";

import { getRandomMessageInHTML } from "./random-list";

import IconButton from "@mui/material/IconButton";
import {
  Info,
  Refresh,
  Fullscreen,
  WebAsset,
  AccountCircle,
  LightMode,
  DarkMode,
  Brightness4,
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

const themeModes = {
  light: <LightMode />,
  dark: <DarkMode />,
  auto: <Brightness4 />,
};

function RightDash(props) {
  const [fullscreen, setFullscreen] = React.useState(() => window.innerHeight == screen.height);

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
        {(props.mode in themeModes && themeModes[props.mode]) || <Brightness4 />}
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
        <div className={`statusLed ${online}`}></div>
        <div id="radarName">{`${name}`}</div>
        <Notification id="statusBody" message={message} timeout={10000} />
      </div>
    </div>
  );
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
        else setMessage(getRandomMessageInHTML());
        k += 1;
      }, 2000);
    } else if (props.test == 2) {
      setInterval(() => setMessage(getRandomMessageInHTML()), 3000);
    }
  }, []);
  return (
    <ThemeProvider theme={topbarTheme}>
      <div id="topbar" role="banner" className="blur">
        <LeftDash {...props} />
        <RightDash {...props} />
      </div>
      {props.test > 0 && <Notification message={message} />}
      <Notification id="appMessage" message={props.message} />
      {!props.isMobile && <Notification id="ingestResponse" message={props.ingest?.response || ""} />}
    </ThemeProvider>
  );
}

TopBar.defaultProps = {
  ingest: null,
  mode: "auto",
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
