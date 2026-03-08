import type { Extension } from "@codemirror/state";
import { Annotation } from "@codemirror/state";

export const intentionalTextReplace = Annotation.define<boolean>();

export const createSpanProtectionFilter = (): Extension => [];