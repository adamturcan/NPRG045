import { readJSON, writeJSON } from "../storage/localStorageHelpers";
import type { AnnotationRepository } from "../../core/interfaces/repositories/AnnotationRepository";
import type { NerSpan } from "../../types/NotationEditor";

interface AnnotationRecord {
  userSpans: NerSpan[];
  apiSpans: NerSpan[];
  deletedApiKeys: string[];
}

const ANNOTATION_KEY_PREFIX = "memorise.annotations.";
const EMPTY_RECORD: AnnotationRecord = {
  userSpans: [],
  apiSpans: [],
  deletedApiKeys: [],
};

export class LocalStorageAnnotationRepository implements AnnotationRepository {
  async getUserSpans(workspaceId: string): Promise<NerSpan[]> {
    return this.read(workspaceId).userSpans;
  }

  async getApiSpans(workspaceId: string): Promise<NerSpan[]> {
    return this.read(workspaceId).apiSpans;
  }

  async getDeletedApiKeys(workspaceId: string): Promise<string[]> {
    return this.read(workspaceId).deletedApiKeys;
  }

  async addUserSpan(workspaceId: string, span: NerSpan): Promise<void> {
    const record = this.read(workspaceId);
    const key = this.spanKey(span);
    if (!record.userSpans.some((existing) => this.spanKey(existing) === key)) {
      record.userSpans = [...record.userSpans, span];
      record.deletedApiKeys = record.deletedApiKeys.filter((k) => k !== key);
      this.write(workspaceId, record);
    }
  }

  async removeUserSpan(workspaceId: string, spanKey: string): Promise<void> {
    const record = this.read(workspaceId);
    record.userSpans = record.userSpans.filter((span) => this.spanKey(span) !== spanKey);
    this.write(workspaceId, record);
  }

  async setApiSpans(workspaceId: string, spans: NerSpan[]): Promise<void> {
    const record = this.read(workspaceId);
    record.apiSpans = spans;
    record.deletedApiKeys = [];
    this.write(workspaceId, record);
  }

  async markApiSpanDeleted(workspaceId: string, spanKey: string): Promise<void> {
    const record = this.read(workspaceId);
    if (!record.deletedApiKeys.includes(spanKey)) {
      record.deletedApiKeys = [...record.deletedApiKeys, spanKey];
      this.write(workspaceId, record);
    }
  }

  async clearApiSpans(workspaceId: string): Promise<void> {
    const record = this.read(workspaceId);
    record.apiSpans = [];
    record.deletedApiKeys = [];
    this.write(workspaceId, record);
  }

  async getActiveAnnotations(workspaceId: string): Promise<NerSpan[]> {
    const record = this.read(workspaceId);
    const deleted = new Set(record.deletedApiKeys);
    const visibleApiSpans = record.apiSpans.filter(
      (span) => !deleted.has(this.spanKey(span))
    );
    return [...visibleApiSpans, ...record.userSpans];
  }

  private read(workspaceId: string): AnnotationRecord {
    const record = readJSON<AnnotationRecord>(
      this.key(workspaceId),
      EMPTY_RECORD
    );
    return {
      userSpans: Array.isArray(record.userSpans) ? record.userSpans : [],
      apiSpans: Array.isArray(record.apiSpans) ? record.apiSpans : [],
      deletedApiKeys: Array.isArray(record.deletedApiKeys) ? record.deletedApiKeys : [],
    };
  }

  private write(workspaceId: string, record: AnnotationRecord): void {
    writeJSON(this.key(workspaceId), record);
  }

  private key(workspaceId: string): string {
    return `${ANNOTATION_KEY_PREFIX}${workspaceId}`;
  }

  private spanKey(span: NerSpan): string {
    return `${span.start}:${span.end}:${span.entity}`;
  }
}


