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
    <Box sx={{ p: 4 }}>
      <Typography variant="h5" fontWeight={600} mb={3}>
        Manage Workspaces
      </Typography>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>ID</TableCell>
              <TableCell align="right">Open</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {workspaces.map((ws: Workspace) => (
              <TableRow key={ws.id} hover>
                <TableCell>
                  {ws.isTemporary ? <em>{ws.name}</em> : ws.name}
                </TableCell>
                <TableCell>{ws.id}</TableCell>
                <TableCell align="right">
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => handleOpen(ws.id)}
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
