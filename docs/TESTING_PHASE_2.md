# Phase 2 Manual Testing Guide

This document outlines manual testing procedures for Phase 2 features, focusing on the User Preferences system, Settings Panel, and BranchDialog enhancements.

---

## What is ProjectLoom?

ProjectLoom is an infinite canvas for managing AI conversations with support for **branching** - creating alternative conversation paths from any point. Think of it as a visual conversation tree where you can explore different directions without losing your original context.

**Key Concepts:**
- **Canvas**: A workspace containing conversation nodes
- **Conversation Node**: A single AI conversation thread
- **Branch**: Creating a new canvas from a specific point in a conversation, optionally inheriting context
- **Context Inheritance**: Choosing which messages to bring along when branching

---

## Quick Start Tutorial

### Tutorial 1: Your First Conversation
**Goal:** Learn basic canvas interactions

1. **Start the dev server:** `npm run dev`
2. **Open browser:** Navigate to `http://localhost:3000`
3. **Observe the canvas:** You should see an infinite canvas with some demo conversation nodes
4. **Pan the canvas:** Click and drag on empty space
5. **Zoom:** Scroll wheel to zoom in/out
6. **Select a node:** Click on a conversation card
7. **Expand a node:** Double-click a card to see full conversation
8. **Move a node:** Click and drag a conversation card
9. **Collapse:** Double-click again to collapse

**Expected:** Smooth interactions, no lag, cards respond instantly

---

### Tutorial 2: Creating Your First Branch
**Goal:** Understand the branching workflow

1. **Find a conversation:** Select any conversation node on the canvas
2. **Open context menu:** Right-click the node
3. **Select "Branch from here":** This opens the Branch Dialog
4. **Enter a reason:** Type "Exploring alternative approach" in the text field
5. **Choose inheritance mode:**
   - **Full Context** - Brings all messages (good for continuity)
   - **Smart Summary** - Brings only recent important messages (good for long conversations)
   - **Custom Selection** - Manually pick which messages to include
6. **Create the branch:** Click "Create Branch" button
7. **Observe:** You're now on a new canvas that has the inherited context

**What happened?**
- A new canvas was created
- The conversation context was copied based on your selection
- You can now continue this conversation in a different direction
- The original conversation remains unchanged on the parent canvas

---

### Tutorial 3: Navigating Between Canvases
**Goal:** Learn multi-canvas navigation

1. **Look at the breadcrumb:** Top of screen shows: "Main Canvas > Branch: Exploring..."
2. **Click parent name:** Click "Main Canvas" in breadcrumb to go back
3. **Use Canvas Tree:** Look at left sidebar (if visible)
4. **Expand/collapse:** Click arrows to see canvas hierarchy
5. **Switch canvases:** Click any canvas name to navigate to it

**Key Insight:** Each branch creates a new canvas, but they're all connected in a tree structure

---

### Tutorial 4: Managing Your Preferences
**Goal:** Customize your workflow

1. **Open Settings:** Click gear icon (⚙️) in bottom-right corner
2. **Explore sections:**
   - **Branching Preferences** - Control branching behavior
   - **UI Preferences** - Toggle sidebar visibility, confirmations
3. **Try changing default inheritance:**
   - Set to "Smart Summary"
   - Next time you branch, this will be pre-selected
4. **Toggle "Always show branch dialog":**
   - When OFF: Branches create instantly with default settings
   - When ON: You choose settings each time (recommended for learning)
5. **Save and test:** Close settings, try creating a branch

---

### Tutorial 5: The "Remember Choice" Feature
**Goal:** Speed up repetitive branching

**Scenario:** You're exploring multiple branches and always want "Full Context"

1. **Open Branch Dialog:** Right-click node → "Branch from here"
2. **Select mode:** Choose "Full Context"
3. **Check "Remember this choice as default"** ✓
4. **Create branch:** Settings are saved
5. **Next branch:** "Full Context" is now pre-selected
6. **Verify in Settings:** Open Settings Panel to see it's saved

**Pro Tip:** Use this when you have a preferred branching style

---

### Tutorial 6: End-to-End Workflow Example
**Goal:** Complete realistic usage scenario

**Scenario:** You're debugging a code issue and want to explore different solutions

1. **Start with a conversation:**
   - Create or select a conversation about a bug
   - Have a few messages back and forth with the AI

2. **First approach - Brute force:**
   - Right-click → "Branch from here"
   - Reason: "Try brute force solution"
   - Mode: "Full Context" (need all details)
   - Create branch
   - Continue conversation on this new canvas

