import React, { useCallback, useMemo } from "react";
import { useParams } from "react-router-dom";
import RightPanel, { type TagRow } from "../rightPanel/RightPanel";
import SplitSegmentDialog from "../rightPanel/dialogs/SplitSegmentDialog";
import type { ThesaurusItem } from "../rightPanel/inputs/TagThesaurusInput";
import { useSessionStore } from "../../stores/sessionStore";
import { useThesaurusDisplay, useThesaurusWorker } from "../../hooks";
import { useSegmentOperations } from "../../hooks/useSegmentOperations";
import { taggingWorkflowService } from "../../../application/services/TaggingWorkflowSercice";
import { type Segment } from "../../../types/Segment";

const PanelContainer: React.FC = () => {
  const { id: routeId } = useParams();

  const session = useSessionStore((state) => state.session);
  const activeTab = useSessionStore((state) => state.activeTab);
  const activeSegmentId = useSessionStore((state) => state.activeSegmentId);
  const viewMode = useSessionStore((state) => state.viewMode);
  const setViewMode = useSessionStore((state) => state.setViewMode);
  
  const currentId = routeId ?? session?.id ?? null;

  const tags = session?.tags ?? [];

  const displaySegments = useMemo(() => {
    const masterSegments = session?.segments ?? [];

    if (activeTab === "original") {
      return masterSegments;
    }

    const currentTranslation = session?.translations?.find((t) => t.language === activeTab);
    const segmentTranslations = currentTranslation?.segmentTranslations ?? {};

    return masterSegments
      .filter((seg) => segmentTranslations[seg.id] !== undefined)
      .map((seg) => ({
        ...seg,
        text: segmentTranslations[seg.id],
      }));
  }, [session?.segments, session?.translations, activeTab]);

  const segmentOps = useSegmentOperations();
  const thesaurusWorker = useThesaurusWorker();
  const thesaurusIndexForDisplay = useThesaurusDisplay(thesaurusWorker);

  const filteredTags = useMemo(
    () => {
      if (viewMode === "segments" && activeSegmentId) {
        return tags.filter(t => t.segmentId === activeSegmentId);
      } else {       
        return tags.filter(t => !t.segmentId);
      }
    },
    [tags, activeSegmentId, viewMode]
  );

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
      await taggingWorkflowService.addCustomTag(name, { keywordId, parentId, segmentId: activeSegmentId });
    } catch  {
      //TODO: handle error
    }
  }, [activeSegmentId]);

  const deleteTag = useCallback(
    (name: string, keywordId?: number, parentId?: number) => taggingWorkflowService.deleteTag(name, keywordId, parentId),
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
        segments={displaySegments}
        activeSegmentId={activeSegmentId}
        segmentOperations={{
          handleSegmentClick: (segment: Segment) => segmentOps.handleSegmentClick(segment),
          handleJoinSegments: segmentOps.handleJoinSegments,
          handleSplitSegment: segmentOps.handleSplitSegment,
        }}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />
      <SplitSegmentDialog
        open={segmentOps.splitDialogOpen}
        segment={displaySegments.find(s => s.id === activeSegmentId) ?? null}
        onClose={() => segmentOps.setSplitDialogOpen(false)}
        onConfirm={segmentOps.handleConfirmSplit}
      />
    </>
  );
};

export default PanelContainer;