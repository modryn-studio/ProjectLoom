/**
 * ProjectLoom Type Definitions
 * 
 * Core types for Canvas, Conversation, Message, AI Provider,
 * and related interfaces. Designed for provider-agnostic
 * architecture with Phase 2 forward compatibility.
 * 
 * @version 1.0.0
 */

// =============================================================================
// POSITION & GEOMETRY
// =============================================================================

/**
 * 2D position on the canvas
 */
export interface Position {
  x: number;
  y: number;
}

/**
 * Rectangular bounds
 */
export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

// =============================================================================
// LANGUAGE & TEXT
// =============================================================================

/**
 * ISO 639-1 language codes with common additions
 */
export type LanguageCode = 
  | 'en' | 'ja' | 'zh' | 'ko' | 'ar' | 'he' | 'th' | 'hi'
  | 'es' | 'fr' | 'de' | 'pt' | 'ru' | 'it' | 'nl' | 'pl'
  | 'und' // undefined/unknown
  | string;

/**
 * Text direction
 */
export type TextDirection = 'ltr' | 'rtl';

/**
 * Script types for font mapping
 */
export type ScriptType = 
  | 'latin' 
  | 'japanese' 
  | 'chinese' 
  | 'korean' 
  | 'arabic' 
  | 'hebrew' 
  | 'thai' 
  | 'devanagari'
  | 'cyrillic';

// =============================================================================
// MESSAGE
// =============================================================================

/**
 * Role of the message sender
 */
export type MessageRole = 'user' | 'assistant' | 'system';

/**
 * Metadata associated with a message
 */
export interface MessageMetadata {
  /** AI model that generated the response (for assistant messages) */
  model?: string;
  /** Token count for the message */
  tokens?: number;
  /** Detected language of the message content */
  language?: LanguageCode;
  /** Custom key-value metadata */
  custom?: Record<string, unknown>;
}

/**
 * A single message in a conversation
 */
export interface Message {
  /** Unique identifier */
  id: string;
  /** Who sent the message */
  role: MessageRole;
  /** Message content (may contain markdown) */
  content: string;
  /** When the message was created */
  timestamp: Date;
  /** Optional metadata */
  metadata?: MessageMetadata;
}

// =============================================================================
// CONVERSATION
// =============================================================================

/**
 * Metadata associated with a conversation
 */
export interface ConversationMetadata {
  /** When the conversation was created */
  createdAt: Date;
  /** When the conversation was last updated */
  updatedAt: Date;
  /** Number of messages in the conversation */
  messageCount: number;
  /** Tags for categorization (Phase 2) */
  tags: string[];
  /** Whether the card is currently expanded */
  isExpanded: boolean;
  /** Detected primary language */
  language?: LanguageCode;
}

/**
 * A conversation node on the canvas
 */
export interface Conversation {
  /** Unique identifier */
  id: string;
  /** Title of the conversation */
  title: string;
  /** ID of the canvas this conversation belongs to */
  canvasId: string;
  /** Position on the canvas */
  position: Position;
  /** Messages in this conversation */
  content: Message[];
  /** AI-generated summary (Phase 2) */
  summary?: string;
  /** IDs of connected conversations */
  connections: string[];
  /** Conversation metadata */
  metadata: ConversationMetadata;
}

// =============================================================================
// CANVAS
// =============================================================================

/**
 * Canvas metadata
 */
export interface CanvasMetadata {
  /** Display title for the canvas */
  title: string;
  /** When the canvas was created */
  createdAt: Date;
  /** When the canvas was last updated */
  updatedAt: Date;
  /** Optional color coding (Phase 2) */
  color?: string;
  /** Schema version for migrations */
  version: number;
}

/**
 * A canvas containing conversation nodes
 */
export interface Canvas {
  /** Unique identifier */
  id: string;
  /** Parent canvas ID if this is a branch (Phase 2) */
  parentCanvasId: string | null;
  /** Context snapshot at branch time (Phase 2) */
  contextSnapshot: ContextSnapshot | null;
  /** Conversations on this canvas */
  conversations: Conversation[];
  /** IDs of child canvas branches (Phase 2) */
  branches: string[];
  /** Tags for the canvas (Phase 2) */
  tags: string[];
  /** ID of conversation this was branched from (Phase 2) */
  createdFromConversationId: string | null;
  /** Canvas metadata */
  metadata: CanvasMetadata;
  /** Branch metadata - only present on branched canvases (Phase 2) */
  branchMetadata?: BranchMetadata;
}

