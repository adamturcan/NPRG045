import { useState } from "react";
import Sidebar from "./components/Sidebar/Sidebar";
import { CssBaseline, ThemeProvider, createTheme, Box } from "@mui/material";
import { Routes, Route } from "react-router-dom";
import AccountPage from "./pages/AccoutPage";
import WorkspacePage from "./pages/WorkspacePage";
import ManageWorkspacesPage from "./pages/ManageWorkspacesPage";
import type { Workspace } from "./types/Workspace";
import { mockWorkspaces } from "./data/mockWorkspaces";

const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#2563eb",
    },
  },
  typography: {
    fontFamily: ["Inter", "sans-serif"].join(","),
  },
});

const App: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [workspaces, setWorkspaces] = useState<Workspace[]>(mockWorkspaces);

  const handleAddWorkspace = () => {
    const newCount = workspaces.filter((w) =>
      w.name.startsWith("New Workspace")
    ).length;
    const newName = `New Workspace #${newCount + 1}`;
    const newId = crypto.randomUUID();

    const newWs: Workspace = {
      id: newId,
      name: newName,
      isTemporary: true,
    };

    setWorkspaces([newWs, ...workspaces]);
    return newWs;
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box display="flex" height="100vh" width="100vw">
        <Sidebar
          open={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
          workspaces={workspaces}
          onAddWorkspace={handleAddWorkspace}
        />
        <Box sx={{ flexGrow: 1, display: "flex", flexDirection: "column" }}>
          <Routes>
            <Route
              path="/"
              element={<WorkspacePage workspaces={workspaces} />}
            />
            <Route
              path="/workspace/new"
              element={<WorkspacePage workspaces={workspaces} />}
            />
            <Route
              path="/workspace/:id"
              element={<WorkspacePage workspaces={workspaces} />}
            />
            <Route path="/manage-account" element={<AccountPage />} />
            <Route
              path="/manage-workspaces"
              element={<ManageWorkspacesPage workspaces={workspaces} />}
            />
          </Routes>
        </Box>
      </Box>
    </ThemeProvider>
  );
};

export default App;
