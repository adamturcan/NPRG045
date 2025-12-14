// src/infrastructure/services/PdfExportService.ts
import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  pdf,
  Font,
  Link,
} from "@react-pdf/renderer";
import type { Workspace } from "../../types/Workspace";
import { getSegmentText } from "../../types/Segment";
import {
  processAnnotatedText,
  getEntityRgb,
  getEntityDisplayName,
  formatDate,
} from "../../shared/utils/pdfHelpers";
import { buildTagHierarchy, loadThesaurusIndex } from "../../shared/utils/thesaurusHelpers";
import type { HierarchyNode } from "../../shared/utils/thesaurusHelpers";
import type { ThesaurusIndexItem } from "../../types/Thesaurus";

// Register Noto Sans font for proper Czech character support (ř, š, č, ž, ý, á, í, é, ó, ú, ů)
// Noto Sans is specifically designed to support all languages including Czech
// Import fonts as static assets using Vite - this ensures proper bundling
import notoSansRegular from "/fonts/NotoSans-Regular.ttf?url";
import notoSansBold from "/fonts/NotoSans-Bold.ttf?url";

// Font registration state
let fontsRegistered = false;
let fontRegistrationPromise: Promise<void> | null = null;

/**
 * Register fonts by fetching them and converting to base64
 * @react-pdf/renderer requires base64 strings or data URLs for font sources
 */
async function registerFonts(): Promise<void> {
  if (fontsRegistered) return;
  if (fontRegistrationPromise) return fontRegistrationPromise;

  fontRegistrationPromise = (async () => {
    try {
      // Fetch fonts using Vite-generated URLs
      const [regularResponse, boldResponse] = await Promise.all([
        fetch(notoSansRegular),
        fetch(notoSansBold),
      ]);

      if (!regularResponse.ok || !boldResponse.ok) {
        throw new Error(
          `Failed to fetch font files: ${regularResponse.status} / ${boldResponse.status}`
        );
      }

      // Convert responses to ArrayBuffer, then to base64 strings
      const [regularArrayBuffer, boldArrayBuffer] = await Promise.all([
        regularResponse.arrayBuffer(),
        boldResponse.arrayBuffer(),
      ]);

      // Validate that we got actual font files (TTF files start with specific bytes)
      // TTF files should start with bytes: 0x00 0x01 0x00 0x00 or 'OTTO' for OTF
      const regularHeader = new Uint8Array(regularArrayBuffer.slice(0, 4));
      const boldHeader = new Uint8Array(boldArrayBuffer.slice(0, 4));
      
      // Check for TTF signature (0x00 0x01 0x00 0x00) or OTF signature ('OTTO')
      const regularIsValidTTF = regularHeader[0] === 0x00 && regularHeader[1] === 0x01 && 
                                 regularHeader[2] === 0x00 && regularHeader[3] === 0x00;
      const regularIsValidOTF = String.fromCharCode(...regularHeader.slice(0, 4)) === 'OTTO';
      const boldIsValidTTF = boldHeader[0] === 0x00 && boldHeader[1] === 0x01 && 
                             boldHeader[2] === 0x00 && boldHeader[3] === 0x00;
      const boldIsValidOTF = String.fromCharCode(...boldHeader.slice(0, 4)) === 'OTTO';
      
      if ((!regularIsValidTTF && !regularIsValidOTF) || (!boldIsValidTTF && !boldIsValidOTF)) {
        throw new Error(
          "Font files appear to be invalid. Expected TTF/OTF format but got HTML or other format. " +
          "Please ensure /public/fonts/NotoSans-Regular.ttf and NotoSans-Bold.ttf are actual font files. " +
          "Download from: https://fonts.google.com/noto/specimen/Noto+Sans"
        );
      }

      // Convert ArrayBuffers to base64 strings
      const bytesToBase64 = (buffer: ArrayBuffer): string => {
        const bytes = new Uint8Array(buffer);
        let binary = "";
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
      };

      const regularBase64 = bytesToBase64(regularArrayBuffer);
      const boldBase64 = bytesToBase64(boldArrayBuffer);

      // react-pdf v4.x requires data URLs with proper format
      // Use application/octet-stream as it's the most compatible
      const regularSrc = `data:application/octet-stream;base64,${regularBase64}`;
      const boldSrc = `data:application/octet-stream;base64,${boldBase64}`;

      // Register fonts with react-pdf
      Font.register({
        family: "NotoSans",
        fonts: [
          {
            src: regularSrc,
            fontWeight: "normal",
          },
          {
            src: boldSrc,
            fontWeight: "bold",
          },
        ],
      });

      fontsRegistered = true;
      console.log("Noto Sans fonts registered successfully for PDF export");
    } catch (error) {
      console.warn(
        "Noto Sans font registration failed, PDF will use Times-Roman fallback:",
        error
      );
      // Mark registration as failed so we use fallback font
      fontsRegistered = false;
      // Don't throw - allow PDF generation to continue with fallback font
    }
  })();

  return fontRegistrationPromise;
}

