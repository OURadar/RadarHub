//
//  app-intro.js - Topbar Only
//  RadarHub
//
//  Created by Boonleng Cheong
//

import React, { Component } from "react";
import { ThemeProvider } from "@mui/material/styles";
import { colorDict, makeTheme } from "./theme";
import { detectMob } from "./common";
import { TopBar } from "./topbar";
import { HelpPage } from "./help";

class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      colors: colorDict(),
      theme: makeTheme(),
      time: new Date("2013-05-20T19:00"),
      open: false,
    };
    this.isMobile = detectMob();
    this.handleHelpOpen = this.handleHelpOpen.bind(this);
    this.handleHelpClose = this.handleHelpClose.bind(this);
    this.handleModeChange = this.handleModeChange.bind(this);
    document.documentElement.setAttribute("theme", this.state.colors.name);
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
  }

  render() {
    return (
      <ThemeProvider theme={this.state.theme}>
        <TopBar
          mode={this.state.colors.name}
          isMobile={this.isMobile}
          handleModeChange={this.handleModeChange}
          handleHelpRequest={this.handleHelpOpen}
        />
        <HelpPage open={this.state.open} handleClose={this.handleHelpClose} />
      </ThemeProvider>
    );
  }

  handleModeChange() {
    let mode = this.state.colors.name == "light" ? "dark" : "light";
    console.log(`App.handleModeChange() -> ${mode}`);
    document.documentElement.setAttribute("theme", mode);
    this.setState({
      colors: colorDict(mode),
      theme: makeTheme(mode),
    });
  }

  handleHelpOpen() {
    this.setState({ open: true });
  }

  handleHelpClose() {
    this.setState({ open: false });
  }
}

export default App;
