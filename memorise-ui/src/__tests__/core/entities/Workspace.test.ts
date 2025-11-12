import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Workspace, WorkspaceTranslation } from '@/core/entities/Workspace';
import { Tag } from '@/core/entities/Tag';

const baseWorkspace = () =>
  Workspace.create({
    id: 'ws-1',
    name: 'Workspace',
    owner: 'owner-1',
  });

describe('Workspace aggregate', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it('requires id, name, and owner', () => {
    expect(() => Workspace.create({ id: '', name: 'name', owner: 'owner' })).toThrow(
      'Workspace id is required'
    );
    expect(() => Workspace.create({ id: 'id', name: '', owner: 'owner' })).toThrow(
      'Workspace name is required'
    );
    expect(() => Workspace.create({ id: 'id', name: 'name', owner: '' })).toThrow(
      'Workspace owner is required'
    );
  });

  it('defaults optional fields', () => {
    const workspace = baseWorkspace();
    expect(workspace.text).toBe('');
    expect(workspace.isTemporary).toBe(false);
    expect(workspace.userSpans).toEqual([]);
    expect(workspace.translations).toEqual([]);
  });

  it('updates text immutably and bumps timestamp', () => {
    const workspace = baseWorkspace();
    vi.useFakeTimers();
    vi.setSystemTime(123);

    const updated = workspace.withText('Hello');
    expect(updated.text).toBe('Hello');
    expect(updated.updatedAt).toBe(123);
    expect(workspace.text).toBe('');
  });

  it('marks as permanent without changing timestamp for already permanent', () => {
    const temp = Workspace.create({ id: 'id', name: 'name', owner: 'owner', isTemporary: true });
    const permanent = temp.markAsPermanent();
    expect(permanent.isTemporary).toBe(false);
    const already = permanent.markAsPermanent();
    expect(already).toBe(permanent);
  });

  it('manages spans immutably', () => {
    const workspace = baseWorkspace();
    const withUser = workspace.withUserSpans([{ start: 0, end: 1, entity: 'A' }]);
    expect(withUser.userSpans).toHaveLength(1);

    const withApi = withUser.withApiSpans([{ start: 1, end: 2, entity: 'B' }]);
    expect(withApi.apiSpans).toHaveLength(1);
    expect(workspace.userSpans).toEqual([]);
  });

  it('deduplicates tags when adding', () => {
    const tag = Tag.create({ name: 'culture', source: 'user' });
    const workspace = baseWorkspace().addTag(tag).addTag(tag);
    expect(workspace.tags).toHaveLength(1);
  });

  it('upserts translations and updates them immutably', () => {
    const translation = WorkspaceTranslation.create({
      language: 'cs',
      text: 'Ahoj',
    });

    const workspace = baseWorkspace().upsertTranslation(translation);
    expect(workspace.translations).toHaveLength(1);

    const updated = workspace.updateTranslation('cs', (t) => t.withText('Nazdar'));
    expect(updated.getTranslation('cs')?.text).toBe('Nazdar');
    expect(() => updated.updateTranslation('da', (t) => t)).toThrow(
      'Translation da not found in workspace ws-1'
    );
  });

  it('removes translations', () => {
    const translation = WorkspaceTranslation.create({ language: 'en' });
    const workspace = baseWorkspace().upsertTranslation(translation);
    const next = workspace.removeTranslation('en');
    expect(next.translations).toHaveLength(0);
  });

  it('sets translations via withTranslations while deduplicating languages', () => {
    const cs = WorkspaceTranslation.create({ language: 'cs', text: 'Ahoj' });
    const en = WorkspaceTranslation.create({ language: 'en', text: 'Hello' });

    const workspace = baseWorkspace().withTranslations([cs, en, cs]);
    expect(workspace.translations).toHaveLength(2);
    expect(workspace.getTranslation('cs')).toBe(cs);
    expect(workspace.getTranslation('en')).toBe(en);
  });
});


