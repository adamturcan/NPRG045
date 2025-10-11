// src/constants/notationEditor.ts
import type { Descendant } from "slate";
import { Node } from "slate";

export const NEWLINE = "\n";

/** App palette */
export const COLORS = {
  text: "#0F172A",
  border: "#E2E8F0",
  borderHover: "#CBD5E1",
  borderFocus: "#94A3B8",
} as const;

/** visible entity colors */
export const ENTITY_COLORS: Record<string, string> = {
  PERS: "#C2185B",
  DATE: "#1976D2",
  LOC: "#388E3C",
  ORG: "#F57C00",
  CAMP: "#6A1B9A",
} as const;

/** fixed category list for the quick-add / edit menu */
export const CATEGORY_LIST = ["PERS", "DATE", "LOC", "ORG", "CAMP"] as const;

export const toInitialValue = (text: string): Descendant[] => [
  { type: "paragraph", children: [{ text }] },
];

export const toPlainTextWithNewlines = (value: Descendant[]): string =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (value as Descendant[]).map((n) => Node.string(n as any)).join(NEWLINE);

export const hexToRgba = (hex: string, alpha: number) => {
  const h = hex.replace("#", "");
  const bigint = parseInt(h, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};
