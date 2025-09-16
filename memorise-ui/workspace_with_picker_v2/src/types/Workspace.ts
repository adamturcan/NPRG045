import type { NerSpan } from "../components/editor/NotationEditor";
import type { TagItem } from "./Tag";
export type Workspace = {
  id: string;
  name: string;
  isTemporary?: boolean;
  text?: string;
  userSpans?: NerSpan[];
  deletedApiKeys?: string[]; // ← add this
  updatedAt?: number;
  apiSpans?: NerSpan[];
  owner?: string;
  tags?: TagItem[];
};
