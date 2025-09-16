// src/components/editor/NotationEditor.tsx
import React, {
  useEffect,
  useMemo,
  useCallback,
  useState,
  useRef,
} from "react";
import { createEditor, Node, Path, Editor, Text, Range, Point } from "slate";
import type { Descendant, BaseEditor } from "slate";
import { Slate, Editable, withReact, ReactEditor } from "slate-react";
import { withHistory, HistoryEditor } from "slate-history";
import {
  Box,
  IconButton,
  Menu,
  MenuItem,
  Tooltip,
  Divider,
} from "@mui/material";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";

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
const COLORS = {
  text: "#0F172A",
  border: "#E2E8F0",
  borderHover: "#CBD5E1",
  borderFocus: "#94A3B8",
};

/** visible entity colors */
const ENTITY_COLORS: Record<string, string> = {
  PERS: "#C2185B",
  DATE: "#1976D2",
  LOC: "#388E3C",
  ORG: "#F57C00",
  CAMP: "#6A1B9A",
};

/** fixed category list for the quick-add / edit menu */
const CATEGORY_LIST = ["PERS", "DATE", "LOC", "ORG", "CAMP"];

const toInitialValue = (text: string): Descendant[] => [
  { type: "paragraph", children: [{ text }] },
];

const toPlainTextWithNewlines = (value: Descendant[]): string =>
  (value as Descendant[]).map((n) => Node.string(n as any)).join(NEWLINE);

