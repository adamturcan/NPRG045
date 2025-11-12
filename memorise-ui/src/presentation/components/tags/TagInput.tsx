/**
 * TagInput - Simple text input for adding custom tags
 * 
 * A basic, lightweight input field for manually entering tag names.
 * This is the LEGACY input component - newer code should use TagThesaurusInput instead.
 * 
 * FEATURES:
 * 
 * 1. Simple Input:
 *    - Text field with dashed border
 *    - Placeholder: "Add custom tag"
 *    - No autocomplete or suggestions
 * 
 * 2. Add Button:
 *    - Icon button inside input (right side)
 *    - Disabled when input is empty
 *    - Changes color when enabled/disabled
 * 
 * 3. Submit Methods:
 *    - Click the + button
 *    - Press Enter key
 *    - Both clear input after submit
 * 
 * 4. Visual Design:
 *    - Dashed border (indicates custom entry)
 *    - Light background with transparency
 *    - Hover and focus states
 *    - DM Mono monospace font
 * 
 * NOTE: This component is kept for backwards compatibility.
 * New code should use TagThesaurusInput for better UX with suggestions.
 */
import React from "react";
import { TextField, InputAdornment, IconButton } from "@mui/material";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";

interface Props {
  /** Current input value */
  value: string;
  
  /** Called when input changes (user types) */
  onChange: (v: string) => void;
  
  /** Called when user submits (Enter or click +) */
  onSubmit: () => void;
}

const TagInput: React.FC<Props> = ({ value, onChange, onSubmit }) => {
  // Disable add button when input is empty or only whitespace
  const canAdd = Boolean(value.trim());
  
  return (
    <TextField
      fullWidth
      placeholder="Add custom tag"
      value={value}
      variant="standard"
      InputProps={{
        disableUnderline: true, // Remove default Material-UI underline
        endAdornment: (
          <InputAdornment position="end">
            {/* Add button (+ icon) */}
            <IconButton
              size="small"
              disabled={!canAdd}
              onClick={onSubmit}
              // Blue when enabled, gray when disabled
              sx={{ color: canAdd ? "#7A91B4" : "#B8C7DC" }}
            >
              <AddCircleOutlineIcon fontSize="small" />
            </IconButton>
          </InputAdornment>
        ),
      }}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        // Submit on Enter key (if input not empty)
        if (e.key === "Enter" && canAdd) {
          e.preventDefault();
          onSubmit();
        }
      }}
      sx={{
        border: "1px dashed #C8D6EA",     // Dashed = custom entry
        backgroundColor: "rgba(255,255,255,0.55)",
        borderRadius: 1.5,
        px: 1,
        py: 0.25,
        "& input": {
          color: "#1E293B",
          fontFamily: "DM Mono, monospace", // Match editor font
          "::placeholder": { color: "#7B8AA0", opacity: 0.8 },
          fontSize: 13,
        },
        "&:hover": { borderColor: "#B8C7DC" },
        "&:focus-within": {
          borderColor: "#7A91B4",
          boxShadow: "0 0 0 2px rgba(122,145,180,0.18)", // Focus ring
        },
      }}
    />
  );
};

export default TagInput;
