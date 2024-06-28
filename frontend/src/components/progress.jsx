//
//  progress.jsx - Progress
//  RadarHub
//
//  This is a view
//
//  Created by Boonleng Cheong
//

import React from "react";

export function Progress({ id = "kailena", value = 0, timeout = 1000 }) {
  const [shownValue, setShownValue] = React.useState(0);
  const [transition, setTransition] = React.useState("invisible");

  React.useEffect(() => {
    setShownValue(value);
    if (value != 100) {
      setTransition("fadeIn");
    } else {
      setTransition("fadeOut");
      const timer = setTimeout(() => setShownValue(0), timeout);
      return () => clearTimeout(timer);
    }
  }, [value]);

  return (
    <div id={id} className={`progress ${transition}`}>
      <div className="progress bar" style={{ transform: `translateX(${-100 + shownValue}%)` }}></div>
    </div>
  );
}
