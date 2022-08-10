//
//  app6.js - Archive Browser
//  RadarHub
//
//  Created by Boonleng Cheong
//

import React, { Component } from "react";
import Split from "split.js";
import { ThemeProvider } from "@mui/material/styles";
import { colorDict, makeTheme } from "./theme";
import { detectMob, clamp } from "./common";
import { Browser } from "./browser";
import { Product } from "./product";
import { TopBar } from "./topbar";
import { Archive } from "./archive";
import { HelpPage } from "./help";
import { Preference } from "./preference";

class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      colors: colorDict(),
      theme: makeTheme(),
      time: new Date("2013-05-20T19:00"),
      overlayLoaded: false,
      showHelp: false,
      key: "",
    };
    this.isMobile = detectMob();
    this.archive = new Archive(props.radar);
    this.archive.onupdate = (_dontcare) => {
      this.forceUpdate();
    };
    this.handleInfoOpen = this.handleInfoOpen.bind(this);
    this.handleInfoClose = this.handleInfoClose.bind(this);
    this.handleThemeChange = this.handleThemeChange.bind(this);
    this.handleOverlayLoaded = this.handleOverlayLoaded.bind(this);
    this.handleLiveModeChange = this.handleLiveModeChange.bind(this);
    document.documentElement.setAttribute("theme", this.state.colors.name);
    window.addEventListener("keydown", (e) => (this.state.key = e.key));
    window.addEventListener("keyup", (e) => {
      if (e.key != this.state.key) {
        // console.log(`keydown ${this.state.key} != keyup ${e.key}`);
        return;
      }
      let symbol = e.key.toUpperCase();
      const styles = ["Z", "V", "W", "D", "P", "R"];
      if (styles.indexOf(symbol) != -1) {
        this.archive.switch(symbol);
      } else if (symbol == "L") {
        this.archive.toggleLiveUpdate();
      } else if (e.target == document.body) {
        if (e.key == "ArrowRight") {
          this.archive.navigateForwardScan();
        } else if (e.key == "ArrowLeft") {
          this.archive.navigateBackwardScan();
        } else if (e.key == "ArrowUp") {
          this.archive.navigateBackward();
        } else if (e.key == "ArrowDown") {
          this.archive.navigateForward();
        }
      }
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
        document.documentElement.setAttribute("theme", mode);
        this.setState({
          colors: colorDict(mode),
          theme: makeTheme(mode),
        });
      });
    if (!this.isMobile) {
      const wm = 280;
      var w = localStorage.getItem("split-archive-w");
      if (w) {
        w = clamp(parseFloat(JSON.parse(w)), wm, window.innerWidth - 400);
      } else {
        w = wm;
      }
      let v = (w / window.innerWidth) * 100;
      Split(["#left", "#right"], {
        sizes: [100 - v, v],
        minSize: [400, wm],
        expandToMin: true,
        elementStyle: (_dimension, elementSize, _gutterSize, index) => {
          if (index == 0)
            return {
              width: `calc(100% - ${w}px)`,
            };
          else {
            w = (window.innerWidth * elementSize) / 100;
            return {
              width: `${w}px`,
            };
          }
        },
        onDragEnd: (_sizes) => {
          w = parseFloat(w).toFixed(1);
          localStorage.setItem("split-archive-w", JSON.stringify(w));
        },
      });
    }
  }

  render() {
    if (this.isMobile)
      return (
        <ThemeProvider theme={this.state.theme}>
          <TopBar isMobile={true} />
          <Product
            sweep={this.archive.data.sweep}
            colors={this.state.colors}
            debug={this.props.debug}
            showStats={false}
            profileGL={this.props.profileGL}
            onOverlayLoaded={this.handleOverlayLoaded}
          />
        </ThemeProvider>
      );
    return (
      <ThemeProvider theme={this.state.theme}>
        <TopBar
          mode={this.state.colors.name}
          ingest={this.archive}
          handleThemeChange={this.handleThemeChange}
          handleInfoRequest={this.handleInfoOpen}
        />
        <div className="flexRow">
          <div id="left" className="container">
            <Product
              origin={this.props.origin}
              sweep={this.archive.data.sweep}
              colors={this.state.colors}
              debug={this.props.debug}
              showStats={false}
              profileGL={this.props.profileGL}
              onOverlayLoaded={this.handleOverlayLoaded}
            />
          </div>
          <div id="right">
            <div className="spacerTop"></div>
            <Browser archive={this.archive} radar={this.props.radar} />
          </div>
        </div>
        <Preference
          value={this.archive.state.liveUpdate}
          handleChange={this.handleLiveModeChange}
        />
        <HelpPage
          open={this.state.showHelp}
          handleClose={this.handleInfoClose}
        />
      </ThemeProvider>
    );
  }

  handleOverlayLoaded() {
    console.log(`App6.handleOverlayLoaded()`);
    this.state.overlayLoaded = true;
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

  handleInfoOpen() {
    this.setState({ showHelp: true });
  }

  handleInfoClose() {
    this.setState({ showHelp: false });
  }

  handleLiveModeChange(_e, value) {
    this.archive.toggleLiveUpdate(value);
  }
}

export default App;
