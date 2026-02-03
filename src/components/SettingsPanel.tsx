'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, X, GitBranch, FileText, Scissors, CheckSquare, RotateCcw } from 'lucide-react';

import { usePreferencesStore, selectBranchingPreferences, selectUIPreferences } from '@/stores/preferences-store';
import { colors, spacing, effects, typography, animation } from '@/lib/design-tokens';
import type { InheritanceMode } from '@/types';

// =============================================================================
// STYLES
// =============================================================================

const overlayStyles: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.6)',
  backdropFilter: 'blur(4px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 9999,
};

const panelStyles: React.CSSProperties = {
  backgroundColor: colors.navy.light,
  borderRadius: effects.border.radius.md,
  border: `1px solid rgba(99, 102, 241, 0.3)`,
  boxShadow: effects.shadow.lg,
  width: '90%',
  maxWidth: '500px',
  maxHeight: '80vh',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
};

const headerStyles: React.CSSProperties = {
  padding: spacing[4],
  borderBottom: `1px solid rgba(99, 102, 241, 0.2)`,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
};

const contentStyles: React.CSSProperties = {
  padding: spacing[4],
  overflowY: 'auto',
  flex: 1,
};

const sectionStyles: React.CSSProperties = {
  marginBottom: spacing[4],
};

const sectionTitleStyles: React.CSSProperties = {
  fontSize: typography.sizes.sm,
  fontWeight: 600,
  color: colors.contrast.white,
  marginBottom: spacing[2],
  display: 'flex',
  alignItems: 'center',
  gap: spacing[1],
  fontFamily: typography.fonts.body,
};

const labelStyles: React.CSSProperties = {
  fontSize: typography.sizes.sm,
  color: colors.contrast.gray,
  marginBottom: spacing[1],
  fontFamily: typography.fonts.body,
};

const selectStyles: React.CSSProperties = {
  width: '100%',
  padding: `${spacing[2]} ${spacing[3]}`,
  backgroundColor: colors.navy.dark,
  border: `1px solid rgba(99, 102, 241, 0.3)`,
  borderRadius: effects.border.radius.default,
  color: colors.contrast.white,
  fontSize: typography.sizes.sm,
  fontFamily: typography.fonts.body,
  cursor: 'pointer',
  outline: 'none',
};

const checkboxLabelStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: spacing[2],
  padding: `${spacing[2]} 0`,
  cursor: 'pointer',
};

const descriptionStyles: React.CSSProperties = {
  fontSize: typography.sizes.xs,
  color: colors.contrast.grayDark,
  marginTop: spacing[1],
  fontFamily: typography.fonts.body,
};

const footerStyles: React.CSSProperties = {
  padding: spacing[3],
  borderTop: `1px solid rgba(99, 102, 241, 0.2)`,
  display: 'flex',
  justifyContent: 'flex-end',
  gap: spacing[2],
};

// =============================================================================
// INHERITANCE MODE OPTIONS
// =============================================================================

const INHERITANCE_MODE_OPTIONS: Array<{
  id: InheritanceMode;
  label: string;
  description: string;
  icon: React.ReactNode;
}> = [
  {
    id: 'full',
    label: 'Full Context',
    description: 'Inherit all messages from the parent conversation',
    icon: <FileText size={14} />,
  },
  {
    id: 'summary',
    label: 'Summary (Smart Truncation)',
    description: 'Inherit only the most recent relevant messages',
    icon: <Scissors size={14} />,
  },
  {
    id: 'custom',
    label: 'Custom Selection',
    description: 'Choose which messages to inherit each time',
    icon: <CheckSquare size={14} />,
  },
];

