import { describe, it, expect } from 'vitest';
import {
  requireNonEmptyString,
  requireWorkspaceId,
  requireOwnerId,
  requireWorkspaceName,
  requireTranslationLanguage,
} from '@/core/usecases/shared/validators';
import { errorHandlingService } from '@/infrastructure/services/ErrorHandlingService';

describe('use case validators', () => {
  it('returns trimmed strings', () => {
    const result = requireNonEmptyString('  value  ', {
      operation: 'TestOperation',
      field: 'field',
      code: 'TEST_CODE',
    });
    expect(result).toBe('value');
  });

  it('throws AppError when value is empty', () => {
    expect(() =>
      requireNonEmptyString('   ', {
        operation: 'TestOperation',
        field: 'field',
        code: 'TEST_CODE',
      })
    ).toThrowError();

    try {
      requireNonEmptyString('', {
        operation: 'TestOperation',
        field: 'field',
        code: 'TEST_CODE',
      });
    } catch (error) {
      expect(errorHandlingService.isAppError(error)).toBe(true);
      expect(error).toMatchObject({
        code: 'TEST_CODE',
        message: 'field is required.',
      });
    }
  });

  it('validates workspace id', () => {
    expect(requireWorkspaceId(' abc ', 'Op')).toBe('abc');
  });

  it('validates owner id', () => {
    expect(requireOwnerId(' owner ', 'Op')).toBe('owner');
  });

  it('validates workspace name', () => {
    expect(requireWorkspaceName(' Draft ', 'Op')).toBe('Draft');
  });

  it('validates translation language', () => {
    expect(requireTranslationLanguage(' cs ', 'Op')).toBe('cs');
  });
});



