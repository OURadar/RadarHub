//
//  notification.jsx - Notification
//  RadarHub
//
//  This is a view
//
//  Created by Boonleng Cheong
//

import React from "react";

export function Notification({ id = "nora", message = "", timeout = 800, onClick = (_e) => {} }) {
  const [display, setDisplay] = React.useState("");
  const [transition, setTransition] = React.useState("invisible");

  const fadeOut = () => {
    setTransition("fadeOut");
    const timer = setTimeout(() => setDisplay(""), timeout);
    return () => clearTimeout(timer);
  };

  React.useEffect(() => {
    if (message.length) {
      setDisplay(message);
      setTransition("fadeIn");
    } else if (display.length || transition == "fadeIn") {
      return fadeOut();
    }
  }, [message]);

  return (
    <div
      id={id}
      className={`notification blur ${transition}`}
      dangerouslySetInnerHTML={{ __html: display }}
      onClick={(e) => {
        fadeOut();
        onClick(e);
      }}
    />
  );
}
