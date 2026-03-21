import type { Segment } from "./Segment";
import type { Translation } from "./Workspace";

export interface SessionPatch {
    segments?: Segment[];
    translations?: Translation[];
    text?: string;
}