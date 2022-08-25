//
//  app6.js - Archive Browser
//  RadarHub
//
//  Created by Boonleng Cheong
//

import React from "react";

import { ThemeProvider } from "@mui/material/styles";
import { colorDict, makeTheme } from "./theme";
import { detectMob } from "./common";
import { Splash } from "./splash";
import { TopBar } from "./topbar";
import { Layout } from "./layout";
import { Product } from "./product";
import { Browser } from "./browser";
import { Archive } from "./archive";
import { HelpPage } from "./help";
import { MenuUpdate } from "./menu-update";

const emojis = require("emoji-name-map");

export class App extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      colors: colorDict(),
      theme: makeTheme(),
      time: new Date("2013-05-20T19:00"),
      load: 0,
      showHelp: false,
      message: "",
      key: "",
    };
    this.isMobile = detectMob();
    this.archive = new Archive(props.radar, props.name);
    this.archive.onUpdate = (_dontcare) => {
      this.forceUpdate();
    };
    this.handleAccount = this.handleAccount.bind(this);
    this.handleInfoOpen = this.handleInfoOpen.bind(this);
    this.handleInfoClose = this.handleInfoClose.bind(this);
    this.handleThemeChange = this.handleThemeChange.bind(this);
    this.handleOverlayLoad = this.handleOverlayLoad.bind(this);
    this.handleLiveModeChange = this.handleLiveModeChange.bind(this);
    document.documentElement.setAttribute("theme", this.state.colors.name);
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
    radar: "radar",
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
    window
      .matchMedia("(prefers-color-scheme: dark)")
      .addEventListener("change", (e) => {
        let mode = e.matches ? "dark" : "light";
        document.documentElement.setAttribute("theme", mode);
        this.setState({
          colors: colorDict(mode),
          theme: makeTheme(mode),
        });
      });
  }

  render() {
    if (this.isMobile)
      return (
        <ThemeProvider theme={this.state.theme}>
          <TopBar isMobile={true} />
          <Product
            colors={this.state.colors}
            onOverlayLoad={this.handleOverlayLoad}
          />
        </ThemeProvider>
      );
    return (
      <div>
        <Splash progress={this.state.load} />
        <div id="main" className="fullHeight">
          <TopBar
            mode={this.state.colors.name}
            ingest={this.archive}
            message={this.state.message}
            onThemeChange={this.handleThemeChange}
            onInfoRequest={this.handleInfoOpen}
            onAccount={this.handleAccount}
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
                />
              }
              right={
                <Browser
                  archive={this.archive}
                  radar={this.props.radar}
                  debug={this.props.debug}
                />
              }
            />
            <MenuUpdate
              value={this.archive.state.liveUpdate}
              onChange={this.handleLiveModeChange}
            />
            <HelpPage
              open={this.state.showHelp}
              handleClose={this.handleInfoClose}
            />
          </ThemeProvider>
        </div>
      </div>
    );
  }

  handleOverlayLoad(x = 1) {
    this.setState({ load: x });
    // console.log(`liveUpdate = ${this.archive.state.liveUpdate}`);
    if (x == 1 && this.archive.state.liveUpdate === null) {
      this.archive.catchup();
    }
  }

  handleAccount() {
    console.log("App.handleAccount()");
    this.setState({ message: "Fetching User Information ..." });
    fetch("/profile/")
      .then((response) => {
        if (response.status == 200) {
          response.json().then(({ user, ip, emoji }) => {
            let title = user == "None" ? "Anonymous User" : `Hello ${user}`;
            let symbol = emojis.get(emoji) || "";
            this.setState({
              message:
                user == "None"
                  ? "<h3>Guest</h3><a class='link darken' href='/accounts/signin/?next=" +
                    window.location.pathname +
                    "'>Sign In Here</a><div class='emotion'>⛅️</div>"
                  : `<h3>${title}</h3>${ip}<div class='emotion'>${symbol}</div>`,
            });
            setTimeout(() => this.setState({ message: "" }), 3500);
          });
        } else {
          this.setState({
            message: `<h3>Error</h3>Received ${response.status}<div class='emotion'>🤷🏻‍♀️</div>`,
          });
        }
      })
      .catch((_error) => {
        this.setState({
          message: `<h3>Error</h3>Received ${response.status}<div class='emotion'>🤷🏻‍♀️</div>`,
        });
        console.error(_error);
        setTimeout(() => setMessage(""), 3500);
      });
  }

  handleThemeChange() {
    console.log("App6.handleThemeChange()");
    this.setState((state) => {
      let mode = state.colors.name == "light" ? "dark" : "light";
      document.documentElement.setAttribute("theme", mode);
      return {
        colors: colorDict(mode),
        theme: makeTheme(mode),
      };
    });
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
}
