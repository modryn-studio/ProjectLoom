### **1. Resize Handle Pattern** ✅

**Answer: Use IDENTICAL logic from CanvasTreeSidebar.tsx**

**Rationale:**
- **Consistency:** Users already learned this interaction on the left sidebar
- **Code reuse:** Copy-paste the exact implementation (DRY principle)
- **Design cohesion:** Amber hover, 4px width, Framer Motion transitions
- **Less cognitive load:** Same affordance pattern throughout the app

**Implementation:**
```typescript
// ChatPanel.tsx - Copy these exact styles from CanvasTreeSidebar.tsx

const resizeHandleStyles: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: -2,  // Left edge instead of right
  width: isResizing || isResizeHovered ? 4 : 4,
  height: '100%',
  cursor: 'ew-resize',
  backgroundColor: isResizing || isResizeHovered ? colors.amber.primary : 'transparent',
  transition: isResizing ? 'none' : 'background-color 0.15s ease',
  zIndex: 30,
};
```

---

### **2. Chat Panel Persistence** ✅

**Answer: Save to storage.ts (add to UserPreferences.ui)**

**Rationale:**
- **User expectation:** Width preferences should persist (like sidebar width would if we saved it)
- **Existing pattern:** We already persist `showCanvasTree`, `showInheritedContext`, `confirmOnDelete`
- **Better UX:** User sets their preferred width once, it stays
- **Implementation cost:** Minimal - already have the infrastructure

