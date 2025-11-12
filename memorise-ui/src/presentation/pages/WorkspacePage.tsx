// src/pages/WorkspacePage.tsx
/**
 * WorkspacePage - Thin wrapper component for workspace editing
 * 
 * This page component is a thin wrapper that delegates all logic to WorkspaceContainer.
 * 
 * Architecture:
 * - WorkspacePage: Route-level page component (thin wrapper)
 * - WorkspaceContainer: Container component with all business logic (uses Zustand directly)
 * - Presentational components: BookmarkBar, EditorArea, RightPanel (UI only)
 * 
 * This separation follows the container/presentational pattern:
 * - Page: Handles route-level concerns
 * - Container: Handles business logic and state management (via Zustand)
 * - Presentational: Handle UI rendering
 * 
 * Note: WorkspaceContainer now uses Zustand store directly instead of props.
 * This eliminates prop drilling and prepares for Phase 3 API integration.
 */
import React from "react";
import WorkspaceContainer from "../components/containers/WorkspaceContainer";

/**
 * WorkspacePage - Main page component for workspace editing
 * 
 * This is a thin wrapper that delegates to WorkspaceContainer.
 * All logic and state management is handled by the container component using Zustand store.
 */
const WorkspacePage: React.FC = () => {
  return <WorkspaceContainer />;
};

export default WorkspacePage;
