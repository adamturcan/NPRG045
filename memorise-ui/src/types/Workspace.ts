import type { NerSpan } from "../components/editor/NotationEditor";

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
};
