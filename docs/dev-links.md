# Dev Quick Links

> All links assume `npm run dev` is running on port 3000.

## App

| Link | Description |
|------|-------------|
| [localhost:3000](http://localhost:3000) | Landing page |
| [localhost:3000/canvas](http://localhost:3000/canvas) | Canvas app |

## Testing / Reset

| Link | Description |
|------|-------------|
| [localhost:3000/canvas?onboarding=reset](http://localhost:3000/canvas?onboarding=reset) | Reset onboarding + clear canvas data, then reload |
| [localhost:3000/canvas?onboarding=reset&firstTime=1](http://localhost:3000/canvas?onboarding=reset&firstTime=1) | Full first-time reset (clears all ProjectLoom local data + KB + trial cookie), then reload |

## Dev Server

```powershell
npm run dev -- --port 3000 2>&1 | Tee-Object -FilePath dev.log
```

Logs are written to `dev.log` (gitignored). Use the default VS Code build task (`Ctrl+Shift+B`) to start it automatically.
