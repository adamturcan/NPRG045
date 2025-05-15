import { useParams } from "react-router-dom";
import { Box, Button, Typography, Paper } from "@mui/material";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import type { Workspace } from "../types/Workspace";

interface Props {
  workspaces: Workspace[];
}

const WorkspacePage: React.FC<Props> = ({ workspaces }) => {
  const { id } = useParams();
  const workspace = workspaces.find((w) => w.id === id);
  const title = workspace ? workspace.name : "NEW WORKSPACE";

  return (
    <Box
      component="main"
      sx={{
        width: "100%",
        height: "100vh",
        px: 4,
        py: 3,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        gap: 3,
      }}
    >
      <Typography variant="h5" fontWeight={600}>
        {title}
      </Typography>

      <Paper
        variant="outlined"
        sx={{
          width: "100%",
          borderStyle: "dashed",
          borderWidth: 2,
          borderColor: "primary.light",
          textAlign: "center",
          p: 4,
        }}
      >
        <CloudUploadIcon fontSize="large" color="primary" />
        <Typography mt={1} fontSize={14} color="text.secondary">
          Upload Document
        </Typography>
      </Paper>

      <Box
        sx={{
          width: "100%",
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
          gap: 2,
        }}
      >
        <Button fullWidth variant="outlined">
          Text Segmentation
        </Button>
        <Button fullWidth variant="outlined">
          Named Entity Recognition
        </Button>
        <Button fullWidth variant="outlined">
          Semantic Tagging
        </Button>
        <Button fullWidth variant="outlined">
          Machine Translation
        </Button>
      </Box>
    </Box>
  );
};

export default WorkspacePage;
