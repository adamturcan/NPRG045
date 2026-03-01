import React, { useState, useRef, useEffect, useCallback } from "react";
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


const ThesaurusOption = React.memo(({ liProps, option }: { liProps: React.HTMLAttributes<HTMLLIElement>, option: ThesaurusItem }) => {
  return (
    <li {...liProps}>
      <Box sx={{ display: "flex", flexDirection: "column", width: "100%" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          {/* Depth indicators */}
          {typeof option.depth === "number" && option.depth > 0 && (
            <Box sx={{ display: "flex", gap: 0.3 }}>
              {Array.from({ length: option.depth }).map((_, i) => (
                <Box key={i} sx={{ ...styles.depthDot, opacity: 0.7 - i * 0.12 }} />
              ))}
            </Box>
          )}

          <Typography sx={{ fontSize: 14, fontWeight: 800, color: "#0F172A" }}>
            {option.name}
          </Typography>

          {option.isPreferred === false && (
            <Chip size="small" label="alias" sx={styles.aliasChip} />
          )}
        </Box>

        {/* Cesta */}
        {option.path && option.path.length > 0 && (
          <Typography sx={{ fontSize: 11, color: "#475569", mt: 0.25 }}>
            {option.path.join(" › ")}
          </Typography>
        )}

        {/* Synonymá */}
        {option.synonyms && option.synonyms.length > 0 && (
          <Box sx={{ mt: 0.5, display: "flex", gap: 0.5, flexWrap: "wrap" }}>
            {option.synonyms.slice(0, 4).map((s) => (
              <Chip key={s} size="small" label={s} />
            ))}
          </Box>
        )}
      </Box>
    </li>
  );
});

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

  const effectiveRestrict = restrictToThesaurus ?? defaultRestrictToThesaurus;
  const timerRef = useRef<number>();

  
  useEffect(() => {
    return () => clearTimeout(timerRef.current);
  }, []);

  const handleInputChange = useCallback(
    (_: React.SyntheticEvent, newInput: string) => {
      setValue(newInput);
      clearTimeout(timerRef.current);

      if (!newInput.trim()) {
        setOptions([]);
        return;
      }

      timerRef.current = window.setTimeout(async () => {
        setLoading(true);
        try {
          const res = await fetchSuggestions(newInput);
          setOptions(res);
        } catch {
          setOptions([]);
        } finally {
          setLoading(false);
        }
      }, DEBOUNCE_MS);
    },
    [fetchSuggestions]
  );

  const handleChange = useCallback(
    (_: React.SyntheticEvent, val: ThesaurusItem | string | null) => {
      if (typeof val === "string") {
        if (!effectiveRestrict && val.trim()) onAdd(val.trim());
      } else if (val) {
        onAdd(val.name, val.keywordId, val.parentId);
      }

      setValue("");
      setOptions([]);
    },
    [effectiveRestrict, onAdd]
  );

  const handleSubmitFree = useCallback(() => {
    const name = value.trim();
    if (!name) return;

    onAdd(name);
    setValue("");
    setOptions([]);
  }, [value, onAdd]);

  return (
    <Box sx={styles.container}>
      <Autocomplete<ThesaurusItem, false, false, boolean>
        sx={{ flex: 1, minWidth: 0 }} 
        blurOnSelect
        value={null}
        options={options}
        loading={loading}
        freeSolo={!effectiveRestrict}
        filterOptions={(opts) => opts} 
        inputValue={value}
        disabled={isThesaurusLoading}
        onChange={handleChange}
        onInputChange={handleInputChange}
        getOptionLabel={(o) => (typeof o === "string" ? o : o.name)}
        renderOption={(props, option) => {
          const { key, ...restProps } = props as React.HTMLAttributes<HTMLLIElement> & { key: React.Key };
          
          const uniqueKey = `${option.keywordId || 'noid'}::${option.name}::${option.path?.join("/") ?? "root"}`;

          return (
            <ThesaurusOption 
              key={uniqueKey || key} 
              liProps={restProps} 
              option={option} 
            />
          );
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            placeholder={isThesaurusLoading ? "Loading thesaurus..." : placeholder}
            size="small"
            InputProps={{
              ...params.InputProps,
              endAdornment: (
                <>
                  {loading || isThesaurusLoading ? <CircularProgress size={16} sx={{ mr: 1 }} /> : null}
                  {params.InputProps.endAdornment}
                </>
              ),
            }}
          />
        )}
      />

      {!effectiveRestrict && (
        <Tooltip title="Add custom tag">
          <span>
            <IconButton
              size="small"
              onClick={handleSubmitFree}
              disabled={!value.trim()}
              aria-label="Add custom tag"
              sx={styles.addButton}
            >
              <AddIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      )}
    </Box>
  );
};



const styles = {
  container: { display: "flex", alignItems: "center", gap: 1, width: "100%" },
  addButton: {
    backgroundColor: "rgba(33, 66, 108, 0.12)",
    "&:hover": { backgroundColor: "rgba(33, 66, 108, 0.22)" },
    color: "#21426C",
    width: 32,
    height: 32,
    flexShrink: 0,
  },
  depthDot: { width: 4, height: 4, borderRadius: "50%", bgcolor: "#A0B8DD" },
  aliasChip: { height: 18, fontSize: 10, bgcolor: "rgba(255, 152, 0, 0.15)", color: "#E65100" }
};

export default TagThesaurusInput;