# Missing Implementations - Card-Level Branching

**Last Updated:** February 5, 2026  
**Status:** 95% Complete - Minor Polish Items Remaining

## ✅ Verified Complete (No Action Needed)

After thorough codebase review, the following items from the spec are **FULLY IMPLEMENTED**:

1. ✅ **Visual Degradation for Merge Nodes**
   - Implemented in `ConversationCard.tsx` lines 318-346
   - Green/Amber/Red color coding based on parent count
   - Warning tooltips for complex merges
   - Badge displays parent count with warning icons

2. ✅ **Edge Bundling Logic**
   - Implemented in `canvas-store.ts` lines 1238-1257
   - Reduces opacity to 0.6 when 4+ parents
   - All edges still render but with bundled appearance
   - First edge gets label with source count

3. ✅ **Cycle Prevention**
   - Fully implemented with `wouldCreateCycle()` function
   - Blocks circular dependencies
   - Shows appropriate warnings

4. ✅ **Context Inheritance UI**
   - InlineBranchPanel.tsx (mouse workflow)
   - BranchDialog.tsx (keyboard workflow)
   - InheritedContextPanel.tsx shows parent context

5. ✅ **Undo/Redo with Toasts**
   - UndoToast.tsx fully implemented
   - Shows notifications for branch/merge/delete actions
   - Undo functionality working

---

## ⚠️ MISSING IMPLEMENTATIONS (Action Required)

### **1. Toast Notifications for Merge Warnings** 🔴 **HIGH PRIORITY**

**Issue:** No real-time toast notifications when adding parents to merge nodes

**What's Missing:**
```typescript
// When user drags 3rd source to merge node:
showToast({
  type: 'warning',
  message: 'Adding source 3/5. Complex merges may reduce AI response quality.'
})

// When user tries to add 6th source:
showToast({
  type: 'error', 
  message: 'Merge node limit reached (5 sources). Consider creating intermediate merge nodes.',
  action: {
    label: 'Learn More',
    onClick: () => showHierarchicalMergeDialog()
  }
})
```

**Where to Implement:**
- File: `src/stores/canvas-store.ts`
- Function: `createMergeNode()` (around line 1175)
- Add toast notifications based on `sourceCardIds.length`

**Acceptance Criteria:**
- [ ] Warning toast at 3+ parents (amber color)
- [ ] Error toast at 5 parents (red color) with suggestion
- [ ] Toast auto-dismisses after 5 seconds
- [ ] User can dismiss manually

---

### **2. Hierarchical Merge Suggestion Dialog** 🟡 **MEDIUM PRIORITY**

**Issue:** No educational dialog when users hit 5-parent limit

**What's Missing:**
```typescript
// When user tries to add 6th source, show dialog:
<HierarchicalMergeDialog>
  <h2>Too Many Sources</h2>
  <p>Merge nodes work best with 2-5 sources. Consider organizing them hierarchically:</p>
  
  <div className="example">
    <p>Instead of:</p>
    <code>[A] [B] [C] [D] [E] [F] → [Final]</code>
    
    <p>Try this pattern:</p>
    <code>
      [A] [B] [C] → [Group 1]
      [D] [E] [F] → [Group 2]
      [Group 1] [Group 2] → [Final]
    </code>
  </div>
  
  <button>Create Intermediate Merge</button>
  <button>Got It</button>
</HierarchicalMergeDialog>
```

**Where to Implement:**
- Create new file: `src/components/HierarchicalMergeDialog.tsx`
- Trigger from: `canvas-store.ts` when parent count validation fails
- Show once per session (use localStorage flag)

**Acceptance Criteria:**
- [ ] Dialog appears when trying to exceed 5 parents
- [ ] Shows visual example of hierarchical pattern
- [ ] "Create Intermediate Merge" button pre-fills merge node creator
- [ ] Dialog can be dismissed and won't show again in session

---

