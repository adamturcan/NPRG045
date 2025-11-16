import React from "react";

export function useMenuHandlers(opts: {
  suppressCloseRef: React.MutableRefObject<boolean>;
  setSelMenuAnchor: (el: HTMLElement | null) => void;
  setSpanMenuAnchor: (el: HTMLElement | null) => void;
}) {
  const { suppressCloseRef, setSelMenuAnchor, setSpanMenuAnchor } = opts;

  const handleSelectionMouseDown = (e: React.MouseEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    suppressCloseRef.current = true;
  };

  const handleSelectionClick = (e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    setSelMenuAnchor(e.currentTarget);
  };

  const handleSpanMouseDown = (e: React.MouseEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    suppressCloseRef.current = true;
  };

  const handleSpanClick = (e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    setSpanMenuAnchor(e.currentTarget);
  };

  const handleMenuMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    suppressCloseRef.current = true;
  };

  return {
    handleSelectionMouseDown,
    handleSelectionClick,
    handleSpanMouseDown,
    handleSpanClick,
    handleMenuMouseDown,
  };
}