3. **Second approach - Optimization:**
   - Go back to parent canvas (breadcrumb or tree)
   - Right-click **same node** again
   - Reason: "Try optimized approach"
   - Mode: "Full Context"
   - Create branch
   - Continue on this canvas

4. **Compare results:**
   - Use Canvas Tree to see both branches
   - Switch between them to compare solutions
   - Original conversation is still intact in parent canvas

5. **Choose winner:**
   - Continue developing in the branch that worked best
   - Other branches remain available for reference

**Key Takeaway:** Branching lets you explore multiple solutions from the same starting point without losing work.

---

### Tutorial 7: Working with Context Inheritance
**Goal:** Master the different inheritance modes

**Test each mode to see the differences:**

1. **Full Context Mode:**
   - Open Branch Dialog
   - Select "Full Context"
   - Look at "Context preview": Shows all messages
   - **Use when:** You need complete conversation history

2. **Smart Summary Mode:**
   - Select "Summary (Smart Truncation)"
   - Look at preview: Shows reduced message count
   - **Use when:** Long conversations, only need recent context

3. **Custom Selection Mode:**
   - Select "Custom Selection"
   - See checklist of all messages
   - Uncheck messages you don't want
   - Preview updates showing selected count
   - **Use when:** You want precise control over inherited messages

**Practice:**
- Create three branches from the same node, one with each mode
- Compare the inherited context panels on each new canvas
- See how token counts differ

---

## Prerequisites

1. Start the development server: `npm run dev`
2. Open browser to `http://localhost:3000`
3. Open browser DevTools Console (F12) to monitor for errors
4. Clear localStorage if needed: `localStorage.clear()` in console

---

## Practical Testing Scenarios

These scenarios combine multiple features to test realistic workflows.

### Scenario A: Research Project with Multiple Approaches
**Goal:** Test branching, navigation, and preferences together

1. **Setup:**
   - Start on main canvas
   - Create a conversation node about "Machine Learning Models"
   
2. **Explore approaches:**
   - Branch #1: "Supervised learning approach" (Full Context)
   - Branch #2: "Unsupervised learning approach" (Full Context)
   - Branch #3: "Hybrid approach" (Custom - select only key messages)

3. **Navigate and compare:**
   - Use Canvas Tree to switch between branches
   - Check breadcrumb shows correct path
   - Verify inherited context panel shows what was brought over

4. **Optimize workflow:**
   - Open Settings, set default to "Full Context"
   - Disable "Always show branch dialog"
   - Create new branch - should happen instantly
   - Re-enable dialog in settings

**Pass criteria:** Can create, navigate, and compare multiple branches without confusion

---

### Scenario B: UI Customization Workflow
**Goal:** Test all UI preference toggles in realistic sequence

1. **Start with defaults:** Fresh page load
2. **Focus mode:** Hide Canvas Tree Sidebar (more space for content)
3. **Work on branch:** Create a branch, verify inherited context visible
4. **Clean view:** Hide inherited context panel (you know the context)
5. **Quick delete:** Disable delete confirmation, delete a test node
6. **Restore defaults:** Open Settings → Reset to Defaults
7. **Verify:** All panels visible again, confirmation restored

**Pass criteria:** UI responds immediately to all toggles, no visual glitches

---

### Scenario C: Speed User Workflow
**Goal:** Test rapid branching with saved preferences

1. **Set preferences:**
   - Default inheritance: "Smart Summary"
   - Always show dialog: OFF
   
2. **Rapid branch creation:**
   - Select node → Right-click → Branch (should create instantly)
   - Repeat 3-4 times from different nodes
   - Verify each branch created with Smart Summary mode

3. **Override when needed:**
   - Hold Shift while branching (dialog should appear)
   - Choose "Full Context" for this one branch
   - Check "Remember this choice" ✓
   - Create branch

4. **Verify new default:**
   - Try another instant branch
   - Should now use "Full Context" (your new default)

**Pass criteria:** Can switch between instant and manual branching modes seamlessly

---

### Scenario D: Error Recovery
**Goal:** Test robustness and error handling

1. **Corrupt preferences:**
   ```javascript
   localStorage.setItem('projectloom_preferences', '{invalid json}')
   ```
2. **Refresh page:** Should load with defaults, no crash
3. **Corrupt canvas data:**
   ```javascript
   localStorage.setItem('projectloom_canvas_data', 'corrupted')
   ```
