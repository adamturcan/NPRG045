// src/components/editor/CategoryMenu.tsx
/**
 * CategoryMenu - Dropdown menu for selecting entity categories
 * 
 * This component displays a popup menu with all available entity categories.
 * Each category is shown with its color indicator. The menu can be opened from:
 * - SelectionBubble (to annotate new text)
 * - SpanBubble (to edit existing annotations)
 * 
 * When editing an existing annotation (showDelete=true), a Delete option is
 * also displayed at the bottom of the menu.
 */
import React from "react";
import { Menu, MenuItem, Divider } from "@mui/material";
import { ENTITY_COLORS, CATEGORY_LIST } from "../../constants/notationEditor";
import type { CategoryMenuProps } from "../../types/NotationEditor";

const CategoryMenu: React.FC<CategoryMenuProps> = ({
  anchorEl,
  onClose,
  onCategorySelect,
  onMouseDown,
  showDelete = false,
  onDelete,
}) => {
  return (
    <Menu
      anchorEl={anchorEl}
      open={!!anchorEl}
      onClose={onClose}
      MenuListProps={{
        dense: true,
        onMouseDown, // Prevents menu from closing during interaction
      }}
      PaperProps={{
        onMouseDown, // Prevents menu from closing during interaction
      }}
    >
      {/* Render all available entity categories */}
      {CATEGORY_LIST.map((category) => (
        <MenuItem
          key={category}
          onClick={() => onCategorySelect(category)}
        >
          {/* Color indicator dot */}
          <span
            style={{
              display: "inline-block",
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: ENTITY_COLORS[category] ?? "#64748B",
              marginRight: 8,
            }}
          />
          {category}
        </MenuItem>
      ))}
      {/* Show delete option when editing existing annotations */}
      {showDelete && [
        <Divider key="divider" />,
        <MenuItem
          key="delete"
          onClick={onDelete}
          sx={{ color: "#b91c1c", fontWeight: 600 }}
        >
          Delete
        </MenuItem>
      ]}
    </Menu>
  );
};

export default CategoryMenu;