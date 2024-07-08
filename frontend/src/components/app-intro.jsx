//
//  app-intro.js - Topbar Only
//  RadarHub
//
//  This is a controller
//
//  Created by Boonleng Cheong
//

import React from "react";

import { ThemeProvider } from "@mui/material/styles";

import { detectMob } from "./common";
import { User } from "./user";

import { TopBar } from "./topbar";
import { HelpPage } from "./help";
import { TermPopup, TermSheet } from "./term";

const version = require("/package.json").version;
const nameStyle = "background-color: #667788; color: white; padding: 2px 4px; border-radius: 3px; margin: -2px 0";

function Pathway({ radars }) {
  return (
    <div>
      {Object.entries(radars).map(([pathway, name]) => (
        <a className="radarButton" key={pathway} href={`/archive/${pathway}/`}>
          {name}
        </a>
      ))}
    </div>
  );
}

class App extends React.Component {
  constructor(props) {
    super(props);
    this.isMobile = detectMob();
    if (!this.isMobile)
      document.getElementById("device-style").setAttribute("href", `/static/css/desktop.css?h=${this.props.css_hash}`);
    this.user = new User();
    this.user.onMessage = (message) => this.setState({ message: message });
    this.user.onUpdate = () => this.forceUpdate();

    this.state = {
      message: "",
      showTermSheet: false,
      showTermPopup: !this.user.preference.agree,
      showInfo: false,
    };

    this.handleInfoOpen = this.handleInfoOpen.bind(this);
    this.handleInfoClose = this.handleInfoClose.bind(this);
    this.handleTermSheetClose = this.handleTermSheetClose.bind(this);
    this.handleTermPopupClose = this.handleTermPopupClose.bind(this);
    this.handleTermSheetOpen = this.handleTermSheetOpen.bind(this);
    this.handleThemeChange = this.handleThemeChange.bind(this);
  }
  static defaultProps = {
    debug: false,
  };

  render() {
    return (
      <ThemeProvider theme={this.user.preference.theme}>
        <TopBar
          mode={this.user.preference.mode}
          isMobile={this.isMobile}
          message={this.state.message}
          onThemeChange={this.handleThemeChange}
          onInfoRequest={this.handleInfoOpen}
          onAccount={this.user.greet}
          onDismiss={(e) => {
            if (
              e.clientX - e.target.offsetLeft < 0.1 * e.target.offsetWidth &&
              e.clientY - e.target.offsetTop > 0.5 * e.target.offsetHeight
            ) {
              console.log(`%cApp.TopBar.onDismiss%c Reset agreement ...`, nameStyle, "");
              this.user.setAgree(false);
            }
          }}
        />
        <HelpPage open={this.state.showInfo} onClose={this.handleInfoClose} />
        {this.state.showTermPopup && (
          <TermPopup onClose={this.handleTermPopupClose} onTermSheet={this.handleTermSheetOpen} />
        )}
        {this.state.showTermSheet && <TermSheet onClose={this.handleTermSheetClose} />}
      </ThemeProvider>
    );
  }

  handleThemeChange() {
    this.user.nextMode();
  }

  handleInfoOpen() {
    this.setState({ showInfo: true });
  }

  handleInfoClose() {
    this.setState({ showInfo: false });
  }

  handleTermPopupClose() {
    this.user.setAgree();
    this.setState({ showTermPopup: false });
  }

  handleTermSheetOpen() {
    console.log(`handleTermSheetOpen()`);
    this.setState({ showTermSheet: true });
  }

  handleTermSheetClose() {
    this.setState({ showTermSheet: false });
  }
}

export { App, Pathway };
