import React from "react";
import TextField from "@mui/material/TextField";
import AdapterDateFns from "@mui/lab/AdapterDateFns";
import LocalizationProvider from "@mui/lab/LocalizationProvider";
import DatePicker from "@mui/lab/DatePicker";

import { SectionHeader } from "./section-header";
import Button from "@mui/material/Button";

function Browser(props) {
  const files = props.archive?.data.list || [];
  const items = [];
  for (let k = 0; k < files.length; k++) {
    let file = files[k];
    items.push(
      <Button
        key={`file-${k}`}
        onClick={() => {
          console.log(`Clicked ${file}`);
          props.archive.load(file);
        }}
        variant="file"
      >
        {file}
      </Button>
    );
  }
  // Need to supply a event handler function from props

  const [value, setValue] = React.useState(null);

  return (
    <div>
      <SectionHeader name="archive" />
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <DatePicker
          label="Collection Date"
          value={value}
          onChange={(newValue) => {
            console.log("new date picked", newValue);
            setValue(newValue);
          }}
          renderInput={(params) => <TextField {...params} />}
        />
      </LocalizationProvider>
      <SectionHeader name="files" />
      {items}
    </div>
  );
}

export { Browser };
