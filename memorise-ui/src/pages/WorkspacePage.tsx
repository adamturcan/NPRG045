import AddIcon from "@mui/icons-material/Add";
import ClearIcon from "@mui/icons-material/Clear";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import LabelIcon from "@mui/icons-material/Label";
import {
  Box,
  Button,
  IconButton,
  Menu,
  MenuItem,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { useEffect, useRef, useState } from "react";
import type { Workspace } from "../types/Workspace";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import InputAdornment from "@mui/material/InputAdornment";

const LANGUAGES = ["eng", "ces", "dan", "nld"];
const BOOKMARK_COLORS = ["#FF8A80", "#80D8FF", "#CCFF90", "#FFD180"];
const CUSTOM_TAG_COLOR = "#DDA0AF";

interface Props {
  workspaces: Workspace[];
}

const WorkspacePage: React.FC<Props> = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [text, setText] = useState("");
  const [classificationResults, setClassificationResults] = useState<
    any[] | null
  >(null);
  const [bookmarks, setBookmarks] = useState<string[]>([]);
  const [bookmarkAnchor, setBookmarkAnchor] = useState<null | HTMLElement>(
    null
  );
  const [customTagInput, setCustomTagInput] = useState("");
  const [customTags, setCustomTags] = useState<string[]>([]);

  const tagTableRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const c = () => classify();
    document.addEventListener("trigger:classify", c);
    return () => document.removeEventListener("trigger:classify", c);
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const content = await file.text();
    setText(content);
  };

  const classify = async () => {
    const res = await fetch(
      "https://semtag-api.dev.memorise.sdu.dk/semtag/classify",
      {
        method: "POST",
        body: JSON.stringify({ text }),
        headers: { "Content-Type": "application/json" },
      }
    );
    const data = await res.json();
    setClassificationResults(data.results || []);
    setTimeout(() => {
      tagTableRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    }, 100);
  };

  const openBookmarkMenu = (e: React.MouseEvent<HTMLElement>) =>
    setBookmarkAnchor(e.currentTarget);
  const closeBookmarkMenu = () => setBookmarkAnchor(null);

  const handleBookmarkSelect = (lang: string) => {
    if (!bookmarks.includes(lang)) {
      setBookmarks([...bookmarks, lang]);
      console.log(`Bookmark translation: ${lang}`);
    }
    closeBookmarkMenu();
  };

  const combinedTags = [
    ...customTags.map((t) => ({ name: t, source: "custom" as const })),
    ...(classificationResults?.map((r: any) => ({
      name: r.name,
      source: "api" as const,
    })) || []),
  ];

  const renderTable = (
    data: { name: string; source: "api" | "custom" }[],
    onDelete: (name: string) => void,
    inputField: React.ReactNode
  ) => (
    <Paper
      sx={{
        flex: 1,
        height: "100%",
        overflow: "auto",
        border: `1px solid #A0B8DD`,
        borderRadius: "12px",
        backgroundColor: "rgba(255,255,255,0.02)",
        p: 2,
      }}
    >
      <Table size="small">
        <TableBody>
          <TableRow>
            <TableCell colSpan={2}>{inputField}</TableCell>
          </TableRow>

          {data.length > 0 ? (
            data.map((row, i) => (
              <TableRow key={`${row.name}-${i}`}>
                <TableCell
                  sx={{
                    fontSize: "0.9rem",
                    color:
                      row.source === "custom" ? CUSTOM_TAG_COLOR : "#A0B8DD",
                  }}
                >
                  {row.name}
                </TableCell>
                <TableCell align="right" sx={{ width: "32px" }}>
                  <IconButton
                    size="small"
                    onClick={() => onDelete(row.name)}
                    sx={{
                      color:
                        row.source === "custom" ? CUSTOM_TAG_COLOR : "#A0B8DD",
                    }}
                  >
                    <ClearIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={2}>
                <Typography sx={{ color: "#DDD1A0", fontSize: "0.85rem" }}>
                  No semantic tags yet. Click the tag icon above to generate.
                </Typography>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </Paper>
  );

  const tagInputField = (
    <TextField
      fullWidth
      placeholder="Add custom tag"
      value={customTagInput}
      variant="standard"
      InputProps={{
        disableUnderline: true,
        endAdornment: (
          <InputAdornment position="end">
            <IconButton
              size="small"
              disabled={!customTagInput.trim()}
              onClick={() => {
                const tag = customTagInput.trim();
                const exists =
                  customTags.includes(tag) ||
                  classificationResults?.some((r) => r.name === tag);
                if (!exists) {
                  setCustomTags((prev) => [tag, ...prev]);
                }
                setCustomTagInput("");
              }}
            >
              <AddCircleOutlineIcon
                fontSize="small"
                sx={{ color: "#DDD1A0", opacity: customTagInput ? 1 : 0.5 }}
              />
            </IconButton>
          </InputAdornment>
        ),
      }}
      onChange={(e) => setCustomTagInput(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && customTagInput.trim()) {
          e.preventDefault();
          const tag = customTagInput.trim();
          const exists =
            customTags.includes(tag) ||
            classificationResults?.some((r) => r.name === tag);
          if (!exists) {
            setCustomTags((prev) => [tag, ...prev]);
          }
          setCustomTagInput("");
        }
      }}
      sx={{
        "& input": {
          color: "#DDD1A0",
          fontFamily: "DM Mono, monospace",
          "::placeholder": { color: "#DDD1A0", opacity: 0.5 },
        },
      }}
    />
  );

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: isMobile ? "column" : "row",
        height: "100vh",
        overflow: "hidden",
        position: "relative",
        px: isMobile ? 0 : 4,
      }}
    >
      <Box
        sx={{
          flex: 1,
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          height: "88.5vh",
          pl: 4,
        }}
      >
        <Box
          sx={{
            mb: -2.2,
            ml: -3,
            display: "flex",
            gap: 0.5,
            alignItems: "center",
          }}
        >
          <Button
            key="default"
            variant="contained"
            size="small"
            sx={{
              backgroundColor: BOOKMARK_COLORS[0],
              color: "#000",
              textTransform: "uppercase",
            }}
          >
            Original
          </Button>

          {bookmarks.map((lang, idx) => (
            <Button
              key={lang}
              variant="contained"
              size="small"
              sx={{
                backgroundColor:
                  BOOKMARK_COLORS[(idx + 1) % BOOKMARK_COLORS.length],
                color: "#000",
                textTransform: "uppercase",
              }}
            >
              {lang}
            </Button>
          ))}

          <Tooltip title="Add translation">
            <IconButton
              onClick={openBookmarkMenu}
              size="small"
              sx={{ color: "#DDD1A0" }}
            >
              <AddIcon />
            </IconButton>
          </Tooltip>
        </Box>

        <Box sx={{ flexGrow: 1, position: "relative", mt: 2 }}>
          <TextField
            multiline
            fullWidth
            placeholder="Paste text here or upload file"
            value={text}
            onChange={(e) => setText(e.target.value)}
            sx={{
              height: "100%",
              "& .MuiOutlinedInput-root": {
                color: "#DDD1A0",
                height: "100%",
                alignItems: "start",
                "& fieldset": { borderColor: "#A0B8DD" },
                "&:hover fieldset": { borderColor: "#EDE8D4" },
                borderRadius: "10px",
                pr: 5,
                ml: -4.18,
              },
              "& textarea": {
                color: "#DDD1A0",
                fontFamily: "DM Mono, monospace",
              },
            }}
          />
          <Box
            sx={{
              position: "absolute",
              bottom: 12,
              right: 50,
              display: "flex",
              alignItems: "center",
            }}
          >
            <Tooltip title="Upload file">
              <IconButton component="label" sx={{ color: "#DDD1A0" }}>
                <CloudUploadIcon />
                <input type="file" hidden onChange={handleUpload} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Semantic Tagging">
              <IconButton onClick={classify} sx={{ color: "#DDD1A0", ml: 1 }}>
                <LabelIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        <Menu
          anchorEl={bookmarkAnchor}
          open={Boolean(bookmarkAnchor)}
          onClose={closeBookmarkMenu}
        >
          {LANGUAGES.map((lang) => (
            <MenuItem key={lang} onClick={() => handleBookmarkSelect(lang)}>
              {lang}
            </MenuItem>
          ))}
        </Menu>
      </Box>

      <Box
        sx={{
          width: isMobile ? "100%" : "300px",
          boxSizing: "border-box",
          height: isMobile ? "auto" : "85vh",
          display: "flex",
          flexDirection: "column",
          mt: isMobile ? 2 : 4,
          p: isMobile ? 2 : 0,
        }}
      >
        {!isMobile && (
          <Box sx={{ flexGrow: 1, overflow: "auto" }} ref={tagTableRef}>
            {renderTable(
              combinedTags,
              (name) => {
                setClassificationResults(
                  classificationResults?.filter((r) => r.name !== name) || null
                );
                setCustomTags((prev) => prev.filter((t) => t !== name));
              },
              tagInputField
            )}
          </Box>
        )}

        {isMobile && (
          <>
            <Typography variant="h6" sx={{ mb: 1, color: "#A0B8DD" }}>
              Semantic Tags
            </Typography>
            <Box sx={{ height: "auto", overflow: "auto" }} ref={tagTableRef}>
              {renderTable(
                combinedTags,
                (name) => {
                  setClassificationResults(
                    classificationResults?.filter((r) => r.name !== name) ||
                      null
                  );
                  setCustomTags((prev) => prev.filter((t) => t !== name));
                },
                tagInputField
              )}
            </Box>
          </>
        )}
      </Box>
    </Box>
  );
};

export default WorkspacePage;
