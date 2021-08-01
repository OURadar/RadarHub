import React from "react";

class Notification extends React.Component {
  constructor(props) {
    super(props);
    this.timer = null;
    this.state = {
      message: props.message,
      class: props.message.length > 0 ? "fadeIn" : "invisible",
    };
  }

  componentWillUnmount() {
    if (this.timer) {
      clearTimeout(this.state.timer);
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
          class: "fadeOut invisible",
        });
        this.timer = null;
      }, 300);
    } else {
      stateToChange.message = this.props.message;
    }
    this.setState(stateToChange);
  }

  componentDidUpdate(prevProps) {
    if (prevProps.message != this.props.message) {
      this.setState({
        class: "fadeOut",
      });
      setTimeout(() => {
        this.update();
      }, 25);
    }
  }

  render() {
    return (
      <div
        id="notification"
        className={this.state.class}
        dangerouslySetInnerHTML={{
          __html: "<p>" + this.state.message + "</p>",
        }}
      ></div>
    );
  }
}

export { Notification };
