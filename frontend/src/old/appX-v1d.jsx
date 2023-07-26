//
//  app6.js - Archive Browser
//  RadarHub
//
//  This is a controller
//
//  Created by Boonleng Cheong
//

import React from "react";

import { ThemeProvider } from "@mui/material/styles";

import { colorDict, makeTheme } from "./theme";
import { detectMob } from "./common";
import { Archive } from "./archive";
import { User } from "./user";

import { Splash } from "./splash";
import { TopBar } from "./topbar";
import { Layout } from "./layout";
import { Product } from "./product";
import { Browser } from "./browser";
import { HelpPage } from "./help";
import { MenuArrow } from "./menu-arrow";
import { MenuUpdate } from "./menu-update";

export class App extends React.Component {
  constructor(props) {
    super(props);
    this.isMobile = detectMob();

    this.setColorMode = this.setColorMode.bind(this);

    this.handleInfoOpen = this.handleInfoOpen.bind(this);
    this.handleInfoClose = this.handleInfoClose.bind(this);
    this.handleThemeChange = this.handleThemeChange.bind(this);
    this.handleOverlayLoad = this.handleOverlayLoad.bind(this);
    this.handleColorbarClick = this.handleColorbarClick.bind(this);
    this.handleRadarDataLoad = this.handleRadarDataLoad.bind(this);
    this.handleLiveModeChange = this.handleLiveModeChange.bind(this);
    this.handleDoubleLeft = this.handleDoubleLeft.bind(this);
    this.handleLeft = this.handleLeft.bind(this);
    this.handleRight = this.handleRight.bind(this);
    this.handleDoubleRight = this.handleDoubleRight.bind(this);

    this.archive = new Archive(props.pathway, props.name);
    this.archive.onUpdate = (_) => this.forceUpdate();
    this.archive.onLoad = this.handleRadarDataLoad;

    this.user = new User();
    this.user.onMessage = (message) => this.setState({ message: message });

    let colors = colorDict(this.user.mode);

    this.state = {
      colors: colors,
      theme: makeTheme(colors.name),
      load: 0,
      showHelp: false,
      message: "",
      key: "",
      disabled: [false, false, false, false],
    };

    console.log(`User.mode = ${this.user.mode} -> ${colors.name}`);

    document.documentElement.setAttribute("theme", colors.name);
    window.addEventListener("keydown", (e) => (this.state.key = e.key));
    window.addEventListener("keyup", (e) => {
      if (e.key != this.state.key) {
        // console.log(`keydown ${this.state.key} != keyup ${e.key}`);
        return;
      }
      let symbol = e.key.toUpperCase();
      const styles = ["Z", "V", "W", "D", "P", "R"];
      if (styles.indexOf(symbol) != -1) {
        this.archive.switch(symbol);
      } else if (symbol == "L") {
        this.archive.toggleLiveUpdate();
      } else if (e.target == document.body) {
        if (e.key == "ArrowRight") {
          this.archive.navigateForwardScan();
        } else if (e.key == "ArrowLeft") {
          this.archive.navigateBackwardScan();
        } else if (e.key == "ArrowUp") {
          this.archive.navigateBackward();
        } else if (e.key == "ArrowDown") {
          this.archive.navigateForward();
        }
      }
    });
  }
  static defaultProps = {
    pathway: "radar",
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
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
      if (this.user.mode !== "auto") return;
      let mode = e.matches ? "dark" : "light";
      document.documentElement.setAttribute("theme", mode);
      this.setState({
        colors: colorDict(mode),
        theme: makeTheme(mode),
      });
    });
    document.getElementById("device-style").setAttribute("href", `/static/css/desktop.css?h=${this.props.css_hash}`);
  }

  render() {
    if (this.isMobile)
      return (
        <ThemeProvider theme={this.state.theme}>
          <TopBar isMobile={true} />
          <Product colors={this.state.colors} onOverlayLoad={this.handleOverlayLoad} />
        </ThemeProvider>
      );
    return (
      <div>
        <Splash progress={this.state.load} />
        <div id="main" className="fullHeight">
          <TopBar
            mode={this.user.mode}
            ingest={this.archive}
            message={this.state.message}
            onThemeChange={this.handleThemeChange}
            onInfoRequest={this.handleInfoOpen}
            onAccount={this.user.greet}
          />
          <ThemeProvider theme={this.state.theme}>
            <Layout
              name="split-archive-width"
              left={
                <Product
                  origin={this.props.origin}
                  sweep={this.archive.data.sweep}
                  colors={this.state.colors}
                  debug={this.props.debug}
                  showStats={false}
                  profileGL={this.props.profileGL}
                  onOverlayLoad={this.handleOverlayLoad}
                  onColorbarClick={this.handleColorbarClick}
                />
              }
              right={<Browser archive={this.archive} pathway={this.props.pathway} debug={this.props.debug} />}
            />
            <MenuUpdate value={this.archive.state.liveUpdate} onChange={this.handleLiveModeChange} />
            <MenuArrow
              doubleLeftDisabled={this.state.disabled[0]}
              leftDisabled={this.state.disabled[1]}
              rightDisabled={this.state.disabled[2]}
              doubleRightDisabled={this.state.disabled[3]}
              onDoubleLeft={this.handleDoubleLeft}
              onLeft={this.handleLeft}
              onRight={this.handleRight}
              onDoubleRight={this.handleDoubleRight}
            />
            <HelpPage open={this.state.showHelp} handleClose={this.handleInfoClose} />
          </ThemeProvider>
        </div>
      </div>
    );
  }

  setColorMode(mode) {
    this.user.setMode(mode);
    let colors = colorDict(this.user.mode);
    document.documentElement.setAttribute("theme", colors.name);
    this.setState({
      colors: colors,
      theme: makeTheme(colors.name),
    });
  }

  handleOverlayLoad(x = 1) {
    this.setState({ load: x });
    // console.log(`liveUpdate = ${this.archive.state.liveUpdate}`);
    if (x == 1 && this.archive.state.liveUpdate === null) {
      this.archive.catchup();
    }
  }

  handleColorbarClick(e) {
    let dy = e.pageY - e.target.offsetTop;
    if (dy / e.target.offsetHeight < 0.5) {
      this.archive.prevProduct();
    } else {
      this.archive.nextProduct();
    }
  }

  handleRadarDataLoad() {
    if (this.archive.grid === null || this.archive.grid === undefined) {
      return;
    }
    this.setState({
      disabled: this.archive.grid.pathsActive.map((x) => !x),
    });
  }

  handleThemeChange() {
    if (this.user.mode == "auto") {
      this.setColorMode("light");
    } else if (this.user.mode == "light") {
      this.setColorMode("dark");
    } else {
      this.setColorMode("auto");
    }
  }

  handleInfoOpen() {
    console.log("App6.handleInfoOpen()");
    this.setState({ showHelp: true });
  }

  handleInfoClose() {
    this.setState({ showHelp: false });
  }

  handleLiveModeChange(_e, value) {
    this.archive.toggleLiveUpdate(value);
  }

  handleDoubleLeft() {
    this.archive.navigateBackwardScan();
  }

  handleLeft() {
    this.archive.navigateBackward();
  }

  handleRight() {
    this.archive.navigateForward();
  }

  handleDoubleRight() {
    this.archive.navigateForwardScan();
  }
}
