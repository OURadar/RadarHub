//
//  AppGLView.js
//  RadarHub
//
//  Created by Boonleng Cheong
//

import React, { Component } from "react";
import { ThemeProvider, StyledEngineProvider } from "@mui/material/styles";
import { detectMob } from "./common";
import { SectionHeader } from "./section-header";
import { theme, colorDict } from "./theme";
import { TopBar } from "./topbar";
import { GLView } from "./glview";
import { Archive } from "./archive";

class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      colors: colorDict(),
    };
    this.isMobile = detectMob();
    this.archive = new Archive();
    this.archive.onupdate = (_dontcare) => {
      console.log("force update");
      console.log(this.archive.data.sweep);
      this.forceUpdate();
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
  }

  render() {
    return (
      // <StyledEngineProvider injectFirst>
      <ThemeProvider theme={theme}>
        <TopBar isMobile={this.isMobile} />
        <SectionHeader name="product" />
        <GLView
          colors={this.state.colors}
          debug={true}
          showStats={true}
          sweep={this.archive.data.sweep}
        />
      </ThemeProvider>
      // </StyledEngineProvider>
    );
  }
}

export default App;
