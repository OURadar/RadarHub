import React from "react";
import IconButton from "@material-ui/core/IconButton";
import { Refresh, AccountCircle } from "@material-ui/icons";
import { ThemeProvider } from "@material-ui/core/styles";
import { theme } from "./theme";

export function StatusBar(props) {
  return (
    <div className="statusBar">
      <div className="leftPadded">{props.message}</div>
    </div>
  );
}

export function Pad(props) {
  return (
    <div id="upperRight">
      <ThemeProvider theme={theme}>
        <IconButton
          aria-label="Refresh"
          onClick={() => {
            window.location.reload();
          }}
        >
          <Refresh style={{ color: "var(--system-background)" }} />
        </IconButton>
        <IconButton
          aria-label="Account"
          onClick={() => {
            props.callback();
          }}
        >
          <AccountCircle style={{ color: "var(--system-background)" }} />
        </IconButton>
      </ThemeProvider>
    </div>
  );
}
