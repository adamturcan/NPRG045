import type { AnnotationRepository } from '../../interfaces/repositories/AnnotationRepository';

export interface ClearApiAnnotationsRequest {
  workspaceId: string;
}

/**
 * Use case for clearing all API-generated annotations
 */
export class ClearApiAnnotationsUseCase {
  private annotationRepository: AnnotationRepository;

  constructor(annotationRepository: AnnotationRepository) {
    this.annotationRepository = annotationRepository;
  }

  async execute(request: ClearApiAnnotationsRequest): Promise<void> {
    if (!request.workspaceId) {
      throw new Error('Workspace ID is required');
    }

    await this.annotationRepository.clearApiSpans(request.workspaceId);
  }
}

