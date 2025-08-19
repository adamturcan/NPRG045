import React, { useState, useMemo } from "react";
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  InputAdornment,
  IconButton,
} from "@mui/material";
import PersonOutlineRoundedIcon from "@mui/icons-material/PersonOutlineRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";

type Props = {
  /** Called with the trimmed username once the form is valid */
  onLogin: (username: string) => void;
  /** Optional: prefill username (e.g., from localStorage) */
  defaultUsername?: string;
};

const LoginPage: React.FC<Props> = ({ onLogin, defaultUsername = "" }) => {
  const [username, setUsername] = useState(defaultUsername);
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const trimmed = useMemo(() => username.trim(), [username]);
  const hasError = touched && trimmed.length === 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!trimmed) return;
    try {
      setSubmitting(true);
      // simulate tiny latency for UX polish (optional)
      await new Promise((r) => setTimeout(r, 200));
      onLogin(trimmed);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        px: 2,
        backgroundColor: "#E8F2F7",
      }}
    >
      <Paper
        elevation={0}
        sx={{
          width: "100%",
          maxWidth: 520,
          p: 3,
          borderRadius: 3,
          border: "1px solid #BFD0E8",
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.75) 0%, rgba(255,255,255,0.45) 100%)",
          backdropFilter: "blur(6px)",
          boxShadow:
            "0 1px 0 rgba(12, 24, 38, 0.04), 0 6px 16px rgba(12, 24, 38, 0.06)",
        }}
      >
        {/* Logo / Title */}
        <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
          <Box
            sx={{
              backgroundColor: "black",
              color: "white",
              borderRadius: 99,
              px: 2,
              py: 0.75,
              mr: 1.5,
              display: "flex",
              alignItems: "center",
              gap: 1,
            }}
          >
            <img
              src={import.meta.env.BASE_URL + "memorise.png"}
              alt="Memorise"
              style={{ height: 22, objectFit: "contain" }}
            />
          </Box>
          <Typography
            variant="h5"
            sx={{ color: "#21426C", fontWeight: 800, letterSpacing: 0.3 }}
          >
            Welcome back
          </Typography>
        </Box>

        <Typography sx={{ color: "#5A6A7A", mb: 2 }}>
          Sign in with your username to access your workspaces.
        </Typography>

        <Box component="form" onSubmit={handleSubmit} noValidate>
          <TextField
            autoFocus
            fullWidth
            label="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onBlur={() => setTouched(true)}
            error={hasError}
            helperText={hasError ? "Please enter your username." : " "}
            size="medium"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <PersonOutlineRoundedIcon sx={{ color: "#7A91B4" }} />
                </InputAdornment>
              ),
              endAdornment: trimmed ? (
                <InputAdornment position="end">
                  <IconButton
                    edge="end"
                    tabIndex={-1}
                    aria-label="ready"
                    sx={{ color: "#388E3C" }}
                  >
                    <CheckCircleRoundedIcon />
                  </IconButton>
                </InputAdornment>
              ) : undefined,
            }}
            sx={{
              "& .MuiOutlinedInput-root": {
                background:
                  "linear-gradient(180deg, rgba(255,255,255,0.65) 0%, rgba(255,255,255,0.35) 100%)",
                borderRadius: 2,
              },
            }}
          />

          <Button
            type="submit"
            variant="contained"
            disableElevation
            disabled={!trimmed || submitting}
            sx={{
              mt: 1,
              width: "100%",
              py: 1.1,
              fontWeight: 800,
              textTransform: "none",
              backgroundColor: "#21426C",
              "&:hover": { backgroundColor: "#1B3556" },
              boxShadow:
                "0 1px 0 rgba(12, 24, 38, 0.04), 0 6px 16px rgba(12, 24, 38, 0.10)",
            }}
          >
            {submitting ? "Signing in…" : "Sign in"}
          </Button>
        </Box>

        <Typography
          variant="body2"
          sx={{ color: "#7A91B4", textAlign: "center", mt: 2 }}
        >
          This demo uses username-only auth. No password required.
        </Typography>
      </Paper>
    </Box>
  );
};

export default LoginPage;