// =============================================================================
// EDGE CONNECTIONS
// =============================================================================

/**
 * Edge/connection type
 */
export type EdgeType = 'bezier' | 'straight' | 'step' | 'smoothstep';

/**
 * Edge styling options
 */
export interface EdgeStyle {
  /** Stroke color */
  stroke?: string;
  /** Stroke width in pixels */
  strokeWidth?: number;
  /** Whether the edge is animated */
  animated?: boolean;
}

/**
 * A connection between two conversation nodes
 */
export interface EdgeConnection {
  /** Unique identifier */
  id: string;
  /** Source conversation ID */
  source: string;
  /** Target conversation ID */
  target: string;
  /** Type of edge curve */
  type: EdgeType;
  /** Whether the edge shows animation */
  animated?: boolean;
  /** Custom styling */
  style?: EdgeStyle;
  /** Optional label (Phase 2) */
  label?: string;
}

// =============================================================================
// CONTEXT INHERITANCE (Phase 2)
// =============================================================================

/**
 * A decision recorded in the conversation
 */
export interface Decision {
  id: string;
  description: string;
  madeAt: Date;
  /** Reference to the message where decision was made */
  messageId: string;
}

/**
 * An assumption in the conversation
 */
export interface Assumption {
  id: string;
  description: string;
  createdAt: Date;
  status: 'active' | 'invalidated' | 'confirmed';
}

/**
 * Metadata about the context state
 */
export interface ContextMetadata {
  /** Recorded decisions */
  decisions: Decision[];
  /** Assumptions made */
  assumptions: Assumption[];
  /** User-provided reason for the branch */
  branchReason: string;
  /** Total message count at branch time */
  messageCount: number;
  /** Estimated token count */
  tokenCount?: number;
}

/**
 * Snapshot of context at branch time (Phase 2)
 */
export interface ContextSnapshot {
  /** Complete conversation history */
  messages: Message[];
  /** Context metadata */
  metadata: ContextMetadata;
  /** When the snapshot was created */
  timestamp: Date;
  /** Parent canvas ID */
  parentCanvasId: string;
  /** Source conversation ID */
  sourceConversationId: string;
}

/**
 * How context is inherited
 */
export type InheritanceMode = 'full' | 'summary' | 'custom';

/**
 * Message selection for custom inheritance
 */
export interface MessageSelection {
  includeIds: string[];
  excludeIds: string[];
}

/**
 * Branch metadata for tracking lineage
 */
export interface BranchMetadata {
  /** User-provided reason for branching */
  reason: string;
  /** ID of the conversation this branch was created from */
  createdFromConversationId: string;
  /** Number of messages inherited */
  inheritedMessageCount: number;
  /** Inheritance mode used */
  inheritanceMode: InheritanceMode;
  /** Timestamp when branch was created */
  createdAt: Date;
}

/**
 * Data required to create a branch
 */
export interface BranchData {
  /** ID of the source conversation to branch from */
  sourceConversationId: string;
  /** User-provided reason for the branch */
  branchReason: string;
  /** How to inherit context */
  inheritanceMode: InheritanceMode;
  /** Selected message IDs (for custom mode) */
  customMessageIds?: string[];
}

/**
 * Truncation strategy for summary mode
 */
export interface TruncationStrategy {
  /** Type of truncation */
  type: 'recent' | 'important' | 'boundary';
  /** Maximum number of messages to keep */
  maxMessages: number;
}

/**
 * Preview of truncation result
 */
export interface TruncationPreview {
  /** Messages after truncation */
  truncated: Message[];
  /** Number of messages removed */
  removed: number;
  /** Estimated tokens saved */
  tokensSaved: number;
}

/**
 * User preferences for branching
 */
export interface BranchingPreferences {
  /** Default inheritance mode */
  defaultInheritanceMode: InheritanceMode;
  /** Whether to always show branch dialog */
  alwaysAskOnBranch: boolean;
  /** Default truncation strategy for summary mode */
  defaultTruncationStrategy: TruncationStrategy;
}

