import { useCallback, useState } from "react";
import { Editor, Range, Transforms } from "slate";
import { ReactEditor } from "slate-react";
import type { NerSpan } from "../../../types/NotationEditor";

export function useDeletionDialogs(params: {
  editor: Editor;
  globalToPoint: (g: number) => { path: number[]; offset: number };
  onDeleteSpan?: (s: NerSpan) => void;
  setLocalSpans: React.Dispatch<React.SetStateAction<NerSpan[]>>;
  closeAllUI: () => void;
}) {
  const { editor, globalToPoint, onDeleteSpan, setLocalSpans, closeAllUI } = params;

  const [pendingDeletion, setPendingDeletion] = useState<NerSpan | null>(null);
  const [pendingMultiDeletion, setPendingMultiDeletion] = useState<NerSpan[]>([]);
  const [pendingCharInsertion, setPendingCharInsertion] = useState<{
    char: string;
    selection: { start: number; end: number };
  } | null>(null);
  const [pendingPasteOperation, setPendingPasteOperation] = useState<{
    type: "paste" | "cut";
    selection: { start: number; end: number };
  } | null>(null);

  const getSpanText = useCallback(
    (span: NerSpan): string => {
      try {
        const startPoint = globalToPoint(span.start);
        const endPoint = globalToPoint(span.end);
        const range: Range = { anchor: startPoint, focus: endPoint };
        return Editor.string(editor, range);
      } catch {
        return "";
      }
    },
    [editor, globalToPoint]
  );

  const getSpanTexts = useCallback(
    (spans: NerSpan[]): Map<string, string> => {
      const texts = new Map<string, string>();
      const keyOfSpan = (s: NerSpan) => `${s.start}:${s.end}:${s.entity}`;
      spans.forEach((span) => {
        const key = keyOfSpan(span);
        const text = getSpanText(span);
        texts.set(key, text);
      });
      return texts;
    },
    [getSpanText]
  );

  const requestDeleteSpan = useCallback(
    (spanToDelete: NerSpan) => {
      setPendingDeletion(spanToDelete);
      closeAllUI();
    },
    [closeAllUI]
  );

  const confirmDeleteSpan = useCallback(() => {
    if (!pendingDeletion) return;
    if (onDeleteSpan) onDeleteSpan(pendingDeletion);
    setLocalSpans((prev) =>
      prev.filter(
        (s) =>
          !(
            s.start === pendingDeletion.start &&
            s.end === pendingDeletion.end &&
            s.entity === pendingDeletion.entity
          )
      )
    );
    setPendingDeletion(null);
  }, [pendingDeletion, onDeleteSpan, setLocalSpans]);

  const cancelDeleteSpan = useCallback(() => {
    setPendingDeletion(null);
  }, []);

  const requestMultiDeleteSpans = useCallback(
    (
      spansToDelete: NerSpan[],
      charToInsert?: { char: string; selection: { start: number; end: number } },
      pasteOperation?: {
        type: "paste" | "cut";
        selection: { start: number; end: number };
      }
    ) => {
      setPendingMultiDeletion(spansToDelete);
      setPendingCharInsertion(charToInsert || null);
      setPendingPasteOperation(pasteOperation || null);
      closeAllUI();
    },
    [closeAllUI]
  );

  const confirmMultiDeleteSpans = useCallback(
    (selectedSpans: NerSpan[]) => {
      if (selectedSpans.length === 0) {
        setPendingMultiDeletion([]);
        setPendingCharInsertion(null);
        return;
      }

      // Delete via external callback
      selectedSpans.forEach((span) => {
        if (onDeleteSpan) onDeleteSpan(span);
      });

      // Remove from local state
      setLocalSpans((prev) => {
        let updated = prev;
        selectedSpans.forEach((spanToDelete) => {
          updated = updated.filter(
            (s) =>
              !(
                s.start === spanToDelete.start &&
                s.end === spanToDelete.end &&
                s.entity === spanToDelete.entity
              )
          );
        });
        return updated;
      });

      const charInsert = pendingCharInsertion;
      const pasteOp = pendingPasteOperation;
      setPendingMultiDeletion([]);
      setPendingCharInsertion(null);
      setPendingPasteOperation(null);

      // Following operations run after deletion
      if (charInsert) {
        setTimeout(() => {
          try {
            const startPoint = globalToPoint(charInsert.selection.start);
            const endPoint = globalToPoint(charInsert.selection.end);
            ReactEditor.focus(editor);
            Transforms.select(editor, {
              anchor: startPoint,
              focus: endPoint,
            });
            Transforms.insertText(editor, charInsert.char);
          } catch {
            // allow manual typing if insertion fails
          }
        }, 0);
      }

      if (pasteOp && pasteOp.type === "paste") {
        setTimeout(async () => {
          try {
            const startPoint = globalToPoint(pasteOp.selection.start);
            const endPoint = globalToPoint(pasteOp.selection.end);
            ReactEditor.focus(editor);
            Transforms.select(editor, {
              anchor: startPoint,
              focus: endPoint,
            });
            const text = await navigator.clipboard.readText();
            Transforms.insertText(editor, text);
          } catch {
            try {
              const startPoint = globalToPoint(pasteOp.selection.start);
              const endPoint = globalToPoint(pasteOp.selection.end);
              ReactEditor.focus(editor);
              Transforms.select(editor, {
                anchor: startPoint,
                focus: endPoint,
              });
              document.execCommand("paste");
            } catch {
              // allow manual paste
            }
          }
        }, 0);
      }

      if (pasteOp && pasteOp.type === "cut") {
        setTimeout(async () => {
          try {
            const startPoint = globalToPoint(pasteOp.selection.start);
            const endPoint = globalToPoint(pasteOp.selection.end);
            const selectionRange = {
              anchor: startPoint,
              focus: endPoint,
            };
            const selectedText = Editor.string(editor, selectionRange);
            ReactEditor.focus(editor);
            Transforms.select(editor, selectionRange);
            await navigator.clipboard.writeText(selectedText);
            Transforms.delete(editor);
          } catch {
            try {
              const startPoint = globalToPoint(pasteOp.selection.start);
              const endPoint = globalToPoint(pasteOp.selection.end);
              const selectionRange = {
                anchor: startPoint,
                focus: endPoint,
              };
              ReactEditor.focus(editor);
              Transforms.select(editor, selectionRange);
              document.execCommand("copy");
              Transforms.delete(editor);
            } catch {
              // allow manual cut
            }
          }
        }, 0);
      }
    },
    [editor, globalToPoint, onDeleteSpan, pendingCharInsertion, pendingPasteOperation, setLocalSpans]
  );

  const cancelMultiDeleteSpans = useCallback(() => {
    setPendingMultiDeletion([]);
    setPendingCharInsertion(null);
    setPendingPasteOperation(null);
  }, []);

  return {
    // state
    pendingDeletion,
    pendingMultiDeletion,
    // helpers
    getSpanText,
    getSpanTexts,
    // actions
    requestDeleteSpan,
    confirmDeleteSpan,
    cancelDeleteSpan,
    requestMultiDeleteSpans,
    confirmMultiDeleteSpans,
    cancelMultiDeleteSpans,
  };
}


