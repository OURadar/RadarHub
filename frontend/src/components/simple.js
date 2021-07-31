import React, { Component } from "react";
import IconButton from "@material-ui/core/IconButton";
import { Refresh, AccountCircle } from "@material-ui/icons";
import { Keyboard, Favorite, BrokenImage } from "@material-ui/icons";
import { ThemeProvider } from "@material-ui/core/styles";
import { theme } from "./theme";

const version = require("/package.json").version;

class StatusBody extends Component {
  constructor(props) {
    super(props);
    this.timer = null;
    this.state = {
      message: "",
      class: "fadeOut",
    };
  }
  componentWillUnmount() {
    if (this.timer) {
      clearTimeout(this.state.timer);
    }
  }

  update = () => {
    if (this.timer) {
      clearTimeout(this.timer);
    }
    let stateToChange = {
      class: this.props.message.length > 1 ? "fadeIn" : "fadeOut",
    };
    if (this.props.message.length == 0) {
      this.timer = setTimeout(() => {
        this.setState({
          message: this.props.message,
        });
        this.timer = null;
      }, 300);
    } else {
      stateToChange.message = this.props.message;
    }
    this.setState(stateToChange);
  };

  componentDidUpdate(prevProps) {
    if (prevProps.message != this.props.message) {
      this.update();
    }
  }

  render() {
    return (
      <div className={"statusBody " + this.state.class}>
        {this.state.message}
      </div>
    );
  }
}

function StatusBodyQuick(props) {
  if (props.message.length > 1) {
    return <div className="statusBody">{props.message}</div>;
  }
  return <div className="invisible"></div>;
}

export function TopBar(props) {
  const prefix = "v" + version + " / " + props.radar;
  return (
    <div>
      <div className="topbar">
        <h1>RadarHub</h1>
        <div className="statusPrefix">{prefix}</div>
        <StatusBody message={props.message} />
      </div>
    </div>
  );
}

export function Console(props) {
  return (
    <div id="upperRight">
      <ThemeProvider theme={theme}>
        <IconButton
          aria-label="Refresh"
          onClick={() => {
            window.location.reload();
          }}
        >
          <Refresh style={{ color: "var(--system-background)" }} />
        </IconButton>
        <IconButton
          aria-label="Account"
          onClick={() => {
            props.callback();
          }}
        >
          <AccountCircle style={{ color: "var(--system-background)" }} />
        </IconButton>
      </ThemeProvider>
    </div>
  );
}

export function SectionHeader(props) {
  let icon;
  if (props.name == "control") {
    icon = <Keyboard color="action" />;
  } else if (props.name == "health") {
    icon = <Favorite style={{ color: "var(--red)" }} />;
  } else if (props.name == "scope") {
    icon = <BrokenImage style={{ color: "var(--blue)" }} />;
  }
  return (
    <div className="sectionHeader">
      {icon}
      <div className="sectionTitle">{props.name}</div>
    </div>
  );
}