const hexToRgba = (hex: string, alpha: number) => {
  const h = hex.replace("#", "");
  const bigint = parseInt(h, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

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

  /** adding a span via selection “…” menu or change-category */
  onAddSpan?: (span: NerSpan) => void;
}

const NotationEditor: React.FC<Props> = ({
  value,
  onChange,
  placeholder,
  spans = [],
  onDeleteSpan,
  highlightedCategories = [],
  onSelectionChange,
  onAddSpan,
}) => {
  const editor = useMemo(() => withHistory(withReact(createEditor())), []);
  const [slateValue, setSlateValue] = useState<Descendant[]>(() =>
    toInitialValue(value)
  );

  const [activeSpan, setActiveSpan] = useState<NerSpan | null>(null);
  const [localSpans, setLocalSpans] = useState<NerSpan[]>(spans);
  useEffect(() => setLocalSpans(spans), [spans]);

  useEffect(() => {
    setSlateValue(toInitialValue(value));
    setActiveSpan(null);
  }, [value]);

  const containerRef = useRef<HTMLDivElement | null>(null);

  const [selBox, setSelBox] = useState<{
    top: number;
    left: number;
    start: number;
    end: number;
  } | null>(null);
  const [selMenuAnchor, setSelMenuAnchor] = useState<HTMLElement | null>(null);

  const [spanBox, setSpanBox] = useState<{
    top: number;
    left: number;
    span: NerSpan;
  } | null>(null);
  const [spanMenuAnchor, setSpanMenuAnchor] = useState<HTMLElement | null>(
    null
  );

  const suppressCloseRef = useRef(false);

  /** ---- global offset index ---- */
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

  const pointToGlobal = useCallback(
    (path: Path, offset: number): number => {
      const info = indexByPath.get(keyFromPath(path));
      if (!info) return 0;
      return info.gStart + offset;
    },
    [indexByPath]
  );

  const globalToPoint = useCallback(
    (g: number): Point => {
      const info = leafIndex.find((lf) => g >= lf.gStart && g <= lf.gEnd);
      if (!info) {
        const last = leafIndex[leafIndex.length - 1];
        return {
          path: last?.path ?? [0, 0],
          offset: Math.max(0, (last?.len ?? 1) - 1),
        };
      }
      const offset = Math.max(0, Math.min(info.len, g - info.gStart));
      return { path: info.path, offset };
    },
    [leafIndex]
  );

  /** ---- util: bubble at end of last line ---- */
  const posFromDomRange = useCallback(
    (domRange: globalThis.Range, containerRect: DOMRect) => {
      const rects = Array.from(domRange.getClientRects());
      const r =
        rects.length > 0
          ? rects[rects.length - 1]
          : domRange.getBoundingClientRect();
      const leftRaw = r.right - containerRect.left + 6;
      const topRaw = r.top - containerRect.top - 32;
      const left = Math.max(6, Math.min(leftRaw, containerRect.width - 36));
      const top = Math.max(6, topRaw);
      return { left, top, width: r.width, height: r.height };
    },
    []
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

        ranges.push({
          anchor: { path, offset: start - info.gStart },
          focus: { path, offset: end - info.gStart },
          underline: true,
          entity: s.entity,
          spanStart: s.start,
          spanEnd: s.end,
          active: isActive,
        });
      }
      return ranges;
    },
    [indexByPath, localSpans, activeSpan, highlightedCategories]
  );

  /** render leaf */
  const renderLeaf = useCallback(
    (props: any) => {
      const { attributes, children, leaf } = props;

      if (leaf.underline) {
        const base = ENTITY_COLORS[leaf.entity as string] ?? "#37474F";
        const bg = hexToRgba(base, leaf.active ? 0.3 : 0.18);
        const outline = hexToRgba(base, 0.55);

        const handleMouseDown: React.MouseEventHandler<HTMLSpanElement> = (
          e
        ) => {
          e.preventDefault();
          e.stopPropagation();
          suppressCloseRef.current = true;

          const clicked: NerSpan = {
            start: leaf.spanStart,
            end: leaf.spanEnd,
            entity: leaf.entity,
          };

          const same =
            activeSpan &&
            activeSpan.start === clicked.start &&
            activeSpan.end === clicked.end &&
            activeSpan.entity === clicked.entity;

          setActiveSpan(same ? null : clicked);
          setSelBox(null);

          try {
            const range: Range = {
              anchor: globalToPoint(leaf.spanStart),
              focus: globalToPoint(leaf.spanEnd),
            };
            const domRange = ReactEditor.toDOMRange(editor, range);
            const containerRect = containerRef.current?.getBoundingClientRect();
            if (containerRect) {
              const p = posFromDomRange(domRange, containerRect);
              if (p.width > 0 && p.height > 0) {
                setSpanBox({ top: p.top, left: p.left, span: clicked });
              } else {
                setSpanBox(null);
              }
            }
          } catch {
            setSpanBox(null);
          }
        };

        return (
          <span
            {...attributes}
            onMouseDown={handleMouseDown}
            style={{
              position: "relative",
              borderRadius: 4,
              backgroundColor: bg,
              boxShadow: leaf.active
                ? `inset 0 0 0 1.5px ${outline}`
                : undefined,
              textDecoration: "underline",
              textDecorationStyle: "dotted",
              textDecorationColor: base,
              textDecorationThickness: "3px",
              textUnderlineOffset: "5px",
              cursor: "pointer",
              color: COLORS.text,
              transition: "box-shadow 0.15s ease",
            }}
            title={`${leaf.entity}`}
          >
            {children}
          </span>
        );
      }

      return (
        <span {...attributes} style={{ color: COLORS.text }}>
          {children}
        </span>
      );
    },
    [activeSpan, editor, globalToPoint, posFromDomRange]
  );

  /** overlap check (blocks any intersection with existing spans) */
  const selectionOverlapsExisting = useCallback(
    (start: number, end: number) =>
      localSpans.some((s) => !(end <= s.start || start >= s.end)),
    [localSpans]
  );

  /** update selection overlay */
  const updateSelectionOverlay = useCallback(() => {
    const sel = editor.selection;
    if (!sel || !Range.isRange(sel) || Range.isCollapsed(sel)) {
      setSelBox(null);
      onSelectionChange?.(null);
      return;
    }
    const [startPoint, endPoint] = Range.edges(sel);
    const gStart = pointToGlobal(startPoint.path, startPoint.offset);
    const gEnd = pointToGlobal(endPoint.path, endPoint.offset);
    const start = Math.min(gStart, gEnd);
    const end = Math.max(gStart, gEnd);

    // Hide bubble if selection overlaps any existing span
    if (selectionOverlapsExisting(start, end)) {
      setSelBox(null);
      onSelectionChange?.({ start, end });
      return;
    }

    try {
      const domRange = ReactEditor.toDOMRange(editor, sel);
      const containerRect = containerRef.current?.getBoundingClientRect();
      if (containerRect) {
        const p = posFromDomRange(domRange, containerRect);
        if (p.width > 0 && p.height > 0) {
          setSelBox({ top: p.top, left: p.left, start, end });
        } else {
          setSelBox(null);
        }
      }
    } catch {
      setSelBox(null);
    }

    onSelectionChange?.({ start, end });
  }, [
    editor,
    pointToGlobal,
    onSelectionChange,
    posFromDomRange,
    selectionOverlapsExisting,
  ]);

  /** category pick */
  const pickCategoryForRange =
    (start: number, end: number, currentEntity?: string) =>
    (entity: string) => {
      if (!onAddSpan) return;

      // Block adding if selection overlaps an existing span
      // but allow when we're editing an existing span (currentEntity defined)
      if (!currentEntity && selectionOverlapsExisting(start, end)) {
        closeAllUI();
        return;
      }

      if (currentEntity && entity === currentEntity) {
        closeAllUI();
        return;
      }

      if (currentEntity && onDeleteSpan)
        onDeleteSpan({ start, end, entity: currentEntity });
      onAddSpan({ start, end, entity });

      // optimistic local update for instant feedback
      setLocalSpans((prev) => {
        const withoutOld = currentEntity
          ? prev.filter(
              (s) =>
                !(
                  s.start === start &&
                  s.end === end &&
                  s.entity === currentEntity
                )
            )
          : prev.slice();
        const exists = withoutOld.some(
          (s) => s.start === start && s.end === end && s.entity === entity
        );
        return exists
          ? withoutOld
          : [...withoutOld, { start, end, entity } as NerSpan];
      });

      closeAllUI();
    };

  const deleteCurrentSpan = () => {
    if (spanBox && onDeleteSpan) onDeleteSpan(spanBox.span);
    setLocalSpans((prev) =>
      prev.filter(
        (s) =>
          !(
            s.start === spanBox?.span.start &&
            s.end === spanBox?.span.end &&
            s.entity === spanBox?.span.entity
          )
      )
    );
    closeAllUI();
  };

  /** helpers to close UI */
  const closeAllUI = useCallback(() => {
    setSelBox(null);
    setSpanBox(null);
    setSelMenuAnchor(null);
    setSpanMenuAnchor(null);
    setActiveSpan(null);
    ReactEditor.blur(editor);
  }, [editor]);

  /** close on outside click + Escape */
  useEffect(() => {
    const onGlobalDown = () => {
      if (suppressCloseRef.current) {
        suppressCloseRef.current = false;
        return;
      }
      closeAllUI();
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeAllUI();
    };

    document.addEventListener("mousedown", onGlobalDown, false);
    document.addEventListener("keydown", onKey, false);
    return () => {
      document.removeEventListener("mousedown", onGlobalDown, false);
      document.removeEventListener("keydown", onKey, false);
    };
  }, [closeAllUI]);

  /** close on scroll inside the editor pane */
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onScroll = () => closeAllUI();
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [closeAllUI]);

  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <Slate
        editor={editor}
        initialValue={slateValue}
        onChange={(val) => {
          setSlateValue(val);
          onChange(toPlainTextWithNewlines(val));
          updateSelectionOverlay();
        }}
      >
        <Box
          ref={containerRef}
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
            position: "relative",
          }}
        >
          <Editable
            placeholder={placeholder ?? "Paste text here or upload file"}
            decorate={decorate}
            renderLeaf={renderLeaf}
            spellCheck={false}
            onKeyDown={() => {
              setSelBox(null);
              setSpanBox(null);
              setSelMenuAnchor(null);
              setSpanMenuAnchor(null);
            }}
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

          {/* floating selection "…" button */}
          {selBox && (
            <Tooltip title="Add to category">
              <IconButton
                size="small"
                disableRipple
                disableFocusRipple
                disableTouchRipple
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  suppressCloseRef.current = true;
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelMenuAnchor(e.currentTarget);
                }}
                sx={{
                  position: "absolute",
                  top: selBox.top,
                  left: selBox.left,
                  width: 30,
                  height: 30,
                  borderRadius: "999px",
                  backgroundColor: "#ffffff",
                  border: "1px solid rgba(2,6,23,0.28)",
                  boxShadow:
                    "0 8px 18px rgba(2,6,23,0.22), 0 3px 7px rgba(2,6,23,0.16)",
                  "&:hover": {
                    backgroundColor: "#ffffff",
                    borderColor: "rgba(2,6,23,0.45)",
                  },
                  color: "#0F172A",
                  zIndex: 60,
                }}
              >
                <MoreHorizIcon sx={{ fontSize: 20 }} />
              </IconButton>
            </Tooltip>
          )}

          {/* selection categories menu */}
          <Menu
            anchorEl={selMenuAnchor}
            open={!!selMenuAnchor}
            onClose={() => setSelMenuAnchor(null)}
            MenuListProps={{
              dense: true,
              onMouseDown: (e: React.MouseEvent) => {
                e.stopPropagation();
                suppressCloseRef.current = true;
              },
            }}
            PaperProps={{
              onMouseDown: (e: React.MouseEvent) => {
                e.stopPropagation();
                suppressCloseRef.current = true;
              },
            }}
          >
            {CATEGORY_LIST.map((c) => (
              <MenuItem
                key={c}
                onClick={() =>
                  selBox && pickCategoryForRange(selBox.start, selBox.end)(c)
                }
              >
                <span
                  style={{
                    display: "inline-block",
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: ENTITY_COLORS[c] ?? "#64748B",
                    marginRight: 8,
                  }}
                />
                {c}
              </MenuItem>
            ))}
          </Menu>

          {/* span edit bubble (change category / delete) */}
          {spanBox && (
            <Tooltip title="Edit entity">
              <IconButton
                size="small"
                disableRipple
                disableFocusRipple
                disableTouchRipple
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  suppressCloseRef.current = true;
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setSpanMenuAnchor(e.currentTarget);
                }}
                sx={{
                  position: "absolute",
                  top: spanBox.top,
                  left: spanBox.left,
                  width: 30,
                  height: 30,
                  borderRadius: "999px",
                  backgroundColor: "#ffffff",
                  border: "1px solid rgba(2,6,23,0.28)",
                  boxShadow:
                    "0 8px 18px rgba(2,6,23,0.22), 0 3px 7px rgba(2,6,23,0.16)",
                  "&:hover": {
                    backgroundColor: "#ffffff",
                    borderColor: "rgba(2,6,23,0.45)",
                  },
                  color: "#0F172A",
                  zIndex: 60,
                }}
              >
                <MoreHorizIcon sx={{ fontSize: 20 }} />
              </IconButton>
            </Tooltip>
          )}

          <Menu
            anchorEl={spanMenuAnchor}
            open={!!spanMenuAnchor}
            onClose={() => setSpanMenuAnchor(null)}
            MenuListProps={{
              dense: true,
              onMouseDown: (e: React.MouseEvent) => {
                e.stopPropagation();
                suppressCloseRef.current = true;
              },
            }}
            PaperProps={{
              onMouseDown: (e: React.MouseEvent) => {
                e.stopPropagation();
                suppressCloseRef.current = true;
              },
            }}
          >
            {spanBox &&
              CATEGORY_LIST.map((c) => (
                <MenuItem
                  key={c}
                  onClick={() =>
                    pickCategoryForRange(
                      spanBox.span.start,
                      spanBox.span.end,
                      spanBox.span.entity
                    )(c)
                  }
                >
                  <span
                    style={{
                      display: "inline-block",
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      background: ENTITY_COLORS[c] ?? "#64748B",
                      marginRight: 8,
                    }}
                  />
                  {c}
                </MenuItem>
              ))}
            <Divider />
            <MenuItem
              onClick={deleteCurrentSpan}
              sx={{ color: "#b91c1c", fontWeight: 600 }}
            >
              Delete
            </MenuItem>
          </Menu>
        </Box>
      </Slate>
    </Box>
  );
};

export default NotationEditor;