4. **Refresh:** Should handle gracefully
5. **Test with empty conversation:**
   - Try branching from empty/invalid node
   - Should show error, not crash

**Pass criteria:** App handles all error states gracefully, no white screen

---

### Scenario E: Cross-Session Persistence
**Goal:** Verify all data survives browser restarts

1. **Configure everything:**
   - Set 3 custom preferences
   - Create 5 canvases with branches
   - Hide sidebar
   - Set default inheritance to Custom
   
2. **Close browser completely** (not just tab)

3. **Reopen and verify:**
   - Preferences: Still customized
   - Canvases: All present in tree
   - UI state: Sidebar still hidden
   - Navigation: Can switch between all canvases

**Pass criteria:** Zero data loss across browser restarts

---

### Scenario F: Performance Under Load
**Goal:** Test with heavy usage

1. **Create many nodes:**
   - Add 10+ conversation nodes to canvas
   - Create several branches from different nodes

2. **Rapid interactions:**
   - Pan canvas quickly
   - Zoom in/out repeatedly
   - Select/deselect nodes rapidly
   - Expand/collapse multiple cards

3. **Monitor DevTools:**
   - Check FPS (should stay near 60)
   - Memory shouldn't grow unbounded
   - No console errors

**Pass criteria:** 60 FPS maintained, no lag or memory leaks

---
























## Test Suite 1: User Preferences Store

### Test 1.1: Default Preferences on First Load
**Steps:**
1. Clear localStorage: `localStorage.clear()`
2. Refresh the page
3. Open Settings Panel (gear icon in bottom-right)

**Expected Results:**
- Settings panel opens successfully
- Default inheritance mode: "Full Context"
- "Always show branch dialog" checkbox: **checked** ✓
- "Show canvas tree sidebar" toggle: **on**
- "Show inherited context panel" toggle: **on**
- "Confirm before deleting conversations" toggle: **on**

### Test 1.2: Preferences Persistence
**Steps:**
1. Open Settings Panel
2. Change default inheritance mode to "Smart Summary"
3. Toggle "Show canvas tree sidebar" **off**
4. Close Settings Panel
5. Refresh the page
6. Reopen Settings Panel

**Expected Results:**
- Settings persist across page refresh
- Default inheritance mode: "Smart Summary"
- Canvas tree sidebar remains hidden
- All other settings remain as configured

### Test 1.3: Reset to Defaults
**Steps:**
1. Open Settings Panel
2. Change several settings from defaults
3. Click "Reset to Defaults" button
4. Verify confirmation dialog appears (if implemented)
5. Confirm reset

**Expected Results:**
- All settings return to default values:
  - Default inheritance mode: "Full Context"
  - Always show branch dialog: **checked**
  - Show canvas tree sidebar: **on**
  - Show inherited context panel: **on**
  - Confirm before deleting: **on**

---

## Test Suite 2: Settings Panel UI

### Test 2.1: Settings Button Visibility and Position
**Steps:**
1. Load the canvas page
2. Locate the Settings button (gear icon)

**Expected Results:**
- Settings button visible in bottom-right corner
- Button uses FAB (Floating Action Button) style
- Hover effect works (lighter background)
- Button has proper z-index (appears above canvas content)

### Test 2.2: Settings Panel Open/Close
**Steps:**
1. Click Settings button
2. Verify panel opens
3. Click outside the panel (backdrop)
4. Verify panel closes
5. Reopen Settings Panel
6. Click the X button in top-right
7. Verify panel closes

**Expected Results:**
- Panel animates in/out smoothly
- Backdrop dims background content
- Panel positioned center of screen
- Close methods work: backdrop click, X button
- No console errors

### Test 2.3: Settings Panel Sections
**Steps:**
1. Open Settings Panel
2. Inspect both sections: "Branching" and "UI Preferences"

**Expected Results:**
- Two clearly labeled sections visible
- "Branching Preferences" section contains:
  - "Default Inheritance Mode" dropdown
  - "Always show branch dialog" checkbox
- "UI Preferences" section contains:
  - "Show canvas tree sidebar" toggle
  - "Show inherited context panel" toggle
  - "Confirm before deleting conversations" toggle
- All controls are properly styled and functional

---

## Test Suite 3: BranchDialog "Remember Choice" Feature

### Test 3.1: Remember Choice Checkbox Visibility
**Steps:**
1. Create a conversation node on canvas (if none exist)
2. Right-click the node → Select "Branch from here"
3. Locate "Remember this choice as default" checkbox

