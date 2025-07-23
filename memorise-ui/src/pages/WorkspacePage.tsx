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
} from "@mui/material";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import LabelIcon from "@mui/icons-material/Label";
import { useParams } from "react-router-dom";
import type { Workspace } from "../types/Workspace";

interface Props {
  workspaces: Workspace[];
}

const WorkspacePage: React.FC<Props> = ({ workspaces }) => {
  const { id } = useParams();
  const workspace = workspaces.find((w) => w.id === id);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [text, setText] = useState("");
  const [classificationResults, setClassificationResults] = useState<
    any[] | null
  >(null);

  useEffect(() => {
    const c = () => classify();
    const e = () => {};

    document.addEventListener("trigger:classify", c);
    document.addEventListener("trigger:editor", e);

    return () => {
      document.removeEventListener("trigger:classify", c);
      document.removeEventListener("trigger:editor", e);
    };
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
      {!isMobile ? (
        // Desktop layout
        <>
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
                    borderRadius: "20px",
                    pr: 5,
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
                  right: 12,
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
                  <IconButton
                    onClick={classify}
                    sx={{ color: "#DDD1A0", ml: 1 }}
                  >
                    <LabelIcon />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>
          </Box>

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
        </>
      ) : (
        // Mobile layout
        <Box sx={{ flex: "0 0 90vh", p: 2 }}>
          <TextField
            multiline
            fullWidth
            placeholder="Paste text here or upload file"
            value={text}
            onChange={(e) => setText(e.target.value)}
            sx={{
              height: "90%",
              "& .MuiOutlinedInput-root": {
                color: "#DDD1A0",
                height: "90%",
                alignItems: "start",
                "& fieldset": { borderColor: "#A0B8DD" },
                "&:hover fieldset": { borderColor: "#EDE8D4" },
                borderRadius: "20px",
                pr: 5,
              },
              "& textarea": {
                color: "#DDD1A0",
                fontFamily: "DM Mono, monospace",
              },
            }}
          />
          <Box sx={{ mt: 2, mb: 1 }}>
            <Typography variant="h6" sx={{ color: "#A0B8DD" }}>
              Semantic Tags
            </Typography>
          </Box>
          <Box
            sx={{ width: "400px", flexGrow: 1, overflow: "auto", mx: "auto" }}
          >
            {classificationResults && classificationResults.length > 0 ? (
              renderTable("#A0B8DD", classificationResults)
            ) : (
              <Paper
                sx={{
                  height: "80%",
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