// Styles are now created dynamically in getStyles() function
// to use the correct font family based on registration status

/**
 * Get styles with correct font family based on registration status
 */
const getStyles = () => {
  const fontFamily = fontsRegistered ? "NotoSans" : "Times-Roman";
  return StyleSheet.create({
    page: {
      padding: 40,
      fontSize: 11,
      fontFamily,
      color: "#0F172A",
      lineHeight: 1.6,
    },
    header: {
      marginBottom: 20,
      paddingBottom: 15,
      borderBottom: "2 solid #E2E8F0",
    },
    title: {
      fontSize: 24,
      fontWeight: "bold",
      marginBottom: 8,
      color: "#DDD1A0",
    },
    metadata: {
      fontSize: 9,
      color: "#334155",
      marginTop: 4,
    },
    section: {
      marginTop: 20,
      marginBottom: 15,
    },
    sectionTitle: {
      fontSize: 14,
      fontWeight: "bold",
      marginBottom: 10,
      color: "#0F172A",
      borderBottom: "1 solid #CBD5E1",
      paddingBottom: 5,
    },
    legendContainer: {
      flexDirection: "row",
      flexWrap: "wrap",
      marginTop: 8,
    },
    legendItem: {
      flexDirection: "row",
      alignItems: "center",
      marginRight: 12,
      marginBottom: 6,
    },
    legendColorBox: {
      width: 16,
      height: 16,
      marginRight: 6,
      border: "1 solid #E2E8F0",
    },
    legendText: {
      fontSize: 9,
      color: "#334155",
    },
    textContainer: {
      marginTop: 10,
      padding: 12,
      backgroundColor: "#F8FAFC",
      borderRadius: 4,
      border: "1 solid #E2E8F0",
    },
    annotatedText: {
      fontSize: 10,
      lineHeight: 1.8,
    },
    plainText: {
      color: "#0F172A",
    },
    tagsTable: {
      marginTop: 8,
      border: "1 solid #E2E8F0",
      borderRadius: 4,
    },
    tableHeader: {
      flexDirection: "row",
      backgroundColor: "#F8FAFC",
      borderBottom: "1 solid #E2E8F0",
      padding: 8,
    },
    tableHeaderCell: {
      fontSize: 9,
      fontWeight: "bold",
      color: "#0F172A",
    },
    tableRow: {
      flexDirection: "row",
      borderBottom: "1 solid #E2E8F0",
      padding: 8,
    },
    tableRowLast: {
      flexDirection: "row",
      padding: 8,
    },
    tableCell: {
      fontSize: 9,
      color: "#0F172A",
    },
    annotatedLine: {
      marginBottom: 4,
      padding: 6,
      borderRadius: 3,
    },
    annotatedLineText: {
      fontSize: 10,
      lineHeight: 1.6,
    },
    translationSection: {
      marginTop: 15,
      padding: 10,
      backgroundColor: "#F8FAFC",
      borderRadius: 4,
      border: "1 solid #E2E8F0",
    },
    translationHeader: {
      fontSize: 12,
      fontWeight: "bold",
      marginBottom: 8,
      color: "#1D4ED8",
    },
    segmentItem: {
      marginBottom: 12,
      padding: 8,
      backgroundColor: "#FFFFFF",
      borderRadius: 4,
      border: "1 solid #E2E8F0",
    },
    segmentHeader: {
      fontSize: 10,
      fontWeight: "bold",
      marginBottom: 6,
      color: "#388E3C",
    },
    segmentText: {
      fontSize: 9,
      color: "#0F172A",
      marginBottom: 4,
    },
    segmentTranslationHeader: {
      fontSize: 10,
      fontWeight: "bold",
      color: "#1D4ED8",
      marginTop: 8,
      marginBottom: 6,
    },
    segmentTranslation: {
      fontSize: 9,
      color: "#334155",
      marginTop: 4,
      paddingLeft: 8,
      borderLeft: "2 solid #CBD5E1",
    },
    emptyState: {
      fontSize: 9,
      color: "#94A3B8",
    },
    hierarchyGroup: {
      border: "1 dashed rgba(160, 184, 221, 0.45)",
      borderRadius: 4,
      backgroundColor: "rgba(255,255,255,0.65)",
      marginBottom: 4,
      padding: 6,
    },
    categoryHeader: {
      fontSize: 10,
      fontWeight: "bold",
      color: "#21426C",
      textTransform: "uppercase",
      letterSpacing: 0.6,
      marginBottom: 4,
    },
    categoryHeaderRoot: {
      fontSize: 11,
      fontWeight: "bold",
      color: "#21426C",
      textTransform: "uppercase",
      letterSpacing: 0.6,
      marginBottom: 6,
    },
    tagPill: {
      borderRadius: 12,
      padding: 4,
      paddingLeft: 8,
      paddingRight: 8,
      marginBottom: 3,
      border: "1 solid rgba(160, 184, 221, 0.50)",
    },
    tagPillUser: {
      backgroundColor: "rgba(210, 132, 150, 0.18)",
    },
    tagPillApi: {
      backgroundColor: "rgba(160, 184, 221, 0.18)",
    },
    tagPillText: {
      fontSize: 10,
      fontWeight: "bold",
      color: "#21426C",
    },
    tagCount: {
      fontSize: 9,
      color: "#5A6A7A",
      fontWeight: "bold",
      marginLeft: 4,
    },
  });
};

