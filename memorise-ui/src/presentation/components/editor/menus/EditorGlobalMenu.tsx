import React, { useState } from "react";
import { Box, IconButton, Tooltip, Collapse, Autocomplete, TextField, ClickAwayListener } from "@mui/material";
import { alpha } from "@mui/material/styles";

import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import LabelOutlinedIcon from "@mui/icons-material/LabelOutlined";
import CallSplitIcon from "@mui/icons-material/CallSplit";
import ManageSearchIcon from "@mui/icons-material/ManageSearch";
import TranslateIcon from "@mui/icons-material/Translate"; 

  interface EditorGlobalMenuProps {
  onNer: () => void;
  onSegment: () => void;
  onSemTag: () => void;
  onSave: () => void;
  onTranslateAll: (langCode: string) => void; 
  isProcessing: boolean;
  hasSegments?: boolean; 
  languageOptions: any[];
  isLanguageListLoading: boolean;
}

const COLORS = {
  gold: "#DDD1A0",
  magenta: "#C2185B",
  dateBlue: "#1976D2",
  darkBlue: "#21426C",
  green: "#388E3C",
  orange: "#F57C00", 
};

const EditorGlobalMenu: React.FC<EditorGlobalMenuProps> = ({
  onNer,
  onSegment,
  onSemTag,
  onSave,
  onTranslateAll,
  isProcessing,
  hasSegments = false,
  languageOptions,
  isLanguageListLoading
}) => {
  const [showTranslate, setShowTranslate] = useState(false);

  const actions = [
    { key: "save", icon: <SaveOutlinedIcon fontSize="small" />, name: "Save Workspace", onClick: onSave, accent: COLORS.green },
    { key: "translate", icon: <TranslateIcon fontSize="small" />, name: "Translate Document", onClick: () => setShowTranslate((prev) => !prev), accent: COLORS.orange },
    { key: "semtag", icon: <LabelOutlinedIcon fontSize="small" />, name: "Run Sem-Tags", onClick: onSemTag, accent: COLORS.magenta },
    { key: "segment", icon: <CallSplitIcon fontSize="small" />, name: hasSegments ? "Re-segment" : "Auto-Segment", onClick: onSegment, accent: COLORS.dateBlue },
    { key: "ner", icon: <ManageSearchIcon fontSize="small" />, name: "Run NER", onClick: onNer, accent: COLORS.magenta },
  ];

  return (
   
    <ClickAwayListener onClickAway={() => setShowTranslate(false)}>
      <Box sx={{ 
        display: "flex", 
        alignItems: "center",
        backgroundColor: "#ffffff", 
        borderRadius: "30px", 
        padding: "4px 16px", 
        boxShadow: "0 4px 14px rgba(0,0,0,0.08)", 
        border: "1px solid #e2e8f0",
        transition: "all 0.3s ease" 
      }}>
         
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          {actions.map((action) => (
            <React.Fragment key={action.key}>
              
              <Tooltip 
                title={action.name} 
                placement="bottom"
                componentsProps={{
                  tooltip: {
                    sx: {
                      bgcolor: alpha("#FFFFFF", 0.95),
                      color: COLORS.darkBlue,
                      border: `1px solid ${alpha(COLORS.darkBlue, 0.16)}`,
                      boxShadow: "0 4px 14px rgba(0,0,0,0.08)",
                      borderRadius: "8px",
                      padding: "6px 12px",
                      fontSize: 13,
                      fontWeight: 600,
                      mt: 1, 
                    }
                  }
                }}
              >
                <span>
                  <IconButton
                    disabled={isProcessing}
                    onClick={action.onClick}
                    sx={{
                      width: 42,
                      height: 42,
                      color: action.accent,
                      bgcolor: action.key === "translate" && showTranslate ? alpha(action.accent, 0.1) : "transparent",
                      transition: "all 0.2s ease",
                      "&:hover": {
                        bgcolor: alpha(action.accent, 0.1),
                        transform: "scale(1.1)",
                      },
                      "&.Mui-disabled": {
                        opacity: 0.5,
                      }
                    }}
                  >
                    {action.icon}
                  </IconButton>
                </span>
              </Tooltip>

              
              {action.key === "translate" && (
                <Collapse in={showTranslate} orientation="horizontal" unmountOnExit>              
                  <Box sx={{ display: "flex", alignItems: "center" }}>
                    <Box sx={{ width: "1px", height: "24px", bgcolor: "#e2e8f0", mx: 1 }} />
                    <Box sx={{ width: 180, pr: 1, display: "flex", alignItems: "center" }}>
                      <Autocomplete
                        fullWidth
                        size="small"
                        disableClearable
                        forcePopupIcon={false}
                        options={languageOptions || []}
                        getOptionLabel={(option: any) => option.label}
                        loading={isLanguageListLoading}
                        onChange={(event, newValue: any) => {
                          if (newValue) {
                            onTranslateAll(newValue.code);
                            setShowTranslate(false);
                          }
                        }}
                        slotProps={{
                          paper: {
                            sx: {
                              mt: 1,
                              borderRadius: "8px",
                              boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                              border: "1px solid #e2e8f0"
                            }
                          }
                        }}
                        renderOption={(props, option: any) => (
                          <li {...props} key={option.code}>
                            <Box sx={{ display: "flex", flexDirection: "column", py: 0.5 }}>
                              <span style={{ textTransform: "uppercase", fontWeight: 700, color: '#1e293b' }}>{option.code}</span>
                              <span style={{ fontSize: "0.8rem", color: '#64748b' }}>{option.label}</span>
                            </Box>
                          </li>
                        )}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            autoFocus
                            placeholder="Translate to..."
                            variant="standard"
                            InputProps={{
                              ...params.InputProps,
                              disableUnderline: true,
                              sx: { fontSize: "14px", color: '#64748b', fontWeight: 500 }
                            }}
                          />
                        )}
                      />
                    </Box>                    
                    <Box sx={{ width: "1px", height: "24px", bgcolor: "#e2e8f0", mx: 1 }} />
                  </Box>
                </Collapse>
              )}

            </React.Fragment>
          ))}
        </Box>
      </Box>
    </ClickAwayListener>
  );
};

export default EditorGlobalMenu;