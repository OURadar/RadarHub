import React from "react";

export function removeSplash() {
  let o = document.getElementById("loading");
  if (o) o.style.opacity = 0;
  setTimeout(() => {
    document.getElementById("loading")?.remove();
    document.getElementById("app").classList.remove("hide");
  }, 500);
}

export function Splash(props) {
  const [value, setValue] = React.useState(0);
  const progress = props.progress;

  React.useEffect(() => setValue(progress), [progress]);

  React.useEffect(() => {
    if (value === 1) {
      setTimeout(() => setValue(2), 100);
    } else if (value === 2) {
      setTimeout(() => setValue(3), 600);
    }
  }, [value]);

  const classes = value === 2 ? "hide" : "";
  if (value == 3) {
    return;
  }
  return (
    <div id="splash" className={classes}>
      <svg
        className="logo50 spin"
        version="1.1"
        viewBox="0 0 96 96"
        stroke="white"
        fill="none"
      >
        <g strokeWidth="6" fill="none">
          <circle cx="48" cy="48" r="25" />
          <circle cx="48" cy="84" r="9" />
          <circle cx="48" cy="84" r="9" transform="rotate(120,48,48)" />
          <circle cx="48" cy="84" r="9" transform="rotate(240,48,48)" />
        </g>
        <g strokeLinecap="round" strokeWidth="10">
          <path d="M48,5l0,15" />
          <path d="M48,5l0,15" transform="rotate(120,48,48)" />
          <path d="M48,5l0,15" transform="rotate(240,48,48)" />
        </g>
      </svg>
      <br />
      <br />
      Loading ... {(props.progress * 100).toFixed(0)}%
    </div>
  );
}
