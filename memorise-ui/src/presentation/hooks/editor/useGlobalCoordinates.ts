import { useMemo, useCallback } from "react";
import { Editor, Path, Point, Text } from "slate";
import type { LeafInfo } from "../../../types/NotationEditor";
import { NEWLINE } from "../../../shared/constants/notationEditor";

export function useGlobalCoordinates(editor: Editor, slateValue: unknown[]) {
  const leafIndex = useMemo<LeafInfo[]>(() => {
    const leaves: LeafInfo[] = [];
    let g = 0;
    let prevBlock: Path | null = null;
    for (const [node, path] of Editor.nodes(editor, { at: [], match: Text.isText })) {
      const parent = Path.parent(path);
      if (prevBlock && !Path.equals(parent, prevBlock)) g += NEWLINE.length;
      const len = (node as Text).text.length;
      leaves.push({ path, gStart: g, gEnd: g + len, len });
      g += len;
      prevBlock = parent;
    }
    return leaves;
  }, [editor, slateValue]);

  const indexByPath = useMemo(() => {
    const m = new Map<string, LeafInfo>();
    const keyFromPath = (p: number[]) => p.join(".");
    for (const info of leafIndex) m.set(keyFromPath(info.path), info);
    return m;
  }, [leafIndex]);

  const keyFromPath = (p: number[]) => p.join(".");

  const pointToGlobal = useCallback((path: Path, offset: number): number => {
    const info = indexByPath.get(keyFromPath(path));
    return info ? info.gStart + offset : 0;
  }, [indexByPath]);

  const globalToPoint = useCallback((g: number): Point => {
    const info = leafIndex.find((lf) => g >= lf.gStart && g <= lf.gEnd);
    if (!info) {
      const last = leafIndex[leafIndex.length - 1];
      return { path: last?.path ?? [0, 0], offset: Math.max(0, (last?.len ?? 1) - 1) };
    }
    const offset = Math.max(0, Math.min(info.len, g - info.gStart));
    return { path: info.path, offset };
  }, [leafIndex]);

  return { indexByPath, pointToGlobal, globalToPoint };
}