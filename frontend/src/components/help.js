import React from "react";

import Modal from "@mui/material/Modal";
import Box from "@mui/material/Box";

export function HelpPage(props) {
  const style = {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    width: "50%",
    maxWidth: "600px",
    maxHeight: "80%",
    overflowY: "scroll",
    bgcolor: "background.paper",
    padding: "50px",
  };

  return (
    <Modal
      open={props.open}
      onClose={props.handleClose}
      aria-labelledby="modal-modal-title"
      aria-describedby="modal-modal-description"
    >
      <Box sx={style}>
        <h1>Some Title</h1>
        <div>
          <p>
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Praesent
            maximus laoreet dolor sed aliquet. Nulla sed odio ac dolor auctor
            accumsan. Fusce venenatis iaculis odio ut vestibulum. Nulla id lacus
            risus. Morbi sed facilisis lorem, iaculis commodo urna. Orci varius
            natoque penatibus et magnis dis parturient montes, nascetur
            ridiculus mus. Maecenas maximus cursus quam. Nam ac dolor et purus
            ullamcorper semper eu at ante. In non condimentum sapien.
            Suspendisse rhoncus neque ac nunc tincidunt, et interdum nunc
            tristique. Sed id posuere enim. Nam at egestas ipsum, eu commodo
            dui. Vivamus mattis, orci quis volutpat venenatis, nisi ante aliquet
            mi, eu lacinia odio purus sed ipsum.
          </p>
          <img src="/static/images/icon64.png" />
          <h1>Some Title</h1>
          <p>
            In dictum pretium dapibus. Phasellus vel leo dolor. Donec ultricies
            lobortis sollicitudin. Pellentesque dictum dapibus augue, a gravida
            lectus consectetur quis. Fusce maximus ullamcorper augue vel mollis.
            Duis pharetra ultricies quam, id molestie diam porttitor eget. Donec
            malesuada sit amet ipsum eget dignissim. Etiam molestie sapien in ex
            viverra, consequat tristique dolor mollis. Nullam mattis lacus
            lorem, ut accumsan ex sagittis sed.
          </p>
          <img src="/static/images/icon512.png" width="512px" />
          <p>
            Cras sed velit facilisis, porta velit id, pharetra leo. Nam eleifend
            consequat viverra. Aenean tempor nisl non neque porta convallis.
            Curabitur sollicitudin nisl et odio tincidunt placerat. Vivamus
            euismod dui eu nisi auctor ornare. Phasellus auctor ut lorem ac
            vulputate. Nulla velit lorem, consectetur nec urna vitae, facilisis
            lobortis sem. Nullam augue felis, consectetur eu bibendum eu, congue
            et turpis. Mauris odio enim, vehicula id lorem vitae, euismod
            iaculis neque. Praesent mi urna, interdum et orci mattis,
            ullamcorper congue felis.
          </p>
          <img src="/static/images/icon512.png" />
          <p>More text</p>
        </div>
      </Box>
    </Modal>
  );
}
