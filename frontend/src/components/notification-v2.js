import React from "react";

export function Notification(props) {
  const [display, setDisplay] = React.useState(props.message);
  const [message, setMessage] = React.useState(props.message);
  const [transition, setTransition] = React.useState("invisible");

  let timer;

  React.useEffect(() => {
    function handleMessageChange(newMessage) {
      console.log("handleMessageChange()", newMessage);
      setMessage(newMessage);
    }
    //console.log("props.message", props.message, message, display);
    handleMessageChange(props.message);
  }, [props.message]);

  React.useEffect(() => {
    function handleDisplayChange(newDisplay) {
      if (newDisplay.length == 0) {
        setTransition("fadeOut");
        return setTimeout(() => setDisplay(""), 1000);
      }
      setDisplay(newDisplay);
      setTransition("fadeIn");
      if (timer) {
        console.log("clear timer");
        clearTimeout(timer);
        timer = null;
      }
      timer = setTimeout(() => {
        //console.log(`check: "${newDisplay}" "${message}"`);
        if (newDisplay == message) {
          //console.log(`clearing same display message ${message}`);
          //setTransition("fadeOut");
          //setTimeout(() => setDisplay(""), 1000);
          handleDisplayChange("");
        }
        timer = null;
      }, 2500);
    }
    handleDisplayChange(message);
  }, [message]);

  const classes = "notification blur " + transition;

  return (
    <div
      className={classes}
      dangerouslySetInnerHTML={{
        __html: `<p>${display}</p>`,
      }}
    />
  );
}

Notification.defaultProps = {
  message: "",
};
