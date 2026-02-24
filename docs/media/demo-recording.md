# Demo Recording Mode

Navigate to: [/canvas?demo=record](http://localhost:3000/canvas?demo=record)

Works in both dev and production — just append `?demo=record` to your deployment URL.

That's it. The system takes over from there.

---

## What happens automatically

1. There is a 10-second silent pre-roll (nothing happens)
2. A root card is created and the first prompt is typed + sent
3. The chat panel stays open throughout the sequence (cleaner recording flow)
4. You perform the manual action (branch or merge), then the next prompt fires

---

## Your 3 actions

| Step | What you do |
|------|-------------|
| After card 1 | Right-click root → **Branch from here** |
| After card 2 | Right-click root → **Branch from here** again |
| After card 3 | Shift-click both branches → **Merge** |

---

## Tips

- **You're done when this appears in DevTools Console:** `[DemoRecord] ✅ Demo complete — stop your screen recorder.`
- **To start over:** refresh the page, then navigate to the link again
- **Escape** cancels at any point
- Suggested recording settings: 70–80% zoom, slow deliberate cursor movement
