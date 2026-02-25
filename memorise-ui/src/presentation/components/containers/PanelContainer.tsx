import React, { useCallback, useMemo } from "react";
import { useParams } from "react-router-dom";
import RightPanel, { type TagRow } from "../right/RightPanel";
import SplitSegmentDialog from "../segmentation/SplitSegmentDialog";
import type { ThesaurusItem } from "../tags/TagThesaurusInput";
import { useSessionStore } from "../../stores/sessionStore";
import { useThesaurusDisplay, useThesaurusWorker } from "../../hooks";
import { useSegmentOperations } from "../../hooks/useSegmentOperations";
import { workflowService } from "../../../application/services/WorkflowApplicationService";
import { type Segment } from "../../../types/Segment";

const PanelContainer: React.FC = () => {
  const { id: routeId } = useParams();
  
  

  const session = useSessionStore((state) => state.session);

  // used for segment operations
  const segments = useSessionStore((state) => state.session?.segments ?? []);  
  //use for tag operations
  const tags = useSessionStore((state) => state.session?.tags ?? []);
  
  //this is the same thing most likely 
  const activeSegmentId = useSessionStore((state) => state.activeSegmentId);

  // could be merged with the general view mode
  const viewMode = useSessionStore((state) => state.viewMode);
  const setViewMode = useSessionStore((state) => state.setViewMode);
  
  const setDraftText = useSessionStore((state) => state.setDraftText);
  
  const currentId = routeId ?? session?.id ?? null;

 

  const segmentOps = useSegmentOperations();
  const thesaurusWorker = useThesaurusWorker();
  const thesaurusIndexForDisplay = useThesaurusDisplay(thesaurusWorker);

  //filter tags based on the active segment 
  const filteredTags = useMemo(
    () => activeSegmentId && viewMode === "segments" ? tags.filter(t => t.segmentId === activeSegmentId) : tags,
    [tags, activeSegmentId, viewMode]
  );

  //map tags to the structure used for rendering the table
  const tagRows = useMemo<TagRow[]>(
    () => filteredTags.map((t) => ({
      name: t.name,
      source: t.source,
      keywordId: t.label ? Number(t.label) : undefined,
      parentId: t.parentId
    })),
    [filteredTags]
  );


  const addTag = useCallback(async (name: string, keywordId?: number, parentId?: number) => {
    try {      
      await workflowService.addCustomTag(name, { keywordId, parentId, segmentId: activeSegmentId });
    } catch  {
      //TODO: handle error
      //
    }
  }, [activeSegmentId]);

  const deleteTag = useCallback(
    (name: string, keywordId?: number, parentId?: number) => workflowService.deleteTag(name, keywordId, parentId),
    []
  );

  
  const fetchThesaurus = useCallback(async (q: string): Promise<ThesaurusItem[]> => {
    if (!q.trim() || !thesaurusWorker.ready) return [];
    try {
      return (await thesaurusWorker.search(q, 20)).map(item => ({
        name: item.label,
        path: item.path,
        keywordId: item.id,
        parentId: item.parentId,
        isPreferred: item.isPreferred,
        depth: item.depth
      }));
    } catch {
      return [];
    }
  }, [thesaurusWorker]);

  const thesaurusConfig = useMemo(
    () => ({      
      fetchSuggestions: fetchThesaurus,
      defaultRestrictToThesaurus: false,
      isThesaurusLoading: !thesaurusWorker.ready,
      resetKey: currentId ?? undefined
    }),
    [fetchThesaurus, thesaurusWorker.ready, currentId]
  );

  return (
    <>
      <RightPanel
        tags={tagRows}
        onDeleteTag={deleteTag}
        onAddTag={addTag}

        thesaurus={thesaurusConfig}
        thesaurusIndex={thesaurusIndexForDisplay}
        segments={segments}
        
        activeSegmentId={activeSegmentId}


        segmentOperations={{
          handleSegmentClick: (segment: Segment) => segmentOps.handleSegmentClick(segment, setDraftText, () => {}),
          handleJoinSegments: segmentOps.handleJoinSegments,
          handleSplitSegment: segmentOps.handleSplitSegment,
        }}
        
        
        viewMode={viewMode}
        onViewModeChange={setViewMode}
 
      />
      <SplitSegmentDialog
        open={segmentOps.splitDialogOpen}
        segment={segments.find(s => s.id === activeSegmentId) ?? null}        
        onClose={() => {
          segmentOps.setSplitDialogOpen(false);         
        }}
        onConfirm={segmentOps.handleConfirmSplit}
      />
    </>
  );
};

export default PanelContainer;
