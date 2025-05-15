import React from "react";
import type { Workspace } from "../../types/Workspace";
import {
  Box,
  Button,
  Divider,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Tooltip,
} from "@mui/material";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import AddIcon from "@mui/icons-material/Add";
import ManageAccountsIcon from "@mui/icons-material/ManageAccounts";
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
}

const Sidebar: React.FC<Props> = ({
  workspaces,
  open,
  onToggle,
  onAddWorkspace,
}) => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleNewWorkspace = () => {
    const newWs = onAddWorkspace();
    navigate(`/workspace/${newWs.id}`);
  };

  return (
    <Box
      sx={{
        width: open ? 270 : 64,
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        bgcolor: "grey.100",
        p: 1,
        transition: "width 0.3s ease",
        overflow: "hidden",
      }}
    >
      <Box>
        <Box
          display="flex"
          justifyContent={open ? "space-between" : "center"}
          alignItems="center"
          mb={2}
          px={1}
        >
          <img
            src={import.meta.env.BASE_URL + "memorise-logo.png"}
            alt="Memorise"
            style={{
              height: "40px",
              objectFit: "contain",
              display: open ? "block" : "none",
            }}
          />
          <Button onClick={onToggle} size="small" sx={{ minWidth: 0 }}>
            {open ? <ChevronLeftIcon /> : <ChevronRightIcon />}
          </Button>
        </Box>

        <List disablePadding>
          {open && (
            <ListItem disablePadding>
              <ListItemText
                primary="Recent Workspaces"
                primaryTypographyProps={{
                  fontWeight: 500,
                  fontSize: 14,
                  color: "text.secondary",
                  sx: { pl: 1.5, pb: 1 },
                }}
              />
            </ListItem>
          )}
          {workspaces.slice(0, 3).map((ws) => (
            <Tooltip
              key={ws.id}
              title={ws.name}
              placement="right"
              disableHoverListener={open}
            >
              <ListItem disablePadding>
                <ListItemButton
                  onClick={() => navigate(`/workspace/${ws.id}`)}
                  selected={location.pathname === `/workspace/${ws.id}`}
                >
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <FolderOpenIcon fontSize="small" />
                  </ListItemIcon>
                  {open && <ListItemText primary={ws.name} />}
                </ListItemButton>
              </ListItem>
            </Tooltip>
          ))}
          <Tooltip
            title="New Workspace"
            placement="right"
            disableHoverListener={open}
          >
            <ListItem disablePadding>
              <ListItemButton onClick={handleNewWorkspace}>
                <ListItemIcon sx={{ minWidth: 36 }}>
                  <AddIcon fontSize="small" />
                </ListItemIcon>
                {open && (
                  <ListItemText
                    primary="New Workspace"
                    primaryTypographyProps={{
                      fontWeight: 500,
                      color: "primary.main",
                    }}
                  />
                )}
              </ListItemButton>
            </ListItem>
          </Tooltip>
          <Tooltip
            title="Manage Workspaces"
            placement="right"
            disableHoverListener={open}
          >
            <ListItem disablePadding>
              <ListItemButton
                onClick={() => navigate("/manage-workspaces")}
                selected={location.pathname === "/manage-workspaces"}
              >
                <ListItemIcon sx={{ minWidth: 36 }}>
                  <ManageAccountsIcon fontSize="small" />
                </ListItemIcon>
                {open && <ListItemText primary="Manage Workspaces" />}
              </ListItemButton>
            </ListItem>
          </Tooltip>
        </List>
      </Box>

      <Box>
        <Divider sx={{ mb: 1 }} />
        <List disablePadding>
          <Tooltip
            title="Manage Account"
            placement="right"
            disableHoverListener={open}
          >
            <ListItem disablePadding>
              <ListItemButton
                onClick={() => navigate("/manage-account")}
                selected={location.pathname === "/manage-account"}
              >
                <ListItemIcon sx={{ minWidth: 36 }}>
                  <AccountCircleIcon fontSize="small" />
                </ListItemIcon>
                {open && <ListItemText primary="Manage Account" />}
              </ListItemButton>
            </ListItem>
          </Tooltip>
          <Tooltip title="Logout" placement="right" disableHoverListener={open}>
            <ListItem disablePadding>
              <ListItemButton onClick={() => alert("Logging out...")}>
                <ListItemIcon sx={{ minWidth: 36 }}>
                  <LogoutIcon fontSize="small" />
                </ListItemIcon>
                {open && <ListItemText primary="Logout" />}
              </ListItemButton>
            </ListItem>
          </Tooltip>
        </List>
      </Box>
    </Box>
  );
};

export default Sidebar;
