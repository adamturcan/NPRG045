export function posFromDomRange(domRange: globalThis.Range, containerRect: DOMRect) {
    const rects = Array.from(domRange.getClientRects());
    const r = rects.length > 0 ? rects[rects.length - 1] : domRange.getBoundingClientRect();
    const leftRaw = r.right - containerRect.left + 6;
    const topRaw = r.top - containerRect.top - 32;
    const left = Math.max(6, Math.min(leftRaw, containerRect.width - 36));
    const top = Math.max(6, topRaw);
    return { left, top, width: r.width, height: r.height };
  }