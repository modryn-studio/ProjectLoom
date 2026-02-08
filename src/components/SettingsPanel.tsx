'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, X, GitBranch, FileText, Scissors, RotateCcw, Key, Eye, EyeOff, Trash2, CheckCircle, Monitor, Sun, Moon } from 'lucide-react';

import { usePreferencesStore, selectBranchingPreferences, selectUIPreferences, selectTheme } from '@/stores/preferences-store';
import { apiKeyManager, type ProviderType, type StorageType } from '@/lib/api-key-manager';
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
  backgroundColor: colors.bg.secondary,
  borderRadius: effects.border.radius.md,
  border: `1px solid ${colors.border.default}`,
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
  borderBottom: `1px solid ${colors.border.default}`,
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
  color: colors.fg.primary,
  marginBottom: spacing[2],
  display: 'flex',
  alignItems: 'center',
  gap: spacing[1],
  fontFamily: typography.fonts.body,
};

const labelStyles: React.CSSProperties = {
  fontSize: typography.sizes.sm,
  color: colors.fg.secondary,
  marginBottom: spacing[1],
  fontFamily: typography.fonts.body,
};

const selectStyles: React.CSSProperties = {
  width: '100%',
  padding: `${spacing[2]} ${spacing[3]}`,
  backgroundColor: colors.bg.inset,
  border: `1px solid ${colors.border.default}`,
  borderRadius: effects.border.radius.default,
  color: colors.fg.primary,
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
  color: colors.fg.tertiary,
  marginTop: spacing[1],
  fontFamily: typography.fonts.body,
};