**BUT:** `chatPanelOpen` should be **session-only** (don't persist)
- Opening/closing is a temporary state like "current zoom level"
- Always start with panel closed for clean slate

**Implementation:**
```typescript
// src/types/index.ts - Add to UserPreferences

export interface UserPreferences {
  branching: BranchingPreferences;
  ui: {
    showCanvasTree: boolean;
    showInheritedContext: boolean;
    confirmOnDelete: boolean;
    // NEW:
    chatPanelWidth: number;  // Persist this
    // chatPanelOpen: boolean; // DON'T persist this
  };
}

// src/stores/preferences-store.ts - Add default

const DEFAULT_UI_PREFERENCES: UserPreferences['ui'] = {
  showCanvasTree: true,
  showInheritedContext: true,
  confirmOnDelete: true,
  chatPanelWidth: 480,  // NEW: Default 30% of 1600px viewport
};

// src/store/canvas-store.ts - Load from preferences

const useCanvasStore = create<CanvasState>()((set, get) => ({
  chatPanelOpen: false,  // Session-only, always start closed
  chatPanelWidth: usePreferencesStore.getState().preferences.ui.chatPanelWidth, // Persisted
  
  setChatPanelWidth: (width) => {
    const newWidth = Math.min(800, Math.max(400, width));
    set({ chatPanelWidth: newWidth });
    // Persist to preferences
    usePreferencesStore.getState().setUIPreferences({ chatPanelWidth: newWidth });
  },
}));
```

---

### **3. Keyboard Shortcuts** ✅

**Answer: Update existing shortcuts + add new ones**

**Current State Analysis:**
- `Space`: Expand/collapse card ← **REMOVE** (cards no longer expand)
- `Ctrl+B`: Branch from card ← **KEEP** (still valid)
- `N`: Add new conversation ← **KEEP**
- `Escape`: Collapse/deselect ← **UPDATE** (close chat panel if open)

**New Shortcuts:**
- `Enter`: Open chat panel for selected card
- `Ctrl+Enter`: Send message (when focused in input)
- `Escape`: Close chat panel (if open), then deselect

**Implementation:**
```typescript
// src/hooks/useKeyboardShortcuts.ts

export interface KeyboardShortcutHandlers {
  onDelete?: () => void;
  onEscape?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onExpand?: () => void;      // DEPRECATED - will be removed
  onBranch?: () => void;
  onAddConversation?: () => void;
  onOpenChat?: () => void;    // NEW: Open chat panel
}

// In useKeyboardShortcuts hook:

switch (event.key) {
  case ' ':
    // DEPRECATED: Space no longer expands cards
    // Instead, open chat panel for selected card
    event.preventDefault();
    handlers.onOpenChat?.();
    break;
    
  case 'Enter':
    // Enter: Open chat panel (only when NOT in input)
    if (!event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      handlers.onOpenChat?.();
    }
    // Note: Ctrl+Enter is handled in MessageInput component for sending
    break;
    
  case 'Escape':
    event.preventDefault();
    handlers.onEscape?.();
    // Handler will check: if chat panel open → close it, else → deselect
    break;
}

// src/components/InfiniteCanvas.tsx - Update handlers:

useKeyboardShortcuts({
  enabled: true,
  handlers: {
    onEscape: () => {
      // Priority: Close chat panel first, then collapse, then deselect
      if (chatPanelOpen) {
        closeChatPanel();
      } else if (firstExpandedId) {
        toggleExpanded(firstExpandedId); // This will be removed post-migration
      } else {
        clearSelection();
      }
    },
    
    onOpenChat: () => {
      // Space or Enter: Open chat panel for first selected card
      if (firstSelectedId) {
        openChatPanel(firstSelectedId);
      }
    },
    
    onExpand: undefined, // DEPRECATED: Remove after migration
    
    onBranch: () => {
      // Ctrl+B: Branch from first selected card
      if (firstSelectedId) {
        openBranchDialog(firstSelectedId);
      }
    },
  },
});
```

**Keyboard Shortcuts Summary Table:**

| Shortcut | Action | Notes |
|----------|--------|-------|
| `Enter` or `Space` | Open chat panel for selected card | Replaces old expand behavior |
| `Escape` | Close chat panel → Deselect | Priority cascade |
| `Ctrl+B` | Branch from selected card | Unchanged |
| `N` | Add new conversation | Unchanged |
| `Delete` | Delete selected card | Unchanged |
| `Ctrl+Z` | Undo | Unchanged |
| `Ctrl+Shift+Z` | Redo | Unchanged |
| `Ctrl+Enter` | Send message | Only in chat input (handled separately) |

---

### **4. Panel State Synchronization** ✅

**Answer: Immediate switch with automatic draft save**

**Behavior:**
- Clicking different card → **Immediately switch** to that conversation
- If input has content → **Auto-save draft** to previous conversation
- Restore draft when user returns to that conversation

**Rationale:**
- **Fast feedback:** Users expect instant response (like switching tabs)
- **No interruption:** Confirmations break flow and slow power users
- **Data safety:** Auto-save means nothing is lost
- **Mental model:** Each card has its own draft (like Gmail drafts per email)

**Similar patterns:**
- VSCode: Switch files, draft comments auto-save
- Slack: Switch channels, message drafts persist
- Gmail: Switch emails, drafts auto-save

**Implementation:**
```typescript
// Store drafts per conversation ID
const [messageDrafts, setMessageDrafts] = useState<Record<string, string>>({});

// Save draft when switching
const openChatPanel = (conversationId: string) => {
  // Save current draft if exists
  if (activeConversationId && currentInputValue) {
    setMessageDrafts(prev => ({
      ...prev,
      [activeConversationId]: currentInputValue,
    }));
  }
  
  // Switch conversation immediately
  set({ 
    chatPanelOpen: true, 
    activeConversationId: conversationId,
  });
  
  // Load draft for new conversation (in MessageInput component)
  const draft = messageDrafts[conversationId] || '';
  setCurrentInputValue(draft);
};
```

---

### **5. Message Input Persistence** ✅

**Answer: Session-only in component state**

**Rationale:**
- **Drafts are ephemeral:** Unlike actual messages, drafts are temporary intent
- **Session scope is natural:** User closes app → fresh start makes sense
- **Simpler implementation:** No storage logic, migrations, or stale data cleanup
- **Less mental overhead:** Users don't wonder "why is this old text here?"
- **Performance:** No localStorage writes on every keystroke

**When to persist to storage:**
- ❌ Draft message text
- ✅ Actual sent messages
- ✅ Conversation history
- ✅ User preferences

**Comparison:**
- VSCode: Comment drafts are session-only
- Slack: Message drafts persist (but they're a messaging app)
- Discord: Drafts session-only
- **Our use case:** More like VSCode (work session) than Slack (always-on chat)

**Edge case handling:**
```typescript
// Optional: Warn on page unload if draft exists
useEffect(() => {
  const handleBeforeUnload = (e: BeforeUnloadEvent) => {
    if (currentInputValue.trim()) {
      e.preventDefault();
      e.returnValue = ''; // Show browser's default warning
    }
  };
  
  window.addEventListener('beforeunload', handleBeforeUnload);
  return () => window.removeEventListener('beforeunload', handleBeforeUnload);
}, [currentInputValue]);
```

---

### **6. Transition Animations** ✅

**Answer: Use `animation.spring.snappy` for active interactions**

**Rationale:**

**Opening/closing panel (triggered by user click):**
- Use **`animation.spring.snappy`** (stiffness: 600, damping: 40)
- Feels responsive and immediate
- User expects fast feedback from their action

**Switching conversations (content swap):**
- Use **instant fade** (no spring)
- Content changes should be immediate, not delayed
- Only animate opacity for smoothness

**Why NOT `animation.spring.gentle`:**
- Gentle is for **background operations** (sidebar auto-opening)
- Chat panel is **foreground action** (user clicked → expects speed)
- 300ms stiffness feels sluggish for direct manipulation

**Design Token Analysis:**
```typescript
// From design-tokens.ts
spring: {
  gentle: { stiffness: 300, damping: 35 },   // Sidebar auto-open
  default: { stiffness: 400, damping: 30 },  // General animations
  snappy: { stiffness: 600, damping: 40 },   // Quick feedback ✅
  bouncy: { stiffness: 500, damping: 25 },   // Hover effects
}
```

**Implementation:**
```typescript
// ChatPanel.tsx

// Panel slide-in/out
<motion.div
  initial={{ x: chatPanelWidth }}
  animate={{ x: 0 }}
  exit={{ x: chatPanelWidth }}
  transition={animation.spring.snappy}  // Fast response
  style={panelStyles}
>
  {/* Panel content */}
</motion.div>

// MessageThread.tsx - Content switching
<AnimatePresence mode="wait">
  <motion.div
    key={activeConversationId}
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: animation.duration.fast / 1000 }}  // 150ms instant fade
  >
    {messages.map(msg => <MessageBubble key={msg.id} message={msg} />)}
  </motion.div>
</AnimatePresence>
```

**Summary:**
- **Panel open/close:** `animation.spring.snappy` (600 stiffness)
- **Content swap:** Instant fade (150ms)
- **Resize handle:** No animation (immediate feedback)

---
