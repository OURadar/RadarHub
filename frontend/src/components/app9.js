//
//  app9.js - Mobile / Desktop App
//  RadarHub
//
//  Created by Boonleng Cheong
//

import React, { Component } from "react";
import { ThemeProvider } from "@mui/material/styles";
import { colorDict, makeTheme } from "./theme";
import { detectMob } from "./common";
import { TopBar } from "./topbar";
import { GLView } from "./glview";
import { Archive } from "./archive";
import { Preference } from "./preference";

class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      colors: colorDict(),
      theme: makeTheme(),
      time: new Date("2013-05-20T19:00"),
      overlayLoaded: false,
      key: "",
    };
    console.log(`colors.name = ${this.state.colors.name}`);
    this.isMobile = detectMob();
    this.archive = new Archive(props.radar);
    this.archive.onupdate = (_dontcare) => {
      this.forceUpdate();
    };
    this.overlayLoaded = false;
    this.handleOverlayLoaded = this.handleOverlayLoaded.bind(this);
    this.handleModeChange = this.handleModeChange.bind(this);
    document.documentElement.setAttribute("theme", this.state.colors.name);
    window.addEventListener("keydown", (e) => (this.state.key = e.key));
    window.addEventListener("keyup", (e) => {
      if (e.key != this.state.key) {
        console.log(`keydown ${this.state.key} != keyup ${e.key}`);
        return;
      }
      console.log(`key = ${e.key}`);
    });
  }
  static defaultProps = {
    radar: "radar",
    origin: {
      longitude: -97.422413,
      latitude: 35.25527,
    },
    debug: false,
    profileGL: false,
    autoLoad: true,
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
          ingest={this.ingest}
          isMobile={this.isMobile}
          handleModeChange={this.handleModeChange}
        />
      </ThemeProvider>
    );
  }

  handleOverlayLoaded() {
    console.log(`App.handleOverlayLoaded()`);
    this.overlayLoaded = true;
  }

  handleModeChange() {
    let mode = this.state.colors.name == "light" ? "dark" : "light";
    console.log(`App8.handleModeChange() -> ${mode}`);
    this.setState({
      colors: colorDict(mode),
      theme: makeTheme(mode),
    });
  }
}

export default App;
