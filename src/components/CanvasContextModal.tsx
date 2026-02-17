'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Upload, Trash2, X, AlertCircle } from 'lucide-react';
import { nanoid } from 'nanoid';
import { useShallow } from 'zustand/react/shallow';

import { colors, spacing, effects, typography, animation, components } from '@/lib/design-tokens';
import { useCanvasStore } from '@/stores/canvas-store';
import type { KnowledgeBaseFileMeta, WorkspaceContext } from '@/types';
import {
  deleteKnowledgeBaseFile,
  listKnowledgeBaseFiles,
  saveKnowledgeBaseFile,
  updateKnowledgeBaseFileMeta,
} from '@/lib/knowledge-base-db';

const MAX_INSTRUCTIONS = 1500;
const MAX_FILES = 10;
const MAX_FILE_SIZE = 500 * 1024;
const MAX_TOTAL_SIZE = MAX_FILES * MAX_FILE_SIZE;

const SUPPORTED_EXTENSIONS = [
  '.txt',
  '.md',
  '.markdown',
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.json',
  '.css',
  '.html',
  '.yml',
  '.yaml',
  '.py',
  '.java',
  '.go',
  '.rs',
  '.c',
  '.cpp',
  '.h',
  '.hpp',
  '.cs',
  '.rb',
  '.php',
  '.sh',
  '.sql',
  '.toml',
  '.ini',
  '.csv',
];

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
  maxWidth: '560px',
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
  fontWeight: typography.weights.semibold,
  color: colors.fg.primary,
  marginBottom: spacing[2],
  display: 'flex',
  alignItems: 'center',
  gap: spacing[1],
  fontFamily: typography.fonts.body,
};

const descriptionStyles: React.CSSProperties = {
  fontSize: typography.sizes.xs,
  color: colors.fg.tertiary,
  marginTop: spacing[1],
  fontFamily: typography.fonts.body,
};

const usageBarTrackStyles: React.CSSProperties = {
  width: '100%',
  height: components.progressBar.height,
  borderRadius: 999,
  backgroundColor: colors.bg.secondary,
  border: `1px solid ${colors.border.muted}`,
  overflow: 'hidden',
  marginTop: spacing[2],
};

const usageBarFillStyles: React.CSSProperties = {
  height: '100%',
  backgroundColor: colors.accent.primary,
  transition: 'width 0.2s ease',
};

const usagePercentStyles: React.CSSProperties = {
  fontSize: typography.sizes.xs,
  color: colors.fg.quaternary,
  marginTop: spacing[1],
  fontFamily: typography.fonts.body,
};

const uploadBarTrackStyles: React.CSSProperties = {
  width: '100%',
  height: components.progressBar.height,
  borderRadius: 999,
  backgroundColor: colors.bg.secondary,
  border: `1px solid ${colors.border.muted}`,
  overflow: 'hidden',
  marginTop: spacing[1],
};

const uploadBarFillStyles: React.CSSProperties = {
  height: '100%',
  backgroundColor: colors.accent.primary,
  transition: 'width 0.1s linear',
};

const textareaStyles: React.CSSProperties = {
  width: '100%',
  minHeight: 120,
  padding: spacing[3],
  backgroundColor: colors.bg.inset,
  border: `1px solid ${colors.border.default}`,
  borderRadius: effects.border.radius.default,
  color: colors.fg.primary,
  fontSize: typography.sizes.sm,
  fontFamily: typography.fonts.body,
  outline: 'none',
  resize: 'vertical',
};

const dropzoneStyles: React.CSSProperties = {
  border: `1px dashed ${colors.border.default}`,
  borderRadius: effects.border.radius.default,
  padding: spacing[3],
  backgroundColor: colors.bg.inset,
  display: 'flex',
  flexDirection: 'column',
  gap: spacing[1],
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center',
};

const fileRowStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: spacing[2],
  padding: `${spacing[2]} ${spacing[3]}`,
  border: `1px solid ${colors.border.default}`,
  borderRadius: effects.border.radius.default,
  backgroundColor: colors.bg.inset,
};

