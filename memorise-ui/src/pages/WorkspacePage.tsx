// src/pages/WorkspacePage.tsx
/**
 * WorkspacePage - Thin wrapper component for workspace editing
 * 
 * This page component is a thin wrapper that delegates all logic to WorkspaceContainer.
 * 
 * Architecture:
 * - WorkspacePage: Route-level page component (thin wrapper)
 * - WorkspaceContainer: Container component with all business logic
 * - Presentational components: BookmarkBar, EditorArea, RightPanel (UI only)
 * 
 * This separation follows the container/presentational pattern:
 * - Page: Handles route-level concerns
 * - Container: Handles business logic and state management
 * - Presentational: Handle UI rendering
 */
import React from "react";
import type { Workspace } from "../types/Workspace";
import WorkspaceContainer from "../components/containers/WorkspaceContainer";

interface Props {
  workspaces: Workspace[];
  setWorkspaces: React.Dispatch<React.SetStateAction<Workspace[]>>;
}

/**
 * WorkspacePage - Main page component for workspace editing
 * 
 * This is a thin wrapper that delegates to WorkspaceContainer.
 * All logic and state management is handled by the container component.
 */
const WorkspacePage: React.FC<Props> = ({ workspaces, setWorkspaces }) => {
  return (
    <WorkspaceContainer 
      workspaces={workspaces} 
      setWorkspaces={setWorkspaces} 
    />
  );
};

export default WorkspacePage;
