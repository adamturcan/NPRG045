import type { NerSpan } from "./NotationEditor";

export type AnnotationLayer = {
    text: string;
    userSpans: NerSpan[];
    apiSpans: NerSpan[];
    segmentTranslations?: Record<string, string>;
    editedSegmentTranslations?: Record<string, boolean>;
};
