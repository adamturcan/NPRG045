import React, { useMemo, useState } from "react";
import Autocomplete from "@mui/material/Autocomplete";
import {
  Box,
  Chip,
  CircularProgress,
  IconButton,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";

export type ThesaurusItem = {
  name: string;
  
  path?: string[];
  
  synonyms?: string[];
  
  keywordId?: number;
  
  parentId?: number;
  
  isPreferred?: boolean;
  
  depth?: number;
};

interface Props {
  onAdd: (name: string, keywordId?: number, parentId?: number) => void;

  fetchSuggestions: (query: string) => Promise<ThesaurusItem[]>;
  
  isThesaurusLoading?: boolean;

  restrictToThesaurus?: boolean;
  
  onRestrictChange?: (v: boolean) => void;

  defaultRestrictToThesaurus?: boolean;

  placeholder?: string;
}

const DEBOUNCE_MS = 220;

const TagThesaurusInput: React.FC<Props> = ({
  onAdd,
  fetchSuggestions,
  restrictToThesaurus,
  defaultRestrictToThesaurus = false,
  placeholder = "Add tag (type to search thesaurus)",
  isThesaurusLoading = false,
}) => {

  const [value, setValue] = useState<string>("");
  
  const [options, setOptions] = useState<ThesaurusItem[]>([]);
  
  const [loading, setLoading] = useState(false);
  
  
  const [internalRestrict] = useState<boolean>(
    restrictToThesaurus ?? defaultRestrictToThesaurus
  );

  const effectiveRestrict = restrictToThesaurus ?? internalRestrict;

  const debouncedFetch = useMemo(() => {
    let t: number | undefined;
    
    return (q: string) => {
      if (t) window.clearTimeout(t);
      
      if (!q.trim()) {
        setOptions([]);
        return;
      }
      
      t = window.setTimeout(async () => {
        setLoading(true);
        try {
          const res = await fetchSuggestions(q);
          setOptions(res);
        } catch {
          setOptions([]);
        } finally {
          setLoading(false);
        }
      }, DEBOUNCE_MS);
    };
  }, [fetchSuggestions]);


  const handleChange = (
    _: React.SyntheticEvent,
    val: ThesaurusItem | string | null
  ) => {
    if (typeof val === "string") {
      if (!effectiveRestrict && val.trim()) onAdd(val.trim());
    } else if (val) {
      onAdd(val.name, val.keywordId, val.parentId);
    }
    
    setValue("");
    setOptions([]);
  };

  const handleSubmitFree = () => {
    const name = value.trim();
    if (!name) return;
    
    onAdd(name);
    setValue("");
    setOptions([]);
  };

  return (
    <Box
      sx={{
        display: "grid",
          gridTemplateColumns: effectiveRestrict ? "1fr" : "1fr auto",  
        gap: 0 , 
        alignItems: "center",
      }}
    >
      <Autocomplete<ThesaurusItem, false, false, boolean>
        sx={{ 
          width: "100%",
          maxWidth: effectiveRestrict ? "95%" : "calc(100% - 15px)"  
        }}
        blurOnSelect
        value={null}                           
        options={options}                      
        loading={loading}                      
        freeSolo={!effectiveRestrict}          
        onChange={handleChange}                
        filterOptions={(opts) => opts}         
        onInputChange={(_, newInput) => {
          setValue(newInput);
          debouncedFetch(newInput);            
        }}
        inputValue={value}
        getOptionLabel={(o) => (typeof o === "string" ? o : o.name)}
        renderOption={(props, option) => (
          <li {...props} key={`${option.name}-${option.path?.join("/") ?? ""}`}>
            <Box sx={{ display: "flex", flexDirection: "column" }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {typeof option.depth === 'number' && option.depth > 0 && (
                  <Box sx={{ display: 'flex', gap: 0.3 }}>
                    {Array.from({ length: option.depth }).map((_, i) => (
                      <Box 
                        key={i}
                        sx={{ 
                          width: 4, 
                          height: 4, 
                          borderRadius: '50%',
                          bgcolor: '#A0B8DD',
                          opacity: 0.7 - (i * 0.12),
                        }} 
                      />
                    ))}
                  </Box>
                )}
                
                <Typography
                  sx={{ fontSize: 14, fontWeight: 800, color: "#0F172A" }}
                >
                  {option.name}
                </Typography>
                
                {option.isPreferred === false && (
                  <Chip 
                    size="small" 
                    label="alias" 
                    sx={{ 
                      height: 18, 
                      fontSize: 10,
                      bgcolor: 'rgba(255, 152, 0, 0.15)',
                      color: '#E65100',
                    }} 
                  />
                )}
              </Box>
              
              {option.path && option.path.length > 0 && (
                <Typography sx={{ fontSize: 11, color: "#475569", mt: 0.25 }}>
                  {option.path.join(" › ")}
                </Typography>
              )}
              
              {option.synonyms && option.synonyms.length > 0 && (
                <Box
                  sx={{ mt: 0.5, display: "flex", gap: 0.5, flexWrap: "wrap" }}
                >
                  {option.synonyms.slice(0, 4).map((s) => (
                    <Chip key={s} size="small" label={s} />
                  ))}
                </Box>
              )}
            </Box>
          </li>
        )}
        renderInput={(params) => (
          <TextField
            {...params}
            placeholder={
              isThesaurusLoading 
                ? "Loading thesaurus..." 
                : placeholder
            }
            size="small"
            disabled={isThesaurusLoading}
            InputProps={{
              ...params.InputProps,
              endAdornment: (
                <>
                  {(loading || isThesaurusLoading) ? (
                    <CircularProgress size={16} sx={{ mr: 1 }} />
                  ) : null}
                  {params.InputProps.endAdornment}
                </>
              ),
            }}
          />
        )}
      />

      <Box sx={{ display: "flex", alignItems: "center",pr:2}}>
        {!effectiveRestrict && (
          <Tooltip title="Add custom tag">
            <span>
              <IconButton
                size="small"
                onClick={handleSubmitFree}
                disabled={!value.trim()}
                sx={{
                  backgroundColor: "rgba(33, 66, 108, 0.12)",
                  "&:hover": { backgroundColor: "rgba(33, 66, 108, 0.22)" },
                  color: "#21426C",
                  width: 32,
                  height: 32,
                }}
              >
                <AddIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        )}
      </Box>
    </Box>
  );
};

export default TagThesaurusInput;
