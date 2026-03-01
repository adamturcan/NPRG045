import React from 'react';
import { 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogContentText, 
  DialogActions, 
  Button 
} from '@mui/material';

interface Props {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const SegmentJoinDialog: React.FC<Props> = ({ open, onConfirm, onCancel }) => {
  return (
    <Dialog open={open} onClose={onCancel}>
      <DialogTitle>Merge Segments?</DialogTitle>
      <DialogContent>
        <DialogContentText>
          You are attempting to delete a segment boundary. Do you want to join these two segments together?
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} color="inherit">
          Cancel
        </Button>
        <Button onClick={onConfirm} color="primary" variant="contained" autoFocus>
          Yes, Merge
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SegmentJoinDialog;