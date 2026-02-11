# Presentation Stores - Developer Guide

This directory contains Zustand stores that manage application state in the presentation layer.

## Store Overview

### 1. `workspaceStore.ts` (Legacy - To Be Refactored)

**Purpose**: Manages the list of all workspaces for the current user.

**State**:
- `workspaces`: Array of all workspaces
- `currentWorkspaceId`: ID of the currently selected workspace
- `isLoading`: Loading state for workspace operations
- `error`: Error messages
- `lastSavedState`: Snapshot of last saved state for rollback
- `isSaving`: Indicates if a save operation is in progress
- `saveError`: Errors from save operations

**Actions**:
- `loadWorkspaces(username)`: Load all workspaces for a user
- `createWorkspace(workspace)`: Add a new workspace
- `updateWorkspace(id, updates)`: Update a workspace
- `deleteWorkspace(id)`: Remove a workspace
- `setCurrentWorkspace(id)`: Set the active workspace
- `markSaveSuccess()`: Mark save operation as successful
- `markSaveFailed(error)`: Mark save operation as failed
- `rollbackToLastSaved()`: Revert to last saved state

**Usage**:
```typescript
import { useWorkspaceStore } from './workspaceStore';

const MyComponent = () => {
  const workspaces = useWorkspaceStore((state) => state.workspaces);
  const loadWorkspaces = useWorkspaceStore((state) => state.loadWorkspaces);
  
  useEffect(() => {
    loadWorkspaces('username');
  }, []);
  
  return <div>{workspaces.length} workspaces</div>;
};
```

---

### 2. `sessionStore.ts` (New - Phase 2)

**Purpose**: Manages the active editing session for the currently open workspace.

**State**:
- `workingSet`: The active workspace data being edited
  - `workspaceId`: ID of the active workspace
  - `text`: Main text content
  - `userSpans`: User-annotated NER spans
  - `apiSpans`: API-generated NER spans
  - `deletedApiKeys`: Soft-deleted API span keys
  - `tags`: Workspace tags
  - `translations`: Translation pages
- `isDirty`: Boolean flag indicating unsaved changes
- `lastChangedAt`: Timestamp of last modification

**Actions**:
- `updateWorkingSet(data)`: Update the working set and mark as dirty
- `setDirty(status)`: Manually control dirty state
- `resetSession()`: Clear the session (e.g., on logout)
- `loadWorkingSet(workspaceId, data)`: Load a workspace into the session

**Usage**:
```typescript
import { useSessionStore } from './sessionStore';

const EditorComponent = () => {
  const workingSet = useSessionStore((state) => state.workingSet);
  const updateWorkingSet = useSessionStore((state) => state.updateWorkingSet);
  
  const handleTextChange = (newText: string) => {
    updateWorkingSet({ text: newText });
    // Auto-save will be triggered by StateSynchronizer
  };
  
  return (
    <textarea 
      value={workingSet.text} 
      onChange={(e) => handleTextChange(e.target.value)} 
    />
  );
};
```

**When to Use**:
- ✅ When editing the active workspace
- ✅ When you need to track unsaved changes
- ✅ When implementing auto-save functionality
- ❌ When managing the list of workspaces (use `workspaceStore`)
- ❌ When loading/creating/deleting workspaces (use `workspaceStore`)

---

### 3. `notificationStore.ts` (New - Phase 2)

**Purpose**: Manages a queue-based system for global application messages.

**State**:
- `notifications`: Array of queued notifications
- `current`: Currently displayed notification

**Actions**:
- `enqueue(notice)`: Add a notification to the queue
- `dequeue()`: Remove the current notification and show the next one
- `clear()`: Clear all notifications

**Usage**:
```typescript
import { useNotificationStore } from './notificationStore';

const MyComponent = () => {
  const enqueue = useNotificationStore((state) => state.enqueue);
  
  const handleSuccess = () => {
    enqueue({
      message: 'Operation completed successfully',
      tone: 'success',
    });
  };
  
  const handleError = () => {
    enqueue({
      message: 'An error occurred',
      tone: 'error',
      persistent: true, // Requires manual dismissal
    });
  };
  
  return (
    <div>
      <button onClick={handleSuccess}>Success</button>
      <button onClick={handleError}>Error</button>
    </div>
  );
};
```