// =============================================================================
// SETTINGS PANEL COMPONENT
// =============================================================================

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
  // Preferences state
  const branchingPrefs = usePreferencesStore(selectBranchingPreferences);
  const uiPrefs = usePreferencesStore(selectUIPreferences);
  const setBranchingPreferences = usePreferencesStore((s) => s.setBranchingPreferences);
  const setUIPreferences = usePreferencesStore((s) => s.setUIPreferences);
  const resetToDefaults = usePreferencesStore((s) => s.resetToDefaults);
  const loadPreferences = usePreferencesStore((s) => s.loadPreferences);

  // Load preferences on mount
  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleReset = () => {
    if (window.confirm('Reset all settings to defaults?')) {
      resetToDefaults();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={overlayStyles}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={animation.spring.snappy}
            style={panelStyles}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={headerStyles}>
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing[2] }}>
                <Settings size={20} color={colors.amber.primary} />
                <h2 style={{
                  fontSize: typography.sizes.lg,
                  fontWeight: 600,
                  color: colors.contrast.white,
                  fontFamily: typography.fonts.heading,
                  margin: 0,
                }}>
                  Settings
                </h2>
              </div>
              <button
                onClick={onClose}
                style={{
                  background: 'none',
                  border: 'none',
                  color: colors.contrast.grayDark,
                  cursor: 'pointer',
                  padding: spacing[1],
                  borderRadius: effects.border.radius.default,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div style={contentStyles}>
              {/* Branching Section */}
              <div style={sectionStyles}>
                <div style={sectionTitleStyles}>
                  <GitBranch size={16} color={colors.amber.primary} />
                  Branching
                </div>

                {/* Default Inheritance Mode */}
                <div style={{ marginBottom: spacing[3] }}>
                  <label style={labelStyles}>Default context inheritance</label>
                  <select
                    value={branchingPrefs.defaultInheritanceMode}
                    onChange={(e) => setBranchingPreferences({
                      defaultInheritanceMode: e.target.value as InheritanceMode
                    })}
                    style={selectStyles}
                  >
                    {INHERITANCE_MODE_OPTIONS.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <p style={descriptionStyles}>
                    {INHERITANCE_MODE_OPTIONS.find(o => o.id === branchingPrefs.defaultInheritanceMode)?.description}
                  </p>
                </div>

                {/* Always Show Branch Dialog */}
                <label style={checkboxLabelStyles}>
                  <input
                    type="checkbox"
                    checked={branchingPrefs.alwaysAskOnBranch}
                    onChange={(e) => setBranchingPreferences({
                      alwaysAskOnBranch: e.target.checked
                    })}
                    style={{
                      width: 16,
                      height: 16,
                      accentColor: colors.amber.primary,
                      cursor: 'pointer',
                    }}
                  />
                  <div>
                    <span style={{
                      fontSize: typography.sizes.sm,
                      color: colors.contrast.white,
                      fontFamily: typography.fonts.body,
                    }}>
                      Always show branch dialog
                    </span>
                    <p style={descriptionStyles}>
                      When disabled, branches will be created immediately with default settings
                    </p>
                  </div>
                </label>
              </div>

              {/* UI Section */}
              <div style={sectionStyles}>
                <div style={sectionTitleStyles}>
                  <Settings size={16} color={colors.violet.primary} />
                  Interface
                </div>

                {/* Show Canvas Tree */}
                <label style={checkboxLabelStyles}>
                  <input
                    type="checkbox"
                    checked={uiPrefs.showCanvasTree}
                    onChange={(e) => setUIPreferences({ showCanvasTree: e.target.checked })}
                    style={{
                      width: 16,
                      height: 16,
                      accentColor: colors.amber.primary,
                      cursor: 'pointer',
                    }}
                  />
                  <div>
                    <span style={{
                      fontSize: typography.sizes.sm,
                      color: colors.contrast.white,
                      fontFamily: typography.fonts.body,
                    }}>
                      Show canvas tree sidebar
                    </span>
                    <p style={descriptionStyles}>
                      Display the canvas hierarchy sidebar
                    </p>
                  </div>
                </label>

                {/* Show Inherited Context Panel */}
                <label style={checkboxLabelStyles}>
                  <input
                    type="checkbox"
                    checked={uiPrefs.showInheritedContext}
                    onChange={(e) => setUIPreferences({ showInheritedContext: e.target.checked })}
                    style={{
                      width: 16,
                      height: 16,
                      accentColor: colors.amber.primary,
                      cursor: 'pointer',
                    }}
                  />
                  <div>
                    <span style={{
                      fontSize: typography.sizes.sm,
                      color: colors.contrast.white,
                      fontFamily: typography.fonts.body,
                    }}>
                      Show inherited context panel
                    </span>
                    <p style={descriptionStyles}>
                      Display inherited context info on branched canvases
                    </p>
                  </div>
                </label>

                {/* Confirm on Delete */}
                <label style={checkboxLabelStyles}>
                  <input
                    type="checkbox"
                    checked={uiPrefs.confirmOnDelete}
                    onChange={(e) => setUIPreferences({ confirmOnDelete: e.target.checked })}
                    style={{
                      width: 16,
                      height: 16,
                      accentColor: colors.amber.primary,
                      cursor: 'pointer',
                    }}
                  />
                  <div>
                    <span style={{
                      fontSize: typography.sizes.sm,
                      color: colors.contrast.white,
                      fontFamily: typography.fonts.body,
                    }}>
                      Confirm before deleting
                    </span>
                    <p style={descriptionStyles}>
                      Show confirmation dialog before deleting items
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {/* Footer */}
            <div style={footerStyles}>
              <button
                onClick={handleReset}
                style={{
                  padding: `${spacing[2]} ${spacing[3]}`,
                  backgroundColor: 'transparent',
                  border: `1px solid rgba(99, 102, 241, 0.3)`,
                  borderRadius: effects.border.radius.default,
                  color: colors.contrast.grayDark,
                  fontSize: typography.sizes.sm,
                  fontFamily: typography.fonts.body,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: spacing[1],
                }}
              >
                <RotateCcw size={14} />
                Reset to Defaults
              </button>
              <button
                onClick={onClose}
                style={{
                  padding: `${spacing[2]} ${spacing[3]}`,
                  backgroundColor: colors.amber.primary,
                  border: 'none',
                  borderRadius: effects.border.radius.default,
                  color: colors.navy.dark,
                  fontSize: typography.sizes.sm,
                  fontFamily: typography.fonts.body,
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Done
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// =============================================================================
// SETTINGS BUTTON COMPONENT
// =============================================================================

interface SettingsButtonProps {
  onClick: () => void;
}

export function SettingsButton({ onClick }: SettingsButtonProps) {
  return (
    <button
      onClick={onClick}
      title="Settings"
      style={{
        position: 'fixed',
        bottom: spacing[4],
        right: spacing[4],
        width: 48,
        height: 48,
        borderRadius: '50%',
        backgroundColor: colors.navy.light,
        border: `1px solid rgba(99, 102, 241, 0.3)`,
        boxShadow: effects.shadow.lg,
        color: colors.contrast.gray,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.2s ease',
        zIndex: 100,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = colors.navy.dark;
        e.currentTarget.style.color = colors.amber.primary;
        e.currentTarget.style.transform = 'scale(1.05)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = colors.navy.light;
        e.currentTarget.style.color = colors.contrast.gray;
        e.currentTarget.style.transform = 'scale(1)';
      }}
    >
      <Settings size={20} />
    </button>
  );
}

export default SettingsPanel;
