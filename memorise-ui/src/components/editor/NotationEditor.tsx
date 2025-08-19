import React, { useEffect, useMemo, useCallback, useState } from "react";
import { createEditor, Node, Path, Editor, Text, Range } from "slate";
import type { Descendant, BaseEditor } from "slate";
import { Slate, Editable, withReact, ReactEditor } from "slate-react";
import { withHistory, HistoryEditor } from "slate-history";
import { Box } from "@mui/material";

/** ---- Slate custom types ---- */
type ParagraphElement = { type: "paragraph"; children: { text: string }[] };

declare module "slate" {
  interface CustomTypes {
    Editor: BaseEditor & ReactEditor & HistoryEditor;
    Element: ParagraphElement;
    Text: { text: string }; // decoration props added at runtime
  }
}

/** ---- Span type ---- */
export type NerSpan = {
  start: number;
  end: number;
  entity: string;
  score?: number;
};

const NEWLINE = "\n";

/** visible entity colors */
const ENTITY_COLORS: Record<string, string> = {
  PERS: "#C2185B",
  DATE: "#1976D2",
  LOC: "#388E3C",
  ORG: "#F57C00",
  CAMP: "#6A1B9A",
};

const hexToRgba = (hex: string, a: number) => {
  const m = hex.replace("#", "");
  const r = parseInt(m.substring(0, 2), 16);
  const g = parseInt(m.substring(2, 4), 16);
  const b = parseInt(m.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
};

const toInitialValue = (text: string): Descendant[] => [
  { type: "paragraph", children: [{ text }] },
];

const toPlainTextWithNewlines = (value: Descendant[]): string =>
  (value as Descendant[]).map((n) => Node.string(n as any)).join(NEWLINE);

interface Props {
  value: string;
  onChange: (text: string) => void;
  placeholder?: string;

  spans?: NerSpan[];
  onDeleteSpan?: (span: NerSpan) => void;

  highlightedCategories?: string[];

  /** selection reporter (global offsets) */
  onSelectionChange?: (sel: { start: number; end: number } | null) => void;

  /** NEW: which spans can show a delete “×”
   * keys are `${start}:${end}:${entity}` for spans that are user-created (deletable)
   * if omitted, all spans are considered deletable
   */
  deletableKeys?: Set<string>;
}

const NotationEditor: React.FC<Props> = ({
  value,
  onChange,
  placeholder,
  spans = [],
  onDeleteSpan,
  highlightedCategories = [],
  onSelectionChange,
  deletableKeys,
}) => {
  const editor = useMemo(() => withHistory(withReact(createEditor())), []);
  const [slateValue, setSlateValue] = useState<Descendant[]>(() =>
    toInitialValue(value)
  );

  // clicked/active span (for full highlight)
  const [activeSpan, setActiveSpan] = useState<NerSpan | null>(null);

  // local mirror for instant UX
  const [localSpans, setLocalSpans] = useState<NerSpan[]>(spans);
  useEffect(() => setLocalSpans(spans), [spans]);

  useEffect(() => {
    setSlateValue(toInitialValue(value));
    setActiveSpan(null);
  }, [value]);

  /** ---- global offset index across leaves (newline-aware) ---- */
  type LeafInfo = { path: Path; gStart: number; gEnd: number; len: number };
  const leafIndex = useMemo<LeafInfo[]>(() => {
    const leaves: LeafInfo[] = [];
    let g = 0;
    let prevBlock: Path | null = null;

    for (const [node, path] of Editor.nodes(editor, {
      at: [],
      match: Text.isText,
    })) {
      const parent = Path.parent(path);
      if (prevBlock && !Path.equals(parent, prevBlock)) g += NEWLINE.length;
      const len = (node as Text).text.length;
      leaves.push({ path, gStart: g, gEnd: g + len, len });
      g += len;
      prevBlock = parent;
    }
    return leaves;
  }, [editor, slateValue]);

  const keyFromPath = (p: number[]) => p.join(".");
  const indexByPath = useMemo(() => {
    const m = new Map<string, LeafInfo>();
    for (const info of leafIndex) m.set(keyFromPath(info.path), info);
    return m;
  }, [leafIndex]);

  /** helper: convert a Slate point to global offset */
  const pointToGlobal = useCallback(
    (path: Path, offset: number): number => {
      const info = indexByPath.get(keyFromPath(path));
      if (!info) return 0;
      return info.gStart + offset;
    },
    [indexByPath]
  );

  /** ---- Decorations ---- */
  const decorate = useCallback(
    (entry: [any, Path]) => {
      const [node, path] = entry;
      const ranges: any[] = [];
      if (!Text.isText(node)) return ranges;

      const info = indexByPath.get(keyFromPath(path));
      if (!info) return ranges;

      for (const s of localSpans) {
        const start = Math.max(s.start, info.gStart);
        const end = Math.min(s.end, info.gEnd);
        if (end <= start) continue;

        const isActive =
          (!!activeSpan &&
            activeSpan.start === s.start &&
            activeSpan.end === s.end &&
            activeSpan.entity === s.entity) ||
          (highlightedCategories.length > 0 &&
            highlightedCategories.includes(s.entity));

        // Only show × for deletable spans (if a list is provided)
        const key = `${s.start}:${s.end}:${s.entity}`;
        const isDeletable = !deletableKeys || deletableKeys.has(key);

        ranges.push({
          anchor: { path, offset: start - info.gStart },
          focus: { path, offset: end - info.gStart },
          underline: true,
          entity: s.entity,
          spanStart: s.start,
          spanEnd: s.end,
          active: isActive,
          // One × per span: only on the leaf containing the span start
          showDelete:
            isDeletable &&
            // If the span is ACTIVE (clicked), show × on ANY leaf segment
            (isActive ||
              // If it’s just category-highlighted, show × only on the leaf containing the start
              (highlightedCategories.includes(s.entity) &&
                s.start >= info.gStart &&
                s.start < info.gEnd)),
        });
      }
      return ranges;
    },
    [indexByPath, localSpans, activeSpan, highlightedCategories, deletableKeys]
  );

  /** delete span */
  const handleDelete = useCallback(
    (span: NerSpan) => {
      setLocalSpans((prev) =>
        prev.filter(
          (s) =>
            !(
              s.start === span.start &&
              s.end === span.end &&
              s.entity === span.entity
            )
        )
      );
      setActiveSpan(null);
      onDeleteSpan?.(span);
    },
    [onDeleteSpan]
  );

  /** render leaf with dotted underline + optional × */
  const renderLeaf = useCallback(
    (props: any) => {
      const { attributes, children, leaf } = props;

      if (leaf.underline) {
        const color = ENTITY_COLORS[leaf.entity as string] ?? "#37474F";
        const bg = leaf.active ? hexToRgba(color, 0.35) : "transparent";

        const handleMouseDown: React.MouseEventHandler<HTMLSpanElement> = (
          e
        ) => {
          e.preventDefault(); // keep caret from moving
          if (
            activeSpan &&
            activeSpan.start === leaf.spanStart &&
            activeSpan.end === leaf.spanEnd &&
            activeSpan.entity === leaf.entity
          ) {
            setActiveSpan(null);
          } else {
            setActiveSpan({
              start: leaf.spanStart,
              end: leaf.spanEnd,
              entity: leaf.entity,
            });
          }
        };

        return (
          <span
            {...attributes}
            onMouseDown={handleMouseDown}
            style={{
              position: "relative",
              backgroundColor: bg,
              borderRadius: 4,
              textDecoration: "underline",
              textDecorationStyle: "dotted",
              textDecorationColor: color,
              textDecorationThickness: "2.5px",
              textUnderlineOffset: "4px",
              cursor: "pointer",
              color: "#1E293B",
              transition: "background-color 0.2s ease",
              paddingRight: leaf.showDelete ? "18px" : undefined,
            }}
            title={`${leaf.entity}`}
          >
            {children}
            {leaf.showDelete && (
              <span
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleDelete({
                    start: leaf.spanStart,
                    end: leaf.spanEnd,
                    entity: leaf.entity,
                  });
                }}
                style={{
                  position: "absolute",
                  top: "-6px",
                  right: "-6px",
                  width: "16px",
                  height: "16px",
                  backgroundColor: "#FFFFFF",
                  border: `1px solid ${color}`,
                  borderRadius: "50%",
                  fontSize: "12px",
                  lineHeight: "14px",
                  textAlign: "center",
                  cursor: "pointer",
                  color,
                  fontWeight: "bold",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.15)",
                  userSelect: "none",
                  zIndex: 10,
                }}
              >
                ×
              </span>
            )}
          </span>
        );
      }

      return (
        <span {...attributes} style={{ color: "#1E293B" }}>
          {children}
        </span>
      );
    },
    [activeSpan, handleDelete]
  );

  /** report selection offsets on any editor change */
  const reportSelection = useCallback(() => {
    if (!onSelectionChange) return;

    const sel = editor.selection;
    if (!sel || !Range.isRange(sel)) {
      onSelectionChange(null);
      return;
    }
    const [startPoint, endPoint] = Range.edges(sel);
    const gStart = pointToGlobal(startPoint.path, startPoint.offset);
    const gEnd = pointToGlobal(endPoint.path, endPoint.offset);
    const start = Math.min(gStart, gEnd);
    const end = Math.max(gStart, gEnd);

    if (start === end) onSelectionChange(null);
    else onSelectionChange({ start, end });
  }, [editor, onSelectionChange, pointToGlobal]);

  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <Slate
        editor={editor}
        initialValue={slateValue}
        onChange={(val) => {
          setSlateValue(val);
          onChange(toPlainTextWithNewlines(val));
          reportSelection();
        }}
      >
        <Box
          sx={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            border: "1px solid #BFD0E8",
            borderRadius: "14px",
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.65) 0%, rgba(255,255,255,0.35) 100%)",
            backdropFilter: "blur(6px)",
            boxShadow:
              "0 1px 0 rgba(12, 24, 38, 0.04), 0 6px 16px rgba(12, 24, 38, 0.06)",
            "&:hover": { borderColor: "#93ACD8" },
            "&:focus-within": { borderColor: "#7A91B4" },
            color: "#1E293B",
            fontFamily: "DM Mono, monospace",
            overflow: "hidden",
          }}
        >
          <Editable
            placeholder={placeholder ?? "Paste text here or upload file"}
            decorate={decorate}
            renderLeaf={renderLeaf}
            spellCheck={false}
            style={{
              flex: 1,
              padding: "14px 14px 18px 14px",
              minHeight: 0,
              overflowY: "auto",
              whiteSpace: "pre-wrap",
              caretColor: "#1E293B",
              position: "relative",
            }}
            renderPlaceholder={(props) => (
              <span
                {...props.attributes}
                style={{
                  position: "absolute",
                  pointerEvents: "none",
                  opacity: 0.55,
                  color: "#5A6A7A",
                  fontFamily: "DM Mono, monospace",
                }}
              >
                {props.children}
              </span>
            )}
          />
        </Box>
      </Slate>
    </Box>
  );
};

export default NotationEditor;