const footerStyles: React.CSSProperties = {
  padding: spacing[3],
  borderTop: `1px solid ${colors.border.default}`,
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
  const currentTheme = usePreferencesStore(selectTheme);
  const setBranchingPreferences = usePreferencesStore((s) => s.setBranchingPreferences);
  const setUIPreferences = usePreferencesStore((s) => s.setUIPreferences);
  const setTheme = usePreferencesStore((s) => s.setTheme);
  const resetToDefaults = usePreferencesStore((s) => s.resetToDefaults);
  const loadPreferences = usePreferencesStore((s) => s.loadPreferences);

  // API Keys state
  const [anthropicKey, setAnthropicKey] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [showAnthropicKey, setShowAnthropicKey] = useState(false);
  const [showOpenAIKey, setShowOpenAIKey] = useState(false);
  const [keysLoaded, setKeysLoaded] = useState(false);
  const [storagePreference, setStoragePreference] = useState<StorageType>('localStorage');

  // Load preferences and API keys on mount
  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

  useEffect(() => {
    if (isOpen && !keysLoaded) {
      const savedAnthropicKey = apiKeyManager.getKey('anthropic');
      const savedOpenAIKey = apiKeyManager.getKey('openai');
      const currentStoragePreference = apiKeyManager.getStoragePreference();

      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (savedAnthropicKey) setAnthropicKey(savedAnthropicKey);
       
      if (savedOpenAIKey) setOpenaiKey(savedOpenAIKey);
       
      setStoragePreference(currentStoragePreference);
       
      setKeysLoaded(true);
    }
  }, [isOpen, keysLoaded]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        onClose();
        return;
      }

      if (e.key === 'Enter') {
        const target = e.target as HTMLElement | null;
        const tagName = target?.tagName?.toLowerCase();
        if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') return;
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

  // API Key handlers
  const handleSaveKey = useCallback((provider: ProviderType, key: string) => {
    if (key.trim()) {
      apiKeyManager.saveKey(provider, key.trim());
      // Mark setup as complete
      if (typeof window !== 'undefined') {
        localStorage.setItem('projectloom:keys-configured', 'true');
      }
    }
  }, []);

  const handleDeleteKey = useCallback((provider: ProviderType) => {
    if (window.confirm(`Delete ${provider === 'anthropic' ? 'Anthropic' : 'OpenAI'} API key?`)) {
      apiKeyManager.removeKey(provider);
      if (provider === 'anthropic') {
        setAnthropicKey('');
      } else {
        setOpenaiKey('');
      }
    }
  }, []);

  const handleChangeStoragePreference = useCallback((type: StorageType) => {
    apiKeyManager.setStoragePreference(type);
    setStoragePreference(type);
  }, []);

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
                <Settings size={20} color={colors.accent.primary} />
                <h2 style={{
                  fontSize: typography.sizes.lg,
                  fontWeight: 600,
                  color: colors.fg.primary,
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
                  color: colors.fg.quaternary,
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
              {/* Appearance Section */}
              <div style={sectionStyles}>
                <div style={sectionTitleStyles}>
                  <Monitor size={16} color={colors.accent.primary} />
                  Appearance
                </div>

                {/* Theme Selector */}
                <div style={{ marginBottom: spacing[3] }}>
                  <label style={labelStyles}>Theme</label>
                  <div style={{
                    display: 'flex',
                    gap: spacing[2],
                  }}>
                    {([
                      { id: 'system', label: 'System', icon: Monitor },
                      { id: 'light', label: 'Light', icon: Sun },
                      { id: 'dark', label: 'Dark', icon: Moon },
                    ] as const).map((option) => {
                      const Icon = option.icon;
                      const isSelected = currentTheme === option.id;
                      return (
                        <button
                          key={option.id}
                          onClick={() => setTheme(option.id)}
                          style={{
                            flex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: spacing[1],
                            padding: `${spacing[2]} ${spacing[3]}`,
                            backgroundColor: isSelected ? colors.accent.muted : colors.bg.inset,
                            border: `1px solid ${isSelected ? colors.accent.primary : colors.border.default}`,
                            borderRadius: effects.border.radius.default,
                            color: isSelected ? colors.accent.primary : colors.fg.secondary,
                            fontSize: typography.sizes.sm,
                            fontFamily: typography.fonts.body,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <Icon size={14} />
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                  <p style={descriptionStyles}>
                    {currentTheme === 'system' && 'Follows your operating system preference'}
                    {currentTheme === 'light' && 'Light theme for bright environments'}
                    {currentTheme === 'dark' && 'Dark theme for reduced eye strain'}
                  </p>
                </div>
              </div>

              {/* Branching Section */}
              <div style={sectionStyles}>
                <div style={sectionTitleStyles}>
                  <GitBranch size={16} color={colors.accent.primary} />
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
                      accentColor: colors.accent.primary,
                      cursor: 'pointer',
                    }}
                  />
                  <div>
                    <span style={{
                      fontSize: typography.sizes.sm,
                      color: colors.fg.primary,
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
                  <Settings size={16} color={colors.accent.primary} />
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
                      accentColor: colors.accent.primary,
                      cursor: 'pointer',
                    }}
                  />
                  <div>
                    <span style={{
                      fontSize: typography.sizes.sm,
                      color: colors.fg.primary,
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
                      accentColor: colors.accent.primary,
                      cursor: 'pointer',
                    }}
                  />
                  <div>
                    <span style={{
                      fontSize: typography.sizes.sm,
                      color: colors.fg.primary,
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
                      accentColor: colors.accent.primary,
                      cursor: 'pointer',
                    }}
                  />
                  <div>
                    <span style={{
                      fontSize: typography.sizes.sm,
                      color: colors.fg.primary,
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

              {/* API Keys Section */}
              <div style={sectionStyles}>
                <div style={sectionTitleStyles}>
                  <Key size={16} color={colors.semantic.success} />
                  API Keys
                </div>

                <p style={{ ...descriptionStyles, marginBottom: spacing[3] }}>
                  Your API keys are stored locally in your browser and never sent to our servers.
                </p>

                {/* Storage Type */}
                <div style={{ marginBottom: spacing[3] }}>
                  <label style={labelStyles}>Storage Type</label>
                  <select
                    value={storagePreference}
                    onChange={(e) => handleChangeStoragePreference(e.target.value as StorageType)}
                    style={selectStyles}
                  >
                    <option value="localStorage">Persistent (localStorage) - Keys remain across sessions</option>
                    <option value="sessionStorage">Session Only (sessionStorage) - Keys cleared when tab closes (more secure)</option>
                  </select>
                  <p style={descriptionStyles}>
                    Current storage: <strong style={{ color: colors.fg.primary }}>
                      {storagePreference === 'localStorage' ? 'Persistent' : 'Session Only'}
                    </strong>
                    {storagePreference === 'sessionStorage' && ' - You will need to re-enter keys when you reopen the tab'}
                  </p>
                </div>

                {/* Anthropic Key */}
                <div style={{ marginBottom: spacing[3] }}>
                  <label style={labelStyles}>Anthropic API Key</label>
                  <div style={{ display: 'flex', gap: spacing[2] }}>
                    <div style={{ flex: 1, position: 'relative' }}>
                      <input
                        type={showAnthropicKey ? 'text' : 'password'}
                        value={anthropicKey}
                        onChange={(e) => setAnthropicKey(e.target.value)}
                        onBlur={() => handleSaveKey('anthropic', anthropicKey)}
                        placeholder="sk-ant-..."
                        style={{
                          ...selectStyles,
                          fontFamily: typography.fonts.code,
                          paddingRight: '40px',
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowAnthropicKey(!showAnthropicKey)}
                        style={{
                          position: 'absolute',
                          right: spacing[2],
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          color: colors.fg.quaternary,
                          cursor: 'pointer',
                          padding: spacing[1],
                        }}
                      >
                        {showAnthropicKey ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                    {anthropicKey && (
                      <>
                        <span style={{ display: 'flex', alignItems: 'center', color: 'var(--success-solid)' }}>
                          <CheckCircle size={16} />
                        </span>
                        <button
                          onClick={() => handleDeleteKey('anthropic')}
                          title="Delete key"
                          style={{
                            background: 'none',
                            border: 'none',
                            color: colors.fg.quaternary,
                            cursor: 'pointer',
                            padding: spacing[1],
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* OpenAI Key */}
                <div style={{ marginBottom: spacing[3] }}>
                  <label style={labelStyles}>OpenAI API Key</label>
                  <div style={{ display: 'flex', gap: spacing[2] }}>
                    <div style={{ flex: 1, position: 'relative' }}>
                      <input
                        type={showOpenAIKey ? 'text' : 'password'}
                        value={openaiKey}
                        onChange={(e) => setOpenaiKey(e.target.value)}
                        onBlur={() => handleSaveKey('openai', openaiKey)}
                        placeholder="sk-..."
                        style={{
                          ...selectStyles,
                          fontFamily: typography.fonts.code,
                          paddingRight: '40px',
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowOpenAIKey(!showOpenAIKey)}
                        style={{
                          position: 'absolute',
                          right: spacing[2],
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          color: colors.fg.quaternary,
                          cursor: 'pointer',
                          padding: spacing[1],
                        }}
                      >
                        {showOpenAIKey ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                    {openaiKey && (
                      <>
                        <span style={{ display: 'flex', alignItems: 'center', color: 'var(--success-solid)' }}>
                          <CheckCircle size={16} />
                        </span>
                        <button
                          onClick={() => handleDeleteKey('openai')}
                          title="Delete key"
                          style={{
                            background: 'none',
                            border: 'none',
                            color: colors.fg.quaternary,
                            cursor: 'pointer',
                            padding: spacing[1],
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={footerStyles}>
              <button
                onClick={handleReset}
                style={{
                  padding: `${spacing[2]} ${spacing[3]}`,
                  backgroundColor: 'transparent',
                  border: `1px solid var(--border-primary)`,
                  borderRadius: effects.border.radius.default,
                  color: colors.fg.quaternary,
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
                  backgroundColor: colors.accent.primary,
                  border: 'none',
                  borderRadius: effects.border.radius.default,
                  color: colors.bg.inset,
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
        bottom: spacing[24], // 96px from bottom (above the minimap which is typically ~80px tall)
        right: spacing[4],
        width: 48,
        height: 48,
        borderRadius: '50%',
        backgroundColor: colors.bg.secondary,
        border: `1px solid var(--border-primary)`,
        boxShadow: effects.shadow.lg,
        color: colors.fg.secondary,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.2s ease',
        zIndex: 100,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = colors.bg.inset;
        e.currentTarget.style.color = colors.accent.primary;
        e.currentTarget.style.transform = 'scale(1.05)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = colors.bg.secondary;
        e.currentTarget.style.color = colors.fg.secondary;
        e.currentTarget.style.transform = 'scale(1)';
      }}
    >
      <Settings size={20} />
    </button>
  );
}

export default SettingsPanel;
