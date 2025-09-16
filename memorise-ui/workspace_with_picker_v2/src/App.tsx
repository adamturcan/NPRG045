import { useState, useEffect } from "react";
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

import AccountPage from "./pages/AccoutPage"; // fixed typo
import WorkspacePage from "./pages/WorkspacePage";
import ManageWorkspacesPage from "./pages/ManageWorkspacesPage";
import BubbleSidebar from "./components/Sidebar/BubbleSidebar";
import LoginPage from "./pages/LoginPage";

import type { Workspace } from "./types/Workspace";

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
const BASE_WS_KEY = "memorise.workspaces.v1";
const keyForUser = (u: string) => `${BASE_WS_KEY}:${u}`;

/* ---------------- helpers ---------------- */

const seedForUser = (owner: string): Workspace[] => [
  {
    id: crypto.randomUUID(),
    name: "Workspace A",
    isTemporary: false,
    text: "",
    userSpans: [],
    updatedAt: Date.now(),
    owner,
  },
  {
    id: crypto.randomUUID(),
    name: "Workspace B",
    isTemporary: false,
    text: "",
    userSpans: [],
    updatedAt: Date.now(),
    owner,
  },
  {
    id: crypto.randomUUID(),
    name: "Workspace C",
    isTemporary: false,
    text: "",
    userSpans: [],
    updatedAt: Date.now(),
    owner,
  },
];

function normalizeOwner(arr: unknown, owner: string): Workspace[] {
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((x) => x && typeof x === "object")
    .map((w: any) => ({
      ...w,
      owner: w?.owner ?? owner,
      text: typeof w?.text === "string" ? w.text : "",
      userSpans: Array.isArray(w?.userSpans) ? w.userSpans : [],
      updatedAt: typeof w?.updatedAt === "number" ? w.updatedAt : Date.now(),
    })) as Workspace[];
}

function loadForUser(user: string): Workspace[] | null {
  try {
    const perUser = localStorage.getItem(keyForUser(user));
    if (perUser) return normalizeOwner(JSON.parse(perUser), user);

    // migrate old single-bucket storage if present
    const legacy = localStorage.getItem(BASE_WS_KEY);
    if (legacy) {
      const migrated = normalizeOwner(JSON.parse(legacy), user);
      localStorage.setItem(keyForUser(user), JSON.stringify(migrated));
      return migrated;
    }
  } catch {}
  return null;
}

function saveForUser(user: string, workspaces: Workspace[]) {
  try {
    localStorage.setItem(keyForUser(user), JSON.stringify(workspaces));
  } catch {}
}

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

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [booted, setBooted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Boot: load user’s workspaces exactly once after username is known
  useEffect(() => {
    if (!username) {
      setWorkspaces([]);
      setBooted(true);
      return;
    }
    const loaded = loadForUser(username);
    if (loaded && loaded.length) {
      setWorkspaces(loaded);
    } else {
      const seeded = seedForUser(username);
      setWorkspaces(seeded);
      saveForUser(username, seeded);
    }
    setBooted(true);
  }, [username]);

  // Persist whenever workspaces change — but only after boot
  useEffect(() => {
    if (!booted || !username) return;
    saveForUser(username, workspaces);
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
    setWorkspaces([]);
    setBooted(true);
    navigate("/login");
  };

  // Create new workspace
  const handleAddWorkspace = () => {
    if (!username) return { id: "", name: "", isTemporary: true } as Workspace;
    const newCount = workspaces.filter((w) =>
      w.name.startsWith("New Workspace")
    ).length;
    const ws: Workspace = {
      id: crypto.randomUUID(),
      name: `New Workspace #${newCount + 1}`,
      isTemporary: true,
      text: "",
      userSpans: [],
      updatedAt: Date.now(),
      owner: username,
    };
    setWorkspaces((prev) => [ws, ...prev]);
    return ws;
  };

  // Keep “recent” 3 by moving opened one to the front
  const bumpWorkspaceToFront = (id: string) => {
    setWorkspaces((prev) => {
      const idx = prev.findIndex((w) => w.id === id);
      if (idx <= 0) return prev;
      const next = prev.slice();
      const [item] = next.splice(idx, 1);
      next.unshift(item);
      return next;
    });
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
        <Routes>
          <Route path="/login" element={<LoginPage onLogin={handleLogin} />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
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
                <WorkspacePage
                  workspaces={workspaces}
                  setWorkspaces={setWorkspaces}
                />
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
                <ManageWorkspacesPage
                  workspaces={workspaces}
                  setWorkspaces={setWorkspaces}
                />
              }
            />
            <Route
              path="*"
              element={<Navigate to="/manage-workspaces" replace />}
            />
          </Routes>
        </Box>
      </Box>
    </ThemeProvider>
  );
};

export default App;
