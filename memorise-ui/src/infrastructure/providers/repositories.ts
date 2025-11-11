/**
 * @deprecated Use dedicated provider modules (`workspaceProvider`, `annotationProvider`,
 * `tagProvider`) instead. This file remains as a compatibility shim until all imports
 * are migrated.
 */
export {
  getWorkspaceRepository,
  getWorkspaceUseCases,
  getWorkspaceApplicationService,
  setWorkspaceProviderOverrides,
  resetWorkspaceProvider,
} from './workspaceProvider';

export {
  getAnnotationRepository,
  getAnnotationUseCases,
  setAnnotationProviderOverrides,
  resetAnnotationProvider,
} from './annotationProvider';

export {
  getTagRepository,
  getTagUseCases,
  setTagProviderOverrides,
  resetTagProvider,
} from './tagProvider';