**Notification Tones**:
- `default`: Neutral message
- `info`: Informational message (blue)
- `success`: Success message (green)
- `warning`: Warning message (orange)
- `error`: Error message (red)

**Persistent Notifications**:
- Set `persistent: true` to require manual dismissal
- Useful for critical errors or important messages

---

## Best Practices

### 1. Separation of Concerns

- **workspaceStore**: Manages the "list" of workspaces
- **sessionStore**: Manages the "active editing session"
- **notificationStore**: Manages user feedback messages

### 2. Auto-Save Pattern

The `StateSynchronizer` component watches `sessionStore.isDirty` and automatically saves changes:

```typescript
// In your component, just update the working set
updateWorkingSet({ text: newText });

// StateSynchronizer will:
// 1. Detect isDirty = true
// 2. Wait 1 second (debounce)
// 3. Call UpdateWorkspaceUseCase
// 4. Set isDirty = false on success
// 5. Show notification on error
```

### 3. Error Handling

Always use the notification store for user feedback:

```typescript
try {
  await someOperation();
  enqueue({ message: 'Success!', tone: 'success' });
} catch (error) {
  const appError = errorHandlingService.wrapRepositoryError(error, {
    operation: 'someOperation',
  });
  const presented = presentError(appError);
  enqueue({ 
    message: presented.message, 
    tone: presented.tone,
    persistent: true,
  });
}
```

### 4. Store Selection Guide

**Use `workspaceStore` when**:
- Loading all workspaces for a user
- Creating a new workspace
- Deleting a workspace
- Switching between workspaces
- Displaying a list of workspaces

**Use `sessionStore` when**:
- Editing text content
- Adding/removing NER spans
- Managing tags
- Working with translations
- Any operation on the "active" workspace

**Use `notificationStore` when**:
- Showing success messages
- Displaying error messages
- Providing user feedback
- Showing warnings or info messages

---

## Migration Guide

### Migrating from Local State to sessionStore

**Before**:
```typescript
const [text, setText] = useState('');
const [tags, setTags] = useState<TagItem[]>([]);

const handleSave = async () => {
  await workspaceService.updateWorkspace(workspaceId, { text, tags });
};
```

**After**:
```typescript
const workingSet = useSessionStore((state) => state.workingSet);
const updateWorkingSet = useSessionStore((state) => state.updateWorkingSet);

// No manual save needed - StateSynchronizer handles it!
const handleTextChange = (newText: string) => {
  updateWorkingSet({ text: newText });
};

const handleTagsChange = (newTags: TagItem[]) => {
  updateWorkingSet({ tags: newTags });
};
```

### Migrating from Local Notifications to notificationStore

**Before**:
```typescript
const [notice, setNotice] = useState<Notice | null>(null);

const showSuccess = () => {
  setNotice({ message: 'Success!', tone: 'success' });
};
```

**After**:
```typescript
const enqueue = useNotificationStore((state) => state.enqueue);

const showSuccess = () => {
  enqueue({ message: 'Success!', tone: 'success' });
};
```

---

## Debugging

All stores use Zustand devtools middleware. To debug:

1. Install [Redux DevTools Extension](https://github.com/reduxjs/redux-devtools)
2. Open browser DevTools
3. Navigate to "Redux" tab
4. Select the store you want to inspect:
   - `workspace-store`
   - `session-store`
   - `notification-store`

You can:
- View current state
- Track state changes over time
- Time-travel debug (revert to previous states)
- Export/import state for testing

---

## Future Improvements

1. **Persistence**: Add middleware to persist `sessionStore` to localStorage for crash recovery
2. **Undo/Redo**: Implement history tracking in `sessionStore`
3. **Conflict Resolution**: Handle concurrent edits across multiple tabs
4. **Optimistic Updates**: Update UI immediately, sync in background
5. **Offline Support**: Queue changes when offline, sync when online

---

## Questions?

For architecture questions, refer to:
- `STRUCTURE.md`: Overall architecture documentation
- `REFACTORING_PHASE2_SUMMARY.md`: Phase 2 refactoring details
- Clean Architecture principles: https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html
