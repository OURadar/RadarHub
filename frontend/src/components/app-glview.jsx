//
//  app-glview.js - GLView Development
//  RadarHub
//
//  This is a controller
//
//  Created by Boonleng Cheong
//

import React, { Component } from "react";
import { ThemeProvider } from "@mui/material/styles";
import { detectMob } from "./common";
import { SectionHeader } from "./section-header";
import { theme, colorDict } from "./theme";
import { TopBar } from "./topbar";
import { GLView } from "./glview";
import { Archive } from "./archive";
// import { Product } from "./product";

class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      colors: colorDict(),
    };
    this.isMobile = detectMob();
    this.archive = new Archive(props.radar);
    this.archive.onUpdate = (_dontcare) => {
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
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
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
        <GLView sweep={this.archive.data.sweep} colors={this.state.colors} debug={true} showStats={true} />
      </ThemeProvider>
      // </StyledEngineProvider>
    );
  }
}

export default App;
