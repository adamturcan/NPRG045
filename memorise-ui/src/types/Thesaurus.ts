/**
 * Types for custom thesaurus vocabulary system
 * 
 * This supports a hierarchical keyword structure from your coworkers'
 * thesaurus JSON file.
 */

/**
 * Single keyword node in the thesaurus hierarchy (full structure)
 */
export type ThesaurusKeyword = {
  KeywordID: number;
  Label: string;
  ParentID: number;              // -1 for root nodes
  ParentLabel: string;           // "primary node" for roots
  CategoryRootKeywordLabel: string;
  CategoryRootKeywordID: number;
  KeywordPath: string;           // e.g., "/10481/15428/36103/"
  IsPreferred: 0 | 1;            // 1 = preferred term, 0 = alias/variant
  SubTerms?: ThesaurusKeyword[]; // Recursive children
};

/**
 * Flattened index item for fast searching
 * This is what gets stored in the pre-processed index file
 */
export type ThesaurusIndexItem = {
  id: number;
  label: string;
  labelLower: string;            // Pre-lowercased for fast search
  parentId: number;
  parentLabel: string;
  rootCategory: string;
  path: string[];                // Array of labels from root to this node
  pathString: string;            // Pre-joined for display: "culture › writing › Jewish publications"
  depth: number;                 // 0 = root, 1 = child, 2 = grandchild, etc.
  isPreferred: boolean;
};

/**
 * Item format for autocomplete UI (used by TagThesaurusInput)
 */
export type ThesaurusItem = {
  name: string;
  path?: string[];               // Hierarchical path for display
  keywordId?: number;            // Reference to original keyword
  isPreferred?: boolean;         // Show badge if not preferred
  depth?: number;                // For visual indentation
};



