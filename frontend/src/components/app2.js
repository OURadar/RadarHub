//
//  App2.js
//  RadarHub
//
//  Created by Boonleng Cheong
//

import React, { Component } from "react";
import { ThemeProvider } from "@material-ui/core/styles";
import { colorDict, detectMob } from "./common";
import { SectionHeader } from "./section-header";
import { Product } from "./product";
import { theme } from "./theme";
import { TopBar } from "./topbar";
import { GLView } from "./glview";

class App2 extends Component {
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
    debug: true,
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
        <Product
          colors={this.state.colors}
          debug={this.props.debug}
          showStats={true}
          profileGL={this.props.profileGL}
        />
      </ThemeProvider>
    );
  }
}

export default App2;
