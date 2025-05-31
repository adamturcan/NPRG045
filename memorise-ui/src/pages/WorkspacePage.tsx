import { useState } from "react";
import {
  Box,
  Button,
  IconButton,
  MenuItem,
  TextField,
  Tooltip,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from "@mui/material";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import { useParams } from "react-router-dom";
import type { Workspace } from "../types/Workspace";

const LANG_2_FLORES: Record<string, string> = {
  Czech: "ces_Latn",
  Danish: "dan_Latn",
  Dutch: "nld_Latn",
  English: "eng_Latn",
  German: "deu_Latn",
  Hebrew: "heb_Hebr",
  Hungarian: "hun_Latn",
  Polish: "pol_Latn",
  Ukrainian: "ukr_Cyrl",
};

interface Props {
  workspaces: Workspace[];
}

const WorkspacePage: React.FC<Props> = ({ workspaces }) => {
  const { id } = useParams();
  const workspace = workspaces.find((w) => w.id === id);

  const [text, setText] = useState("");
  const [activeTab, setActiveTab] = useState<
    "classification" | "ner" | "translation"
  >("classification");
  const [classificationResults, setClassificationResults] = useState<
    any[] | null
  >(null);
  const [nerResults, setNerResults] = useState<any[] | null>(null);
  const [targetLang, setTargetLang] = useState("");
  const [translation, setTranslation] = useState("");

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const content = await file.text();
    setText(content);
  };

  const classify = async () => {
    const res = await fetch("/api/semtag/classify", {
      method: "POST",
      body: JSON.stringify({ text }),
      headers: { "Content-Type": "application/json" },
    });
    const data = await res.json();
    setClassificationResults(data.results || []);
  };

  const ner = async () => {
    const res = await fetch("/api/ner/ner", {
      method: "POST",
      body: JSON.stringify({ text }),
      headers: { "Content-Type": "application/json" },
    });
    const data = await res.json();
    setNerResults(data.results || []);
  };

  const translate = async () => {
    const langResp = await fetch(
      "https://quest.ms.mff.cuni.cz/dimbu/supported_languages"
    );
    const langs = await langResp.json();
    const allLangs = langs.supported_languages;
    const detected = allLangs.find((l: string) =>
      text.toLowerCase().includes(l.slice(0, 3))
    );
    if (!detected || !targetLang) return;

    const res = await fetch("https://quest.ms.mff.cuni.cz/dimbu/translate", {
      method: "POST",
      body: JSON.stringify({
        text,
        src_lang: detected,
        tgt_lang: LANG_2_FLORES[targetLang],
      }),
      headers: { "Content-Type": "application/json" },
    });
    const data = await res.json();
    setTranslation(data.text || "");
  };

  const renderTable = (title: string, color: string, data: any[]) => (
    <Paper
      sx={{
        flex: 1,
        height: "100%",
        overflow: "auto",
        border: `1px solid ${color}`,
        borderRadius: "12px",
        backgroundColor: "rgba(255,255,255,0.02)",
      }}
    >
      <Box sx={{ maxHeight: "100%", overflowY: "auto" }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              {Object.keys(data[0] || {}).map((col) => (
                <TableCell key={col} sx={{ color, fontWeight: 700 }}>
                  {col}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {data.map((row, i) => (
              <TableRow key={i}>
                {Object.values(row).map((val, j) => (
                  <TableCell key={j} sx={{ color, fontSize: "0.9rem" }}>
                    {val as string}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
    </Paper>
  );

  return (
    <Box sx={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      {/* LEFT: Text Editor */}
      <Box
        sx={{
          width: "50%",
          p: 4,
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          height: "90%",
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
          <Box sx={{ position: "absolute", bottom: 12, right: 12 }}>
            <Tooltip title="Upload .txt file">
              <IconButton component="label" sx={{ color: "#DDD1A0" }}>
                <CloudUploadIcon />
                <input type="file" hidden onChange={handleUpload} />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </Box>

      {/* RIGHT: Action Area */}
      <Box
        sx={{
          width: "50%",
          p: 4,
          boxSizing: "border-box",
          height: "90%",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <Box sx={{ display: "flex", gap: 2, mb: 3 }}>
          <Button
            onClick={() => {
              setActiveTab("classification");
              classify();
            }}
            sx={{
              ...tabButtonStyle,
              borderColor: "#A0B8DD",
              color: activeTab === "classification" ? "#0B0B0B" : "#A0B8DD",
              backgroundColor:
                activeTab === "classification" ? "#A0B8DD" : "transparent",
            }}
          >
            Semantic Classification
          </Button>
          <Button
            onClick={() => {
              setActiveTab("ner");
              ner();
            }}
            sx={{
              ...tabButtonStyle,
              borderColor: "#DDD1A0",
              color: activeTab === "ner" ? "#0B0B0B" : "#DDD1A0",
              backgroundColor: activeTab === "ner" ? "#DDD1A0" : "transparent",
            }}
          >
            Named Entity Recognition
          </Button>
          <Button
            onClick={() => {
              setActiveTab("translation");
              translate();
            }}
            sx={{
              ...tabButtonStyle,
              borderColor: "#DDA0AF",
              color: activeTab === "translation" ? "#0B0B0B" : "#DDA0AF",
              backgroundColor:
                activeTab === "translation" ? "#DDA0AF" : "transparent",
            }}
          >
            Translation
          </Button>
        </Box>

        {/* Action Panel */}
        <Box sx={{ flexGrow: 1, overflow: "auto" }}>
          {activeTab === "classification" &&
            classificationResults &&
            renderTable(
              "Semantic Classification",
              "#A0B8DD",
              classificationResults
            )}
          {activeTab === "ner" &&
            nerResults &&
            renderTable("Named Entity Recognition", "#DDD1A0", nerResults)}
          {activeTab === "translation" && (
            <>
              <TextField
                select
                fullWidth
                value={targetLang}
                onChange={(e) => setTargetLang(e.target.value)}
                sx={{
                  mb: 2,
                  "& .MuiOutlinedInput-root": {
                    color: "#DDD1A0",
                    borderRadius: "20px",
                    "& fieldset": { borderColor: "#DDA0AF" },
                    "&:hover fieldset": { borderColor: "#EDE8D4" },
                  },
                  "& .MuiSelect-select": {
                    pt: 1.5,
                    color: "#DDD1A0",
                    fontWeight: 600,
                    textAlign: "center",
                  },
                }}
              >
                {Object.keys(LANG_2_FLORES).map((lang) => (
                  <MenuItem key={lang} value={lang}>
                    {lang}
                  </MenuItem>
                ))}
              </TextField>
              <Paper
                sx={{
                  p: 3,
                  border: "1px solid #DDA0AF",
                  borderRadius: "12px",
                  color: "#DDA0AF",
                  backgroundColor: "transparent",
                }}
              >
                <Typography>{translation || "No translation yet."}</Typography>
              </Paper>
            </>
          )}
        </Box>
      </Box>
    </Box>
  );
};

const tabButtonStyle = {
  textTransform: "uppercase",
  border: "2px solid",
  borderRadius: "999px",
  px: 3,
  py: 1,
  fontWeight: 700,
  fontSize: "0.8rem",
  transition: "all 0.2s ease",
};

export default WorkspacePage;
