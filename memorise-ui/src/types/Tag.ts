export type TagSource = "api" | "user";

export interface TagItem {
  name: string;
  source: TagSource;
  label?: number;     // KeywordID from thesaurus (when from API classification)
  parentId?: number;  // ParentID to disambiguate entries with same KeywordID
}
