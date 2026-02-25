
import { useMemo, useCallback } from "react";
import { Node, Path, Text, type Descendant } from "slate";
import { NEWLINE } from "../../../shared/constants/notationEditor";
import type { LeafInfo } from "../../../types/NotationEditor";


export function useGlobalCoordinates(children: Descendant[]) {
  
  const leafIndex = useMemo<LeafInfo[]>(() => {
    const leaves: LeafInfo[] = [];
    let g = 0;
    
    const textEntries = Array.from(Node.texts({ children } as Node));
    
    let prevBlock: Path | null = null;
    
    for (const [node, path] of textEntries) {
      const parent = Path.parent(path);
      
      if (prevBlock && !Path.equals(parent, prevBlock)) {
          g += NEWLINE.length;
      }
      
      const len = (node as Text).text.length;
      leaves.push({ path, gStart: g, gEnd: g + len, len });
      g += len;
      prevBlock = parent;
    }
    return leaves;
  }, [children]); 

  const indexByPath = useMemo(() => {
    const m = new Map<string, LeafInfo>();
    const keyFromPath = (p: number[]) => p.join(".");
    for (const info of leafIndex) m.set(keyFromPath(info.path), info);
    return m;
  }, [leafIndex]);

  const pointToGlobal = useCallback((path: number[], offset: number): number => {
    const key = path.join(".");
    const info = indexByPath.get(key);
    return info ? info.gStart + offset : 0;
  }, [indexByPath]);

  const globalToPoint = useCallback((g: number) => {
    const info = leafIndex.find((lf) => g >= lf.gStart && g <= lf.gEnd);
    if (!info) {
      const last = leafIndex[leafIndex.length - 1];
      return { path: last?.path ?? [0, 0], offset: last ? last.len : 0 };
    }
    const offset = Math.max(0, Math.min(info.len, g - info.gStart));
    return { path: info.path, offset };
  }, [leafIndex]);

  return { indexByPath, pointToGlobal, globalToPoint , leafIndex};
}