import React from "react";
import { Menu, MenuItem, Divider, Box } from "@mui/material";
import { ENTITY_COLORS, CATEGORY_LIST } from "../../../shared/constants/notationEditor";
import type { CategoryMenuProps } from "../../../types/NotationEditor";

const CategoryMenu: React.FC<CategoryMenuProps> = ({
  anchorEl,
  onClose,
  onCategorySelect,
  showDelete = false,
  onDelete,
}) => {
  
  // Helper to handle click without losing editor focus
  const handleItemClick = (e: React.MouseEvent, category: string) => {
    e.preventDefault(); 
    e.stopPropagation();
    onCategorySelect(category);
  };

  // Helper for delete
  const handleDeleteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  
    if (onDelete) onDelete();
  };

  // Helper to prevent focus loss during mouse down
  const preventFocusLoss = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <Menu
      anchorEl={anchorEl}
      open={!!anchorEl}
      onClose={onClose}
      
      autoFocus={false} 
      disableAutoFocus={true} 
      disableEnforceFocus={true}
      
      
      MenuListProps={{
        dense: true,
        onMouseDown: preventFocusLoss, 
      }}
    >
      {CATEGORY_LIST.map((category: string) => (
        <MenuItem
          key={category}          
          onMouseDown={preventFocusLoss}
          onClick={(e) => handleItemClick(e, category)}
        >
          <Box
            component="span"
            sx={{
              display: "inline-block",
              width: 10,
              height: 10,
              borderRadius: "50%",
              bgcolor: ENTITY_COLORS[category] ?? "#64748B",
              mr: 1,
            }}
          />
          {category}
        </MenuItem>
      ))}

      {showDelete && onDelete && [
        <Divider key="divider" />,
        <MenuItem
          key="delete"
          onMouseDown={preventFocusLoss}
          onClick={handleDeleteClick}
          sx={{ color: "#b91c1c", fontWeight: 600 }}
        >
          Delete
        </MenuItem>
      ]}
    </Menu>
  );
};

export default CategoryMenu;