### **3. Canvas Stats Display** 🟢 **LOW PRIORITY (Nice to Have)**

**Issue:** No workspace statistics in header

**What's Missing:**
```typescript
// In CanvasBreadcrumb or new WorkspaceHeader:
<div className="workspace-stats">
  <span className="workspace-name">📁 API Design Project</span>
  <span className="stats">
    {cardCount} cards | {mergeCount} merges
  </span>
</div>
```

**Where to Implement:**
- File: `src/components/CanvasBreadcrumb.tsx`
- Add stats calculation from `conversations` map
- Display next to workspace name when no card selected

**Acceptance Criteria:**
- [ ] Shows total card count
- [ ] Shows merge node count
- [ ] Updates reactively when cards added/removed
- [ ] Styled consistently with existing breadcrumb

---

### **4. Workspace Switcher Dropdown** 🔵 **FUTURE (Not in Spec)**

**Issue:** No UI to switch between multiple workspaces

**Status:** Not implemented, but **NOT REQUIRED** for v4 launch

**Reasoning:**
- Multi-workspace support exists in store
- Current CanvasBreadcrumb shows workspace name
- Most users will use single workspace initially
- Can be added in Phase 3+ when multi-workspace usage increases

**If Implementing (Future):**
- Create: `src/components/WorkspaceSwitcherDropdown.tsx`
- Show list of all workspaces with switch action
- Add "+" button to create new workspace
- Store workspace order preference

---

## 📋 Implementation Priority

### **This Week (Required for Spec Compliance):**

1. **Toast Notifications** (2-3 hours)
   - Add to `canvas-store.ts` createMergeNode
   - Warning at 3 parents
   - Error at 5 parents
   - Test with merge node creation

2. **Hierarchical Merge Dialog** (3-4 hours)
   - Create dialog component
   - Design visual example
   - Wire up to merge validation
   - Add session persistence

### **Next Sprint (Polish):**

3. **Canvas Stats** (1 hour)
   - Calculate card/merge counts
   - Add to breadcrumb
   - Style and test

---

## 🧪 Testing Checklist

After implementing toast notifications:
- [ ] Create merge node with 2 parents → no toast
- [ ] Add 3rd parent → warning toast appears
- [ ] Add 4th parent → warning toast appears  
- [ ] Add 5th parent → error toast appears
- [ ] Try to add 6th parent → blocked with suggestion

After implementing dialog:
- [ ] Attempt 6th parent → dialog opens
- [ ] Dialog shows hierarchical example
- [ ] "Got It" dismisses dialog
- [ ] Dialog doesn't show again in same session
- [ ] Dialog reappears in new session

---

## 📝 Notes

**Why These Were Missed:**
1. Toast notifications exist in `UndoToast.tsx` but weren't wired to merge validation
2. Educational dialog was in spec but deprioritized during implementation
3. Canvas stats are UI polish that don't affect functionality

**Impact:**
- Low - Core functionality works perfectly
- Users can still see visual warnings on cards
- Merge limit is enforced (just no toast)

**References:**
- Spec: `docs/card-branching/card-branching-decisions.md` lines 15-108
- GitHub Issue: #5 (comments #2 and #3)
- User Tutorial: `docs/USER_TUTORIAL.md` section 4.3

---

## ✨ Bonus: Optional Enhancements

These are NOT in the spec but could improve UX:

1. **Merge Node Border Colors** (Already Done! ✅)
   - Implemented in ConversationCard.tsx
   - No action needed

2. **Edge Animation for Merge**
   - Pulsing animation on merge edges
   - Low priority visual polish

3. **Parent Source Preview**
   - Hover over merge node → show parent titles
   - Already implemented via tooltip! ✅

4. **Keyboard Shortcut for Merge**
   - Ctrl/Cmd+M to create merge from selected cards
   - Would match Ctrl/Cmd+B for branch

---

**Document Status:** Ready for implementation  
**Next Review:** After toast notifications are added  
**Owner:** Development team
