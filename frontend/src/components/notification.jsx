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

  React.useEffect(() => {
    if (props.message.length) {
      setDisplay(props.message);
      setTransition("fadeIn");
    } else {
      setTransition("fadeOut");
      const timer = setTimeout(() => setDisplay(""), 800);
      return () => clearTimeout(timer);
    }
  }, [props.message]);

  return (
    <div id={props.id} className={`notification blur ${transition}`} dangerouslySetInnerHTML={{ __html: display }} />
  );
}

Notification.defaultProps = {
  id: "nora",
  message: "",
  timeout: 3000,
};
