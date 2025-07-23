import { useState, useEffect } from "react";
import {
  Box,
  IconButton,
  TextField,
  Tooltip,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  useMediaQuery,
  useTheme,
  Typography,
  Menu,
  MenuItem,
  Button,
} from "@mui/material";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import LabelIcon from "@mui/icons-material/Label";
import AddIcon from "@mui/icons-material/Add";
//import { useParams } from "react-router-dom";
import type { Workspace } from "../types/Workspace";

// Sample language codes for bookmarking (stub)
const LANGUAGES = ["eng", "ces", "dan", "nld"];
const BOOKMARK_COLORS = ["#FF8A80", "#80D8FF", "#CCFF90", "#FFD180"];

// New, distinct colors for the vertical side‐bookmarks
const VERTICAL_BOOKMARK_COLORS = ["#FF5252", "#536DFE"];

interface Props {
  workspaces: Workspace[];
}

const WorkspacePage: React.FC<Props> = () => {
  //const { id } = useParams();
  //const workspace = workspaces.find((w) => w.id === id);
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
  };

  // Bookmark menu handlers
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

  // Render only the 'name' field from classification results
  const renderTable = (color: string, data: any[]) => (
    <Paper
      sx={{
        flex: 1,
        height: "100%",
        overflow: "auto",
        border: `1px solid ${color}`,
        borderRadius: "12px",
        backgroundColor: "rgba(255,255,255,0.02)",
        p: 2,
      }}
    >
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ color, fontWeight: 700 }}>name</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {data.map((row, i) => (
            <TableRow key={i}>
              <TableCell sx={{ color, fontSize: "0.9rem" }}>
                {row.name}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Paper>
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
      {/* ── Vertical side‐bookmarks (desktop only) ────────────────────────────── */}
      {!isMobile && (
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            mt: 10, // aligns to top padding of editor
            mr: 0, // flush against editor
            gap: 1, // larger gap so they don't overlap
          }}
        >
          {["Non-segmentated", "Segmentated"].map((label, idx) => (
            <Button
              key={label}
              variant="contained"
              size="small"
              sx={{
                backgroundColor:
                  VERTICAL_BOOKMARK_COLORS[
                    idx % VERTICAL_BOOKMARK_COLORS.length
                  ],
                color: "#000",
                textTransform: "uppercase",
                width: "110px",
                height: "35px",
                lineHeight: "14px",
                transformOrigin: "center",
              }}
            >
              {label}
            </Button>
          ))}
        </Box>
      )}

      {/* ── Left Column: Dynamic Translation Bookmarks & Editor ───────────────── */}
      <Box
        sx={{
          flex: 1,
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          height: "80vh",
          p: 4,
        }}
      >
        {/* Dynamic translation bookmarks with default “Original” */}
        <Box
          sx={{
            mb: -0.3,
            ml: -3,
            display: "flex",
            gap: 0.5,
            alignItems: "center",
          }}
        >
          {/* Default language bookmark */}
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

          {/* User‐added language bookmarks */}
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

          {/* “+” to add more */}
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

        {/* Text editor */}
        <Box sx={{ flexGrow: 1, position: "relative" }}>
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
            <Tooltip title="Upload .txt file">
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

        {/* Bookmark language selection menu */}
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

      {/* ── Right: Semantic Tags panel ────────────────────────────────────────── */}
      {!isMobile && (
        <Box
          sx={{
            width: "400px",
            p: 4,
            boxSizing: "border-box",
            height: "80vh",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <Typography variant="h6" sx={{ mb: 2, color: "#A0B8DD" }}>
            Semantic Tags
          </Typography>
          <Box sx={{ flexGrow: 1, overflow: "auto" }}>
            {classificationResults && classificationResults.length > 0 ? (
              renderTable("#A0B8DD", classificationResults)
            ) : (
              <Paper
                sx={{
                  height: "100%",
                  border: "1px dashed #A0B8DD",
                  borderRadius: "12px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "rgba(255,255,255,0.02)",
                  p: 2,
                }}
              >
                <Typography sx={{ color: "#A0B8DD" }}>
                  No semantic tags yet. Click the tag icon above to generate.
                </Typography>
              </Paper>
            )}
          </Box>
        </Box>
      )}

      {/* ── Mobile: semantic tags below editor, full width ───────────────────── */}
      {isMobile && (
        <Box sx={{ p: 2 }}>
          <Typography variant="h6" sx={{ mb: 1, color: "#A0B8DD" }}>
            Semantic Tags
          </Typography>
          <Box sx={{ height: "200px", overflow: "auto" }}>
            {classificationResults && classificationResults.length > 0 ? (
              renderTable("#A0B8DD", classificationResults)
            ) : (
              <Paper
                sx={{
                  height: "100%",
                  border: "1px dashed #A0B8DD",
                  borderRadius: "12px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "rgba(255,255,255,0.02)",
                  p: 2,
                }}
              >
                <Typography sx={{ color: "#A0B8DD" }}>
                  No semantic tags yet. Click the tag icon in the editor.
                </Typography>
              </Paper>
            )}
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default WorkspacePage;
