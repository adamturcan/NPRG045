import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { WorkspaceRepository } from '@/core/interfaces/repositories/WorkspaceRepository';
import type { AnnotationRepository } from '@/core/interfaces/repositories/AnnotationRepository';
import type { TagRepository } from '@/core/interfaces/repositories/TagRepository';
import { Workspace } from '@/core/entities/Workspace';
import {
  getWorkspaceApplicationService,
  resetWorkspaceProvider,
  setWorkspaceProviderOverrides,
} from '@/infrastructure/providers/workspaceProvider';
import {
  getAnnotationUseCases,
  resetAnnotationProvider,
  setAnnotationProviderOverrides,
} from '@/infrastructure/providers/annotationProvider';
import type { NerSpan } from '@/types/NotationEditor';
import type { TagItem } from '@/types/Tag';
import {
  getTagUseCases,
  resetTagProvider,
  setTagProviderOverrides,
} from '@/infrastructure/providers/tagProvider';

class InMemoryWorkspaceRepository implements WorkspaceRepository {
  private readonly workspaces = new Map<string, Workspace>();

  async findById(id: string): Promise<Workspace | null> {
    return this.workspaces.get(id) ?? null;
  }

  async findByOwner(ownerId: string): Promise<Workspace[]> {
    return Array.from(this.workspaces.values()).filter((workspace) => workspace.owner === ownerId);
  }

  async findAll(): Promise<Workspace[]> {
    return Array.from(this.workspaces.values());
  }

  async save(workspace: Workspace): Promise<void> {
    this.workspaces.set(workspace.id, workspace);
  }

  async delete(id: string): Promise<void> {
    this.workspaces.delete(id);
  }

  async exists(id: string): Promise<boolean> {
    return this.workspaces.has(id);
  }
}

