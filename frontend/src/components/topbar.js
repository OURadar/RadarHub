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

import { Notification as Notification2 } from "./notification-v2";

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
      <div id="statusBody" className={`${this.state.class} blur`}>
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
        <StatusBody message={message} />
      </div>
    </div>
  );
}

// Supply props with
// - ingest - real-time data ingest
// - xxx - archived data ingest

export function TopBar(props) {
  return (
    <ThemeProvider theme={topbarTheme}>
      <div id="topbar" role="banner" className="blur">
        <LeftDash {...props} />
        <RightDash {...props} onAccount={props.onAccount} />
      </div>
      <Notification message={props.ingest?.response || ""} />
      <Notification message={props.message} />
      <Notification2 message="Hello" />
    </ThemeProvider>
  );
}

TopBar.defaultProps = {
  ingest: null,
  mode: "light",
  message: "",
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
