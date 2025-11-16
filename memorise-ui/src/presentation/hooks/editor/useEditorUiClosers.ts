import { useEffect } from "react";

export function useEditorUiClosers(opts: {
  containerRef: React.RefObject<HTMLDivElement | null>;
  closeAllUI: () => void;
  closeSpanUI: () => void;
  suppressCloseRef: React.MutableRefObject<boolean>;
}) {
  const { containerRef, closeAllUI, closeSpanUI, suppressCloseRef } = opts;

  // Global click + Escape key
  useEffect(() => {
    const onGlobalDown = (e: MouseEvent) => {
      if (suppressCloseRef.current) {
        suppressCloseRef.current = false;
        return;
      }

      const container = containerRef.current;
      if (container && container.contains(e.target as Node)) {
        // Click is within the editor container
        const editable = container.querySelector('[data-slate-editor="true"]');
        if (editable && editable.contains(e.target as Node)) {
          // Click is on the editable text - close span UI so clicks on whitespace dismiss it
          closeSpanUI();
          return;
        }
        // Click is in container but not on text (likely bubble/menu) - let it handle itself
        return;
      }
      // Outside the editor - close all and blur
      closeAllUI();
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        const container = containerRef.current;
        if (container && container.contains(document.activeElement)) {
          closeAllUI();
        }
      }
    };

    document.addEventListener("mousedown", onGlobalDown, false);
    document.addEventListener("keydown", onKey, false);
    return () => {
      document.removeEventListener("mousedown", onGlobalDown, false);
      document.removeEventListener("keydown", onKey, false);
    };
  }, [containerRef, closeAllUI, closeSpanUI, suppressCloseRef]);

  // Close on scroll (bubble positions become invalid)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onScroll = () => closeAllUI();
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [containerRef, closeAllUI]);
}


