// src/components/tags/TagThesaurusInput.tsx
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
  path?: string[]; // e.g., ["Person","Artist"]
  synonyms?: string[]; // e.g., ["performer","musician"]
};

interface Props {
  /** Called when a term (suggested or custom) is added */
  onAdd: (name: string) => void;

  /** Async suggestion source */
  fetchSuggestions: (query: string) => Promise<ThesaurusItem[]>;

  /** When true, only allow picking items from thesaurus; when false, freeSolo is allowed */
  restrictToThesaurus?: boolean;
  onRestrictChange?: (v: boolean) => void;

  /** Optional initial value */
  defaultRestrictToThesaurus?: boolean;

  /** Optional label placeholder */
  placeholder?: string;
}

const DEBOUNCE_MS = 220;

const TagThesaurusInput: React.FC<Props> = ({
  onAdd,
  fetchSuggestions,
  restrictToThesaurus,
  defaultRestrictToThesaurus = false,
  placeholder = "Add tag (type to search thesaurus)",
}) => {
  const [value, setValue] = useState<string>("");
  const [options, setOptions] = useState<ThesaurusItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [internalRestrict] = useState<boolean>(
    restrictToThesaurus ?? defaultRestrictToThesaurus
  );

  // keep controlled/uncontrolled in sync if parent drives it
  const effectiveRestrict = restrictToThesaurus ?? internalRestrict;

  // debounced fetch
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
      onAdd(val.name);
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
        gridTemplateColumns: "1fr auto",
        gap: 1,
        alignItems: "center",
      }}
    >
      {/* Use FreeSolo generic as boolean so the prop can be true/false at runtime. */}
      <Autocomplete<ThesaurusItem, false, false, boolean>
        blurOnSelect
        options={options}
        loading={loading}
        freeSolo={!effectiveRestrict}
        onChange={handleChange}
        filterOptions={(opts) => opts} // server-side; show as-is
        onInputChange={(_, newInput) => {
          setValue(newInput);
          debouncedFetch(newInput);
        }}
        inputValue={value}
        getOptionLabel={(o) => (typeof o === "string" ? o : o.name)}
        renderOption={(props, option) => (
          <li {...props} key={`${option.name}-${option.path?.join("/") ?? ""}`}>
            <Box sx={{ display: "flex", flexDirection: "column" }}>
              <Typography
                sx={{ fontSize: 14, fontWeight: 800, color: "#0F172A" }}
              >
                {option.name}
              </Typography>
              {option.path && option.path.length > 0 && (
                <Typography sx={{ fontSize: 12, color: "#475569" }}>
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
            placeholder={placeholder}
            size="small"
            InputProps={{
              ...params.InputProps,
              endAdornment: (
                <>
                  {loading ? <CircularProgress size={16} /> : null}
                  {params.InputProps.endAdornment}
                </>
              ),
            }}
          />
        )}
      />

      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
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
