import { describe, it, expect } from 'vitest';
import { Tag } from '../Tag';
import type { TagItem } from '../../types/Tag';

describe('Tag Domain Model', () => {
  describe('Constructor', () => {
    it('should create a user tag without label', () => {
      const tag = new Tag('culture', 'user');

      expect(tag.name).toBe('culture');
      expect(tag.source).toBe('user');
      expect(tag.label).toBeUndefined();
      expect(tag.parentId).toBeUndefined();
    });

    it('should create an API tag with label', () => {
      const tag = new Tag('education', 'api', 12345);

      expect(tag.name).toBe('education');
      expect(tag.source).toBe('api');
      expect(tag.label).toBe(12345);
      expect(tag.parentId).toBeUndefined();
    });

    it('should create an API tag with label and parentId', () => {
      const tag = new Tag('history', 'api', 67890, 11111);

      expect(tag.name).toBe('history');
      expect(tag.source).toBe('api');
      expect(tag.label).toBe(67890);
      expect(tag.parentId).toBe(11111);
    });

    it('should trim whitespace from tag name', () => {
      const tag = new Tag('  science  ', 'user');
      expect(tag.name).toBe('science');
    });

    it('should throw error if name is empty string', () => {
      expect(() => new Tag('', 'user')).toThrow('Tag name is required');
    });

    it('should throw error if name is only whitespace', () => {
      expect(() => new Tag('   ', 'user')).toThrow('Tag name is required');
    });

    it('should accept tag with special characters', () => {
      const tag = new Tag('AI/ML', 'user');
      expect(tag.name).toBe('AI/ML');
    });

    it('should accept tag with numbers', () => {
      const tag = new Tag('Web3.0', 'user');
      expect(tag.name).toBe('Web3.0');
    });
  });

  describe('fromTagItem', () => {
    it('should create tag from TagItem without label', () => {
      const tagItem: TagItem = {
        name: 'technology',
        source: 'user',
      };

      const tag = Tag.fromTagItem(tagItem);

      expect(tag.name).toBe('technology');
      expect(tag.source).toBe('user');
      expect(tag.label).toBeUndefined();
      expect(tag.parentId).toBeUndefined();
    });

    it('should create tag from TagItem with label', () => {
      const tagItem: TagItem = {
        name: 'philosophy',
        source: 'api',
        label: 99999,
      };

      const tag = Tag.fromTagItem(tagItem);

      expect(tag.name).toBe('philosophy');
      expect(tag.source).toBe('api');
      expect(tag.label).toBe(99999);
      expect(tag.parentId).toBeUndefined();
    });

    it('should create tag from TagItem with label and parentId', () => {
      const tagItem: TagItem = {
        name: 'mathematics',
        source: 'api',
        label: 55555,
        parentId: 44444,
      };

      const tag = Tag.fromTagItem(tagItem);

      expect(tag.name).toBe('mathematics');
      expect(tag.source).toBe('api');
      expect(tag.label).toBe(55555);
      expect(tag.parentId).toBe(44444);
    });

    it('should throw validation errors from constructor', () => {
      const invalidTagItem: TagItem = {
        name: '   ',
        source: 'user',
      };

      expect(() => Tag.fromTagItem(invalidTagItem)).toThrow('Tag name is required');
    });
  });

  describe('toTagItem', () => {
    it('should convert tag to TagItem without label', () => {
      const tag = new Tag('literature', 'user');
      const tagItem = tag.toTagItem();

      expect(tagItem).toEqual({
        name: 'literature',
        source: 'user',
        label: undefined,
        parentId: undefined,
      });
    });

    it('should convert tag to TagItem with label', () => {
      const tag = new Tag('biology', 'api', 77777);
      const tagItem = tag.toTagItem();

      expect(tagItem).toEqual({
        name: 'biology',
        source: 'api',
        label: 77777,
        parentId: undefined,
      });
    });

    it('should convert tag to TagItem with label and parentId', () => {
      const tag = new Tag('chemistry', 'api', 88888, 99999);
      const tagItem = tag.toTagItem();

      expect(tagItem).toEqual({
        name: 'chemistry',
        source: 'api',
        label: 88888,
        parentId: 99999,
      });
    });

    it('should create a round-trip conversion', () => {
      const originalTagItem: TagItem = {
        name: 'physics',
        source: 'api',
        label: 12121,
        parentId: 21212,
      };

      const tag = Tag.fromTagItem(originalTagItem);
      const resultTagItem = tag.toTagItem();

      expect(resultTagItem).toEqual(originalTagItem);
    });
  });

  describe('equals', () => {
    it('should return true for tags with same name, label, and parentId', () => {
      const tag1 = new Tag('science', 'api', 100, 200);
      const tag2 = new Tag('science', 'api', 100, 200);

      expect(tag1.equals(tag2)).toBe(true);
    });

    it('should return true for tags with same name and no label/parentId', () => {
      const tag1 = new Tag('art', 'user');
      const tag2 = new Tag('art', 'user');

      expect(tag1.equals(tag2)).toBe(true);
    });

    it('should return false for tags with different names', () => {
      const tag1 = new Tag('music', 'user');
      const tag2 = new Tag('dance', 'user');

      expect(tag1.equals(tag2)).toBe(false);
    });

    it('should return false for tags with different labels', () => {
      const tag1 = new Tag('history', 'api', 100);
      const tag2 = new Tag('history', 'api', 200);

      expect(tag1.equals(tag2)).toBe(false);
    });

    it('should return false for tags with different parentIds', () => {
      const tag1 = new Tag('geography', 'api', 100, 500);
      const tag2 = new Tag('geography', 'api', 100, 600);

      expect(tag1.equals(tag2)).toBe(false);
    });

    it('should return false when one has label and other does not', () => {
      const tag1 = new Tag('economics', 'api', 100);
      const tag2 = new Tag('economics', 'user');

      expect(tag1.equals(tag2)).toBe(false);
    });

    it('should return false when one has parentId and other does not', () => {
      const tag1 = new Tag('sociology', 'api', 100, 200);
      const tag2 = new Tag('sociology', 'api', 100);

      expect(tag1.equals(tag2)).toBe(false);
    });

    it('should be case-sensitive for name comparison', () => {
      const tag1 = new Tag('Culture', 'user');
      const tag2 = new Tag('culture', 'user');

      expect(tag1.equals(tag2)).toBe(false);
    });

    it('should handle undefined vs missing properties correctly', () => {
      const tag1 = new Tag('test', 'user', undefined, undefined);
      const tag2 = new Tag('test', 'user');

      expect(tag1.equals(tag2)).toBe(true);
    });
  });

  describe('Integration - fromTagItem and toTagItem', () => {
    it('should maintain data integrity through conversion cycle', () => {
      const tagItems: TagItem[] = [
        { name: 'tag1', source: 'user' },
        { name: 'tag2', source: 'api', label: 111 },
        { name: 'tag3', source: 'api', label: 222, parentId: 333 },
      ];

      tagItems.forEach(originalTagItem => {
        const tag = Tag.fromTagItem(originalTagItem);
        const convertedTagItem = tag.toTagItem();
        expect(convertedTagItem).toEqual(originalTagItem);
      });
    });
  });

  describe('Source types', () => {
    it('should distinguish between user and api sources', () => {
      const userTag = new Tag('userTag', 'user');
      const apiTag = new Tag('apiTag', 'api', 123);

      expect(userTag.source).toBe('user');
      expect(apiTag.source).toBe('api');
    });
  });
});

