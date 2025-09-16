// src/components/Sidebar/BubbleSidebar.tsx
import React, { useState } from "react";
import type { Workspace } from "../../types/Workspace";
import {
  Box,
  Fab,
  Tooltip,
  Typography,
  Zoom,
  useTheme,
  useMediaQuery,
} from "@mui/material";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import AddIcon from "@mui/icons-material/Add";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import LogoutIcon from "@mui/icons-material/Logout";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { useNavigate, useLocation } from "react-router-dom";

interface Props {
  workspaces: Workspace[];
  open: boolean;
  onToggle: () => void;
  onAddWorkspace: () => Workspace;
  onLogout: () => void;
}

const BubbleSidebar: React.FC<Props> = ({
  workspaces,
  open,
  onToggle,
  onAddWorkspace,
  onLogout,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [mobileOpen, setMobileOpen] = useState(false);

  const isSelected = (path: string) => location.pathname === path;
  const isExpanded = !isMobile && open;
  const showBubbles = isMobile ? mobileOpen : true;
  const isOpen = isMobile ? mobileOpen : open;

  /** Reusable bubble */
  const Bubble = ({
    label,
    icon,
    onClick,
    selected,
    color,
    ariaLabel,
  }: {
    label: string;
    icon: React.ReactNode;
    onClick: () => void;
    selected?: boolean;
    color?: string; // accent
    ariaLabel?: string;
  }) => {
    const accent = color || "#DDD1A0"; // default gold
    const bg = selected ? accent : "#1F2C24";
    const fg = selected ? "#1F2C24" : accent;

    const content = (
      <Fab
        aria-label={ariaLabel || label}
        onClick={onClick}
        disableRipple
        sx={{
          bgcolor: bg,
          color: fg,
          "&:hover": { bgcolor: accent, color: "#1F2C24" },
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow:
            "0 1px 0 rgba(12,24,38,0.04), 0 4px 10px rgba(12,24,38,0.18)",
          display: "flex",
          alignItems: "center",
          gap: 0,
          width: isExpanded ? 200 : 56, // cleaner: circle when collapsed
          height: 56,
          minHeight: 56,
          borderRadius: isExpanded ? "28px" : "50%",
          transition: "all 0.25s ease",
          justifyContent: isExpanded ? "space-between" : "center",
          px: isExpanded ? 2 : 0,
          pl: isExpanded ? 2.5 : 0,
          outline: "none",
          "&:focus-visible": {
            boxShadow:
              "0 0 0 3px rgba(160,184,221,0.65), 0 4px 10px rgba(12,24,38,0.18)",
          },
        }}
      >
        {isExpanded && (
          <Typography
            variant="body2"
            fontWeight={700}
            sx={{
              textTransform: "uppercase",
              letterSpacing: 0.4,
              fontSize: "0.78rem",
              lineHeight: 1.1,
              whiteSpace: "nowrap",
              color: "inherit",
            }}
          >
            {label}
          </Typography>
        )}
        <Box
          component="span"
          sx={{
            display: "inline-flex",
            alignItems: "center",
            ml: isExpanded ? 1 : 0,
            "& svg": { fontSize: "1.45rem" },
          }}
        >
          {icon}
        </Box>
      </Fab>
    );

    // Show tooltip only when collapsed; on expanded the label is visible
    return isExpanded ? (
      content
    ) : (
      <Tooltip title={label} placement="right">
        <span>{content}</span>
      </Tooltip>
    );
  };

  return (
    <Box
      sx={{
        position: "fixed",
        top: 80,
        left: 16, // ✅ push it slightly inward from the edge
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        height: "85vh",
        zIndex: 1300,
        overflowY: "auto",
      }}
    >
      <Box display="flex" flexDirection="column" gap={2}>
        <Bubble
          label={isOpen ? "Collapse" : "Expand"}
          icon={isOpen ? <ChevronLeftIcon /> : <ChevronRightIcon />}
          onClick={() => (isMobile ? setMobileOpen(!mobileOpen) : onToggle())}
          color="#DDD1A0"
          ariaLabel="Toggle sidebar"
        />

        {showBubbles && (
          <>
            {workspaces.slice(0, 3).map((ws) => (
              <Zoom in key={ws.id} unmountOnExit>
                <Box>
                  <Bubble
                    label={ws.name}
                    icon={<FolderOpenIcon />}
                    onClick={() => navigate(`/workspace/${ws.id}`)}
                    selected={isSelected(`/workspace/${ws.id}`)}
                    color="#DDD1A0"
                    ariaLabel={`Open workspace ${ws.name}`}
                  />
                </Box>
              </Zoom>
            ))}

            <Bubble
              label="New Workspace"
              icon={<AddIcon />}
              onClick={() => {
                const newWs = onAddWorkspace();
                navigate(`/workspace/${newWs.id}`);
              }}
              selected={isSelected("/workspace/new")}
              color="#DDD1A0"
              ariaLabel="Create new workspace"
            />
          </>
        )}
      </Box>

      {showBubbles && (
        <Box display="flex" flexDirection="column" gap={2}>
          <Bubble
            label="Manage Account"
            icon={<AccountCircleIcon />}
            onClick={() => navigate("/manage-account")}
            selected={isSelected("/manage-account")}
            color="#DDA0AF"
            ariaLabel="Manage account"
          />
          <Bubble
            label="Logout"
            icon={<LogoutIcon />}
            onClick={onLogout}
            color="#DDA0AF"
            ariaLabel="Logout"
          />
        </Box>
      )}
    </Box>
  );
};

export default BubbleSidebar;
