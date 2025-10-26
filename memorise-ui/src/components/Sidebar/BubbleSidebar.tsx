// src/components/Sidebar/BubbleSidebar.tsx
/**
 * BubbleSidebar - Floating navigation sidebar with expandable bubble buttons
 * 
 * This component provides quick access to:
 * - Workspaces (shows first 3)
 * - Create new workspace
 * - Account management
 * - Logout
 * 
 * FEATURES:
 * 
 * 1. Expand/Collapse:
 *    - Desktop: Bubbles expand to show labels (circle → pill shape)
 *    - Mobile: Bubbles show/hide entirely
 *    - Smooth transitions with animation
 * 
 * 2. Visual Design:
 *    - Floating circular/pill buttons ("bubbles")
 *    - Gold accent color for primary actions
 *    - Pink accent for account/logout
 *    - Selected state highlights active workspace
 *    - Shadows and hover effects
 * 
 * 3. Responsive Behavior:
 *    - Desktop: Always visible, can expand/collapse
 *    - Mobile: Hidden by default, toggle to show
 *    - Different state management for each mode
 * 
 * 4. Layout:
 *    - Fixed position on left side of screen
 *    - Top section: Workspaces + Add button
 *    - Bottom section: Account + Logout
 *    - Space-between to separate sections
 * 
 * 5. Accessibility:
 *    - Tooltips when collapsed (show labels on hover)
 *    - ARIA labels for all actions
 *    - Keyboard focus indicators
 */
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
  /** List of all workspaces (sidebar shows first 3) */
  workspaces: Workspace[];
  
  /** Desktop: expanded state, Mobile: not used */
  open: boolean;
  
  /** Desktop: toggle expand/collapse */
  onToggle: () => void;
  
  /** Create new workspace and return it */
  onAddWorkspace: () => Workspace;
  
  /** Handle logout action */
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
  
  /**
   * Mobile-specific state: whether sidebar is shown
   * Desktop doesn't use this (always shown)
   */
  const [mobileOpen, setMobileOpen] = useState(false);

  /**
   * ============================================================================
   * COMPUTED STATE
   * ============================================================================
   */

  /** Check if a route path matches current location (for selected state) */
  const isSelected = (path: string) => location.pathname === path;
  
  /** Bubbles should expand to show labels (desktop only) */
  const isExpanded = !isMobile && open;
  
  /** Whether to show bubbles at all (mobile: toggle, desktop: always) */
  const showBubbles = isMobile ? mobileOpen : true;
  
  /** Generic "is open" state (mobile: mobileOpen, desktop: open) */
  const isOpen = isMobile ? mobileOpen : open;

  /**
   * ============================================================================
   * BUBBLE COMPONENT: Reusable button with expand/collapse
   * ============================================================================
   * 
   * Each bubble is a FAB (Floating Action Button) that:
   * - Shows as circle when collapsed
   * - Expands to pill shape when expanded (shows label)
   * - Highlights when selected (inverts colors)
   * - Shows tooltip when collapsed
   * - Animates smoothly between states
   */
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
    color?: string; // accent color (gold for primary, pink for account)
    ariaLabel?: string;
  }) => {
    // Color scheme
    const accent = color || "#DDD1A0"; // Default: gold
    const bg = selected ? accent : "#1F2C24"; // Selected: accent, Normal: dark
    const fg = selected ? "#1F2C24" : accent; // Selected: dark text, Normal: accent text

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
          // Morphs between circle (56x56) and pill (200x56)
          width: isExpanded ? 200 : 56,
          height: 56,
          minHeight: 56,
          borderRadius: isExpanded ? "28px" : "50%", // Pill vs circle
          transition: "all 0.25s ease", // Smooth morph animation
          justifyContent: isExpanded ? "space-between" : "center",
          px: isExpanded ? 2 : 0,
          pl: isExpanded ? 2.5 : 0,
          outline: "none",
          // Keyboard focus indicator
          "&:focus-visible": {
            boxShadow:
              "0 0 0 3px rgba(160,184,221,0.65), 0 4px 10px rgba(12,24,38,0.18)",
          },
        }}
      >
        {/* Label (only shown when expanded) */}
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
        
        {/* Icon (always shown) */}
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

    // Show tooltip only when collapsed (label not visible)
    return isExpanded ? (
      content
    ) : (
      <Tooltip title={label} placement="right">
        <span>{content}</span>
      </Tooltip>
    );
  };

  /**
   * ============================================================================
   * RENDER: Fixed sidebar with top and bottom sections
   * ============================================================================
   * 
   * Layout:
   * - Fixed position on left side
   * - Top section: Toggle + Workspaces + Add button
   * - Bottom section: Account + Logout
   * - justifyContent: space-between separates top/bottom
   */
  return (
    <Box
      sx={{
        position: "fixed",
        top: 80,                    // Below header
        left: 16,                   // Slight inset from edge
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between", // Separate top/bottom sections
        height: "85vh",             // Almost full height
        zIndex: 1300,               // Above most content, below modals
        overflowY: "auto",          // Scroll if too many workspaces
      }}
    >
      {/* ========================================================================
          TOP SECTION: Toggle + Workspaces + Add
          ======================================================================== */}
      <Box display="flex" flexDirection="column" gap={2}>
        {/* Toggle expand/collapse button */}
        <Bubble
          label={isOpen ? "Collapse" : "Expand"}
          icon={isOpen ? <ChevronLeftIcon /> : <ChevronRightIcon />}
          onClick={() => (isMobile ? setMobileOpen(!mobileOpen) : onToggle())}
          color="#DDD1A0"
          ariaLabel="Toggle sidebar"
        />

        {/* Show workspace bubbles only when open (mobile) or always (desktop) */}
        {showBubbles && (
          <>
            {/* First 3 workspaces with zoom-in animation */}
            {workspaces.slice(0, 3).map((ws) => (
              <Zoom in key={ws.id} unmountOnExit>
                <Box>
                  <Bubble
                    label={ws.name}
                    icon={<FolderOpenIcon />}
                    onClick={() => navigate(`/workspace/${ws.id}`)}
                    selected={isSelected(`/workspace/${ws.id}`)}
                    color="#DDD1A0" // Gold accent
                    ariaLabel={`Open workspace ${ws.name}`}
                  />
                </Box>
              </Zoom>
            ))}

            {/* Add new workspace button */}
            <Bubble
              label="New Workspace"
              icon={<AddIcon />}
              onClick={() => {
                const newWs = onAddWorkspace();
                navigate(`/workspace/${newWs.id}`);
              }}
              selected={isSelected("/workspace/new")}
              color="#DDD1A0" // Gold accent
              ariaLabel="Create new workspace"
            />
          </>
        )}
      </Box>

      {/* ========================================================================
          BOTTOM SECTION: Account + Logout
          ======================================================================== */}
      {showBubbles && (
        <Box display="flex" flexDirection="column" gap={2}>
          {/* Account management */}
          <Bubble
            label="Manage Account"
            icon={<AccountCircleIcon />}
            onClick={() => navigate("/manage-account")}
            selected={isSelected("/manage-account")}
            color="#DDA0AF" // Pink accent (different from primary actions)
            ariaLabel="Manage account"
          />
          
          {/* Logout */}
          <Bubble
            label="Logout"
            icon={<LogoutIcon />}
            onClick={onLogout}
            color="#DDA0AF" // Pink accent
            ariaLabel="Logout"
          />
        </Box>
      )}
    </Box>
  );
};

export default BubbleSidebar;
