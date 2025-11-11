import type { NerSpan } from '../../../types/NotationEditor';
import type { AnnotationRepository } from '../../interfaces/repositories/AnnotationRepository';
import { Annotation } from '../../entities/Annotation';
import { errorHandlingService } from '../../../infrastructure/services/ErrorHandlingService';
import { requireWorkspaceId } from '../shared/validators';

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
    const workspaceId = requireWorkspaceId(
      request.workspaceId,
      'AddUserAnnotationUseCase'
    );

    if (!request.span) {
      throw errorHandlingService.createAppError({
        message: 'Annotation span is required.',
        code: 'ANNOTATION_SPAN_REQUIRED',
        severity: 'warn',
        context: {
          operation: 'AddUserAnnotationUseCase',
          workspaceId,
        },
      });
    }

    if (
      typeof request.span.start !== 'number' ||
      typeof request.span.end !== 'number' ||
      request.span.start < 0 ||
      request.span.end <= request.span.start
    ) {
      throw errorHandlingService.createAppError({
        message: 'Annotation span coordinates are invalid.',
        code: 'ANNOTATION_SPAN_INVALID',
        severity: 'warn',
        context: {
          operation: 'AddUserAnnotationUseCase',
          workspaceId,
          spanStart: request.span.start,
          spanEnd: request.span.end,
        },
      });
    }

    // Validate span using domain model
    try {
      Annotation.fromSpan(request.span);
    } catch (error) {
      throw errorHandlingService.createAppError({
        message:
          error instanceof Error
            ? error.message
            : 'Annotation span failed validation.',
        code: 'ANNOTATION_VALIDATION_FAILED',
        severity: 'warn',
        context: {
          operation: 'AddUserAnnotationUseCase',
          workspaceId,
        },
        cause: error,
      });
    }

    // Note: We allow overlaps in the current implementation
    // Overlap validation is available via domain model if needed in the future:
    // const existingSpans = await this.annotationRepository.getUserSpans(request.workspaceId);
    // const annotation = Annotation.fromSpan(request.span);
    // const hasOverlap = existingSpans.some(existing => 
    //   annotation.overlapsWith(Annotation.fromSpan(existing))
    // );

    // Add the annotation
    await this.annotationRepository.addUserSpan(workspaceId, request.span);
  }
}