/**
 * Count all tags in a node and its descendants (recursive)
 */
function countAllTags(node: HierarchyNode): number {
  let count = node.tags.length;
  for (const child of node.children.values()) {
    count += countAllTags(child);
  }
  return count;
}

/**
 * Recursive component to render hierarchical tag groups in PDF
 * Styled to match the workspace TagTable appearance
 */
const HierarchyGroup: React.FC<{
  node: HierarchyNode;
  depth?: number;
  styles: ReturnType<typeof getStyles>;
}> = ({ node, depth = 0, styles }) => {
  const hasTags = node.tags.length > 0;
  const hasChildren = node.children.size > 0;
  
  if (!hasTags && !hasChildren) return null;

  const sortedChildren = Array.from(node.children.values()).sort((a, b) =>
    a.label.localeCompare(b.label, undefined, { sensitivity: "base" })
  );

  const totalTagCount = countAllTags(node);

  return (
    <View
      style={[
        styles.hierarchyGroup,
        {
          marginLeft: depth > 0 ? depth * 6 : 0,
          marginBottom: depth === 0 ? 6 : 4,
        },
      ]}
    >
      {/* Category header */}
      {(hasTags || hasChildren) && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginBottom: hasTags || hasChildren ? 4 : 0,
          }}
        >
          {/* Visual depth indicator */}
          {depth > 0 && (
            <View
              style={{
                width: 2,
                height: 12,
                backgroundColor: "#A0B8DD",
                opacity: 0.5,
                marginRight: 4,
                borderRadius: 1,
              }}
            />
          )}
          <Text
            style={depth === 0 ? styles.categoryHeaderRoot : styles.categoryHeader}
          >
            {node.label}
          </Text>
          {totalTagCount > 0 && (
            <Text style={styles.tagCount}>{totalTagCount}</Text>
          )}
        </View>
      )}

      {/* Tags at this level */}
      {hasTags && (
        <View style={{ marginBottom: hasChildren ? 4 : 0 }}>
          {node.tags
            .slice()
            .sort((a, b) =>
              a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
            )
            .map((tag, idx) => (
              <View
                key={`${node.fullPath.join(" › ")}::${tag.name}::${idx}`}
                style={[
                  styles.tagPill,
                  tag.source === "user" ? styles.tagPillUser : styles.tagPillApi,
                ]}
              >
                <Text style={styles.tagPillText}>{tag.name}</Text>
              </View>
            ))}
        </View>
      )}

      {/* Recursively render children */}
      {hasChildren &&
        sortedChildren.map((child) => (
          <HierarchyGroup
            key={child.fullPath.join(" › ")}
            node={child}
            depth={depth + 1}
            styles={styles}
          />
        ))}
    </View>
  );
};

