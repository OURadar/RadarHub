import React from "react";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";

const link = "/static/html/license.html";

export function TermPopup({
  onTermSheet = () => {
    window.location.assign(link);
  },
  onClose = () => {},
}) {
  React.useEffect(() => {
    document.getElementById("termCover").style.opacity = 1;
  }, []);

  return (
    <div id="termCover" className="cover">
      <Box id="agreement">
        <h1>Terms and Conditions</h1>
        <div className="spacer10"></div>
        <p>
          By clicking on Continue, you agree to the RadarHub's<span> </span>
          <a className="inline" href={link}>
            Terms and Conditions of Use
          </a>
          .
        </p>
        <div className="spacer10"></div>
        <Button variant="big" onClick={onClose}>
          Continue
        </Button>
      </Box>
    </div>
  );
}

// TermPopup.defaultProps = {
//   onTermSheet: () => {
//     window.location.assign(link);
//   },
// };

export function TermSheet() {
  return (
    <Box>
      <iframe
        id="termSheet"
        title="Inline Frame Example"
        width="300"
        height="200"
        src="/static/html/license.html"
      ></iframe>
    </Box>
  );
}
