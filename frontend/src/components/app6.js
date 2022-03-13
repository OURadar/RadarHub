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
import { SectionHeader } from "./section-header";
import { Browser } from "./browser";
import { Product } from "./product";
import { TopBar } from "./topbar";
import { Archive } from "./archive";

class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      colors: colorDict(),
      theme: makeTheme(),
      sweep: null,
      index: -1,
      hour: -1,
      time: new Date("2013-05-20T19:00"),
    };
    this.isMobile = detectMob();
    this.archive = new Archive(props.radar);
    this.archive.onupdate = (_dontcare) => {
      this.forceUpdate();
    };
    this.archive.onlist = (hour, index) => {
      if (props.autoLoad && index > -1) {
        // console.log(
        //   `%capp.archive.onlist()%c ${hour} ${index} ${this.archive.grid.index}`,
        //   "color: deeppink",
        //   "color: inherit"
        // );
        if (this.overlayLoaded && this.state.index != index) {
          this.state.hour = hour;
          this.state.index = index;
          this.archive.load(index);
        } else {
          this.pendingLoadIndex = index;
        }
      }
    };
    // console.log(props);
    this.overlayLoaded = false;
    this.pendingLoadIndex = -1;

    this.handleOverlayLoaded = this.handleOverlayLoaded.bind(this);

    window.addEventListener("keyup", (e) => {
      //console.log(`keyup: ${e.key}`);
      let symbol = e.key.toUpperCase();
      const styles = ["Z", "V", "W", "D", "P", "R"];
      if (styles.indexOf(symbol) != -1) {
        this.archive.switch(symbol);
      } else if (symbol == "L") {
        this.archive.toggleLiveUpdate();
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
        if (e.matches) {
          this.setState({
            colors: colorDict("dark"),
            theme: makeTheme("dark"),
          });
        } else {
          this.setState({
            colors: colorDict("light"),
            theme: makeTheme("light"),
          });
        }
      });
    if (!this.isMobile) {
      var w = localStorage.getItem("split-archive-w");
      if (w) {
        w = clamp(parseFloat(JSON.parse(w)), 310, window.innerWidth - 400);
      } else {
        w = 310;
      }
      let v = (w / window.innerWidth) * 100;
      Split(["#left", "#right"], {
        sizes: [100 - v, v],
        minSize: [400, 310],
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
        // <StyledEngineProvider injectFirst>
        <ThemeProvider theme={this.state.theme}>
          <TopBar isMobile={this.isMobile} />
          <SectionHeader name="product" />
          <Product
            sweep={this.archive.data.sweep}
            colors={this.state.colors}
            debug={this.props.debug}
            showStats={false}
            profileGL={this.props.profileGL}
            onOverlayLoaded={this.handleOverlayLoaded}
          />
        </ThemeProvider>
        // </StyledEngineProvider>
      );
    return (
      <ThemeProvider theme={this.state.theme}>
        <TopBar ingest={this.archive} />
        <div id="flex">
          <div id="left">
            <div>
              <SectionHeader name="product" isMobile={false} />
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
          </div>
          <div id="right">
            <Browser archive={this.archive} radar={this.props.radar} />
          </div>
        </div>
      </ThemeProvider>
    );
  }

  handleOverlayLoaded() {
    console.log(
      `App6.handleOverlayLoaded()  pendingLoadIndex = ${this.pendingLoadIndex}`
    );
    this.overlayLoaded = true;
    if (this.pendingLoadIndex > -1) {
      this.archive.load(this.pendingLoadIndex);
      this.pendingLoadIndex = -1;
    }
  }
}

export default App;
