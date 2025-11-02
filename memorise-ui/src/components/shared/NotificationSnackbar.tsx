/**
 * NotificationSnackbar - Reusable snackbar component for showing notifications
 * 
 * Displays a notification message at the bottom center of the screen.
 * Automatically hides after a specified duration.
 * 
 * @param message - The message to display, or null to hide
 * @param onClose - Callback when the snackbar is closed
 */

import React from "react";
import { Snackbar, Alert } from "@mui/material";

// Constants for snackbar configuration
const ANCHOR_ORIGIN = { vertical: "bottom" as const, horizontal: "center" as const };
const AUTO_HIDE_DURATION = 2200;
const ALERT_BG_COLOR = "#21426C";

interface NotificationSnackbarProps {
  message: string | null;
  onClose: () => void;
}

export const NotificationSnackbar: React.FC<NotificationSnackbarProps> = ({
  message,
  onClose,
}) => {
  return (
    <Snackbar
      open={!!message}
      autoHideDuration={AUTO_HIDE_DURATION}
      onClose={onClose}
      anchorOrigin={ANCHOR_ORIGIN}
    >
      <Alert
        onClose={onClose}
        severity="info"
        variant="filled"
        sx={{ bgcolor: ALERT_BG_COLOR }}
      >
        {message}
      </Alert>
    </Snackbar>
  );
};

