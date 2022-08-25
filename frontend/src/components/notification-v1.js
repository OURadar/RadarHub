import React from "react";

class Notification extends React.Component {
  constructor(props) {
    super(props);
    this.timer = null;
    this.state = {
      message: props.message,
      class: props.message.length ? "fadeIn" : "invisible",
    };
  }

  static defaultProps = {
    message: "",
  };

  componentWillUnmount() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  update() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    let stateToChange = {
      class: this.props.message == "" ? "fadeOut" : "fadeIn",
    };
    if (this.props.message == "") {
      this.timer = setTimeout(() => {
        this.setState({
          message: this.props.message,
          class: "invisible",
        });
        this.timer = null;
      }, 300);
    } else {
      stateToChange = { ...stateToChange, message: this.props.message };
    }
    this.setState(stateToChange);
  }

  componentDidUpdate(prevProps) {
    if (prevProps.message != this.props.message) {
      if (this.state.class == "invisible") {
        this.setState({
          class: "fadeOut",
        });
      }
      setTimeout(() => {
        this.update();
      }, 25);
    }
  }

  render() {
    return (
      <div
        className={`notification blur ${this.state.class}`}
        dangerouslySetInnerHTML={{
          __html: "<p>" + this.state.message + "</p>",
        }}
      />
    );
  }
}

export { Notification };
