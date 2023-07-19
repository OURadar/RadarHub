//
//  progress.jsx - Progress
//  RadarHub
//
//  This is a view
//
//  Created by Boonleng Cheong
//

import React from "react";

export function Progress(props) {
  const [value, setValue] = React.useState(0);
  const [transition, setTransition] = React.useState("invisible");

  React.useEffect(() => {
    setValue(props.value);
    if (props.value != 100) {
      setTransition("fadeIn");
    } else {
      setTransition("fadeOut");
      const timer = setTimeout(() => setValue(0), 800);
      return () => clearTimeout(timer);
    }
  }, [props.value]);

  return (
    <div id={props.id} className={`progress ${transition}`}>
      <div className="progress bar" style={{ transform: `translateX(${-100 + value}%)` }}></div>
    </div>
  );
}

Progress.defaultProps = {
  id: "kailena",
  value: 0,
  timeout: 5000,
};
