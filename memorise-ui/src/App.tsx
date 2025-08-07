import { useState } from "react";

import {
  CssBaseline,
  ThemeProvider,
  createTheme,
  Box,
  responsiveFontSizes,
  IconButton,
  Tooltip,
  useMediaQuery,
} from "@mui/material";
import { Routes, Route } from "react-router-dom";

import AccountPage from "./pages/AccoutPage";
import WorkspacePage from "./pages/WorkspacePage";
import ManageWorkspacesPage from "./pages/ManageWorkspacesPage";
import BubbleSidebar from "./components/Sidebar/BubbleSidebar";

import TagIcon from "@mui/icons-material/Tag";
import PersonSearchIcon from "@mui/icons-material/PersonSearch";
import TranslateIcon from "@mui/icons-material/Translate";
import NotesIcon from "@mui/icons-material/Notes";

import type { Workspace } from "./types/Workspace";
import { mockWorkspaces } from "./data/mockWorkspaces";

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
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

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
          position: "fixed",
          inset: 0,
          minHeight: "100dvh",
          width: "100vw",
          overflow: "clip",
          backgroundColor: "#0b0b0b",
          backgroundImage: {
            xs: "none",
            sm: `url(${import.meta.env.BASE_URL + "grain.png"})`,
          },
          backgroundRepeat: "no-repeat",
          backgroundSize: "cover",
          backgroundPosition: "top left",
          backgroundAttachment: "scroll",
          color: "#DDD1A0",
          WebkitTouchCallout: "none",
          WebkitUserSelect: "none",
          WebkitOverflowScrolling: "touch",
          paddingTop: "env(safe-area-inset-top)",
          paddingBottom: "env(safe-area-inset-bottom)",
          paddingLeft: "env(safe-area-inset-left)",
          paddingRight: "env(safe-area-inset-right)",
        }}
      >
        {/* Top mobile action bar */}
        <Box
          sx={{
            height: "40px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            px: 2,
            pt: isMobile ? 0 : 1,
            position: "relative",
            zIndex: 1300,
          }}
        >
          <Box
            sx={{
              display: { xs: "none", sm: "block" },
              position: "absolute",
              left: 30,
              top: 20,
            }}
          >
            <img
              src={import.meta.env.BASE_URL + "memorise.png"}
              alt="Memorise"
              style={{ height: "20px", objectFit: "contain" }}
            />
          </Box>

          {/* Action icons visible only on mobile */}
          <Box
            sx={{
              display: { xs: "flex", sm: "none" },
              gap: 1,
              alignItems: "center",
            }}
          >
            <Tooltip title="Semantic Tagging">
              <IconButton
                onClick={() =>
                  document.dispatchEvent(new Event("trigger:classify"))
                }
              >
                <TagIcon sx={{ color: "#A0B8DD", fontSize: 20 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title="NER">
              <IconButton
                onClick={() => document.dispatchEvent(new Event("trigger:ner"))}
              >
                <PersonSearchIcon sx={{ color: "#DDD1A0", fontSize: 20 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Translate">
              <IconButton
                onClick={() =>
                  document.dispatchEvent(new Event("trigger:translate"))
                }
              >
                <TranslateIcon sx={{ color: "#DDA0AF", fontSize: 20 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Editor">
              <IconButton
                onClick={() =>
                  document.dispatchEvent(new Event("trigger:editor"))
                }
              >
                <NotesIcon sx={{ color: "#EDE8D4", fontSize: 20 }} />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Sidebar */}
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
            px: { xs: 0, sm: 4 },
            ml: {
              xs: 10,
              sm: sidebarOpen ? 28 : 10,
            },
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
