export type TagSource = "api" | "custom";
export interface TagItem {
  name: string;
  source: TagSource;
}
