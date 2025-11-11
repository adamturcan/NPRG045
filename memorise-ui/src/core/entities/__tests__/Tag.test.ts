import { describe, it, expect } from 'vitest';
import { Tag } from '../Tag';
import type { TagItem } from '../../../types/Tag';

describe('Tag value object', () => {
  it('creates user tag without label', () => {
    const tag = Tag.create({ name: 'culture', source: 'user' });
    expect(tag.name).toBe('culture');
    expect(tag.source).toBe('user');
    expect(tag.label).toBeUndefined();
  });

  it('creates api tag with label and parentId', () => {
    const tag = Tag.create({ name: 'history', source: 'api', label: 10, parentId: 5 });
    expect(tag.label).toBe(10);
    expect(tag.parentId).toBe(5);
  });

  it('trims tag name', () => {
    const tag = Tag.create({ name: '  science  ', source: 'user' });
    expect(tag.name).toBe('science');
  });

  it('validates non-empty name', () => {
    expect(() => Tag.create({ name: '', source: 'user' })).toThrow('Tag name is required');
  });

  it('converts to and from TagItem', () => {
    const item: TagItem = { name: 'ai', source: 'api', label: 42 };
    const tag = Tag.fromTagItem(item);
    expect(tag.toTagItem()).toEqual(item);
  });

  it('compares equality based on identity fields', () => {
    const a = Tag.create({ name: 'art', source: 'user' });
    const b = Tag.create({ name: 'art', source: 'user' });
    const c = Tag.create({ name: 'art', source: 'api', label: 1 });

    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
  });
});