**Expected Results:**
- Checkbox appears in BranchDialog (near bottom)
- Checkbox label is clear
- Checkbox is **unchecked** by default
- Checkbox is functional (can be toggled)

### Test 3.2: Save Preference with Remember Choice
**Steps:**
1. Open BranchDialog
2. Select inheritance mode: "Smart Summary"
3. **Check** "Remember this choice as default"
4. Click "Create Branch"
5. Open Settings Panel
6. Check "Default Inheritance Mode"

**Expected Results:**
- Settings Panel shows "Smart Summary" as default
- Preference persists after page refresh

### Test 3.3: Branch Dialog Respects Default Inheritance Mode
**Steps:**
1. Open Settings Panel
2. Set "Default Inheritance Mode" to "Custom Selection"
3. Close Settings Panel
4. Create new conversation node
5. Right-click → "Branch from here"

**Expected Results:**
- BranchDialog opens with "Custom Selection" tab pre-selected
- Custom selection UI is visible immediately
- Other tabs still accessible

### Test 3.4: Skip Branch Dialog When Disabled
**Steps:**
1. Open Settings Panel
2. **Uncheck** "Always show branch dialog"
3. Close Settings Panel
4. Right-click conversation node → "Branch from here"

**Expected Results:**
- BranchDialog does **not** appear
- Branch creates immediately using default inheritance mode
- New branched canvas opens
- No console errors

### Test 3.5: Override Skip Dialog with Modifier Key
**Steps:**
1. With "Always show branch dialog" **unchecked**
2. Hold **Shift** key
3. Right-click conversation node → "Branch from here"

**Expected Results:**
- BranchDialog **opens** (override behavior)
- User can configure branch manually
- Creates branch after submitting dialog

---

## Test Suite 4: UI Preference Toggles

### Test 4.1: Canvas Tree Sidebar Toggle
**Steps:**
1. Ensure Canvas Tree Sidebar is visible (left side)
2. Open Settings Panel
3. Toggle "Show canvas tree sidebar" **off**
4. Close Settings Panel

**Expected Results:**
- Canvas Tree Sidebar immediately disappears
- Canvas content reflows to fill space
- No layout glitches

**Steps (continued):**
5. Reopen Settings Panel
6. Toggle "Show canvas tree sidebar" **on**

**Expected Results:**
- Canvas Tree Sidebar reappears
- Sidebar content intact (canvas list preserved)

### Test 4.2: Inherited Context Panel Toggle
**Setup:**
1. Create a parent canvas with conversation nodes
2. Branch from a conversation (creates child canvas with parent)

**Steps:**
1. Verify Inherited Context Panel is visible (top-right area)
2. Open Settings Panel
3. Toggle "Show inherited context panel" **off**
4. Close Settings Panel

**Expected Results:**
- Inherited Context Panel immediately disappears
- Breadcrumb navigation remains visible
- No layout glitches

**Steps (continued):**
5. Reopen Settings Panel
6. Toggle "Show inherited context panel" **on**

**Expected Results:**
- Inherited Context Panel reappears
- Panel shows correct parent context
- Token counts and preview accurate

### Test 4.3: Confirm Before Deleting Toggle
**Steps:**
1. Create a test conversation node
2. Open Settings Panel
3. Ensure "Confirm before deleting conversations" is **on**
4. Close Settings Panel
5. Press Delete key with node selected (or right-click → Delete)

**Expected Results:**
- Confirmation dialog appears
- Can cancel deletion
- Can confirm deletion

**Steps (continued):**
6. Create another test node
7. Open Settings Panel
8. Toggle "Confirm before deleting conversations" **off**
9. Close Settings Panel
10. Delete the test node

**Expected Results:**
- Node deletes immediately
- No confirmation dialog
- Undo still available (Ctrl+Z)

---

## Test Suite 5: Integration & Edge Cases

### Test 5.1: Preferences Survive Page Refresh
**Steps:**
1. Change multiple settings:
   - Set inheritance mode to "Smart Summary"
   - Disable "Always show branch dialog"
   - Hide Canvas Tree Sidebar
   - Hide Inherited Context Panel
2. Close Settings Panel
3. Create a branch (should skip dialog)
4. Refresh the page (F5)
5. Check all UI elements and Settings Panel

**Expected Results:**
- All preferences persist exactly
- UI reflects saved preferences immediately
- Settings Panel shows saved values
- Branching behavior matches saved preference

