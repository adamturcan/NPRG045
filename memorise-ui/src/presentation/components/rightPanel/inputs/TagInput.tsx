
import React from "react";
import { TextField, InputAdornment, IconButton } from "@mui/material";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";

interface Props {
  value: string;
  
  onChange: (v: string) => void;
  
  onSubmit: () => void;
}

const TagInput: React.FC<Props> = ({ value, onChange, onSubmit }) => {
  const canAdd = Boolean(value.trim());
  
  return (
    <TextField
      fullWidth
      placeholder="Add custom tag"
      value={value}
      variant="standard"
      InputProps={{
        disableUnderline: true, 
        endAdornment: (
          <InputAdornment position="end">           
            <IconButton
              size="small"
              disabled={!canAdd}
              onClick={onSubmit}
              sx={{ color: canAdd ? "#7A91B4" : "#B8C7DC" }}
            >
              <AddCircleOutlineIcon fontSize="small" />
            </IconButton>
          </InputAdornment>
        ),
      }}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && canAdd) {
          e.preventDefault();
          onSubmit();
        }
      }}
      sx={{
        border: "1px dashed #C8D6EA",     
        backgroundColor: "rgba(255,255,255,0.55)",
        borderRadius: 1.5,
        px: 1,
        py: 0.25,
        "& input": {
          color: "#1E293B",
          fontFamily: "DM Mono, monospace", 
          "::placeholder": { color: "#7B8AA0", opacity: 0.8 },
          fontSize: 13,
        },
        "&:hover": { borderColor: "#B8C7DC" },
        "&:focus-within": {
          borderColor: "#7A91B4",
          boxShadow: "0 0 0 2px rgba(122,145,180,0.18)", 
        },
      }}
    />
  );
};

export default TagInput;
