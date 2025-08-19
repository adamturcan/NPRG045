// src/pages/AccountPage.tsx
import React from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Avatar,
  Divider,
  Stack,
} from "@mui/material";
import WorkspacesIcon from "@mui/icons-material/Workspaces";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import type { Workspace } from "../types/Workspace";

interface Props {
  username: string;
  workspaces: Workspace[];
}

const AccountPage: React.FC<Props> = ({ username, workspaces }) => {
  const lastLogin = new Date().toLocaleString();

  return (
    <Box
      sx={{
        px: 8,
        py: 3,
        width: "100%",
        height: "100%",
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      <Typography
        variant="h5"
        fontWeight={700}
        mb={3}
        sx={{ color: "#21426C", textTransform: "uppercase", letterSpacing: 1 }}
      >
        Manage Account
      </Typography>

      <Card
        sx={{
          borderRadius: "16px",
          border: "1px solid #BFD0E8",
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.55) 100%)",
          backdropFilter: "blur(6px)",
          boxShadow:
            "0 1px 0 rgba(12, 24, 38, 0.04), 0 6px 16px rgba(12, 24, 38, 0.06)",
          maxWidth: 720,
        }}
      >
        <CardContent>
          {/* Header */}
          <Box display="flex" alignItems="center" mb={2}>
            <Avatar sx={{ bgcolor: "#DDA0AF", width: 64, height: 64, mr: 2 }}>
              <AccountCircleIcon sx={{ fontSize: 40 }} />
            </Avatar>
            <Box>
              <Typography variant="h6" sx={{ color: "#21426C" }}>
                {username}
              </Typography>
              <Typography variant="body2" sx={{ color: "#456" }}>
                Active User
              </Typography>
            </Box>
          </Box>

          <Divider sx={{ my: 2 }} />

          {/* Stats row (responsive) */}
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={3}
            alignItems="stretch"
          >
            <Box
              sx={{
                flex: 1,
                border: "1px solid #BFD0E8",
                borderRadius: "12px",
                p: 2.5,
                textAlign: "center",
                background:
                  "linear-gradient(180deg, rgba(255,255,255,0.75) 0%, rgba(255,255,255,0.45) 100%)",
              }}
            >
              <WorkspacesIcon
                sx={{ fontSize: 36, color: "#A0B8DD", mb: 0.5 }}
              />
              <Typography
                variant="h6"
                fontWeight={700}
                sx={{ color: "#21426C" }}
              >
                {workspaces.length}
              </Typography>
              <Typography variant="body2" sx={{ color: "#456" }}>
                Workspaces
              </Typography>
            </Box>

            <Box
              sx={{
                flex: 1,
                border: "1px solid #BFD0E8",
                borderRadius: "12px",
                p: 2.5,
                textAlign: "center",
                background:
                  "linear-gradient(180deg, rgba(255,255,255,0.75) 0%, rgba(255,255,255,0.45) 100%)",
              }}
            >
              <Typography
                variant="h6"
                fontWeight={700}
                sx={{ color: "#21426C" }}
              >
                {lastLogin}
              </Typography>
              <Typography variant="body2" sx={{ color: "#456" }}>
                Last Login
              </Typography>
            </Box>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
};

export default AccountPage;