### Test 5.2: Multiple Canvas Context Switch
**Steps:**
1. Create Canvas A with preferences:
   - Hide sidebar
   - Default: "Full Context"
2. Create Canvas B (branch from Canvas A)
3. Switch between Canvas A and Canvas B using Canvas Tree or breadcrumb

**Expected Results:**
- UI preferences apply globally (sidebar stays hidden)
- Branching preferences apply globally
- No state corruption when switching canvases

### Test 5.3: Invalid State Recovery
**Steps:**
1. Open DevTools Console
2. Manually corrupt preferences:
   ```javascript
   localStorage.setItem('projectloom_preferences', 'invalid_json_data')
   ```
3. Refresh page

**Expected Results:**
- App loads without crashing
- Preferences reset to defaults
- Console may show warning about corrupted data (acceptable)
- No breaking errors

### Test 5.4: Settings Panel During Branch Dialog
**Steps:**
1. Open BranchDialog
2. Try to open Settings Panel (click gear icon)

**Expected Results:**
- Settings Panel should open **over** Branch Dialog (higher z-index)
- Both modals should remain functional
- Closing Settings Panel returns focus to Branch Dialog
- No z-index fighting or visual glitches

### Test 5.5: Keyboard Accessibility
**Steps:**
1. Use **Tab** key to navigate through Settings Panel
2. Use **Enter** or **Space** to toggle checkboxes
3. Use **Escape** to close Settings Panel

**Expected Results:**
- Focus indicators visible on all interactive elements
- Tab order is logical (top to bottom, left to right)
- Keyboard controls work as expected
- Escape key closes panel

---

## Test Suite 6: Performance & Storage

### Test 6.1: localStorage Size Check
**Steps:**
1. Configure all preferences
2. Create multiple canvases with nodes
3. Open DevTools → Application → Local Storage
4. Inspect storage keys

**Expected Results:**
- `projectloom_preferences` key exists
- Data is JSON with schema version
- File size is reasonable (<5KB for preferences)
- No duplicate or orphaned keys

### Test 6.2: No Memory Leaks on Preference Changes
**Steps:**
1. Open Settings Panel
2. Toggle UI preferences on/off rapidly (10+ times)
3. Change inheritance mode multiple times
4. Close and reopen Settings Panel repeatedly

**Expected Results:**
- UI remains responsive
- No lag or slowdown
- No console errors or warnings
- DevTools memory profiler shows stable memory (if checked)

---

## Test Suite 7: Cross-Browser Testing

Repeat key tests in:
- **Chrome/Edge** (primary)
- **Firefox**
- **Safari** (if available)

**Focus Areas:**
- Settings Panel animations
- localStorage persistence
- UI preference toggles
- BranchDialog "Remember choice"

**Expected Results:**
- Consistent behavior across browsers
- No browser-specific bugs
- Fallback behavior works if features unsupported

---

## Regression Testing Checklist

Verify existing functionality still works:
- [ ] Create conversation nodes
- [ ] Branch from conversation (with dialog)
- [ ] Edit conversation content
- [ ] Undo/Redo (Ctrl+Z / Ctrl+Y)
- [ ] Canvas navigation (pan, zoom)
- [ ] Minimap interactions
- [ ] Node selection (single, multi-select)
- [ ] Edge connections
- [ ] Canvas Tree Sidebar navigation
- [ ] Breadcrumb navigation
- [ ] Inherited Context Panel display
- [ ] Delete conversations
- [ ] Keyboard shortcuts

---

## Known Issues / Expected Behaviors

1. **Settings Panel z-index**: Should always appear above other UI elements
2. **Preference Loading**: Brief flash possible on first load before preferences apply
3. **Branch Dialog Skip**: No visual feedback when dialog is skipped (instant branch creation)
4. **localStorage Limit**: Browser-specific (typically 5-10MB), should be sufficient

---

## Reporting Issues

When reporting issues, include:
1. Browser and version
2. Steps to reproduce
3. Expected vs actual behavior
4. Console errors (if any)
5. localStorage state (if relevant):
   ```javascript
   console.log(localStorage.getItem('projectloom_preferences'));
   ```

---

## Success Criteria

**All tests pass** when:
- No console errors during normal usage
- All preferences persist correctly
- UI responds to preference changes immediately
- Settings Panel is accessible and functional
- BranchDialog respects saved preferences
- No breaking changes to existing features
- Smooth animations and transitions
- Keyboard and mouse interactions work as expected

---

*Last Updated: February 3, 2026*
*Phase 2 Polish Items Implementation*
