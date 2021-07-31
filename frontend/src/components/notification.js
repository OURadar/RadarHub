import React from "react";

class Notification extends React.Component {
  constructor(props) {
    super(props);
    this.timer = null;
    this.state = {
      message: props.message,
      class: props.message.length > 0 ? "fadeIn" : "fadeOut",
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
  }

  componentDidUpdate(prevProps) {
    if (prevProps.message != this.props.message) {
      this.update();
    }
  }

  render() {
    return (
      <div id="notification" className={this.state.class}>
        {this.state.message}
      </div>
    );
  }
}

export { Notification };
