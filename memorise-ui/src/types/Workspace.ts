import type { NerSpan } from "../types/NotationEditor";
import type { TagItem } from "./Tag";
import type { Segment } from "./Segment";

/**
 * Translation page within a workspace
 * Each translation represents the workspace text in a different language
 * Each translation has its own independent NER annotations
 */
export type Translation = {
  language: string;        // Language code (e.g., "cs", "da", "nl")
  text: string;            // Translated text content
  sourceLang: string;      // Source language used for translation
  createdAt: number;       // Timestamp when translation was created
  updatedAt: number;       // Last modification timestamp
  userSpans?: NerSpan[];   // User-annotated NER spans for this translation
  apiSpans?: NerSpan[];    // API-generated NER spans for this translation
  deletedApiKeys?: string[]; // Soft-deleted API span keys for this translation
  segmentTranslations?: {
    [segmentId: string]: string;  // segmentId → translated text (for per-segment translation)
  };
};

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
  translations?: Translation[]; // ← NEW: Store translation pages
  segments?: Segment[]; // Optional segments from segmentation API
};
