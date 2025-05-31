import React from "react";
import type { Workspace } from "../../types/Workspace";
import { Box, Fab, Tooltip, Typography, Zoom } from "@mui/material";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import AddIcon from "@mui/icons-material/Add";
import ManageAccountsIcon from "@mui/icons-material/ManageAccounts";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import LogoutIcon from "@mui/icons-material/Logout";
import MenuIcon from "@mui/icons-material/Menu";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import { useNavigate, useLocation } from "react-router-dom";

interface Props {
  workspaces: Workspace[];
  open: boolean;
  onToggle: () => void;
  onAddWorkspace: () => Workspace;
}

const BubbleSidebar: React.FC<Props> = ({
  workspaces,
  open,
  onToggle,
  onAddWorkspace,
}) => {
  const navigate = useNavigate();
  const location = useLocation();

  const isSelected = (path: string) => location.pathname === path;

  const Bubble = ({
    label,
    icon,
    onClick,
    selected,
    color,
  }: {
    label: string;
    icon: React.ReactNode;
    onClick: () => void;
    selected?: boolean;
    color?: string;
  }) => (
    <Fab
      onClick={onClick}
      sx={{
        bgcolor: selected ? color || "#DDD1A0" : "#0B0B0B",
        color: selected ? "#0B0B0B" : color || "#DDD1A0",
        "&:hover": {
          bgcolor: color || "#DDD1A0",
          color: "#0B0B0B",
        },
        justifyContent: open ? "flex-start" : "center",
        px: open ? 2 : 0,
        width: open ? "180px" : "56px",
        height: "48px",
        borderRadius: "24px",
        boxShadow: "0 0 4px rgba(255,255,255,0.2)",
        display: "flex",
        alignItems: "center",
        gap: 1,
        transition: "all 0.3s ease",
      }}
    >
      {icon}
      {open && (
        <Typography
          variant="body2"
          fontWeight={600}
          sx={{ textTransform: "uppercase", fontSize: "0.75rem" }}
        >
          {label}
        </Typography>
      )}
    </Fab>
  );

  return (
    <Box
      sx={{
        position: "fixed",
        top: 80,
        left: 20,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        height: "calc(100vh - 100px)",
        zIndex: 1300,
      }}
    >
      <Box display="flex" flexDirection="column" gap={2}>
        <Bubble
          label={open ? "Collapse" : "Expand"}
          icon={open ? <ChevronLeftIcon /> : <MenuIcon />}
          onClick={onToggle}
          color="#DDD1A0"
        />

        {workspaces.slice(0, 3).map((ws) => (
          <Zoom in key={ws.id} unmountOnExit>
            <Box>
              <Tooltip
                title={ws.name}
                placement="right"
                disableHoverListener={open}
              >
                <span>
                  <Bubble
                    label={ws.name}
                    icon={<FolderOpenIcon />}
                    onClick={() => navigate(`/workspace/${ws.id}`)}
                    selected={isSelected(`/workspace/${ws.id}`)}
                    color="#DDD1A0"
                  />
                </span>
              </Tooltip>
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
        />

        <Bubble
          label="Manage Workspaces"
          icon={<ManageAccountsIcon />}
          onClick={() => navigate("/manage-workspaces")}
          selected={isSelected("/manage-workspaces")}
          color="#A0B8DD" // blue-100
        />
      </Box>

      <Box display="flex" flexDirection="column" gap={2} pb={2}>
        <Bubble
          label="Manage Account"
          icon={<AccountCircleIcon />}
          onClick={() => navigate("/manage-account")}
          selected={isSelected("/manage-account")}
          color="#DDA0AF" // pink-100
        />
        <Bubble
          label="Logout"
          icon={<LogoutIcon />}
          onClick={() => alert("Logging out...")}
          color="#DDA0AF" // pink-100
        />
      </Box>
    </Box>
  );
};

export default BubbleSidebar;
