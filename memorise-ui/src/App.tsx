// Import React hooks and components for state management, routing, and lazy loading
import { useState, useEffect, useMemo, lazy, Suspense } from "react";
// Import Material-UI components for theming and layout
import {
  CssBaseline,
  ThemeProvider,
  createTheme,
  Box,
  responsiveFontSizes,
} from "@mui/material";
// Import React Router components for navigation and routing
import {
  Routes,
  Route,
  useLocation,
  useNavigate,
  Navigate,
} from "react-router-dom";
// Import custom components, stores, services, and utilities
import BubbleSidebar from "./presentation/components/sidebar/BubbleSidebar";
import { useWorkspaceStore } from "./presentation/stores/workspaceStore";
import { useNotificationStore } from "./presentation/stores/notificationStore";
import { getWorkspaceApplicationService } from "./infrastructure/providers/workspaceProvider";
import type { Workspace } from "./types/Workspace";
import { NotificationSnackbar } from "./presentation/components/shared/NotificationSnackbar";
import { StateSynchronizer } from "./presentation/components/shared/StateSynchronizer";

// Lazy load pages for code splitting to reduce initial bundle size
const AccountPage = lazy(() => import("./presentation/pages/AccoutPage"));
const WorkspacePage = lazy(() => import("./presentation/pages/WorkspacePage"));
const ManageWorkspacesPage = lazy(() => import("./presentation/pages/ManageWorkspacesPage"));
const LoginPage = lazy(() => import("./presentation/pages/LoginPage"));

// Create and configure the Material-UI theme with custom colors, fonts, and typography
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
// Make theme responsive by scaling font sizes based on screen size
theme = responsiveFontSizes(theme);

// Storage key for persisting the current user's username in localStorage
const USER_KEY = "memorise.user.v1";

/* --- helper route for /workspace/new: create + redirect --- */
// Component that creates a new workspace and redirects to it or manage page on mount
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
  // Get current route location and navigation function from React Router
  const location = useLocation();
  const navigate = useNavigate();

  // Initialize username from localStorage to prevent flicker on page load
  const [username, setUsername] = useState<string | null>(() =>
    localStorage.getItem(USER_KEY)
  );

  // Track sidebar open state
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Access Zustand store state and actions for workspace management
  // Use metadata for lightweight UI operations (listing, navigation)
  const workspaces = useWorkspaceStore((state) => state.workspaces);
  const createWorkspaceAction = useWorkspaceStore.getState().createWorkspace;
  
  // Access notification store for displaying global messages
  const current = useNotificationStore((state) => state.current);
  const dequeue = useNotificationStore.getState().dequeue;
  
  // Memoize workspace application service to prevent recreating on each render
  const workspaceApplicationService = useMemo(
    () => getWorkspaceApplicationService(),
    []
  );

  // Save username to localStorage and navigate to workspaces page
  // StateSynchronizer will react to the username change
  const handleLogin = (name: string) => {
    localStorage.setItem(USER_KEY, name);
    setUsername(name);
    navigate("/manage-workspaces");
  };

  // Clear user data from localStorage and navigate to login page
  // StateSynchronizer will react to the username change
  const handleLogout = () => {
    localStorage.removeItem(USER_KEY);
    setUsername(null);
    navigate("/login");
  };

  // Create a new workspace draft with auto-incremented name and add it to the store
  const handleAddWorkspace = () => {
    if (!username) return { id: "", name: "", isTemporary: true } as Workspace;
    const newCount = workspaces.filter((w) =>
      w.name.startsWith("New Workspace")
    ).length;
    const ws = workspaceApplicationService.createWorkspaceDraft(
      username,
      `New Workspace #${newCount + 1}`
    );
    void createWorkspaceAction(ws);
    return ws;
  };

  // Move the opened workspace to the front of the list to maintain recent workspaces order
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

  // Bump workspace to front of list when navigating to a workspace route
  useEffect(() => {
    const m = location.pathname.match(/^\/workspace\/([^/]+)$/);
    if (!m) return;
    const id = decodeURIComponent(m[1]);
    if (id !== "new") bumpWorkspaceToFront(id);
  }, [location.pathname]);

  /* --------- Routing --------- */

  // Render login page and routes when user is not authenticated
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

  // Render main application with sidebar, routes, and notification system
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <StateSynchronizer username={username}>
        <Box
          sx={{
            position: "fixed",
            inset: 0,
            width: "100vw",
            overflow: "clip",
            background: "linear-gradient(135deg, #2f3e34 0%, #8d7f57 100%)",
          }}
          >
        {/* Render sidebar component with workspace list and navigation controls */}
        <BubbleSidebar
          onLogout={handleLogout}
          open={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
          workspaces={workspaces}
          onAddWorkspace={handleAddWorkspace}
        />
        {/* Render main content area with routes for all authenticated pages */}
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
                element={<WorkspacePage />}
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
                  <ManageWorkspacesPage />
                }
              />
              <Route
                path="*"
                element={<Navigate to="/manage-workspaces" replace />}
              />
            </Routes>
          </Suspense>
        </Box>
        {/* Render notification snackbar for global messages */}
        {current && (
          <NotificationSnackbar
            message={current.message}
            onClose={dequeue}
            tone={current.tone}
            persistent={current.persistent}
          />
        )}
        </Box>
      </StateSynchronizer>
    </ThemeProvider>
  );
};

export default App;
