import React from "react";
import { Box, Button, Typography, Paper } from "@mui/material";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";

const Home: React.FC = () => {
  return (
    <Box component="main" sx={{ flex: 1, p: 4 }}>
      {/* Page Title */}
      <Typography variant="h5" fontWeight={600} mb={3}>
        NLP Workspace
      </Typography>

      {/* Upload Area */}
      <Paper
        component="section"
        variant="outlined"
        sx={{
          p: 4,
          borderStyle: "dashed",
          borderWidth: 2,
          borderColor: "primary.light",
          textAlign: "center",
          mb: 4,
        }}
      >
        <CloudUploadIcon fontSize="large" color="primary" />
        <Typography mt={1} fontSize={14} color="text.secondary">
          Upload Document
        </Typography>
      </Paper>

      {/* NLP Tool Buttons */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            sm: "1fr 1fr",
          },
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

export default Home;
