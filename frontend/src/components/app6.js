//
//  app6.js
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
      time: new Date("2013-05-20T19:00"),
    };
    this.isMobile = detectMob();
    this.archive = new Archive();
    this.archive.onupdate = (_dontcare) => {
      this.forceUpdate();
    };
    this.archive.onlist = (index) => {
      if (!props.autoLoad || index == -1) {
        return;
      }
      if (this.overlayLoaded) {
        this.archive.load(index);
      } else {
        this.pendingLoadIndex = index;
      }
    };
    //console.log(props);
    this.overlayLoaded = false;
    this.pendingLoadIndex = -1;

    this.handleOverlayLoaded = this.handleOverlayLoaded.bind(this);

    window.addEventListener("keyup", (e) => {
      // if (e.key == "s") {
      //   this.toggleSpin();
      // } else if (e.key == "c") {
      //   const h = this.assets.colormap.height;
      //   let i = Math.round(this.assets.index * h - 0.5);
      //   i = i >= h - 1 ? 0 : i + 1;
      //   this.assets.index = (i + 0.5) / h;
      //   const styles = ["Z", "V", "W", "D", "P", "R"];
      //   this.loadDashboard(styles[i]);
      //   console.log(`this.textures.index = ${this.assets.index}   h = ${h}`);
      // }
      console.log(`keyup: ${e.key}`);
    });
  }

  static defaultProps = {
    radar: "archive",
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
        w = clamp(parseFloat(JSON.parse(w)), 300, window.innerWidth - 400);
      } else {
        w = 300;
      }
      let v = (w / window.innerWidth) * 100;
      Split(["#left", "#right"], {
        sizes: [100 - v, v],
        minSize: [400, 300],
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
            showStats={true}
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
                sweep={this.archive.data.sweep}
                colors={this.state.colors}
                debug={this.props.debug}
                showStats={true}
                profileGL={this.props.profileGL}
                onOverlayLoaded={this.handleOverlayLoaded}
              />
            </div>
          </div>
          <div id="right">
            <Browser archive={this.archive} />
          </div>
        </div>
      </ThemeProvider>
    );
  }

  handleOverlayLoaded() {
    console.log("App6.handleOverlayLoaded()");
    this.overlayLoaded = true;
    if (this.pendingLoadIndex > -1) {
      this.archive.load(this.pendingLoadIndex);
      this.pendingLoadIndex = -1;
    }
  }
}

export default App;
