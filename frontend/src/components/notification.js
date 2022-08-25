import React, { useEffect } from "react";

export function Notification(props) {
  const [display, setDisplay] = React.useState(props.message);
  const [transition, setTransition] = React.useState("invisible");

  function fadeOutText() {
    setTransition("fadeOut");
    return setTimeout(() => {
      setTransition("invisible");
      setDisplay("&nbsp;");
    }, 500);
  }

  function fadeInText(text) {
    setDisplay(text);
    setTransition("fadeIn");
    return setTimeout(fadeOutText, props.timeout);
  }

  useEffect(() => {
    const timer = props.message.length
      ? fadeInText(props.message)
      : fadeOutText();
    return () => clearTimeout(timer);
  }, [props.message]);

  const classes = "notification blur " + transition;

  return (
    <div
      id={props.id}
      className={classes}
      dangerouslySetInnerHTML={{
        __html: display,
      }}
    />
  );
}

Notification.defaultProps = {
  id: "nora",
  message: "",
  timeout: 5000,
};
