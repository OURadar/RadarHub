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

const version = require("/package.json").version;

class App extends React.Component {
  constructor(props) {
    super(props);
    this.isMobile = detectMob();
    if (this.isMobile)
      document
        .getElementById("device-style")
        .setAttribute(
          "href",
          `/static/css/mobile.css?h=${this.props.css_hash}`
        );
    this.state = {
      colors: colorDict(),
      theme: makeTheme(),
      message: "",
      time: new Date("2013-05-20T19:00"),
      open: false,
    };
    this.user = new User();
    this.user.onMessage = (message) => this.setState({ message: message });
    this.handleInfoOpen = this.handleInfoOpen.bind(this);
    this.handleInfoClose = this.handleInfoClose.bind(this);
    this.handleThemeChange = this.handleThemeChange.bind(this);
  }
  static defaultProps = {
    debug: false,
  };

  componentDidMount() {
    // Get notified when the desktop theme is changed
    window
      .matchMedia("(prefers-color-scheme: dark)")
      .addEventListener("change", (e) => {
        let mode = e.matches ? "dark" : "light";
        this.setState({
          colors: colorDict(mode),
          theme: makeTheme(mode),
        });
      });
    document.getElementById("versionTag").innerHTML =
      `v${version}` + ` <div class="lite">(${this.props.css_hash})</div>`;
  }

  render() {
    return (
      <ThemeProvider theme={this.state.theme}>
        <TopBar
          mode={this.state.colors.name}
          isMobile={this.isMobile}
          message={this.state.message}
          onThemeChange={this.handleThemeChange}
          onInfoRequest={this.handleInfoOpen}
          onAccount={this.user.greet}
        />
        <HelpPage open={this.state.open} handleClose={this.handleInfoClose} />
      </ThemeProvider>
    );
  }

  handleThemeChange() {
    let mode = this.state.colors.name == "light" ? "dark" : "light";
    document.documentElement.setAttribute("theme", mode);
    this.setState({
      colors: colorDict(mode),
      theme: makeTheme(mode),
    });
  }

  handleInfoOpen() {
    this.setState({ open: true });
  }

  handleInfoClose() {
    this.setState({ open: false });
  }
}

export default App;
