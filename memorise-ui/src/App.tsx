import { useState } from "react";
import {
  CssBaseline,
  ThemeProvider,
  createTheme,
  Box,
  responsiveFontSizes,
} from "@mui/material";
import { Routes, Route } from "react-router-dom";

import AccountPage from "./pages/AccoutPage";
import WorkspacePage from "./pages/WorkspacePage";
import ManageWorkspacesPage from "./pages/ManageWorkspacesPage";
import BubbleSidebar from "./components/Sidebar/BubbleSidebar";

import type { Workspace } from "./types/Workspace";
import { mockWorkspaces } from "./data/mockWorkspaces";

// Theme setup
let theme = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#2563eb" },
    background: { default: "#0B0B0B" },
  },
  typography: {
    fontFamily: ["DM Sans", "DM Mono", "Jacques Francois", "sans-serif"].join(
      ","
    ),
    h1: { fontSize: "3.5rem", fontWeight: 700, lineHeight: 1.2 },
    h2: { fontSize: "2.5rem", fontWeight: 700, lineHeight: 1.3 },
    h3: { fontSize: "2rem", fontWeight: 700, lineHeight: 1.3 },
    body1: { fontSize: "1rem", lineHeight: 1.5 },
    body2: { fontSize: "0.875rem", lineHeight: 1.5 },
  },
});
theme = responsiveFontSizes(theme);

const App: React.FC = () => {
  const [workspaces, setWorkspaces] = useState<Workspace[]>(mockWorkspaces);
  const [sidebarOpen, setSidebarOpen] = useState(true);

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
      <Box
        sx={{
          height: "100vh",
          width: "100vw",
          backgroundColor: "#0b0b0b",
          backgroundImage: `url(${import.meta.env.BASE_URL + "grain.png"})`,
          backgroundRepeat: "no-repeat",
          backgroundSize: "cover",
          backgroundPosition: "top left",
          backgroundAttachment: "fixed",
          color: "#DDD1A0",
          position: "relative",
        }}
      >
        {/* Top logo bar */}
        <Box
          sx={{
            height: "60px",
            display: "flex",
            alignItems: "center",
            pl: 4,
            pt: 1,
          }}
        >
          <img
            src={import.meta.env.BASE_URL + "memorise.png"}
            alt="Memorise"
            style={{ height: "20px", objectFit: "contain" }}
          />
        </Box>

        {/* Bubble sidebar */}
        <BubbleSidebar
          open={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
          workspaces={workspaces}
          onAddWorkspace={handleAddWorkspace}
        />

        {/* Page content */}
        <Box
          sx={{
            flexGrow: 1,
            px: 4,
            py: 2,
            ml: sidebarOpen ? 28 : 10,
            transition: "margin-left 0.3s ease",
          }}
        >
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
