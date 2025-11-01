import type { Workspace } from '../types/Workspace';

const BASE_WS_KEY = "memorise.workspaces.v1";
const keyForUser = (u: string) => `${BASE_WS_KEY}:${u}`;

function normalizeOwner(arr: unknown, owner: string): Workspace[] {
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((x) => x && typeof x === "object")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((w: any) => ({
      ...w,
      owner: w?.owner ?? owner,
      text: typeof w?.text === "string" ? w.text : "",
      userSpans: Array.isArray(w?.userSpans) ? w.userSpans : [],
      updatedAt: typeof w?.updatedAt === "number" ? w.updatedAt : Date.now(),
    })) as Workspace[];
}

export class WorkspaceService {
  static seedForUser(owner: string): Workspace[] {
    return [
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
  }

  static loadForUser(username: string): Workspace[] | null {
    try {
      const perUser = localStorage.getItem(keyForUser(username));
      if (perUser) return normalizeOwner(JSON.parse(perUser), username);

      // migrate old single-bucket storage if present
      const legacy = localStorage.getItem(BASE_WS_KEY);
      if (legacy) {
        const migrated = normalizeOwner(JSON.parse(legacy), username);
        localStorage.setItem(keyForUser(username), JSON.stringify(migrated));
        return migrated;
      }
    } catch (error) {
      console.error(error);
    }
    return null;
  }

  static saveForUser(username: string, workspaces: Workspace[]): void {
    try {
      localStorage.setItem(keyForUser(username), JSON.stringify(workspaces));
    } catch (error) {
      console.error(error);
    }
  }

  static createWorkspace(owner: string, name: string): Workspace {
    return {
      id: crypto.randomUUID(),
      name,
      isTemporary: true,
      text: "",
      userSpans: [],
      tags: [], // Initialize empty tags array for new workspaces
      updatedAt: Date.now(),
      owner,
    };
  }

  static updateWorkspace(
    id: string,
    updates: Partial<Workspace>,
    workspaces: Workspace[]
  ): Workspace[] {
    return workspaces.map((w) => (w.id === id ? { ...w, ...updates } : w));
  }

  static deleteWorkspace(id: string, workspaces: Workspace[]): Workspace[] {
    return workspaces.filter((w) => w.id !== id);
  }
}
