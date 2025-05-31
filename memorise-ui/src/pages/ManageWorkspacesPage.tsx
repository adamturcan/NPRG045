import React from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Paper,
  Button,
} from "@mui/material";
import type { Workspace } from "../types/Workspace";

interface Props {
  workspaces: Workspace[];
}

const ManageWorkspacesPage: React.FC<Props> = ({ workspaces }) => {
  const navigate = useNavigate();

  const handleOpen = (id: string) => {
    navigate(`/workspace/${id}`);
  };

  return (
    <Box
      sx={{
        px: 4,
        py: 3,
        width: "100%",
        height: "100%",
        color: "#DDD1A0",
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      <Typography
        variant="h5"
        fontWeight={700}
        mb={3}
        sx={{ color: "#DDD1A0", textTransform: "uppercase", letterSpacing: 1 }}
      >
        Manage Workspaces
      </Typography>

      <TableContainer
        component={Paper}
        sx={{
          backgroundColor: "rgba(11, 11, 11, 0.6)",
          backdropFilter: "blur(4px)",
          border: "1px solid #DDD1A0",
        }}
      >
        <Table>
          <TableHead>
            <TableRow>
              <TableCell sx={{ color: "#DDD1A0", fontWeight: 600 }}>
                Name
              </TableCell>
              <TableCell sx={{ color: "#DDD1A0", fontWeight: 600 }}>
                ID
              </TableCell>
              <TableCell
                align="right"
                sx={{ color: "#DDD1A0", fontWeight: 600 }}
              >
                Action
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {workspaces.map((ws: Workspace) => (
              <TableRow
                key={ws.id}
                hover
                sx={{
                  "&:hover": {
                    backgroundColor: "rgba(221, 209, 160, 0.08)",
                  },
                }}
              >
                <TableCell sx={{ color: "#DDD1A0" }}>
                  {ws.isTemporary ? (
                    <em style={{ fontStyle: "italic" }}>{ws.name}</em>
                  ) : (
                    ws.name
                  )}
                </TableCell>
                <TableCell sx={{ color: "#DDD1A0" }}>{ws.id}</TableCell>
                <TableCell align="right">
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => handleOpen(ws.id)}
                    sx={{
                      color: "#DDD1A0",
                      borderColor: "#DDD1A0",
                      textTransform: "uppercase",
                      fontWeight: 500,
                      "&:hover": {
                        backgroundColor: "#DDD1A0",
                        color: "#0B0B0B",
                        borderColor: "#DDD1A0",
                      },
                    }}
                  >
                    Open
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default ManageWorkspacesPage;
