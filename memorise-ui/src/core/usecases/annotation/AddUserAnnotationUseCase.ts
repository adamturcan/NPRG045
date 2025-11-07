import type { NerSpan } from '../../../types/NotationEditor';
import type { AnnotationRepository } from '../../interfaces/repositories/AnnotationRepository';
import { Annotation } from '../../../domain/Annotation'; 

export interface AddUserAnnotationRequest {
  workspaceId: string;
  span: NerSpan;
}

/**
 * Use case for adding a user-created annotation
 */
export class AddUserAnnotationUseCase {
  private annotationRepository: AnnotationRepository;

  constructor(annotationRepository: AnnotationRepository) {
    this.annotationRepository = annotationRepository;
  }

  async execute(request: AddUserAnnotationRequest): Promise<void> {
    // Validate input
    if (!request.workspaceId) {
      throw new Error('Workspace ID is required');
    }

    if (!request.span || request.span.start < 0 || request.span.end <= request.span.start) {
      throw new Error('Invalid annotation span');
    }

    // Validate span using domain model
    Annotation.fromSpan(request.span);

    // Note: We allow overlaps in the current implementation
    // Overlap validation is available via domain model if needed in the future:
    // const existingSpans = await this.annotationRepository.getUserSpans(request.workspaceId);
    // const annotation = Annotation.fromSpan(request.span);
    // const hasOverlap = existingSpans.some(existing => 
    //   annotation.overlapsWith(Annotation.fromSpan(existing))
    // );

    // Add the annotation
    await this.annotationRepository.addUserSpan(request.workspaceId, request.span);
  }
}

