import React, { useEffect, useMemo, useCallback, useState } from "react";
import { createEditor, Node, Path, Editor, Text } from "slate";
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
    Text: { text: string }; // decoration props attached at runtime
  }
}

/** ---- NER span ---- */
export type NerSpan = {
  start: number;
  end: number;
  entity: string;
  score?: number;
};

// If your backend uses CRLF, change to "\r\n"
const NEWLINE = "\n";

/** Rich, visible entity colors */
const ENTITY_COLORS: Record<string, string> = {
  PERS: "#C2185B", // deep rose
  DATE: "#1976D2", // strong blue
  LOC: "#388E3C", // dark green
  ORG: "#F57C00", // vivid orange
  CAMP: "#6A1B9A", // rich purple
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

// Use newlines between blocks so NER offsets match what you see
const toPlainTextWithNewlines = (value: Descendant[]): string =>
  (value as Descendant[]).map((n) => Node.string(n as any)).join(NEWLINE);

interface Props {
  value: string;
  onChange: (text: string) => void;
  placeholder?: string;
  spans?: NerSpan[];
  onDeleteSpan?: (span: NerSpan) => void; // notify parent
  highlightedCategories?: string[]; // multi-select filter from bubbles
}

const NotationEditor: React.FC<Props> = ({
  value,
  onChange,
  placeholder,
  spans = [],
  onDeleteSpan,
  highlightedCategories = [],
}) => {
  const editor = useMemo(() => withHistory(withReact(createEditor())), []);
  const [slateValue, setSlateValue] = useState<Descendant[]>(() =>
    toInitialValue(value)
  );

  // selection (for full highlight if clicked)
  const [activeSpan, setActiveSpan] = useState<NerSpan | null>(null);

  // LOCAL spans for instant UX; stays in sync with incoming props
  const [localSpans, setLocalSpans] = useState<NerSpan[]>(spans);
  useEffect(() => {
    setLocalSpans(spans);
  }, [spans]);

  useEffect(() => {
    setSlateValue(toInitialValue(value));
    setActiveSpan(null); // reset selection when content is replaced
  }, [value]);

  // Clear any clicked selection when the category filters change
  useEffect(() => {
    setActiveSpan(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightedCategories?.join("|")]);

  /** ---- Build global offset index across leaves (newline-aware) ---- */
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
      if (prevBlock && !Path.equals(parent, prevBlock)) g += NEWLINE.length; // virtual newline
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

  /** ---- Decorations: underline + attach span identity ---- */
  const decorate = useCallback(
    (entry: [any, Path]) => {
      const [node, path] = entry;
      const ranges: any[] = [];
      if (!Text.isText(node)) return ranges;

      const info = indexByPath.get(keyFromPath(path));
      if (!info) return ranges;

      const hasGroupFilters = (highlightedCategories?.length ?? 0) > 0;

      for (const s of localSpans) {
        const start = Math.max(s.start, info.gStart);
        const end = Math.min(s.end, info.gEnd);
        if (end > start) {
          const clicked =
            !!activeSpan &&
            activeSpan.start === s.start &&
            activeSpan.end === s.end &&
            activeSpan.entity === s.entity;

          const grouped =
            !!highlightedCategories && highlightedCategories.includes(s.entity);

          // Only keep clicked highlight when there are NO group filters
          const isActive = grouped || (clicked && !hasGroupFilters);

          const localStart = start - info.gStart;
          const localEnd = end - info.gStart;

          ranges.push({
            anchor: { path, offset: localStart },
            focus: { path, offset: localEnd },
            underline: true,
            entity: s.entity,
            spanStart: s.start,
            spanEnd: s.end,
            active: isActive,
            clicked,
            // SHOW × if (clicked OR grouped) on the FIRST leaf of the span
            showDelete: (clicked || grouped) && start === s.start,
          });
        }
      }
      return ranges;
    },
    [indexByPath, localSpans, activeSpan, highlightedCategories]
  );

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

  const renderLeaf = useCallback(
    (props: any) => {
      const { attributes, children, leaf } = props;

      if (leaf.underline) {
        const color = ENTITY_COLORS[leaf.entity as string] ?? "#37474F";
        const bg = leaf.active ? hexToRgba(color, 0.35) : "transparent";
        const hasGroupFilters = (highlightedCategories?.length ?? 0) > 0;

        const handleMouseDown: React.MouseEventHandler<HTMLSpanElement> = (
          e
        ) => {
          e.preventDefault();
          e.stopPropagation();
          if (hasGroupFilters) {
            // With filters active, clicking shouldn’t create a sticky selection.
            return;
          }
          // Toggle clicked-only selection (works when no group filters)
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
              boxDecorationBreak: "clone",
            }}
            title={`${leaf.entity}`}
          >
            {children}

            {/* Delete "×" for either clicked or grouped (first leaf only) */}
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
    [activeSpan, highlightedCategories, handleDelete]
  );

  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <Slate
        editor={editor}
        initialValue={slateValue}
        onChange={(val) => {
          setSlateValue(val);
          onChange(toPlainTextWithNewlines(val)); // keep NER offsets aligned
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
            transition: "box-shadow .2s ease, border-color .2s ease",
            "&:hover": {
              borderColor: "#93ACD8",
              boxShadow:
                "0 1px 0 rgba(12, 24, 38, 0.05), 0 10px 24px rgba(12, 24, 38, 0.09)",
            },
            "&:focus-within": {
              borderColor: "#7A91B4",
              boxShadow:
                "0 0 0 3px rgba(122,145,180,0.25), 0 8px 24px rgba(12, 24, 38, 0.10)",
            },
            color: "#1E293B",
            fontFamily: "DM Mono, monospace",
            overflow: "hidden",
            "& ::-webkit-scrollbar": { width: 10 },
            "& ::-webkit-scrollbar-thumb": {
              background: "#C7D5EA",
              borderRadius: 10,
              border: "3px solid transparent",
              backgroundClip: "content-box",
            },
            "& ::-webkit-scrollbar-thumb:hover": { background: "#B3C6E4" },
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
