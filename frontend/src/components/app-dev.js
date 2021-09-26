//
//  App2.js
//  RadarHub
//
//  Created by Boonleng Cheong
//

import React, { Component } from "react";
import Split from "split.js";
import { ThemeProvider } from "@mui/material/styles";
import { detectMob } from "./common";
import { SectionHeader } from "./section-header";
import { Browser } from "./browser";
import { Product } from "./product";
import { makeTheme, colorDict } from "./theme";
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
            theme: makeTheme("ligth"),
          });
        }
      });
    if (!this.isMobile) {
      const w = (300 / window.innerWidth) * 100;
      console.log(`w = ${w}`);
      Split(["#left", "#right"], {
        sizes: [100 - w, w],
        minSize: [400, 300],
        expandToMin: true,
      });
    }

    // this.archive.count("20130520");
    this.archive.list("20130520-1900");
  }

  render() {
    if (this.isMobile)
      return (
        // <StyledEngineProvider injectFirst>
        <ThemeProvider theme={theme}>
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
            <Browser archive={this.archive} hour={19} />
          </div>
        </div>
      </ThemeProvider>
    );
  }
}

export default App;
