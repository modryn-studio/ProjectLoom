'use client';

import React, { Component, ReactNode } from 'react';
import { colors, typography, spacing, effects } from '@/lib/design-tokens';
import { zIndex } from '@/constants/zIndex';

// =============================================================================
// TYPES
// =============================================================================

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

// =============================================================================
// ERROR BOUNDARY COMPONENT
// =============================================================================

/**
 * Error Boundary for catching and displaying runtime errors
 * 
 * Wraps the canvas and other critical components to prevent
 * white screen crashes and provide recovery options.
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
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    this.setState({ errorInfo });
    
    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('ErrorBoundary caught an error:', error);
      console.error('Component stack:', errorInfo.componentStack);
    }
    
    // TODO: Send to error tracking service (Sentry, etc.)
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Custom fallback provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div style={styles.container}>
          <div style={styles.card}>
            <div style={styles.iconContainer}>
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke={colors.amber.primary}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            
            <h2 style={styles.title}>Something went wrong</h2>
            
            <p style={styles.message}>
              An unexpected error occurred. Your work is saved locally.
            </p>
            
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div style={styles.errorDetails}>
                <code style={styles.errorCode}>
                  {this.state.error.name}: {this.state.error.message}
                </code>
                {this.state.errorInfo && (
                  <pre style={styles.stackTrace}>
                    {this.state.errorInfo.componentStack}
                  </pre>
                )}
              </div>
            )}
            
            <div style={styles.actions}>
              <button
                onClick={this.handleReset}
                style={styles.primaryButton}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = colors.amber.dark;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = colors.amber.primary;
                }}
              >
                Try Again
              </button>
              
              <button
                onClick={this.handleReload}
                style={styles.secondaryButton}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = colors.navy.hover;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// =============================================================================
// STYLES
// =============================================================================

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'fixed',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.navy.bg,
    zIndex: zIndex.top.errorBoundary,
    padding: spacing[4],
  },
  
  card: {
    backgroundColor: colors.navy.light,
    borderRadius: effects.border.radius.lg,
    padding: spacing[8],
    maxWidth: '480px',
    width: '100%',
    textAlign: 'center',
    boxShadow: effects.shadow.xl,
    border: `1px solid ${colors.navy.hover}`,
  },
  
  iconContainer: {
    marginBottom: spacing[4],
  },
  
  title: {
    fontFamily: typography.fonts.heading,
    fontSize: typography.sizes['2xl'],
    fontWeight: typography.weights.semibold,
    color: colors.contrast.white,
    marginBottom: spacing[2],
  },
  
  message: {
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes.base,
    color: colors.contrast.gray,
    marginBottom: spacing[6],
    lineHeight: typography.lineHeights.relaxed,
  },
  
  errorDetails: {
    backgroundColor: colors.navy.dark,
    borderRadius: effects.border.radius.default,
    padding: spacing[4],
    marginBottom: spacing[6],
    textAlign: 'left',
    overflow: 'auto',
    maxHeight: '200px',
  },
  
  errorCode: {
    fontFamily: typography.fonts.code,
    fontSize: typography.sizes.sm,
    color: colors.semantic.error,
    display: 'block',
    marginBottom: spacing[2],
  },
  
  stackTrace: {
    fontFamily: typography.fonts.code,
    fontSize: typography.sizes.xs,
    color: colors.contrast.grayDark,
    margin: 0,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  
  actions: {
    display: 'flex',
    gap: spacing[3],
    justifyContent: 'center',
  },
  
  primaryButton: {
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.contrast.black,
    backgroundColor: colors.amber.primary,
    border: 'none',
    borderRadius: effects.border.radius.default,
    padding: `${spacing[2]} ${spacing[5]}`,
    cursor: 'pointer',
    transition: `background-color ${animation.duration.fast}ms`,
  },
  
  secondaryButton: {
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.contrast.white,
    backgroundColor: 'transparent',
    border: `1px solid ${colors.contrast.grayDark}`,
    borderRadius: effects.border.radius.default,
    padding: `${spacing[2]} ${spacing[5]}`,
    cursor: 'pointer',
    transition: `background-color ${animation.duration.fast}ms`,
  },
};

// Import animation for styles
import { animation } from '@/lib/design-tokens';

export default ErrorBoundary;
