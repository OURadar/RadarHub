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
import { detectMob } from "./common";
import { SectionHeader } from "./section-header";
import { Browser } from "./browser";
import { Product } from "./product";
import { TopBar } from "./topbar";
import { Archive } from "./archive";
import { elements } from "./earth-grid";

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
    console.log(props);
  }

  static defaultProps = {
    radar: "archive",
    debug: false,
    profileGL: false,
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
        w = JSON.parse(w);
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
          localStorage.setItem("split-archive-w", JSON.stringify(w.toFixed(1)));
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
}

export default App;