describe('Integration: provider wiring', () => {
  describe('workspace lifecycle', () => {
    let repository: InMemoryWorkspaceRepository;

    beforeEach(() => {
      repository = new InMemoryWorkspaceRepository();
      setWorkspaceProviderOverrides({ repository });
    });

    afterEach(() => {
      resetWorkspaceProvider();
    });

    it('runs create → update → sync → delete through the application service', async () => {
      const ownerId = 'owner-123';
      const service = getWorkspaceApplicationService();

      const created = await service.createWorkspace({
        ownerId,
        name: 'Initial Workspace',
        text: 'Draft text',
      });

      expect(created.id).toBeTruthy();
      expect(created.owner).toBe(ownerId);

      const storedAfterCreate = await repository.findById(created.id!);
      expect(storedAfterCreate).not.toBeNull();
      expect(storedAfterCreate!.text).toBe('Draft text');

      const updated = await service.updateWorkspace({
        workspaceId: created.id!,
        patch: {
          name: 'Updated Workspace',
          text: 'Refined content',
          tags: [
            {
              name: 'research',
              source: 'user',
            },
          ],
          updatedAt: 1_735_000_000_000,
        },
      });

      expect(updated).not.toBeNull();
      expect(updated!.name).toBe('Updated Workspace');

      const synced = await service.syncWorkspaceTranslations({
        workspaceId: created.id!,
        translations: [
          {
            language: 'es',
            text: 'hola mundo',
            sourceLang: 'en',
            createdAt: 1_735_000_000_000,
            updatedAt: 1_735_000_100_000,
            userSpans: [],
            apiSpans: [],
            deletedApiKeys: [],
          },
        ],
      });

      expect(synced).not.toBeNull();
      expect(synced!.translations).toHaveLength(1);
      expect(synced!.translations?.[0]?.language).toBe('es');

      const storedAfterSync = await repository.findById(created.id!);
      expect(storedAfterSync!.translations).toHaveLength(1);
      expect(storedAfterSync!.translations[0].language).toBe('es');

      await service.deleteWorkspace(created.id!);

      expect(await repository.findById(created.id!)).toBeNull();
      expect(await service.loadForOwner(ownerId)).toHaveLength(0);
    });
  });

  describe('annotation flows', () => {
    class InMemoryAnnotationRepository implements AnnotationRepository {
      private readonly store = new Map<
        string,
        { user: NerSpan[]; api: NerSpan[]; deletedApiKeys: string[] }
      >();

      constructor() {
        this.store.set('workspace-test', {
          user: [],
          api: [
            {
              start: 0,
              end: 5,
              entity: 'ORG',
              score: 0.9,
            },
          ],
          deletedApiKeys: [],
        });
      }

      private ensure(workspaceId: string) {
        if (!this.store.has(workspaceId)) {
          this.store.set(workspaceId, { user: [], api: [], deletedApiKeys: [] });
        }
        return this.store.get(workspaceId)!;
      }

      private spanKey(span: NerSpan): string {
        return `${span.start}:${span.end}:${span.entity}`;
      }

      async getUserSpans(workspaceId: string): Promise<NerSpan[]> {
        return [...this.ensure(workspaceId).user];
      }

      async getApiSpans(workspaceId: string): Promise<NerSpan[]> {
        return [...this.ensure(workspaceId).api];
      }

      async getDeletedApiKeys(workspaceId: string): Promise<string[]> {
        return [...this.ensure(workspaceId).deletedApiKeys];
      }

      async addUserSpan(workspaceId: string, span: NerSpan): Promise<void> {
        const record = this.ensure(workspaceId);
        const key = this.spanKey(span);
        if (!record.user.some((existing) => this.spanKey(existing) === key)) {
          record.user.push(span);
          record.deletedApiKeys = record.deletedApiKeys.filter((deleted) => deleted !== key);
        }
      }

      async removeUserSpan(workspaceId: string, spanKey: string): Promise<void> {
        const record = this.ensure(workspaceId);
        record.user = record.user.filter((span) => this.spanKey(span) !== spanKey);
      }

      async setApiSpans(workspaceId: string, spans: NerSpan[]): Promise<void> {
        const record = this.ensure(workspaceId);
        record.api = [...spans];
        record.deletedApiKeys = [];
      }

      async markApiSpanDeleted(workspaceId: string, spanKey: string): Promise<void> {
        const record = this.ensure(workspaceId);
        if (!record.deletedApiKeys.includes(spanKey)) {
          record.deletedApiKeys.push(spanKey);
        }
      }

      async clearApiSpans(workspaceId: string): Promise<void> {
        const record = this.ensure(workspaceId);
        record.api = [];
        record.deletedApiKeys = [];
      }

      async getActiveAnnotations(workspaceId: string): Promise<NerSpan[]> {
        const record = this.ensure(workspaceId);
        const deleted = new Set(record.deletedApiKeys);
        const activeApi = record.api.filter((span) => !deleted.has(this.spanKey(span)));
        return [...record.user, ...activeApi];
      }
    }

    beforeEach(() => {
      setAnnotationProviderOverrides({
        repository: new InMemoryAnnotationRepository(),
      });
    });

    afterEach(() => {
      resetAnnotationProvider();
    });

    it('adds user annotations and clears API spans through provider use cases', async () => {
      const workspaceId = 'workspace-test';
      const { addUserAnnotation, getAnnotations, clearApiAnnotations } = getAnnotationUseCases();

      const initial = await getAnnotations.execute({ workspaceId });
      expect(initial.apiSpans).toHaveLength(1);
      expect(initial.userSpans).toHaveLength(0);

      await addUserAnnotation.execute({
        workspaceId,
        span: {
          start: 10,
          end: 20,
          entity: 'PERSON',
          score: 0.95,
        },
      });

      const afterAdd = await getAnnotations.execute({ workspaceId });
      expect(afterAdd.userSpans).toHaveLength(1);
      expect(afterAdd.activeSpans).toHaveLength(2);

      await clearApiAnnotations.execute({ workspaceId });

      const afterClear = await getAnnotations.execute({ workspaceId });
      expect(afterClear.apiSpans).toHaveLength(0);
      expect(afterClear.activeSpans).toHaveLength(1);
      expect(afterClear.deletedApiKeys).toHaveLength(0);
    });
  });

  describe('tagging flow', () => {
    class InMemoryTagRepository implements TagRepository {
      private readonly store = new Map<string, { user: TagItem[]; api: TagItem[] }>();

      private ensure(workspaceId: string) {
        if (!this.store.has(workspaceId)) {
          this.store.set(workspaceId, { user: [], api: [] });
        }
        return this.store.get(workspaceId)!;
      }

      async getTags(workspaceId: string): Promise<TagItem[]> {
        const record = this.ensure(workspaceId);
        return [...record.user, ...record.api];
      }

      async getUserTags(workspaceId: string): Promise<TagItem[]> {
        return [...this.ensure(workspaceId).user];
      }

      async getApiTags(workspaceId: string): Promise<TagItem[]> {
        return [...this.ensure(workspaceId).api];
      }

      async addTag(workspaceId: string, tag: TagItem): Promise<void> {
        const record = this.ensure(workspaceId);
        const collection = tag.source === 'user' ? record.user : record.api;
        if (!collection.some((existing) => this.equals(existing, tag))) {
          collection.push(tag);
        }
      }

      async removeTag(workspaceId: string, tagName: string): Promise<void> {
        const record = this.ensure(workspaceId);
        record.user = record.user.filter((tag) => !this.matches(tag, tagName));
        record.api = record.api.filter((tag) => !this.matches(tag, tagName));
      }

      async setApiTags(workspaceId: string, tags: TagItem[]): Promise<void> {
        const record = this.ensure(workspaceId);
        record.api = tags.filter((tag) => tag.source === 'api');
      }

      async clearTags(workspaceId: string): Promise<void> {
        this.store.set(workspaceId, { user: [], api: [] });
      }

      async hasTag(workspaceId: string, tagName: string): Promise<boolean> {
        const record = this.ensure(workspaceId);
        return (
          record.user.some((tag) => this.matches(tag, tagName)) ||
          record.api.some((tag) => this.matches(tag, tagName))
        );
      }

      private matches(tag: TagItem, tagName: string): boolean {
        return tag.name === tagName;
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

    const workspaceId = 'workspace-tags';
    let repository: InMemoryTagRepository;

    beforeEach(() => {
      repository = new InMemoryTagRepository();
      setTagProviderOverrides({ repository });
    });

    afterEach(() => {
      resetTagProvider();
    });

    it('adds tags and surfaces AppError for duplicates via provider use case', async () => {
      const { addTag } = getTagUseCases();

      await addTag.execute({
        workspaceId,
        tag: {
          name: 'Research',
          source: 'user',
        },
      });

      await expect(
        addTag.execute({
          workspaceId,
          tag: {
            name: 'Research',
            source: 'api',
          },
        })
      ).rejects.toMatchObject({
        code: 'TAG_ALREADY_EXISTS',
      });

      await addTag.execute({
        workspaceId,
        tag: {
          name: 'Science',
          source: 'user',
        },
      });

      await expect(repository.getTags(workspaceId)).resolves.toHaveLength(2);
      await expect(repository.getUserTags(workspaceId)).resolves.toHaveLength(2);
    });
  });
});


