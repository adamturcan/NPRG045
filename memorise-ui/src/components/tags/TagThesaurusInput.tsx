// src/components/tags/TagThesaurusInput.tsx
/**
 * TagThesaurusInput - Autocomplete input with thesaurus/taxonomy suggestions
 * 
 * This is the MODERN tag input component with intelligent autocomplete.
 * It fetches suggestions from an external API (e.g., Datamuse, or custom taxonomy).
 * 
 * FEATURES:
 * 
 * 1. Two Input Modes:
 *    - Restricted: Only thesaurus suggestions allowed (no free-form text)
 *    - Free-form: Custom tags allowed + suggestions shown (freeSolo mode)
 * 
 * 2. Autocomplete:
 *    - Debounced API calls (220ms delay after typing stops)
 *    - Shows loading spinner while fetching
 *    - Rich suggestion display with taxonomy path and synonyms
 * 
 * 3. Visual Design:
 *    - Clean Material-UI Autocomplete
 *    - Suggestion items show:
 *      * Main term name
 *      * Hierarchical path (e.g., "Person › Artist")
 *      * Up to 4 synonym chips
 *    - Add button (+ icon) when in free-form mode
 * 
 * 4. Submit Methods:
 *    - Select a suggestion from dropdown
 *    - Click + button (free-form mode only)
 *    - Type custom text and press Enter (free-form mode only)
 * 
 * 5. State Management:
 *    - Can be controlled (restrictToThesaurus prop) or uncontrolled
 *    - Automatically clears input after submit
 *    - Manages loading state for suggestions
 */
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

/**
 * Thesaurus suggestion item format
 */
export type ThesaurusItem = {
  /** The main term/tag name */
  name: string;
  
  /** Hierarchical category path, e.g., ["culture", "writing", "Jewish publications"] */
  path?: string[];
  
  /** Related terms/synonyms, e.g., ["performer","musician"] */
  synonyms?: string[];
  
  /** Keyword ID from thesaurus (for reference) */
  keywordId?: number;
  
  /** Parent ID from thesaurus (to disambiguate duplicate KeywordIDs) */
  parentId?: number;
  
  /** Whether this is the preferred term (false = alias/variant) */
  isPreferred?: boolean;
  
  /** Depth in hierarchy (0 = root, 1 = child, etc.) - for visual indentation */
  depth?: number;
};

interface Props {
  /** Called when user adds a tag (from suggestions or custom text) */
  onAdd: (name: string, keywordId?: number, parentId?: number) => void;

  /** Async function to fetch tag suggestions from API */
  fetchSuggestions: (query: string) => Promise<ThesaurusItem[]>;
  
  /** Whether thesaurus is still loading (shows in placeholder) */
  isThesaurusLoading?: boolean;

  /** 
   * Restriction mode:
   * - true: Only thesaurus suggestions allowed
   * - false: Free-form custom tags + suggestions (freeSolo)
   */
  restrictToThesaurus?: boolean;
  
  /** Called when restriction mode changes (for controlled component) */
  onRestrictChange?: (v: boolean) => void;

  /** Initial restriction mode (for uncontrolled component) */
  defaultRestrictToThesaurus?: boolean;

  /** Placeholder text for input field */
  placeholder?: string;
}

/**
 * Debounce delay in milliseconds before fetching suggestions
 * (prevents API spam while user is typing)
 */
const DEBOUNCE_MS = 220;