/**
 * PDF Document Component for Workspace Export
 */
const WorkspacePdfDocument: React.FC<{ 
  workspace: Workspace;
  thesaurusIndex?: ThesaurusIndexItem[];
}> = ({ workspace, thesaurusIndex }) => {
  // Get styles with correct font family
  const styles = getStyles();
  // Get all unique entity types for legend
  const allSpans = [
    ...(workspace.userSpans || []),
    ...(workspace.apiSpans || []),
    ...(workspace.translations?.flatMap((t) => [
      ...(t.userSpans || []),
      ...(t.apiSpans || []),
    ]) || []),
  ];

  const entityTypes = Array.from(
    new Set(allSpans.map((span) => span.entity))
  ).sort();

  // Process main document text with annotations and segment highlights
  const segments = workspace.segments || [];
  const mainTextSegments = processAnnotatedText(
    workspace.text || "",
    [...(workspace.userSpans || []), ...(workspace.apiSpans || [])],
    workspace.deletedApiKeys,
    segments.map(s => ({ start: s.start, end: s.end, id: s.id }))
  );

  // Group tags by scope (document vs segment)
  const documentTags = workspace.tags?.filter((tag) => !tag.segmentId) || [];
  const segmentTagsMap = new Map<string, typeof documentTags>();
  workspace.tags?.forEach((tag) => {
    if (tag.segmentId) {
      if (!segmentTagsMap.has(tag.segmentId)) {
        segmentTagsMap.set(tag.segmentId, []);
      }
      segmentTagsMap.get(tag.segmentId)!.push(tag);
    }
  });

  // Convert TagItem[] to TagRow[] format and build hierarchy if thesaurusIndex is available
  const documentTagRows = documentTags.map((tag) => ({
    name: tag.name,
    source: tag.source,
    keywordId: tag.label, // TagItem uses 'label' for keywordId
    parentId: tag.parentId,
  }));

  const documentTagHierarchy = thesaurusIndex && thesaurusIndex.length > 0
    ? buildTagHierarchy(documentTagRows, thesaurusIndex)
    : null;

  // Build hierarchies for segment tags
  const segmentTagHierarchies = new Map<string, Map<string, HierarchyNode> | null>();
  if (thesaurusIndex && thesaurusIndex.length > 0) {
    segmentTagsMap.forEach((tags, segmentId) => {
      const tagRows = tags.map((tag) => ({
        name: tag.name,
        source: tag.source,
        keywordId: tag.label,
        parentId: tag.parentId,
      }));
      segmentTagHierarchies.set(segmentId, buildTagHierarchy(tagRows, thesaurusIndex));
    });
  }

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{workspace.name}</Text>
          <Text style={styles.metadata}>Workspace ID: {workspace.id}</Text>
          {workspace.owner && (
            <Text style={styles.metadata}>Owner: {workspace.owner}</Text>
          )}
          <Text style={styles.metadata}>
            Last Updated: {formatDate(workspace.updatedAt)}
          </Text>
          <Text style={styles.metadata}>
            Exported: {formatDate(Date.now())}
          </Text>
        </View>

        {/* Color Legend */}
        {entityTypes.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Annotation Color Legend</Text>
            <View style={styles.legendContainer}>
              {entityTypes.map((entity) => {
                const [r, g, b] = getEntityRgb(entity);
                return (
                  <View key={entity} style={styles.legendItem}>
                    <View
                      style={[
                        styles.legendColorBox,
                        { backgroundColor: `rgb(${r}, ${g}, ${b})` },
                      ]}
                    />
                    <Text style={styles.legendText}>
                      {getEntityDisplayName(entity)} ({entity})
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Document Text */}
        {workspace.text && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Document Text</Text>
            <View style={styles.textContainer}>
              <Text style={styles.annotatedText}>
                {mainTextSegments.map((segment, idx) => {
                  // Skip empty segments to avoid rendering issues
                  if (!segment.text) return null;
                  
                  // Build style object combining entity annotation and segment border highlight
                  const style: Record<string, string | number> = {
                    color: "#0F172A",
                  };
                  
                  // Add segment border highlighting (darker green background at segment.end)
                  if (segment.isSegmentBorder) {
                    style.backgroundColor = "rgba(139, 195, 74, 0.3)"; // Darker green like workspace border
                  }
                  
                  // Add entity annotation
                  if (segment.entity && segment.color) {
                    const [r, g, b] = segment.color;
                    // If segment border is highlighted, blend the colors
                    if (segment.isSegmentBorder) {
                      // Blend entity color with segment border green background
                      const entityBg = `rgb(${Math.round(r * 0.2 + 139 * 0.8)}, ${Math.round(g * 0.2 + 195 * 0.8)}, ${Math.round(b * 0.2 + 74 * 0.8)})`;
                      style.backgroundColor = entityBg;
                    } else {
                      style.backgroundColor = `rgb(${Math.round(r * 0.2 + 255 * 0.8)}, ${Math.round(g * 0.2 + 255 * 0.8)}, ${Math.round(b * 0.2 + 255 * 0.8)})`;
                    }
                    style.textDecoration = "underline";
                    style.textDecorationStyle = "dotted";
                  }
                  
                  // Wrap segment border in Link if it has a segmentId
                  if (segment.isSegmentBorder && segment.segmentId) {
                    // Link component - wrap Text with backgroundColor inside
                    return (
                      <Link
                        key={idx}
                        src={`#segment-${segment.segmentId}`}
                      >
                        <Text style={style}>
                          {segment.text}
                        </Text>
                      </Link>
                    );
                  }
                  
                  return (
                    <Text key={idx} style={style}>
                      {segment.text}
                    </Text>
                  );
                })}
              </Text>
            </View>
          </View>
        )}

        {/* Document-level Tags */}
        {documentTags.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Document Tags</Text>
            <View style={{ marginTop: 8 }}>
              {/* Hierarchical or flat tag display */}
              {documentTagHierarchy ? (
                // Hierarchical display using thesaurus
                Array.from(documentTagHierarchy.values())
                  .sort((a, b) =>
                    a.label.localeCompare(b.label, undefined, { sensitivity: "base" })
                  )
                  .map((rootNode) => (
                    <HierarchyGroup
                      key={rootNode.fullPath.join(" › ")}
                      node={rootNode}
                      depth={0}
                      styles={styles}
                    />
                  ))
              ) : (
                // Fallback: Flat display (alphabetical) in table format
                <View style={styles.tagsTable}>
                  <View style={styles.tableHeader}>
                    <Text style={styles.tableHeaderCell}>Tag Name</Text>
                  </View>
                  {documentTags
                    .slice()
                    .sort((a, b) =>
                      a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
                    )
                    .map((tag, idx) => (
                      <View
                        key={`doc-${idx}`}
                        style={
                          idx === documentTags.length - 1
                            ? styles.tableRowLast
                            : styles.tableRow
                        }
                      >
                        <Text style={styles.tableCell}>{tag.name}</Text>
                      </View>
                    ))}
                </View>
              )}
            </View>
          </View>
        )}

        {/* Translations */}
        {workspace.translations && workspace.translations.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Translations</Text>
            {workspace.translations.map((translation, idx) => {
              const translationSegments = processAnnotatedText(
                translation.text,
                [
                  ...(translation.userSpans || []),
                  ...(translation.apiSpans || []),
                ],
                translation.deletedApiKeys
              );

              return (
                <View key={idx} style={styles.translationSection}>
                  <Text style={styles.translationHeader}>
                    {translation.language.toUpperCase()} (from{" "}
                    {translation.sourceLang})
                  </Text>
                  <Text style={styles.metadata}>
                    Created: {formatDate(translation.createdAt)} | Updated:{" "}
                    {formatDate(translation.updatedAt)}
                  </Text>
                  <View style={styles.textContainer}>
                    <Text style={styles.annotatedText}>
                      {translationSegments.map((segment, segIdx) => {
                        // Skip empty segments to avoid rendering issues
                        if (!segment.text) return null;
                        
                        if (segment.entity && segment.color) {
                          const [r, g, b] = segment.color;
                          return (
                            <Text
                              key={segIdx}
                              style={{
                                backgroundColor: `rgb(${Math.round(r * 0.2 + 255 * 0.8)}, ${Math.round(g * 0.2 + 255 * 0.8)}, ${Math.round(b * 0.2 + 255 * 0.8)})`,
                                color: "#0F172A",
                                textDecoration: "underline",
                                textDecorationStyle: "dotted",
                              }}
                            >
                              {segment.text}
                            </Text>
                          );
                        }
                        return (
                          <Text key={segIdx} style={styles.plainText}>
                            {segment.text}
                          </Text>
                        );
                      })}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Segments */}
        {workspace.segments && workspace.segments.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Segments</Text>
            {workspace.segments
              .sort((a, b) => a.order - b.order)
              .map((segment) => {
                const segmentText =
                  segment.text ||
                  getSegmentText(segment, workspace.text || "");
                const segmentTags = segmentTagsMap.get(segment.id) || [];

                return (
                  <View key={segment.id} id={`segment-${segment.id}`} style={styles.segmentItem}>
                    <Text style={styles.segmentHeader}>
                      {segment.id}
                    </Text>
                    <Text style={styles.segmentText}>{segmentText}</Text>
                    {segmentTags.length > 0 && (
                      <View style={{ marginTop: 8 }}>
                        {(() => {
                          const segmentHierarchy = segmentTagHierarchies.get(segment.id);
                          if (segmentHierarchy) {
                            // Hierarchical display using thesaurus
                            return Array.from(segmentHierarchy.values())
                              .sort((a, b) =>
                                a.label.localeCompare(b.label, undefined, { sensitivity: "base" })
                              )
                              .map((rootNode) => (
                                <HierarchyGroup
                                  key={rootNode.fullPath.join(" › ")}
                                  node={rootNode}
                                  depth={0}
                                  styles={styles}
                                />
                              ));
                          } else {
                            // Fallback: Flat display (alphabetical) in table format
                            return (
                              <View style={styles.tagsTable}>
                                <View style={styles.tableHeader}>
                                  <Text style={styles.tableHeaderCell}>Tags</Text>
                                </View>
                                {segmentTags
                                  .slice()
                                  .sort((a, b) =>
                                    a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
                                  )
                                  .map((tag, tagIdx) => (
                                    <View
                                      key={tagIdx}
                                      style={
                                        tagIdx === segmentTags.length - 1
                                          ? styles.tableRowLast
                                          : styles.tableRow
                                      }
                                    >
                                      <Text style={styles.tableCell}>{tag.name}</Text>
                                    </View>
                                  ))}
                              </View>
                            );
                          }
                        })()}
                      </View>
                    )}
                    {segment.translations &&
                      Object.keys(segment.translations).length > 0 && (
                        <View style={{ marginTop: 8 }}>
                          <Text style={styles.segmentTranslationHeader}>
                            Translations
                          </Text>
                          {Object.entries(segment.translations).map(
                            ([lang, transText]) => (
                              <Text
                                key={lang}
                                style={styles.segmentTranslation}
                              >
                                {lang.toUpperCase()}: {transText}
                              </Text>
                            )
                          )}
                        </View>
                      )}
                  </View>
                );
              })}
          </View>
        )}

        {/* Empty states */}
        {!workspace.text && (
          <View style={styles.section}>
            <Text style={styles.emptyState}>No document text available</Text>
          </View>
        )}
      </Page>
    </Document>
  );
};

/**
 * PDF Export Service
 */
export class PdfExportService {
  /**
   * Generate and download PDF for a workspace
   */
  static async exportWorkspace(workspace: Workspace): Promise<void> {
    try {
      // Ensure fonts are registered before generating PDF
      await registerFonts();

      // Load thesaurus index for hierarchical tag display
      let thesaurusIndex: ThesaurusIndexItem[] | undefined;
      try {
        thesaurusIndex = await loadThesaurusIndex();
      } catch (error) {
        console.warn("Could not load thesaurus index, tags will be displayed flat:", error);
        // Continue without thesaurus - tags will be displayed in flat alphabetical order
      }

      // Sanitize filename
      const sanitizedName = workspace.name.replace(/[^a-z0-9]/gi, "_");
      const filename = `${sanitizedName}_${workspace.id}.pdf`;

      // Generate PDF blob
      const blob = await pdf(
        <WorkspacePdfDocument workspace={workspace} thesaurusIndex={thesaurusIndex} />
      ).toBlob();

      // Create download link and trigger download
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error exporting PDF:", error);
      throw error;
    }
  }
}

