import { useCallback } from "react";
import type { Operation } from "slate";
import { NEWLINE } from "../../../../shared/constants/notationEditor";
import type { LeafInfo, NerSpan } from "../../../../types/NotationEditor";
import type { Segment } from "../../../../types/Segment";

function adjustForInsert(spans: NerSpan[], pos: number, len: number): NerSpan[] {
  return spans.map(s => {
    if (pos <= s.start) return { ...s, start: s.start + len, end: s.end + len };
    if (pos > s.start && pos < s.end) return { ...s, end: s.end + len };
    return s;
  });
}


function adjustRangeForDelete<T extends { start: number; end: number }>(
  ranges: T[],
  delStart: number,
  delLen: number
): T[] {
  const delEnd = delStart + delLen;
  const next: T[] = [];
  
  for (const range of ranges) {
    if (delEnd <= range.start) {
      next.push({ ...range, start: range.start - delLen, end: range.end - delLen });
      continue;
    }
    
    if (delStart >= range.end) {
      next.push(range);
      continue;
    }
    
    const overlapStart = Math.max(range.start, delStart);
    const overlapEnd = Math.min(range.end, delEnd);
    const removedInside = Math.max(0, overlapEnd - overlapStart);
    
    let newStart = range.start;
    let newEnd = range.end - removedInside;

    if (delStart < range.start) {
      const shift = Math.min(delLen, range.start - delStart);
      newStart -= shift;
      newEnd -= shift;
    }
    
    if (newEnd > newStart) {
      next.push({ ...range, start: newStart, end: newEnd });
    }
  }
  
  return next;
}

function adjustForDelete(spans: NerSpan[], delStart: number, delLen: number): NerSpan[] {
  return adjustRangeForDelete(spans, delStart, delLen);
}

function adjustSegmentForInsert(segments: Segment[], pos: number, len: number): Segment[] {
  return segments.map(seg => {
    if (pos < seg.start) return { ...seg, start: seg.start + len, end: seg.end + len };
    if (pos >= seg.start && pos <= seg.end) return { ...seg, end: seg.end + len };
    return seg;
  });
}

function adjustSegmentForDelete(segments: Segment[], delStart: number, delLen: number): Segment[] {
  return adjustRangeForDelete(segments, delStart, delLen);
}


export function useSpanOperationTransform(
  pointToGlobal: (path: number[], offset: number) => number,
  leafIndex: LeafInfo[] 
) {
  
  const transform = useCallback((
    ops: Operation[], 
    currentSpans: NerSpan[], 
    currentSegments: Segment[]
  ) => {
    let nextSpans = currentSpans;
    let nextSegments = currentSegments;
    
    const relevantOps = ops.filter(op => 
      ['insert_text', 'remove_text', 'split_node', 'merge_node', 'remove_node'].includes(op.type)
    );

    if (relevantOps.length === 0) return { nextSpans, nextSegments };

    nextSpans = [...currentSpans];
    nextSegments = [...currentSegments];

    let lastTextSplitPos: number | null = null;

    for (const op of relevantOps) {
      if (op.type === 'insert_text') {
        const pos = pointToGlobal(op.path, op.offset);
        nextSpans = adjustForInsert(nextSpans, pos, op.text.length);
        nextSegments = adjustSegmentForInsert(nextSegments, pos, op.text.length);
      } 
      else if (op.type === 'remove_text') {
        const pos = pointToGlobal(op.path, op.offset);
        nextSpans = adjustForDelete(nextSpans, pos, op.text.length);
        nextSegments = adjustSegmentForDelete(nextSegments, pos, op.text.length);
      }
      else if (op.type === 'split_node') {
          if (op.path.length > 1) {
              lastTextSplitPos = pointToGlobal(op.path, op.position);
          } 
          else if (op.path.length === 1) {
              let pos = 0;
              if (lastTextSplitPos !== null) {
                  pos = lastTextSplitPos;
              } else {
                  const rowIndex = op.path[0];
                  const leaf = leafIndex.find(l => l.path[0] === rowIndex);
                  pos = leaf ? leaf.gStart : 0;
              }
              
              nextSpans = adjustForInsert(nextSpans, pos, NEWLINE.length);
              nextSegments = adjustSegmentForInsert(nextSegments, pos, NEWLINE.length);
              lastTextSplitPos = null; 
          }
      }
      else if (op.type === 'merge_node' && op.path.length === 1) {
          const rowIndex = op.path[0];
          const leaf = leafIndex.find(l => l.path[0] === rowIndex);
          
          if (leaf) {
              const deletePos = Math.max(0, leaf.gStart - NEWLINE.length);
              nextSpans = adjustForDelete(nextSpans, deletePos, NEWLINE.length);
              nextSegments = adjustSegmentForDelete(nextSegments, deletePos, NEWLINE.length);
          }
      }
      else if (op.type === 'remove_node' && op.path.length === 1) {
          const rowIndex = op.path[0];
          const leaf = leafIndex.find(l => l.path[0] === rowIndex);
          
          if (leaf) {
              const deletePos = Math.max(0, leaf.gStart - NEWLINE.length);
              nextSpans = adjustForDelete(nextSpans, deletePos, NEWLINE.length);
              nextSegments = adjustSegmentForDelete(nextSegments, deletePos, NEWLINE.length);
          }
      }
    }

    return { nextSpans, nextSegments };
  }, [pointToGlobal, leafIndex]); 

  return transform;
}