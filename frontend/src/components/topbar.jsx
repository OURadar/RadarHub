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

import { IconButton } from "@mui/material";
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
import { Progress } from "./progress";

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
      <IconButton aria-label="Refresh" onClick={() => window.location.reload()}>
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
        <div className={`statusLed ${online}`} onClick={() => props.ingest?.toggleLiveUpdate()}></div>
        <div id="radarName">{`${name}`}</div>
        <Notification id="statusBody" message={message} timeout={10000} />
      </div>
    </div>
  );
}

// Supply props with
// - ingest - real-time data ingest
// - xxx - archived data ingest
//  <Progress id="topbarProgress" value={props.ingest?.progress || 100} style="transform: translateX({})" />
export function TopBar({
  ingest = null,
  mode = "auto",
  message = "",
  isMobile = false,
  test = 0,
  onThemeChange = () => console.log("Topbar.onThemeChange()"),
  onInfoRequest = () => console.log("Topbar.onInfoRequest()"),
  onAccount = () => console.log("Topbar.onAccount()"),
  onDismiss = () => console.log("Topbar.onDismiss()"),
}) {
  const [displayMessage, setDisplayMessage] = React.useState(message);
  React.useEffect(() => {
    if (test == 1) {
      let k = 0;
      setInterval(() => {
        if (k % 2 == 0) setDisplayMessage("");
        else setDisplayMessage(getRandomMessageInHTML());
        k += 1;
      }, 2000);
    } else if (test == 2) {
      setInterval(() => setDisplayMessage(getRandomMessageInHTML()), 3000);
    }
  }, []);
  return (
    <ThemeProvider theme={topbarTheme}>
      <div id="topbar" role="banner" className="blur">
        <LeftDash ingest={ingest} />
        <RightDash
          isMobile={isMobile}
          mode={mode}
          onThemeChange={onThemeChange}
          onInfoRequest={onInfoRequest}
          onAccount={onAccount}
        />
        <Progress id="topbarProgress" value={ingest?.progress || 100} />
      </div>
      {test > 0 && <Notification message={displayMessage} />}
      <Notification id="appMessage" message={displayMessage} onClick={(e) => onDismiss(e)} />
      {!isMobile && <Notification id="ingestResponse" message={ingest?.response || ""} />}
    </ThemeProvider>
  );
}