interface CanvasContextModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface UploadingFile {
  id: string;
  name: string;
  size: number;
  loaded: number;
  total: number;
  status: 'reading' | 'saving' | 'error';
}

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: number): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getFileExtension(name: string): string {
  const idx = name.lastIndexOf('.');
  if (idx === -1) return '';
  return name.slice(idx).toLowerCase();
}

function isSupportedFile(file: File): boolean {
  return SUPPORTED_EXTENSIONS.includes(getFileExtension(file.name));
}

function readFileAsTextWithProgress(
  file: File,
  onProgress: (loaded: number, total: number) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(event.loaded, event.total);
      }
    };
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === 'string') {
        resolve(result);
        return;
      }
      if (result instanceof ArrayBuffer) {
        resolve(new TextDecoder().decode(result));
        return;
      }
      resolve('');
    };
    reader.onerror = () => {
      reject(reader.error ?? new Error('Failed to read file.'));
    };
    reader.readAsText(file);
  });
}

export function CanvasContextModal({ isOpen, onClose }: CanvasContextModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const overlayMouseDownRef = useRef(false);

  const { activeWorkspaceId } = useCanvasStore(
    useShallow((s) => ({
      activeWorkspaceId: s.activeWorkspaceId,
    }))
  );
  const updateWorkspace = useCanvasStore((s) => s.updateWorkspace);

  const [instructions, setInstructions] = useState('');
  const [files, setFiles] = useState<KnowledgeBaseFileMeta[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [replaceTargetId, setReplaceTargetId] = useState<string | null>(null);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [replaceProgress, setReplaceProgress] = useState<Record<string, UploadingFile>>({});

  const instructionCount = instructions.length;
  const fileCount = files.length;
  const totalFileSize = files.reduce((sum, file) => sum + file.size, 0);
  const usagePercent = MAX_TOTAL_SIZE > 0
    ? Math.min(100, Math.round((totalFileSize / MAX_TOTAL_SIZE) * 100))
    : 0;

  const updateContext = useCallback((updates: Partial<WorkspaceContext>) => {
    if (!activeWorkspaceId) return;

    const currentWorkspace = useCanvasStore.getState().workspaces
      .find((w) => w.id === activeWorkspaceId);
    const current = currentWorkspace?.context || {
      instructions: '',
      knowledgeBaseFiles: [],
      updatedAt: new Date(),
    };

    const next: WorkspaceContext = {
      ...current,
      ...updates,
      updatedAt: new Date(),
    };

    updateWorkspace(activeWorkspaceId, { context: next });
  }, [activeWorkspaceId, updateWorkspace]);

  const refreshFilesFromDb = useCallback(async () => {
    if (!activeWorkspaceId) return;

    try {
      const dbFiles = await listKnowledgeBaseFiles(activeWorkspaceId);
      const sorted = [...dbFiles].sort((a, b) => a.lastModified - b.lastModified);
      setFiles(sorted);

      const currentContext = useCanvasStore.getState().workspaces
        .find((w) => w.id === activeWorkspaceId)?.context;
      const currentIds = (currentContext?.knowledgeBaseFiles || []).map((f) => f.id).join('|');
      const nextIds = sorted.map((f) => f.id).join('|');
      if (currentIds !== nextIds) {
        updateContext({ knowledgeBaseFiles: sorted });
      }
    } catch (err) {
      console.error('[CanvasContextModal] Failed to load KB files', err);
      setError('Could not load knowledge base files.');
    }
  }, [activeWorkspaceId, updateContext]);

  useEffect(() => {
    if (!isOpen) return;
    if (!activeWorkspaceId) return;

    const currentContext = useCanvasStore.getState().workspaces
      .find((w) => w.id === activeWorkspaceId)?.context;

    setInstructions(currentContext?.instructions || '');
    setFiles(currentContext?.knowledgeBaseFiles || []);
    setError(null);
    setUploadingFiles([]);
    setReplaceProgress({});
    refreshFilesFromDb();
  }, [isOpen, activeWorkspaceId, refreshFilesFromDb]);

  const handleClose = useCallback(() => {
    updateContext({ instructions: instructions.trim() });
    onClose();
  }, [instructions, updateContext, onClose]);

  const handleInstructionsBlur = useCallback(() => {
    updateContext({ instructions: instructions.trim() });
  }, [instructions, updateContext]);

  useEffect(() => {
    if (!isOpen) return;
    if (!activeWorkspaceId) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      if (e.key === 'Enter') {
        const target = e.target as HTMLElement | null;
        const tagName = target?.tagName?.toLowerCase();
        if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') return;
        handleClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, activeWorkspaceId, handleClose]);

  const handleFileBrowse = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleReplaceBrowse = useCallback((fileId: string) => {
    setReplaceTargetId(fileId);
    replaceInputRef.current?.click();
  }, []);

  const validateFiles = useCallback((incoming: File[]) => {
    if (incoming.length === 0) return 'No files selected.';
    if (fileCount + incoming.length > MAX_FILES) {
      return `Maximum ${MAX_FILES} files allowed.`;
    }

    const incomingSize = incoming.reduce((sum, file) => sum + file.size, 0);
    if (totalFileSize + incomingSize > MAX_TOTAL_SIZE) {
      return `Knowledge base limit reached (${formatBytes(MAX_TOTAL_SIZE)} total). Remove files to add more.`;
    }

    for (const file of incoming) {
      if (!isSupportedFile(file)) {
        return `Unsupported format: ${file.name}. PDF/DOCX support coming soon. Use text, markdown, or code files.`;
      }
      if (file.size > MAX_FILE_SIZE) {
        return `${file.name} exceeds 500KB limit.`;
      }
    }

    return null;
  }, [fileCount, totalFileSize]);

  const addFiles = useCallback(async (incoming: File[]) => {
    if (!activeWorkspaceId) return;

    const validationError = validateFiles(incoming);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);

    try {
      for (const file of incoming) {
        const uploadId = `upload-${nanoid()}`;
        const meta: KnowledgeBaseFileMeta = {
          id: `kb-${nanoid()}`,
          name: file.name,
          type: file.type || 'text/plain',
          size: file.size,
          lastModified: file.lastModified,
        };

        setUploadingFiles((prev) => ([
          ...prev,
          {
            id: uploadId,
            name: meta.name,
            size: meta.size,
            loaded: 0,
            total: meta.size,
            status: 'reading',
          },
        ]));

        const content = await readFileAsTextWithProgress(file, (loaded, total) => {
          setUploadingFiles((prev) => prev.map((entry) =>
            entry.id === uploadId ? { ...entry, loaded, total } : entry
          ));
        });

        setUploadingFiles((prev) => prev.map((entry) =>
          entry.id === uploadId ? { ...entry, status: 'saving', loaded: entry.total } : entry
        ));
        await saveKnowledgeBaseFile({
          workspaceId: activeWorkspaceId,
          content,
          ...meta,
        });

        setUploadingFiles((prev) => prev.filter((entry) => entry.id !== uploadId));
        
        // Update local state first
        const updatedFiles = [...files, meta];
        setFiles(updatedFiles);
        
        // Then update store (must be separate, not inside setState callback)
        updateContext({ knowledgeBaseFiles: updatedFiles });
      }
    } catch (err) {
      console.error('[CanvasContextModal] Failed to upload KB files', err);
      setError('Could not upload knowledge base files.');
      setUploadingFiles([]);
    }
  }, [activeWorkspaceId, updateContext, validateFiles, files]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const incoming = Array.from(e.target.files || []);
    if (incoming.length > 0) {
      addFiles(incoming);
    }
    e.target.value = '';
  }, [addFiles]);

  const handleReplaceFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const incoming = Array.from(e.target.files || []);
    const targetId = replaceTargetId;
    if (!targetId || incoming.length === 0) return;

    const file = incoming[0];
    if (!isSupportedFile(file)) {
      setError(`Unsupported format: ${file.name}. PDF/DOCX support coming soon. Use text, markdown, or code files.`);
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError(`${file.name} exceeds 500KB limit.`);
      return;
    }

    const current = files.find((entry) => entry.id === targetId);
    const nextTotal = totalFileSize - (current?.size || 0) + file.size;
    if (nextTotal > MAX_TOTAL_SIZE) {
      setError(`Knowledge base limit reached (${formatBytes(MAX_TOTAL_SIZE)} total). Remove files to add more.`);
      return;
    }

    if (!activeWorkspaceId) return;

    setReplaceProgress((prev) => ({
      ...prev,
      [targetId]: {
        id: targetId,
        name: file.name,
        size: file.size,
        loaded: 0,
        total: file.size,
        status: 'reading',
      },
    }));

    try {
      const content = await readFileAsTextWithProgress(file, (loaded, total) => {
        setReplaceProgress((prev) => ({
          ...prev,
          [targetId]: {
            ...(prev[targetId] || {
              id: targetId,
              name: file.name,
              size: file.size,
              status: 'reading',
            }),
            loaded,
            total,
          },
        }));
      });
      const meta: KnowledgeBaseFileMeta = {
        id: targetId,
        name: file.name,
        type: file.type || 'text/plain',
        size: file.size,
        lastModified: file.lastModified,
      };

      setReplaceProgress((prev) => ({
        ...prev,
        [targetId]: {
          ...(prev[targetId] || {
            id: targetId,
            name: file.name,
            size: file.size,
            loaded: file.size,
            total: file.size,
          }),
          status: 'saving',
          loaded: file.size,
          total: file.size,
        },
      }));

      await saveKnowledgeBaseFile({
        workspaceId: activeWorkspaceId,
        content,
        ...meta,
      });
      const updatedFiles = files.map((entry) =>
        entry.id === targetId
          ? { ...entry, name: meta.name, type: meta.type, size: meta.size, lastModified: meta.lastModified }
          : entry
      );
      setFiles(updatedFiles);
      updateContext({ knowledgeBaseFiles: updatedFiles });
      setReplaceProgress((prev) => {
        const next = { ...prev };
        delete next[targetId];
        return next;
      });
      setError(null);
    } catch (err) {
      console.error('[CanvasContextModal] Failed to replace KB file', err);
      setError('Could not replace file.');
      setReplaceProgress((prev) => {
        const next = { ...prev };
        delete next[targetId];
        return next;
      });
    } finally {
      setReplaceTargetId(null);
      e.target.value = '';
    }
  }, [replaceTargetId, files, totalFileSize, activeWorkspaceId, updateContext]);

  const handleRenameStart = useCallback((fileId: string, name: string) => {
    setRenamingId(fileId);
    setRenameValue(name);
  }, []);

  const handleRenameCancel = useCallback(() => {
    setRenamingId(null);
    setRenameValue('');
  }, []);

  const handleRenameSave = useCallback(async () => {
    if (!renamingId) return;
    const nextName = renameValue.trim();
    if (!nextName) return;

    const now = Date.now();

    try {
      await updateKnowledgeBaseFileMeta(renamingId, {
        name: nextName,
        lastModified: now,
      });

      const updatedFiles = files.map((entry) =>
        entry.id === renamingId
          ? { ...entry, name: nextName, lastModified: now }
          : entry
      );
      setFiles(updatedFiles);
      updateContext({ knowledgeBaseFiles: updatedFiles });
      handleRenameCancel();
    } catch (err) {
      console.error('[CanvasContextModal] Failed to rename KB file', err);
      setError('Could not rename file.');
    }
  }, [renamingId, renameValue, files, updateContext, handleRenameCancel]);

  const handleRemoveFile = useCallback(async (fileId: string) => {
    try {
      await deleteKnowledgeBaseFile(fileId);
      const updatedFiles = files.filter((file) => file.id !== fileId);
      setFiles(updatedFiles);
      updateContext({ knowledgeBaseFiles: updatedFiles });
    } catch (err) {
      console.error('[CanvasContextModal] Failed to remove KB file', err);
      setError('Could not remove file.');
    }
  }, [files, updateContext]);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = Array.from(e.dataTransfer.files || []);
    if (dropped.length > 0) {
      addFiles(dropped);
    }
  }, [addFiles]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={overlayStyles}
          onMouseDown={(e) => {
            overlayMouseDownRef.current = e.target === e.currentTarget;
          }}
          onMouseUp={(e) => {
            if (overlayMouseDownRef.current && e.target === e.currentTarget) {
              handleClose();
            }
            overlayMouseDownRef.current = false;
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={animation.spring.snappy}
            style={panelStyles}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={headerStyles}>
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing[2] }}>
                <FileText size={20} color={colors.accent.primary} />
                <h2
                  style={{
                    fontSize: typography.sizes.lg,
                    fontWeight: typography.weights.semibold,
                    color: colors.fg.primary,
                    fontFamily: typography.fonts.heading,
                    margin: 0,
                  }}
                >
                  Canvas Context
                </h2>
              </div>
              <button
                onClick={handleClose}
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

            <div style={contentStyles}>
              {error && (
                <div
                  style={{
                    display: 'flex',
                    gap: spacing[2],
                    alignItems: 'center',
                    padding: spacing[2],
                    borderRadius: effects.border.radius.default,
                    backgroundColor: `${colors.semantic.warning}15`,
                    color: colors.semantic.warning,
                    fontSize: typography.sizes.xs,
                    fontFamily: typography.fonts.body,
                    marginBottom: spacing[3],
                  }}
                >
                  <AlertCircle size={14} />
                  <span>{error}</span>
                </div>
              )}

              <div style={sectionStyles}>
                <div style={sectionTitleStyles}>Instructions</div>
                <textarea
                  value={instructions}
                  onChange={(e) => {
                    if (e.target.value.length <= MAX_INSTRUCTIONS) {
                      setInstructions(e.target.value);
                    }
                  }}
                  onBlur={handleInstructionsBlur}
                  placeholder="Add instructions..."
                  style={textareaStyles}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <p style={descriptionStyles}>{instructionCount}/{MAX_INSTRUCTIONS}</p>
                </div>
              </div>

              <div style={sectionStyles}>
                <div style={sectionTitleStyles}>Knowledge Base</div>

                <div
                  style={{
                    ...dropzoneStyles,
                    borderColor: isDragging ? colors.accent.primary : colors.border.default,
                    backgroundColor: isDragging ? `${colors.accent.primary}10` : colors.bg.inset,
                  }}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragEnter={handleDragEnter}
                  onDragLeave={handleDragLeave}
                >
                  <Upload size={18} color={colors.fg.secondary} />
                  <div style={{ fontSize: typography.sizes.sm, color: colors.fg.primary }}>
                    Drag and drop files here or
                    <button
                      onClick={handleFileBrowse}
                      style={{
                        marginLeft: spacing[1],
                        background: 'none',
                        border: 'none',
                        color: colors.accent.primary,
                        fontSize: typography.sizes.sm,
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                      browse
                    </button>
                  </div>
                  <p style={usagePercentStyles}>
                    {usagePercent}% used
                  </p>
                  <div style={usageBarTrackStyles} aria-hidden="true">
                    <div style={{ ...usageBarFillStyles, width: `${usagePercent}%` }} />
                  </div>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept={SUPPORTED_EXTENSIONS.join(',')}
                  style={{ display: 'none' }}
                  onChange={handleFileChange}
                />

                <input
                  ref={replaceInputRef}
                  type="file"
                  accept={SUPPORTED_EXTENSIONS.join(',')}
                  style={{ display: 'none' }}
                  onChange={handleReplaceFile}
                />

                <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[2], marginTop: spacing[3] }}>
                  {uploadingFiles.map((file) => {
                    const percent = file.total > 0 ? Math.min(100, Math.round((file.loaded / file.total) * 100)) : 0;
                    return (
                      <div key={file.id} style={fileRowStyles}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1 }}>
                          <span
                            style={{
                              fontSize: typography.sizes.sm,
                              color: colors.fg.primary,
                              fontFamily: typography.fonts.body,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                            title={file.name}
                          >
                            {file.name}
                          </span>
                          <span style={{ fontSize: typography.sizes.xs, color: colors.fg.tertiary }}>
                            {formatBytes(file.size)} • {file.status === 'saving' ? 'Saving' : 'Uploading'} {percent}%
                          </span>
                          <div style={uploadBarTrackStyles} aria-hidden="true">
                            <div style={{ ...uploadBarFillStyles, width: `${percent}%` }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {files.map((file) => (
                    <div key={file.id} style={fileRowStyles}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                        {renamingId === file.id ? (
                          <input
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleRenameSave();
                              } else if (e.key === 'Escape') {
                                handleRenameCancel();
                              }
                            }}
                            style={{
                              fontSize: typography.sizes.sm,
                              color: colors.fg.primary,
                              fontFamily: typography.fonts.body,
                              backgroundColor: colors.bg.secondary,
                              border: `1px solid ${colors.border.default}`,
                              borderRadius: effects.border.radius.default,
                              padding: `2px ${spacing[1]}`,
                              outline: 'none',
                            }}
                            aria-label="Rename file"
                          />
                        ) : (
                          <span
                            style={{
                              fontSize: typography.sizes.sm,
                              color: colors.fg.primary,
                              fontFamily: typography.fonts.body,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                            title={file.name}
                          >
                            {file.name}
                          </span>
                        )}
                        <span style={{ fontSize: typography.sizes.xs, color: colors.fg.tertiary }}>
                          {formatBytes(file.size)} • Updated {formatDate(file.lastModified)}
                        </span>
                        {replaceProgress[file.id] && (() => {
                          const progress = replaceProgress[file.id];
                          const percent = progress.total > 0
                            ? Math.min(100, Math.round((progress.loaded / progress.total) * 100))
                            : 0;
                          return (
                            <>
                              <span style={{ fontSize: typography.sizes.xs, color: colors.fg.quaternary }}>
                                {progress.status === 'saving' ? 'Saving' : 'Uploading'} {percent}%
                              </span>
                              <div style={uploadBarTrackStyles} aria-hidden="true">
                                <div style={{ ...uploadBarFillStyles, width: `${percent}%` }} />
                              </div>
                            </>
                          );
                        })()}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: spacing[1] }}>
                        {renamingId === file.id ? (
                          <>
                            <button
                              onClick={handleRenameSave}
                              style={{
                                background: 'none',
                                border: `1px solid ${colors.border.default}`,
                                borderRadius: effects.border.radius.default,
                                color: colors.fg.primary,
                                cursor: 'pointer',
                                fontSize: typography.sizes.xs,
                                padding: `${spacing[1]} ${spacing[2]}`,
                              }}
                            >
                              Save
                            </button>
                            <button
                              onClick={handleRenameCancel}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: colors.fg.quaternary,
                                cursor: 'pointer',
                                fontSize: typography.sizes.xs,
                              }}
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => handleRenameStart(file.id, file.name)}
                              title="Rename file"
                              style={{
                                background: 'none',
                                border: 'none',
                                color: colors.fg.quaternary,
                                cursor: 'pointer',
                                fontSize: typography.sizes.xs,
                              }}
                            >
                              Rename
                            </button>
                            <button
                              onClick={() => handleReplaceBrowse(file.id)}
                              title="Replace file"
                              style={{
                                background: 'none',
                                border: 'none',
                                color: colors.fg.quaternary,
                                cursor: 'pointer',
                                fontSize: typography.sizes.xs,
                              }}
                            >
                              Replace
                            </button>
                            <button
                              onClick={() => handleRemoveFile(file.id)}
                              title="Remove file"
                              style={{
                                background: 'none',
                                border: 'none',
                                color: colors.fg.quaternary,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default CanvasContextModal;
