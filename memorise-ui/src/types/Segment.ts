export type Segment = {
  id: string;           
  start: number;        
  end: number;          
  text: string;         
  order: number;        
};

export function getSegmentText(segment: Segment, fullText: string): string {
  return fullText.substring(segment.start, segment.end);
}

export function populateSegmentText(segments: Segment[], fullText: string): Segment[] {
  if (!segments || segments.length === 0 || !fullText) {
    return segments;
  }
  return segments.map(segment => {
    if (segment.text) return segment;
    return { ...segment, text: getSegmentText(segment, fullText) };
  });
}