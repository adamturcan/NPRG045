import type { NerSpan } from '../../types/NotationEditor';
import type { TagItem } from '../../types/Tag';
import type { Translation as TranslationDTO, Workspace as WorkspaceDTO } from '../../types/Workspace';
import { Annotation } from './Annotation';
import { Tag } from './Tag';
import { Workspace, WorkspaceTranslation } from './Workspace';

export interface WorkspaceMapperOptions {
  ownerFallback?: string;
}

export type WorkspacePersistence = WorkspaceDTO & {
  owner: string;
  text: string;
  isTemporary: boolean;
  updatedAt: number;
};

export function workspaceFromDto(
  dto: WorkspaceDTO,
  options: WorkspaceMapperOptions = {}
): Workspace {
  const owner = dto.owner ?? options.ownerFallback;
  if (!owner) {
    throw new Error('Workspace DTO must include owner');
  }

  return Workspace.create({
    id: dto.id ?? crypto.randomUUID(),
    name: dto.name ?? 'Untitled Workspace',
    owner,
    text: dto.text,
    isTemporary: dto.isTemporary,
    updatedAt: dto.updatedAt,
    userSpans: dto.userSpans,
    apiSpans: dto.apiSpans,
    deletedApiKeys: dto.deletedApiKeys,
    tags: dto.tags?.map((item) => Tag.fromTagItem(item)),
    translations: dto.translations?.map((translation) =>
      WorkspaceTranslation.fromDto(translation as TranslationDTO)
    ),
  });
}

export function workspaceToDto(workspace: Workspace): WorkspaceDTO {
  return {
    id: workspace.id,
    name: workspace.name,
    owner: workspace.owner,
    text: workspace.text,
    isTemporary: workspace.isTemporary,
    updatedAt: workspace.updatedAt,
    userSpans: [...workspace.userSpans],
    apiSpans: [...workspace.apiSpans],
    deletedApiKeys: [...workspace.deletedApiKeys],
    tags: workspace.tags.map((tag) => tag.toTagItem()),
    translations: workspace.translations.map((translation) => translation.toDto()),
  };
}

export function workspaceToPersistence(workspace: Workspace): WorkspacePersistence {
  const dto = workspaceToDto(workspace);
  return {
    ...dto,
    owner: workspace.owner,
    text: workspace.text,
    isTemporary: workspace.isTemporary,
    updatedAt: workspace.updatedAt,
  };
}

export function annotationFromSpan(span: NerSpan): Annotation {
  return Annotation.fromSpan(span);
}

export function annotationToSpan(annotation: Annotation): NerSpan {
  return annotation.toSpan();
}

export function tagFromItem(item: TagItem): Tag {
  return Tag.fromTagItem(item);
}

export function tagToItem(tag: Tag): TagItem {
  return tag.toTagItem();
}



