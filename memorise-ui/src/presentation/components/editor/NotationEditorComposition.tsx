import React, { useCallback } from "react";
import { NotationEditorRoot } from "./layers/NotationEditorRoot";
import { NotationInteractionLayer } from "./layers/NotationInteractionLayer";
import { NotationOverlayLayer } from "./layers/NotationOverlayLayer";
import type { NotationEditorProps } from "../../../types/NotationEditor";

const NotationEditorComposition: React.FC<NotationEditorProps> = (props) => {
  
  
  const renderOverlay = useCallback(
    (uiState: Parameters<React.ComponentProps<typeof NotationInteractionLayer>['children']>[0]) => <NotationOverlayLayer uiState={uiState} />, 
    []
  );

  return (
    <NotationEditorRoot
      initialValue={props.value} 
      onChange={props.onChange}
      spans={props.spans || []}
      segments={props.segments || []}
      onSpansAdjusted={props.onSpansAdjusted}
      onSegmentsAdjusted={props.onSegmentsAdjusted}
      selectedSegmentId={props.selectedSegmentId}
    >
      <NotationInteractionLayer
        placeholder={props.placeholder}
        activeSegmentId={props.activeSegmentId}
        selectedSegmentId={props.selectedSegmentId}
        highlightedCategories={props.highlightedCategories}
        activeTab={props.activeTab}
        onAddSpan={props.onAddSpan}
        onDeleteSpan={props.onDeleteSpan}
      >
        {renderOverlay}
      </NotationInteractionLayer>
    </NotationEditorRoot>
  );
};

export default NotationEditorComposition;