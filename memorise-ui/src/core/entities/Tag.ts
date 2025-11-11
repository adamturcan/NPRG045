import type { TagItem, TagSource } from '../../types/Tag';

export interface TagProps {
  name: string;
  source: TagSource;
  label?: number;
  parentId?: number;
}

/**
 * Immutable Tag value object.
 */
export class Tag {
  private readonly props: TagProps;

  private constructor(props: TagProps) {
    this.props = Object.freeze({ ...props });
  }

  static create(props: TagProps): Tag {
    const { name, source, label, parentId } = props;

    if (!name || name.trim().length === 0) {
      throw new Error('Tag name is required');
    }

    return new Tag({
      name: name.trim(),
      source,
      label,
      parentId,
    });
  }

  static fromTagItem(item: TagItem): Tag {
    return Tag.create({
      name: item.name,
      source: item.source,
      label: item.label,
      parentId: item.parentId,
    });
  }

  get name(): string {
    return this.props.name;
  }

  get source(): TagSource {
    return this.props.source;
  }

  get label(): number | undefined {
    return this.props.label;
  }

  get parentId(): number | undefined {
    return this.props.parentId;
  }

  equals(other: Tag): boolean {
    return (
      this.name === other.name &&
      this.source === other.source &&
      this.label === other.label &&
      this.parentId === other.parentId
    );
  }

  toTagItem(): TagItem {
    return {
      name: this.name,
      source: this.source,
      label: this.label,
      parentId: this.parentId,
    };
  }
}


