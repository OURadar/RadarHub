import React from "react";

export function Notification(props) {
  const [message, setMessage] = React.useState(props.message);
  const [classes, setClasses] = React.useState(
    "notification blur " + props.message.length ? "fadeIn" : "invisible"
  );
  let timer;

  React.useEffect(() => {
    function handleMessageChange(message) {
      setMessage(message);
      timer = setTimeout(() => {
        if (message == props.message) {
          setMessage("");
        }
        timer = null;
      }, 2000);
    }
    console.log("props.message", props.message);
    handleMessageChange(props.message);
    return () => {
      if (timer) {
        console.log("clear timer");
        clearTimeout(timer);
        timer = null;
      }
    };
  });

  return (
    <div
      className={classes}
      dangerouslySetInnerHTML={{
        __html: `<p>${message}</p>`,
      }}
    />
  );
}

Notification.defaultProps = {
  message: "",
};
