import type { WorkspaceRepository } from "../../core/interfaces/repositories/WorkspaceRepository";
import type { AnnotationRepository } from "../../core/interfaces/repositories/AnnotationRepository";
import type { TagRepository } from "../../core/interfaces/repositories/TagRepository";
import { LocalStorageWorkspaceRepository } from "../repositories/LocalStorageWorkspaceRepository";
import { LocalStorageAnnotationRepository } from "../repositories/LocalStorageAnnotationRepository";
import { LocalStorageTagRepository } from "../repositories/LocalStorageTagRepository";

let workspaceRepositoryInstance: WorkspaceRepository | null = null;
let annotationRepositoryInstance: AnnotationRepository | null = null;
let tagRepositoryInstance: TagRepository | null = null;

export function getWorkspaceRepository(): WorkspaceRepository {
  if (!workspaceRepositoryInstance) {
    workspaceRepositoryInstance = new LocalStorageWorkspaceRepository();
  }
  return workspaceRepositoryInstance;
}

export function getAnnotationRepository(): AnnotationRepository {
  if (!annotationRepositoryInstance) {
    annotationRepositoryInstance = new LocalStorageAnnotationRepository();
  }
  return annotationRepositoryInstance;
}

export function getTagRepository(): TagRepository {
  if (!tagRepositoryInstance) {
    tagRepositoryInstance = new LocalStorageTagRepository();
  }
  return tagRepositoryInstance;
}


