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
    Text: { text: string };
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

/** App palette */
const CATEGORIES = ["PERSON", "ORG", "LOC", "DATE", "CAMP"] as const;

type Category = typeof CATEGORIES[number];

const COLORS = {
  text: "#0F172A", // deep slate
  textSub: "#334155",
  border: "#E2E8F0", // slate-200
  borderHover: "#CBD5E1",
  borderFocus: "#94A3B8", // slate-400
};

/** visible entity colors */
const ENTITY_COLORS: Record<string, string> = {
  PERS: "#C2185B",
  DATE: "#1976D2",
  LOC: "#388E3C",
  ORG: "#F57C00",
  CAMP: "#6A1B9A",
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

  onSelectionChange?: (sel: { start: number; end: number } | null) => void;

  /** keys: `${start}:${end}:${entity}` */
  deletableKeys?: Set<string>;

  onAddSpan?: (span: NerSpan) => void;
}

// Optional: called when user adds a span via the selection picker
// If omitted, the editor will add the span to its local mirror.


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

  // Floating selection picker state
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerPos, setPickerPos] = useState<{top: number; left: number} | null>(null);
  const [currentSelection, setCurrentSelection] = useState<{ start: number; end: number } | null>(null);

  // Compute DOM rect of current Slate selection and place the button near it
  const updatePickerPosition = useCallback(() => {
    const sel = window.getSelection?.();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    if (!rect || rect.width === 0 && rect.height === 0) return;
    const top = rect.top + window.scrollY - 32; // above selection
    const left = rect.left + window.scrollX;    // start of selection
    setPickerPos({ top, left });
  }, []);



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
          showDelete:
            isDeletable &&
            (isActive ||
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

        const handleMouseDown: React.MouseEventHandler<HTMLSpanElement> = (
          e
        ) => {
          e.preventDefault();
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
              backgroundColor: "#FFFFFF",
              borderRadius: 4,
              textDecoration: "underline",
              textDecorationStyle: "dotted",
              textDecorationColor: color,
              textDecorationThickness: "2.5px",
              textUnderlineOffset: "4px",
              cursor: "pointer",
              color: COLORS.text,
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
                  boxShadow: "0 1px 2px rgba(0,0,0,0.18)",
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
        <span {...attributes} style={{ color: COLORS.text }}>
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

    if (start === end) {
      onSelectionChange(null);
      setCurrentSelection(null);
      setPickerOpen(false);
      setPickerPos(null);
    } else {
      const selPayload = { start, end };
      onSelectionChange(selPayload);
      setCurrentSelection(selPayload);
      // update DOM position for the floating picker
      updatePickerPosition();
    }
  }, [editor, onSelectionChange, pointToGlobal]);


  const addSpanForCategory = useCallback((cat: Category) => {
    if (!currentSelection) return;
    const span = { start: currentSelection.start, end: currentSelection.end, entity: cat };
    if (onAddSpan) {
      onAddSpan(span);
    } else {
      // update local mirror immediately
      setLocalSpans((prev) => {
        // avoid duplicates
        const key = `${span.start}:${span.end}:${span.entity}`;
        const seen = new Set(prev.map(s => `${s.start}:${s.end}:${s.entity}`));
        if (seen.has(key)) return prev;
        return [...prev, span];
      });
    }
    // Close picker and clear selection highlight in Slate (but keep text selected)
    setPickerOpen(false);
  }, [currentSelection, onAddSpan]);

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
            border: `1px solid ${COLORS.border}`,
            borderRadius: "16px",
            background: "#FFFFFF",
            boxShadow:
              "0 14px 40px rgba(0,0,0,0.6), 0 4px 12px rgba(0,0,0,0.25)",
            "&:hover": { borderColor: COLORS.borderHover },
            "&:focus-within": { borderColor: COLORS.borderFocus },
            color: COLORS.text,
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
              padding: "18px 18px 22px 18px",
              minHeight: 0,
              overflowY: "auto",
              whiteSpace: "pre-wrap",
              caretColor: COLORS.text,
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
        {/* Floating selection picker trigger */}
          {currentSelection && pickerPos && (
            <Box
              sx={{
                position: "absolute",
                top: pickerPos.top,
                left: pickerPos.left,
                transform: "translateY(-8px)",
                background: "#FFFFFF",
                border: `1px solid ${COLORS.border}`,
                borderRadius: "10px",
                boxShadow: "0 6px 18px rgba(2,19,35,0.20)",
                zIndex: 50,
              }}
              onMouseDown={(e) => e.preventDefault()}
            >
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 0.5,
                  padding: "4px 6px",
                  cursor: "pointer",
                  userSelect: "none",
                  fontFamily: "DM Mono, monospace",
                  color: COLORS.text,
                }}
                onClick={() => setPickerOpen((v) => !v)}
                title="Add to category"
              >
                <span style={{ fontWeight: 700, fontSize: 14, padding: "0 4px" }}>⋯</span>
              </Box>
              {pickerOpen && (
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: "repeat(1, 1fr)",
                    gap: 0.5,
                    padding: "6px",
                    minWidth: "160px",
                    background: "#FFFFFF",
                    borderTop: `1px solid ${COLORS.border}`,
                    borderBottomLeftRadius: "10px",
                    borderBottomRightRadius: "10px",
                  }}
                >
                  {CATEGORIES.map((cat) => (
                    <Box
                      key={cat}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => addSpanForCategory(cat)}
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "6px 8px",
                        borderRadius: "8px",
                        border: `1px solid ${COLORS.border}`,
                        boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
                        cursor: "pointer",
                        "&:hover": { background: "#F8FAFC" },
                      }}
                    >
                      <span style={{ fontSize: 12, fontWeight: 700 }}>{cat}</span>
                      <span
                        style={{
                          display: "inline-block",
                          width: 10,
                          height: 10,
                          borderRadius: 999,
                          background: ENTITY_COLORS[cat] ?? "#64748B",
                        }}
                      />
                    </Box>
                  ))}
                </Box>
              )}
            </Box>
          )}
        </Box>
      </Slate>
    </Box>
  );
};

export default NotationEditor;
