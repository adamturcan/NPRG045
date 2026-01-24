import React, { Component } from 'react';
import type { ReactNode } from 'react';
import { Box, Typography, Button, Paper } from '@mui/material';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

/**
 * Error Boundary component to catch and display React errors gracefully
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error details
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    // Update state with error info
    this.setState({
      error,
      errorInfo,
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

  }

  handleReset = () => {
    // Reset error state to allow user to try again
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return <ErrorFallbackUI 
        error={this.state.error} 
        errorInfo={this.state.errorInfo}
        onReset={this.handleReset}
      />;
    }

    return this.props.children;
  }
}

interface ErrorFallbackUIProps {
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  onReset: () => void;
}

const ErrorFallbackUI: React.FC<ErrorFallbackUIProps> = ({ error, errorInfo, onReset }) => {
  const errorMessage = error?.message || 'An unexpected error occurred';
  const errorStack = error?.stack;
  const componentStack = errorInfo?.componentStack;

  return (
    <Box
      role="alert"
      aria-live="assertive"
      sx={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'background.default',
        p: 3,
        zIndex: (theme) => theme.zIndex.modal + 1, 
      }}
    >
      <Paper
        elevation={8}
        sx={{
          maxWidth: 600,
          width: '100%',
          p: 4,
          textAlign: 'center',
          backgroundColor: (theme) => 
            theme.palette.mode === 'dark' 
              ? 'rgba(255, 255, 255, 0.05)' 
              : 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(10px)',
        }}
      >
        <ErrorOutlineIcon
          sx={{
            fontSize: 64,
            color: 'error.main',
            mb: 2,
          }}
          aria-hidden="true"
        />
        <Typography variant="h4" component="h1" gutterBottom color="error.main">
          Something went wrong
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          {errorMessage}
        </Typography>

        {/* Error details (expandable for debugging) */}
        {(errorStack || componentStack) && (
          <Box sx={{ mb: 3 }}>
            <Box
              component="details"
              sx={{
                textAlign: 'left',
                backgroundColor: (theme) => 
                  theme.palette.mode === 'dark' 
                    ? 'rgba(255, 255, 255, 0.05)' 
                    : theme.palette.grey[100],
                p: 1.5,
                borderRadius: 1,
                fontSize: '0.875rem',
                maxHeight: 200,
                overflow: 'auto',
                display: 'block',
                '& summary': {
                  cursor: 'pointer',
                  mb: 1,
                  fontWeight: 600,
                  display: 'list-item',
                  '&:focus-visible': {
                    outline: (theme) => `2px solid ${theme.palette.primary.main}`,
                    outlineOffset: 2,
                    borderRadius: 1,
                  },
                },
              }}
            >
              <summary>Error Details (Click to expand)</summary>
              {errorStack && (
                <Box component="section" sx={{ mb: 2 }}>
                  <Typography 
                    variant="caption" 
                    component="pre" 
                    sx={{ 
                      whiteSpace: 'pre-wrap', 
                      fontFamily: 'monospace',
                      fontSize: '0.75rem',
                      m: 0,
                    }}
                  >
                    {errorStack}
                  </Typography>
                </Box>
              )}
              {componentStack && (
                <Box component="section">
                  <Typography 
                    variant="caption" 
                    component="pre" 
                    sx={{ 
                      whiteSpace: 'pre-wrap', 
                      fontFamily: 'monospace',
                      fontSize: '0.75rem',
                      m: 0,
                    }}
                  >
                    {componentStack}
                  </Typography>
                </Box>
              )}
            </Box>
          </Box>
        )}

        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Button
            variant="contained"
            color="primary"
            onClick={onReset}
            sx={{ minWidth: 120 }}
            aria-label="Try again to recover from error"
          >
            Try Again
          </Button>
          <Button
            variant="outlined"
            color="secondary"
            onClick={() => window.location.reload()}
            sx={{ minWidth: 120 }}
            aria-label="Reload the entire page"
          >
            Reload Page
          </Button>
        </Box>
      </Paper>
    </Box>
  );
};

export default ErrorBoundary;