// =============================================================================
// AI PROVIDER (Phase 2)
// =============================================================================

/**
 * Provider identifier
 */
export type ProviderId = 'claude' | 'openai' | 'local' | string;

/**
 * Configuration for an AI provider
 */
export interface ProviderConfig {
  /** API key (if required) */
  apiKey?: string;
  /** Base URL for API calls */
  baseUrl?: string;
  /** Default model to use */
  defaultModel?: string;
  /** Maximum tokens per request */
  maxTokens?: number;
  /** Temperature for responses */
  temperature?: number;
}

/**
 * Context passed to AI provider
 */
export interface AIContext {
  /** Message history */
  messages: Message[];
  /** System prompt */
  systemPrompt?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Response from AI provider
 */
export interface AIResponse {
  /** Response content */
  content: string;
  /** Model used */
  model: string;
  /** Token usage */
  tokens: {
    input: number;
    output: number;
  };
  /** Why the response ended */
  finishReason: 'stop' | 'length' | 'error';
}

/**
 * Information about an AI model
 */
export interface ModelInfo {
  /** Model identifier */
  id: string;
  /** Display name */
  name: string;
  /** Maximum context tokens */
  maxTokens: number;
  /** Whether streaming is supported */
  supportsStreaming: boolean;
}

/**
 * AI Provider interface (Phase 2)
 */
export interface AIProvider {
  /** Provider identifier */
  id: ProviderId;
  /** Display name */
  name: string;
  /** Provider configuration */
  config: ProviderConfig;
  /** Send a message and get response */
  sendMessage(content: string, context: AIContext): Promise<AIResponse>;
  /** Stream a message response */
  streamMessage(content: string, context: AIContext): AsyncIterator<AIResponse>;
  /** Check if provider is available */
  isAvailable(): Promise<boolean>;
  /** Get available models */
  getModels(): Promise<ModelInfo[]>;
}

// =============================================================================
// STORAGE
// =============================================================================

/**
 * User preferences
 */
export interface UserPreferences {
  /** Theme (dark-only in Phase 1) */
  theme: 'dark';
  /** Default inheritance mode (Phase 2) */
  defaultInheritanceMode: InheritanceMode;
  /** Whether to show minimap */
  showMinimap: boolean;
  /** Whether to show dev overlay */
  showDevOverlay: boolean;
  /** Branching preferences */
  branching: BranchingPreferences;
}

/**
 * Canvas storage data (Phase 2 - multiple canvases)
 */
export interface CanvasStorageData {
  /** All canvases */
  canvases: Canvas[];
  /** Currently active canvas ID */
  activeCanvasId: string;
  /** User settings */
  settings: {
    theme: 'dark';
    showMinimap: boolean;
    snapToGrid: boolean;
  };
}

/**
 * Complete storage schema
 */
export interface StorageData {
  /** All conversations */
  conversations: Conversation[];
  /** Node positions by conversation ID */
  positions: Record<string, Position>;
  /** Edge connections */
  connections: EdgeConnection[];
  /** Canvas settings */
  settings: {
    theme: 'dark';
    showMinimap: boolean;
    snapToGrid: boolean;
  };
}

// =============================================================================
// UI STATE
// =============================================================================

/**
 * Card state for z-index and styling
 */
export interface CardState {
  isExpanded?: boolean;
  isDragging?: boolean;
  isHovered?: boolean;
  isSelected?: boolean;
}

/**
 * Viewport state
 */
export interface ViewportState {
  x: number;
  y: number;
  zoom: number;
}

// =============================================================================
// REACT FLOW TYPES
// =============================================================================

/**
 * React Flow node data for conversation cards
 * Extends Record<string, unknown> for React Flow compatibility
 */
export interface ConversationNodeData extends Record<string, unknown> {
  conversation: Conversation;
  isExpanded: boolean;
  isSelected: boolean;
}

/**
 * React Flow edge data
 */
export interface ConversationEdgeData {
  connection: EdgeConnection;
}

// =============================================================================
// UTILITY TYPES
// =============================================================================

/**
 * Make all properties optional recursively
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Extract the ID type from an entity
 */
export type EntityId = string;

/**
 * Timestamp as ISO string or Date
 */
export type Timestamp = Date | string;
