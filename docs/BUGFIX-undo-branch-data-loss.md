# Bugfix: Undo Branch Creation Deletes Parent Conversation Data

## Problem

When a user:
1. Created a card and had a conversation
2. Pressed the branch button to create a branch
3. Pressed Ctrl+Z to undo

**Bug**: The undo operation would delete all conversation data from the original (parent) card, not just the new branch.

**Why it happened**: Pressing redo would restore the data, and the bug was intermittent.

## Root Cause

The history system only recorded state at specific points:
- When a card was created
- When a card was deleted
- When a branch/merge was created

But NOT when messages were added to a conversation.

### The Sequence

```
1. User creates card
   → recordHistory() → history[0] = { parent card with NO messages }
   
2. User adds messages via chat
   → NO history recorded
   
3. User creates branch
   → recordHistory() → history[1] = { parent with messages + new branch }
   
4. User presses undo
   → Restores history[0] = { parent card with NO messages } ❌
```

The problem: When branching, `recordHistory()` was only called AFTER creating the branch, not BEFORE. So when undoing, it would revert to the last saved state (when the card was created empty).

## Solution

Added `recordHistory()` call BEFORE making state changes in both:
- `branchFromMessage()`
- `createMergeNode()`

This ensures the current state (with all messages) is captured before the operation.

### Fixed Sequence

```
1. User creates card
   → recordHistory() → history[0] = { parent card with NO messages }
   
2. User adds messages via chat
   → NO history recorded (still)
   
3. User creates branch
   → recordHistory() → history[1] = { parent with messages } ✅
   → Create branch
   → recordHistory() → history[2] = { parent with messages + new branch }
   
4. User presses undo
   → Restores history[1] = { parent with messages } ✅
```

## Changes

**File**: `src/stores/canvas-store.ts`

### branchFromMessage()
Added `get().recordHistory()` after validation but before creating the branch.

### createMergeNode()
Added `get().recordHistory()` after validation but before creating the merge node.

## Testing

Added comprehensive test case in `src/__tests__/branchingStore.test.ts`:

```typescript
it('preserves parent conversation content when undoing branch creation', () => {
  // Creates parent with 3 messages
  // Branches from it
  // Undos
  // Verifies parent still has all 3 messages ✅
});
```

All 67 tests pass including this new regression test.

## Why Double Recording is Correct

Each branch/merge operation now records history TWICE:
1. **Before**: Captures state before the operation (for undo to restore to)
2. **After**: Captures state after the operation (current state)

This is the correct behavior for undo/redo to work properly. When you undo, you want to go back to the state before the operation, not to some arbitrary earlier state.

## Edge Cases Handled

- Validation failures don't record unnecessary history entries (recordHistory is after validation)
- Works for both branch and merge operations
- Preserves inherited context correctly
- Compatible with existing undo/redo flow (truncates forward history when new changes are made)

## Related Files

- [canvas-store.ts](../src/stores/canvas-store.ts) - Main fix
- [branchingStore.test.ts](../src/__tests__/branchingStore.test.ts) - Test coverage
