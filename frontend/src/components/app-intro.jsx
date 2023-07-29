//
//  app-intro.js - Topbar Only
//  RadarHub
//
//  Created by Boonleng Cheong
//

import React from "react";

import { ThemeProvider } from "@mui/material/styles";

import { colorDict, makeTheme } from "./theme";
import { detectMob } from "./common";
import { User } from "./user";

import { TopBar } from "./topbar";
import { HelpPage } from "./help";
import { TermPage } from "./term";

const version = require("/package.json").version;
const nextMode = { auto: "light", light: "dark", dark: "auto" };
const nameStyle = "background-color: #667788; color: white; padding: 2px 4px; border-radius: 3px; margin: -2px 0";

class App extends React.Component {
  constructor(props) {
    super(props);
    this.isMobile = detectMob();
    if (!this.isMobile)
      document.getElementById("device-style").setAttribute("href", `/static/css/desktop.css?h=${this.props.css_hash}`);
    this.user = new User();
    this.user.onMessage = (message) => this.setState({ message: message });

    this.state = {
      colors: colorDict(this.user.preference.mode),
      theme: makeTheme(this.user.preference.mode),
      message: "",
      time: new Date("2013-05-20T19:00"),
      showInfo: false,
      showTerm: this.user.preference.agree === false,
    };

    this.handleInfoOpen = this.handleInfoOpen.bind(this);
    this.handleInfoClose = this.handleInfoClose.bind(this);
    this.handleTermOpen = this.handleTermOpen.bind(this);
    this.handleTermClose = this.handleTermClose.bind(this);
    this.handleThemeChange = this.handleThemeChange.bind(this);
  }
  static defaultProps = {
    debug: false,
  };

  componentDidMount() {
    // Get notified when the desktop theme is changed
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
      let mode = e.matches ? "dark" : "light";
      this.setState({
        colors: colorDict(mode),
        theme: makeTheme(mode),
      });
    });
    document.documentElement.setAttribute("theme", this.state.colors.name);
  }

  render() {
    return (
      <ThemeProvider theme={this.state.theme}>
        <TopBar
          mode={this.user.preference.mode}
          isMobile={this.isMobile}
          message={this.state.message}
          onThemeChange={this.handleThemeChange}
          onInfoRequest={this.handleInfoOpen}
          onAccount={this.user.greet}
          onDismiss={(e) => {
            if (e.clientX < 0.15 * e.target.offsetWidth && e.clientY > 0.5 * e.target.offsetHeight) {
              console.log(`%cApp.TopBar.onDismiss%c Reset agreement ...`, nameStyle, "");
              this.user.setAgree(false);
            }
          }}
        />
        <HelpPage open={this.state.showInfo} onClose={this.handleInfoClose} />
        {this.state.showTerm && <TermPage onClose={this.handleTermClose} />}
      </ThemeProvider>
    );
  }

  handleThemeChange() {
    const mode = nextMode[this.user.preference.mode];
    const newColors = colorDict(mode);
    this.user.setMode(mode);
    this.setState({
      colors: colorDict(mode),
      theme: makeTheme(mode),
    });
    document.documentElement.setAttribute("theme", newColors.name);
  }

  handleInfoOpen() {
    this.setState({ showInfo: true });
  }

  handleInfoClose() {
    this.setState({ showInfo: false });
  }

  handleTermOpen() {
    this.setState({ showTerm: true });
  }

  handleTermClose() {
    this.user.setAgree();
    this.setState({ showTerm: false });
  }
}

export default App;
