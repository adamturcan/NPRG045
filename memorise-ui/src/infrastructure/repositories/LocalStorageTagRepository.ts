import { readJSON, writeJSON } from "../storage/localStorageHelpers";
import type { TagRepository } from "../../core/interfaces/repositories/TagRepository";
import type { TagItem } from "../../types/Tag";
import { errorHandlingService } from "../services/ErrorHandlingService";

interface TagRecord {
  user: TagItem[];
  api: TagItem[];
}

const TAG_KEY_PREFIX = "memorise.tags.";
const EMPTY_RECORD: TagRecord = {
  user: [],
  api: [],
};
const REPOSITORY_NAME = "LocalStorageTagRepository";

export class LocalStorageTagRepository implements TagRepository {
  async getTags(workspaceId: string): Promise<TagItem[]> {
    return errorHandlingService.withRepositoryError(
      {
        operation: "load tags",
        repository: REPOSITORY_NAME,
        workspaceId,
      },
      () => {
        const record = this.read(workspaceId);
        return [...record.user, ...record.api];
      }
    );
  }

  async getUserTags(workspaceId: string): Promise<TagItem[]> {
    return errorHandlingService.withRepositoryError(
      {
        operation: "load user tags",
        repository: REPOSITORY_NAME,
        workspaceId,
      },
      () => this.read(workspaceId).user
    );
  }

  async getApiTags(workspaceId: string): Promise<TagItem[]> {
    return errorHandlingService.withRepositoryError(
      {
        operation: "load API tags",
        repository: REPOSITORY_NAME,
        workspaceId,
      },
      () => this.read(workspaceId).api
    );
  }

  async addTag(workspaceId: string, tag: TagItem): Promise<void> {
    return errorHandlingService.withRepositoryError(
      {
        operation: "add tag",
        repository: REPOSITORY_NAME,
        workspaceId,
      },
      () => {
        const record = this.read(workspaceId);
        const collection = tag.source === "user" ? record.user : record.api;
        const exists = collection.some((t) => this.equals(t, tag));
        if (!exists) {
          if (tag.source === "user") {
            record.user = [tag, ...record.user];
          } else {
            record.api = [tag, ...record.api];
          }
          this.write(workspaceId, record);
        }
      }
    );
  }

  async removeTag(workspaceId: string, tagName: string): Promise<void> {
    return errorHandlingService.withRepositoryError(
      {
        operation: "remove tag",
        repository: REPOSITORY_NAME,
        workspaceId,
      },
      () => {
        const record = this.read(workspaceId);
        record.user = record.user.filter((tag) => !this.matches(tag, tagName));
        record.api = record.api.filter((tag) => !this.matches(tag, tagName));
        this.write(workspaceId, record);
      }
    );
  }

  async setApiTags(workspaceId: string, tags: TagItem[]): Promise<void> {
    return errorHandlingService.withRepositoryError(
      {
        operation: "set API tags",
        repository: REPOSITORY_NAME,
        workspaceId,
      },
      () => {
        const normalized = tags
          .filter((tag) => tag.source === "api")
          .filter((tag, index, arr) => index === arr.findIndex((t) => this.equals(t, tag)));

        const record = this.read(workspaceId);
        record.api = normalized;
        this.write(workspaceId, record);
      }
    );
  }

  async clearTags(workspaceId: string): Promise<void> {
    return errorHandlingService.withRepositoryError(
      {
        operation: "clear tags",
        repository: REPOSITORY_NAME,
        workspaceId,
      },
      () => {
        this.write(workspaceId, { user: [], api: [] });
      }
    );
  }

  async hasTag(workspaceId: string, tagName: string): Promise<boolean> {
    return errorHandlingService.withRepositoryError(
      {
        operation: "check tag",
        repository: REPOSITORY_NAME,
        workspaceId,
      },
      () => {
        const record = this.read(workspaceId);
        return (
          record.user.some((tag) => this.matches(tag, tagName)) ||
          record.api.some((tag) => this.matches(tag, tagName))
        );
      }
    );
  }

  private read(workspaceId: string): TagRecord {
    const record = readJSON<TagRecord>(this.key(workspaceId), EMPTY_RECORD);
    return {
      user: Array.isArray(record.user) ? record.user : [],
      api: Array.isArray(record.api) ? record.api : [],
    };
  }

  private write(workspaceId: string, record: TagRecord): void {
    writeJSON(this.key(workspaceId), record);
  }

  private key(workspaceId: string): string {
    return `${TAG_KEY_PREFIX}${workspaceId}`;
  }

  private matches(tag: TagItem, tagName: string): boolean {
    if (tag.name !== tagName) return false;
    return true;
  }

  private equals(a: TagItem, b: TagItem): boolean {
    return (
      a.name === b.name &&
      a.source === b.source &&
      a.label === b.label &&
      a.parentId === b.parentId
    );
  }
}


