import type { NerSpan } from '../../../types/NotationEditor';
import type { AnnotationRepository } from '../../interfaces/repositories/AnnotationRepository';

export interface GetAnnotationsRequest {
  workspaceId: string;
}

export interface GetAnnotationsResponse {
  userSpans: NerSpan[];
  apiSpans: NerSpan[];
  activeSpans: NerSpan[];
  deletedApiKeys: string[];
}

/**
 * Use case for retrieving all annotations for a workspace
 */
export class GetAnnotationsUseCase {
  private annotationRepository: AnnotationRepository;

  constructor(annotationRepository: AnnotationRepository) {
    this.annotationRepository = annotationRepository;
  }

  async execute(request: GetAnnotationsRequest): Promise<GetAnnotationsResponse> {
    if (!request.workspaceId) {
      throw new Error('Workspace ID is required');
    }

    const [userSpans, apiSpans, deletedApiKeys, activeSpans] = await Promise.all([
      this.annotationRepository.getUserSpans(request.workspaceId),
      this.annotationRepository.getApiSpans(request.workspaceId),
      this.annotationRepository.getDeletedApiKeys(request.workspaceId),
      this.annotationRepository.getActiveAnnotations(request.workspaceId),
    ]);

    return {
      userSpans,
      apiSpans,
      activeSpans,
      deletedApiKeys,
    };
  }
}