const TagThesaurusInput: React.FC<Props> = ({
  onAdd,
  fetchSuggestions,
  restrictToThesaurus,
  defaultRestrictToThesaurus = false,
  placeholder = "Add tag (type to search thesaurus)",
  isThesaurusLoading = false,
}) => {
  /**
   * ============================================================================
   * STATE
   * ============================================================================
   */

  /** Current input value (what user is typing) */
  const [value, setValue] = useState<string>("");
  
  /** Autocomplete suggestions fetched from API */
  const [options, setOptions] = useState<ThesaurusItem[]>([]);
  
  /** Loading state while fetching suggestions */
  const [loading, setLoading] = useState(false);
  
  /** 
   * Internal restriction state (for uncontrolled mode)
   * Set once on mount, not updated
   */
  const [internalRestrict] = useState<boolean>(
    restrictToThesaurus ?? defaultRestrictToThesaurus
  );

  /**
   * Effective restriction mode (controlled prop overrides internal state)
   */
  const effectiveRestrict = restrictToThesaurus ?? internalRestrict;

  /**
   * ============================================================================
   * DEBOUNCED SUGGESTION FETCHING
   * ============================================================================
   * 
   * Fetches suggestions from API after user stops typing (220ms delay).
   * This prevents excessive API calls while user is still typing.
   */
  const debouncedFetch = useMemo(() => {
    let t: number | undefined;
    
    return (q: string) => {
      // Cancel previous timer if user is still typing
      if (t) window.clearTimeout(t);
      
      // Clear suggestions for empty query
      if (!q.trim()) {
        setOptions([]);
        return;
      }
      
      // Schedule API call for 220ms from now
      t = window.setTimeout(async () => {
        setLoading(true);
        try {
          const res = await fetchSuggestions(q);
          setOptions(res);
        } catch {
          // Silently fail and show no suggestions
          setOptions([]);
        } finally {
          setLoading(false);
        }
      }, DEBOUNCE_MS);
    };
  }, [fetchSuggestions]);

  /**
   * ============================================================================
   * SUBMIT HANDLERS
   * ============================================================================
   */

  /**
   * Handle selection from autocomplete dropdown
   * Works for both suggestion selection and custom text entry (freeSolo mode)
   */
  const handleChange = (
    _: React.SyntheticEvent,
    val: ThesaurusItem | string | null
  ) => {
    if (typeof val === "string") {
      // Free-form text entry (only allowed when not restricted)
      if (!effectiveRestrict && val.trim()) onAdd(val.trim());
    } else if (val) {
      // Selected a suggestion from dropdown - pass name, keywordId, AND parentId
      onAdd(val.name, val.keywordId, val.parentId);
    }
    
    // Clear input and suggestions
    setValue("");
    setOptions([]);
  };

  /**
   * Handle clicking the + button (free-form mode only)
   * Submits current input value as custom tag
   */
  const handleSubmitFree = () => {
    const name = value.trim();
    if (!name) return;
    
    onAdd(name);
    setValue("");
    setOptions([]);
  };

  /**
   * ============================================================================
   * RENDER
   * ============================================================================
   */
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: effectiveRestrict ? "1fr" : "1fr auto",  // Dynamic: Input only | Input + Add button
        gap: 0 , // Reduced gap (4px) when button is shown
        alignItems: "center",
      }}
    >
      {/* ========================================================================
          AUTOCOMPLETE INPUT with suggestions
          ======================================================================== */}
      {/* FreeSolo type as boolean allows runtime toggle between modes */}
      <Autocomplete<ThesaurusItem, false, false, boolean>
        sx={{ 
          width: "100%",
          maxWidth: effectiveRestrict ? "95%" : "calc(100% - 15px)"  // Leave space for + button (32px) + gap (4px) when not restricted
        }}
        blurOnSelect
        value={null}                           // Always null to clear after selection
        options={options}                      // Suggestions from API
        loading={loading}                      // Show loading spinner
        freeSolo={!effectiveRestrict}          // Allow custom text in free-form mode
        onChange={handleChange}                // Handle selection/submission
        filterOptions={(opts) => opts}         // No client-side filtering (server-side)
        onInputChange={(_, newInput) => {
          setValue(newInput);
          debouncedFetch(newInput);            // Fetch suggestions as user types
        }}
        inputValue={value}
        getOptionLabel={(o) => (typeof o === "string" ? o : o.name)}
        renderOption={(props, option) => (
          <li {...props} key={`${option.name}-${option.path?.join("/") ?? ""}`}>
            <Box sx={{ display: "flex", flexDirection: "column" }}>
              {/* Main term with depth indicator and preferred badge */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {/* Depth dots (visual hierarchy indicator) */}
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
                
                {/* Term name */}
                <Typography
                  sx={{ fontSize: 14, fontWeight: 800, color: "#0F172A" }}
                >
                  {option.name}
                </Typography>
                
                {/* Non-preferred badge (alias/variant indicator) */}
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
              
              {/* Full hierarchical path (e.g., "culture › writing › Jewish publications") */}
              {option.path && option.path.length > 0 && (
                <Typography sx={{ fontSize: 11, color: "#475569", mt: 0.25 }}>
                  {option.path.join(" › ")}
                </Typography>
              )}
              
              {/* Synonym chips (max 4) - if available */}
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
                  {/* Show loading spinner: either fetching suggestions OR loading thesaurus */}
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

      {/* ========================================================================
          ADD BUTTON: Only shown in free-form mode
          ======================================================================== */}
      <Box sx={{ display: "flex", alignItems: "center",pr:2}}>
        {!effectiveRestrict && (
          <Tooltip title="Add custom tag">
            {/* Span wrapper required for tooltip to work with disabled button */}
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
