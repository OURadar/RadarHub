//
//  notification.jsx - Notification
//  RadarHub
//
//  This is a view
//
//  Created by Boonleng Cheong
//

import React from "react";

export function Notification(props) {
  const [display, setDisplay] = React.useState("");
  const [transition, setTransition] = React.useState("invisible");

  const fadeOut = () => {
    setTransition("fadeOut");
    const timer = setTimeout(() => setDisplay(""), 800);
    return () => clearTimeout(timer);
  };

  React.useEffect(() => {
    if (props.message.length) {
      setDisplay(props.message);
      setTransition("fadeIn");
    } else if (display.length || transition == "fadeIn") {
      return fadeOut();
    }
  }, [props.message]);

  return (
    <div
      id={props.id}
      className={`notification blur ${transition}`}
      dangerouslySetInnerHTML={{ __html: display }}
      onClick={() => fadeOut()}
    />
  );
}

Notification.defaultProps = {
  id: "nora",
  message: "",
  timeout: 3000,
};
