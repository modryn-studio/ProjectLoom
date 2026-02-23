# Media Migration Rules (MVP)

## Current setup (safe now)
- Keep hosting local files in `/public`:
  - `/demo.mp4`
  - `/podcast.m4a`
  - `/demo-poster.png`
- This is fine for current traffic (~30 users).

## When to migrate off local hosting
Migrate video/podcast to external hosting (YouTube/Spotify or CDN) when **any** of these are true:
- Vercel monthly bandwidth > **60 GB** (warning threshold)
- You expect a launch spike (Product Hunt, HN, Reddit, newsletter blast)
- Landing page gets ~**500+ unique visitors/month** consistently
- Audio/video start buffering complaints increase

## Hard limit reference
- Vercel free bandwidth: **100 GB/month**
- Approximate plays to hit 100 GB:
  - `demo.mp4` (19 MB): ~5,200 plays
  - `podcast.m4a` (37 MB): ~2,700 plays

## Zero-code migration path
Set these environment variables in production:
- `NEXT_PUBLIC_DEMO_VIDEO_URL`
- `NEXT_PUBLIC_DEMO_VIDEO_EXTERNAL_URL`
- `NEXT_PUBLIC_PODCAST_AUDIO_URL`
- `NEXT_PUBLIC_PODCAST_EXTERNAL_URL`
- (Optional) `NEXT_PUBLIC_DEMO_VIDEO_POSTER_URL`
- (Optional) `NEXT_PUBLIC_DEMO_VIDEO_CAPTIONS_URL`

After setting env vars, redeploy. No code changes required.

## Suggested route by stage
- **Now (MVP):** local `/public` files
- **First public launch:** YouTube (demo) + Spotify/SoundCloud (podcast)
- **Scaling phase:** dedicated media CDN/storage (Cloudflare R2 + CDN, Bunny, S3 + CloudFront)

## Quick monthly check (5 min)
1. Open Vercel usage dashboard
2. Check bandwidth trend
3. If >60 GB or spike expected, switch env vars before campaign day
