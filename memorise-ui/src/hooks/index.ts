/**
 * Centralized exports for all custom hooks
 * 
 * This allows importing multiple hooks from a single location:
 * import { useWorkspaceState, useAutoSave, useAnnotationManager } from '../../hooks';
 */

export { useAnnotationManager } from './useAnnotationManager';
export { useAutoSave } from './useAutoSave';
export { useNotification } from './useNotification';
export { useSemanticTags } from './useSemanticTags';
export { useThesaurusDisplay } from './useThesaurusDisplay';
export { useThesaurusWorker } from './useThesaurusWorker';
export { useTranslationManager } from './useTranslationManager';
export { useWorkspaceHydration } from './useWorkspaceHydration';
export { useWorkspaceState } from './useWorkspaceState';
export { useWorkspaceSync } from './useWorkspaceSync';

