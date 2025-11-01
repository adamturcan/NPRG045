import type { TagItem } from '../types/Tag';

/**
 * Domain model for tags
 * 
 * Represents a semantic tag/keyword with validation and business logic.
 */
export class Tag {
  name: string;
  source: 'api' | 'user';
  label?: number;     // KeywordID from thesaurus (when from API classification)
  parentId?: number;  // ParentID to disambiguate entries with same KeywordID

  constructor(
    name: string,
    source: 'api' | 'user',
    label?: number,
    parentId?: number
  ) {
    if (!name || name.trim().length === 0) {
      throw new Error('Tag name is required');
    }

    this.name = name.trim();
    this.source = source;
    this.label = label;
    this.parentId = parentId;
  }

  /**
   * Create a Tag from a TagItem
   * @param tagItem - The tag item to convert
   * @returns A new Tag instance
   */
  static fromTagItem(tagItem: TagItem): Tag {
    return new Tag(tagItem.name, tagItem.source, tagItem.label, tagItem.parentId);
  }

  /**
   * Convert this tag back to a TagItem
   * @returns A TagItem representation
   */
  toTagItem(): TagItem {
    return {
      name: this.name,
      source: this.source,
      label: this.label,
      parentId: this.parentId,
    };
  }

  /**
   * Check if this tag is equal to another tag
   * Tags are considered equal if they have the same name, label, and parentId
   * @param other - The other tag to compare
   * @returns True if the tags are equal
   */
  equals(other: Tag): boolean {
    return (
      this.name === other.name &&
      this.label === other.label &&
      this.parentId === other.parentId
    );
  }
}

