//
//  app9.js - Mobile / Desktop App
//  RadarHub
//
//  Created by Boonleng Cheong
//

import React, { Component } from "react";
import { ThemeProvider } from "@mui/material/styles";

import BottomNavigation from "@mui/material/BottomNavigation";
import BottomNavigationAction from "@mui/material/BottomNavigationAction";

import RadarIcon from "@mui/icons-material/Radar";
import EventNoteIcon from "@mui/icons-material/EventNote";
import MonitorHeartIcon from "@mui/icons-material/MonitorHeart";
import GamepadIcon from "@mui/icons-material/Gamepad";

import { colorDict, makeTheme } from "./theme";
import { TopBar } from "./topbar";
import { Archive } from "./archive";
import { Browser } from "./browser";
import { Product } from "./product";

class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      colors: colorDict(),
      theme: makeTheme(),
      time: new Date("2013-05-20T19:00"),
      overlayLoaded: false,
      tabIndex: 0,
    };
    this.archive = new Archive(props.radar);
    this.archive.onupdate = (_dontcare) => {
      this.forceUpdate();
    };
    this.handleThemeChange = this.handleThemeChange.bind(this);
    this.handleOverlayLoaded = this.handleOverlayLoaded.bind(this);
    this.handleNavigationChange = this.handleNavigationChange.bind(this);
    document.documentElement.setAttribute("theme", this.state.colors.name);
  }
  static defaultProps = {
    radar: "px1000",
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
      <div className="fullHeight">
        <TopBar
          isMobile={true}
          ingest={this.archive}
          handleThemeChange={this.handleThemeChange}
        />
        <ThemeProvider theme={this.state.theme}>
          <Product
            gravity="top"
            colors={this.state.colors}
            origin={this.props.origin}
            sweep={this.archive.data.sweep}
            onOverlayLoaded={this.handleOverlayLoaded}
          />
          <BottomNavigation
            id="navbar"
            showLabels
            value={this.state.tabIndex}
            onChange={this.handleNavigationChange}
          >
            <BottomNavigationAction label="View" icon={<RadarIcon />} />
            <BottomNavigationAction label="Archive" icon={<EventNoteIcon />} />
            <BottomNavigationAction
              label="Health"
              icon={<MonitorHeartIcon />}
            />
            <BottomNavigationAction label="Control" icon={<GamepadIcon />} />
          </BottomNavigation>
        </ThemeProvider>
      </div>
    );
  }

  handleOverlayLoaded() {
    console.log(`App.handleOverlayLoaded()`);
    this.setState({ overlayLoaded: true });
    this.archive.catchup();
  }

  handleThemeChange() {
    console.log("app6.handleThemeChange()");
    let mode = this.state.colors.name == "light" ? "dark" : "light";
    document.documentElement.setAttribute("theme", mode);
    this.setState({
      colors: colorDict(mode),
      theme: makeTheme(mode),
    });
  }

  handleLiveModeChange(_e, value) {
    this.archive.toggleLiveUpdate(value);
  }

  handleNavigationChange(_e, value) {
    console.log("handleChange()");
    this.setState({ navIndex: value });
  }
}

export default App;
