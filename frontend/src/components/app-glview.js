//
//  AppGLView.js
//  RadarHub
//
//  Created by Boonleng Cheong
//

import React, { Component } from "react";
import { ThemeProvider } from "@material-ui/core/styles";
import { detectMob } from "./common";
import { SectionHeader } from "./section-header";
import { theme, colorDict } from "./theme";
import { TopBar } from "./topbar";
import { GLView } from "./glview";

class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      colors: colorDict(),
    };
    this.isMobile = detectMob();
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
      <ThemeProvider theme={theme}>
        <TopBar isMobile={this.isMobile} />
        <SectionHeader name="product" />
        <GLView colors={this.state.colors} debug={true} showStats={true} />
      </ThemeProvider>
    );
  }
}

export default App;
