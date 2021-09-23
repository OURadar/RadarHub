//
//  App2.js
//  RadarHub
//
//  Created by Boonleng Cheong
//

import React, { Component } from "react";
import { ThemeProvider } from "@material-ui/core/styles";
import { detectMob } from "./common";
import { SectionHeader } from "./section-header";
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
      console.log(data);
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
    this.archive.load("PX-20130520-191140-E2.6-Z.nc");
  }

  render() {
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
  }
}

export default App;
