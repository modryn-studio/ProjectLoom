# Card-Level Branching: Future Features

## **Cross-workspace references**

**Description:** Allow linking cards across workspaces

```typescript
// Allow linking cards across workspaces
interface CrossWorkspaceReference {
  fromCardId: string
  fromCanvasId: string
  toCardId: string
  toCanvasId: string
  note?: string  // "See database discussion in Main Project"
}
```

---

*Add additional future feature ideas here as they come up*
