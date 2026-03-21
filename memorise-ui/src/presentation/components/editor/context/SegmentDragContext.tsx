import React, { createContext, useCallback, useContext, useEffect, useRef } from "react";

export interface SegmentDragState {
  draggingFromIndex: number | null;
}

interface SegmentDragContextValue {
  notifyDragStart: (idx: number) => void;
  notifyDragEnd: () => void;
  setHoveredIdx: (idx: number | null) => void;
  hoveredIdxRef: React.RefObject<number | null>;
  draggingIdxRef: React.RefObject<number | null>;
  registerNode: (idx: number, el: HTMLElement | null) => void;
}

const SegmentDragContext = createContext<SegmentDragContextValue | null>(null);

export const SegmentDragProvider: React.FC<{
  children: React.ReactNode;
  onDraggingChange: (idx: number | null) => void;
  draggingFromIndex: number | null;
}> = ({ children, onDraggingChange, draggingFromIndex }) => {
  const nodeMap = useRef<Map<number, HTMLElement>>(new Map());
  const hoveredIdxRef = useRef<number | null>(null);
  const draggingIdxRef = useRef<number | null>(null);

  const refreshBoundaryVisibility = useCallback(() => {
    const hovered = hoveredIdxRef.current;
    const dragging = draggingIdxRef.current;
    nodeMap.current.forEach((el, idx) => {
      const prevIdx = idx - 1;
      const prevIsHovered = hovered === prevIdx;
      const buttonInThisNode = prevIsHovered && dragging === null;
      el.setAttribute("data-boundary-visible", buttonInThisNode ? "1" : "0");
    });
  }, []);

  useEffect(() => {
    if (draggingFromIndex === null && draggingIdxRef.current !== null) {
      draggingIdxRef.current = null;
      nodeMap.current.forEach((el) => {
        el.removeAttribute("data-dragging");
        el.removeAttribute("data-drop-disabled");
      });
      refreshBoundaryVisibility();
    }
  }, [draggingFromIndex, refreshBoundaryVisibility]);

  const setHoveredIdx = useCallback((idx: number | null) => {
    if (hoveredIdxRef.current === idx) return;
    hoveredIdxRef.current = idx;
    refreshBoundaryVisibility();
  }, [refreshBoundaryVisibility]);

  const notifyDragStart = useCallback((idx: number) => {
    draggingIdxRef.current = idx;
    nodeMap.current.forEach((el, nodeIdx) => {
      el.setAttribute("data-dragging", "1");
      el.setAttribute("data-drop-disabled", nodeIdx <= idx ? "1" : "0");
    });
    onDraggingChange(idx);
    refreshBoundaryVisibility();
  }, [onDraggingChange, refreshBoundaryVisibility]);

  const notifyDragEnd = useCallback(() => {
    draggingIdxRef.current = null;
    nodeMap.current.forEach((el) => {
      el.removeAttribute("data-dragging");
      el.removeAttribute("data-drop-disabled");
    });
    onDraggingChange(null);
    refreshBoundaryVisibility();
  }, [onDraggingChange, refreshBoundaryVisibility]);

  const registerNode = useCallback((idx: number, el: HTMLElement | null) => {
    if (el) {
      nodeMap.current.set(idx, el);
    } else {
      nodeMap.current.delete(idx);
    }
  }, []);

  return (
    <SegmentDragContext.Provider value={{ notifyDragStart, notifyDragEnd, setHoveredIdx, hoveredIdxRef, draggingIdxRef, registerNode }}>
      {children}
    </SegmentDragContext.Provider>
  );
};

export const useSegmentDrag = () => {
  const ctx = useContext(SegmentDragContext);
  if (!ctx) throw new Error("useSegmentDrag must be used inside SegmentDragProvider");
  return ctx;
};
