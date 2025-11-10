import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Workspace } from '../Workspace';

describe('Workspace Domain Model', () => {
  let workspace: Workspace;

  beforeEach(() => {
    workspace = new Workspace(
      'test-id',
      'Test Workspace',
      'test-owner',
      'Initial text',
      false,
      1000000
    );
  });

  describe('Constructor', () => {
    it('should create a workspace with all properties', () => {
      expect(workspace.id).toBe('test-id');
      expect(workspace.name).toBe('Test Workspace');
      expect(workspace.owner).toBe('test-owner');
      expect(workspace.text).toBe('Initial text');
      expect(workspace.isTemporary).toBe(false);
      expect(workspace.updatedAt).toBe(1000000);
    });

    it('should use default values for optional parameters', () => {
      const minimal = new Workspace('id', 'name', 'owner');
      
      expect(minimal.text).toBe('');
      expect(minimal.isTemporary).toBe(false);
      expect(minimal.updatedAt).toBeGreaterThan(0);
    });

    it('should create a temporary workspace by default', () => {
      const temp = new Workspace('id', 'name', 'owner', '', true);
      expect(temp.isTemporary).toBe(true);
    });
  });

  describe('updateText', () => {
    it('should return a new workspace with updated text', () => {
      const updated = workspace.updateText('New text content');

      expect(updated).not.toBe(workspace); // Different instance
      expect(updated.text).toBe('New text content');
      expect(updated.id).toBe(workspace.id);
      expect(updated.name).toBe(workspace.name);
      expect(updated.owner).toBe(workspace.owner);
    });

    it('should update the timestamp when text is updated', () => {
      const originalTime = workspace.updatedAt;
      
      // Wait a bit to ensure timestamp changes
      vi.useFakeTimers();
      vi.setSystemTime(originalTime + 5000);
      
      const updated = workspace.updateText('New text');
      
      expect(updated.updatedAt).toBeGreaterThan(originalTime);
      expect(updated.updatedAt).toBe(originalTime + 5000);
      
      vi.useRealTimers();
    });

    it('should preserve isTemporary flag when updating text', () => {
      const tempWorkspace = new Workspace('id', 'name', 'owner', '', true);
      const updated = tempWorkspace.updateText('Some text');
      
      expect(updated.isTemporary).toBe(true);
    });

    it('should handle empty string update', () => {
      const updated = workspace.updateText('');
      
      expect(updated.text).toBe('');
    });

    it('should be immutable - not modify original workspace', () => {
      const originalText = workspace.text;
      workspace.updateText('Modified text');
      
      expect(workspace.text).toBe(originalText); // Original unchanged
    });
  });

  describe('markAsPermanent', () => {
    it('should return a new workspace marked as permanent', () => {
      const tempWorkspace = new Workspace('id', 'name', 'owner', 'text', true);
      const permanent = tempWorkspace.markAsPermanent();

      expect(permanent).not.toBe(tempWorkspace); // Different instance
      expect(permanent.isTemporary).toBe(false);
      expect(permanent.id).toBe(tempWorkspace.id);
      expect(permanent.name).toBe(tempWorkspace.name);
      expect(permanent.text).toBe(tempWorkspace.text);
    });

    it('should preserve all other properties', () => {
      const tempWorkspace = new Workspace(
        'test-id',
        'Test Name',
        'test-owner',
        'Some content',
        true,
        123456
      );
      const permanent = tempWorkspace.markAsPermanent();

      expect(permanent.id).toBe('test-id');
      expect(permanent.name).toBe('Test Name');
      expect(permanent.owner).toBe('test-owner');
      expect(permanent.text).toBe('Some content');
      expect(permanent.updatedAt).toBe(123456);
    });

    it('should work on already permanent workspace', () => {
      const alreadyPermanent = new Workspace('id', 'name', 'owner', '', false);
      const result = alreadyPermanent.markAsPermanent();

      expect(result.isTemporary).toBe(false);
    });

    it('should be immutable - not modify original workspace', () => {
      const tempWorkspace = new Workspace('id', 'name', 'owner', '', true);
      tempWorkspace.markAsPermanent();
      
      expect(tempWorkspace.isTemporary).toBe(true); // Original unchanged
    });

    it('should not update timestamp when marking as permanent', () => {
      const tempWorkspace = new Workspace('id', 'name', 'owner', '', true, 999999);
      const permanent = tempWorkspace.markAsPermanent();
      
      expect(permanent.updatedAt).toBe(999999); // Timestamp preserved
    });
  });

  describe('Immutability principle', () => {
    it('should always return new instances for updates', () => {
      const updated = workspace.updateText('New text');
      const permanent = workspace.markAsPermanent();

      expect(updated).not.toBe(workspace);
      expect(permanent).not.toBe(workspace);
      expect(updated).not.toBe(permanent);
    });
  });
});

