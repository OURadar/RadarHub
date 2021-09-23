//
//  App2.js
//  RadarHub
//
//  Created by Boonleng Cheong
//

import React, { Component } from "react";
import Split from "split.js";
import { ThemeProvider } from "@material-ui/core/styles";
import { detectMob } from "./common";
import { SectionHeader } from "./section-header";
import { Browser } from "./browser";
import { Product } from "./product";
import { theme, colorDict } from "./theme";
import { TopBar } from "./topbar";
import { Archive } from "./archive";

class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      colors: colorDict(),
      sweep: null,
    };
    this.isMobile = detectMob();
    this.archive = new Archive();
    this.archive.onupdate = (data) => {
      console.log("app-dev", data);
      this.setState({ sweep: data });
    };
    console.log(props);
  }

  static defaultProps = {
    radar: "demo",
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
          });
        } else {
          this.setState({
            colors: colorDict("light"),
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
    this.archive.load("PX-20130520-191140-E2.6-Z.nc");
  }

  render() {
    if (this.isMobile)
      return (
        <ThemeProvider theme={theme}>
          <TopBar isMobile={this.isMobile} />
          <SectionHeader name="product" />
          <Product
            sweep={this.state.sweep}
            colors={this.state.colors}
            debug={this.props.debug}
            showStats={true}
            profileGL={this.props.profileGL}
          />
        </ThemeProvider>
      );
    return (
      <ThemeProvider theme={theme}>
        <TopBar />
        <div id="flex">
          <div id="left">
            <div>
              <SectionHeader name="product" isMobile={false} />
              <Product
                sweep={this.state.sweep}
                colors={this.state.colors}
                debug={this.props.debug}
                showStats={true}
                profileGL={this.props.profileGL}
              />
            </div>
          </div>
          <div id="right">
            <Browser />
          </div>
        </div>
      </ThemeProvider>
    );
  }
}

export default App;
