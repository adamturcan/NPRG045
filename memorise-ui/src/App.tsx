import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import {
  CssBaseline,
  ThemeProvider,
  createTheme,
  Box,
  responsiveFontSizes,
} from "@mui/material";
import {
  Routes,
  Route,
  useLocation,
  useNavigate,
  Navigate,
} from "react-router-dom";
import BubbleSidebar from "./components/sidebar/BubbleSidebar";
import { useWorkspaceStore } from "./stores/workspaceStore";
import { WorkspaceService } from "./services/workspaceService";
import type { Workspace } from "./types/Workspace";

// Lazy load pages for code splitting
const AccountPage = lazy(() => import("./pages/AccoutPage"));
const WorkspacePage = lazy(() => import("./pages/WorkspacePage"));
const ManageWorkspacesPage = lazy(() => import("./pages/ManageWorkspacesPage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));

let theme = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#2563eb" },
    background: { default: "#545742" },
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

const USER_KEY = "memorise.user.v1";

/* --- helper route for /workspace/new: create + redirect --- */
const NewWorkspaceRedirect: React.FC<{
  onCreate: () => Workspace;
}> = ({ onCreate }) => {
  const navigate = useNavigate();
  useEffect(() => {
    const ws = onCreate();
    if (ws?.id) {
      navigate(`/workspace/${encodeURIComponent(ws.id)}`, { replace: true });
    } else {
      navigate("/manage-workspaces", { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
};

/* ---------------- App ---------------- */

const App: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // hydrate username synchronously from localStorage (no flicker)
  const [username, setUsername] = useState<string | null>(() =>
    localStorage.getItem(USER_KEY)
  );

  const [booted, setBooted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Zustand store
  const workspaces = useWorkspaceStore((state) => state.workspaces);
  const loadWorkspaces = useWorkspaceStore.getState().loadWorkspaces;
  const createWorkspaceAction = useWorkspaceStore.getState().createWorkspace;

  // Wrapper function to update workspaces array (for compatibility with old setWorkspaces API)
  // Memoize to prevent infinite loops in child components
  const setWorkspaces = useCallback((updater: Workspace[] | ((prev: Workspace[]) => Workspace[])) => {
    const currentWorkspaces = useWorkspaceStore.getState().workspaces;
    const newWorkspaces = typeof updater === 'function' 
      ? updater(currentWorkspaces)
      : updater;
    useWorkspaceStore.setState({ workspaces: newWorkspaces });
  }, []); // Empty deps - function is stable

  // Boot: load user's workspaces exactly once after username is known
  useEffect(() => {
    if (!username) {
      setBooted(true);
      return;
    }
    loadWorkspaces(username).then(() => {
      setBooted(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username]);

  // Persist whenever workspaces change — but only after boot
  useEffect(() => {
    if (!booted || !username) return;
    WorkspaceService.saveForUser(username, workspaces);
  }, [booted, username, workspaces]);

  // Login / logout
  const handleLogin = (name: string) => {
    localStorage.setItem(USER_KEY, name);
    setBooted(false); // force reload of correct bucket
    setUsername(name);
    navigate("/manage-workspaces");
  };

  const handleLogout = () => {
    localStorage.removeItem(USER_KEY);
    setUsername(null);
    useWorkspaceStore.setState({ workspaces: [] });
    setBooted(true);
    navigate("/login");
  };

  // Create new workspace
  const handleAddWorkspace = () => {
    if (!username) return { id: "", name: "", isTemporary: true } as Workspace;
    const newCount = workspaces.filter((w) =>
      w.name.startsWith("New Workspace")
    ).length;
    const ws = WorkspaceService.createWorkspace(
      username,
      `New Workspace #${newCount + 1}`
    );
    createWorkspaceAction({
      name: ws.name,
      isTemporary: ws.isTemporary,
      text: ws.text,
      userSpans: ws.userSpans,
      owner: ws.owner,
      updatedAt: ws.updatedAt,
    });
    return ws;
  };

  // Keep "recent" 3 by moving opened one to the front
  const bumpWorkspaceToFront = (id: string) => {
    const currentWorkspaces = useWorkspaceStore.getState().workspaces;
    const idx = currentWorkspaces.findIndex((w) => w.id === id);
    if (idx <= 0) return;
    const next = [...currentWorkspaces];
    const [item] = next.splice(idx, 1);
    next.unshift(item);
    // Use Zustand's setState to replace the entire array
    useWorkspaceStore.setState({ workspaces: next });
  };

  useEffect(() => {
    const m = location.pathname.match(/^\/workspace\/([^/]+)$/);
    if (!m) return;
    const id = decodeURIComponent(m[1]);
    if (id !== "new") bumpWorkspaceToFront(id);
  }, [location.pathname]);

  /* --------- Routing --------- */

  if (!username) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Suspense fallback={
          <Box
            sx={{
              position: "fixed",
              inset: 0,
              display: "grid",
              placeItems: "center",
              backgroundColor: "background.default",
            }}
          >
            <img
              src={import.meta.env.BASE_URL + "memorise.png"}
              alt="Memorise"
              style={{ height: 36, opacity: 0.7 }}
            />
          </Box>
        }>
          <Routes>
            <Route path="/login" element={<LoginPage onLogin={handleLogin} />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </Suspense>
      </ThemeProvider>
    );
  }

  if (!booted) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box
          sx={{
            position: "fixed",
            inset: 0,
            display: "grid",
            placeItems: "center",
            backgroundColor: "background.default",
          }}
        >
          <img
            src={import.meta.env.BASE_URL + "memorise.png"}
            alt="Memorise"
            style={{ height: 36, opacity: 0.7 }}
          />
        </Box>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box
        sx={{
          position: "fixed",
          inset: 0,
          width: "100vw",
          overflow: "clip",
          background: "linear-gradient(135deg, #2f3e34 0%, #8d7f57 100%)",
        }}
      >
        {/* Top-left pill logo
        <Box
          sx={{
            position: "fixed",
            top: 15,
            left: -20,
            zIndex: 1400,
            display: { xs: "none", sm: "block" },
          }}
        >
          <Box
            sx={{ backgroundColor: "black", p: 1.5, borderRadius: 50, px: 4.5 }}
          >
            <img
              src={import.meta.env.BASE_URL + "memorise.png"}
              alt="Memorise"
              style={{ height: 26, objectFit: "contain" }}
            />
          </Box>
        </Box> */}
        {/* Sidebar */}
        <BubbleSidebar
          onLogout={handleLogout}
          open={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
          workspaces={workspaces}
          onAddWorkspace={handleAddWorkspace}
        />
        {/* Pages */}
        <Box
          sx={{
            flexGrow: 1,
            px: { xs: 0, sm: 4 },
            ml: { xs: 10, sm: sidebarOpen ? 20 : 5 },
            pt: { xs: 0, sm: 5 },
            transition: "margin-left 0.3s ease",
          }}
        >
          <Suspense fallback={
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                minHeight: "200px",
              }}
            >
              <img
                src={import.meta.env.BASE_URL + "memorise.png"}
                alt="Loading"
                style={{ height: 24, opacity: 0.5 }}
              />
            </Box>
          }>
            <Routes>
              <Route
                path="/"
                element={<Navigate to="/manage-account" replace />}
              />
              <Route
                path="/workspace/new"
                element={<NewWorkspaceRedirect onCreate={handleAddWorkspace} />}
              />
              <Route
                path="/workspace/:id"
                element={
                  <WorkspacePage workspaces={workspaces} setWorkspaces={setWorkspaces} />
                }
              />
              <Route
                path="/manage-account"
                element={
                  <AccountPage username={username} workspaces={workspaces} />
                }
              />
              <Route
                path="/manage-workspaces"
                element={
                  <ManageWorkspacesPage workspaces={workspaces} setWorkspaces={setWorkspaces} />
                }
              />
              <Route
                path="*"
                element={<Navigate to="/manage-workspaces" replace />}
              />
            </Routes>
          </Suspense>
        </Box>
      </Box>
    </ThemeProvider>
  );
};

export default App;
