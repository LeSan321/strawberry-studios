# Strawberry Studios — Project TODO

## Phase 1: Foundation
- [x] Dark noir design system (CSS variables, typography, color palette)
- [x] Database schema: concerts, characters, presets, audio_tracks tables
- [x] Core navigation structure and App.tsx routes
- [x] Google Fonts: Cinzel Decorative + Cormorant Garamond

## Phase 2: Landing Page
- [x] Hero section with cinematic noir aesthetic and Strawberry Studios branding
- [x] Tagline and featured Velvet Strawberry Jazz Club venue preview
- [x] CTA to enter the Studio
- [x] Atmospheric background with smoke/shadow effects

## Phase 3: Venue Dashboard & Concert Creation Wizard
- [x] Venue selection dashboard (Velvet Strawberry Jazz Club active, 2 Coming Soon)
- [x] Multi-step concert creation wizard (5 steps: Track, Vibe, Visual, Cast, Review)
- [x] Vibe presets: Intimate Jazz, High Energy, Noir Smoke, Custom
- [x] Camera style and lighting preset selectors
- [x] Character/Avatar system: The Red Head Singer, The Fedora Man, Custom

## Phase 4: Expert Council & Director's Package
- [x] Expert Council LLM backend (fabric physics, Kelvin lighting, camera psychology)
- [x] Director's Package JSON assembly pipeline (shot list, production notes, director statement)
- [x] Cinématique Preset Library: Shadow and Smoke, Golden Rim, Venetian Cage, Match Flare
- [x] Preset browsing UI with physics descriptions and camera psychology

## Phase 5: Library, Audio, and Ticket Links
- [x] User project library (authenticated dashboard with concert management)
- [x] Audio upload with S3 storage (/api/audio/upload endpoint)
- [x] Shareable concert ticket link (unique slug per concert)
- [x] Concert detail/ticket page with full Director's Package display

## Phase 6: Polish & Delivery
- [x] Full UI polish and responsive design
- [x] Vitest unit tests (9 passing)
- [x] Checkpoint and delivery

## Future Phases
- [ ] Strawberry in the Round venue (360° immersive)
- [ ] Berries on the Rocks venue (volcanic amphitheater)
- [ ] Character reference image upload (custom characters)
- [ ] Audio trimming and normalization tools
- [ ] Concert video generation integration (AI video API)
- [ ] Social sharing with Open Graph meta tags
- [ ] Admin preset management UI
- [ ] Strawberry Riff profile integration

## Knowledge Base Research Queue

### Tier 1 — Mine Next (High Direct Impact)
- [x] Pixar SIGGRAPH 2022 — "Revamping the Cloth Tailoring Pipeline at Pixar" (simulation vs. render mesh pipeline, artistic draping control) → Chapter 15
- [x] Pixar — "Directing Cloth Draping through Blended UVs" (artistic control over physics for Expert Council prompt generation) → Chapter 15
- [x] pbrt book (Pharr, Jakob, Humphreys) — Chapters on subsurface scattering, microfacet models, and volumetric materials (smoke/fog/rain) → Chapter 14
- [x] "Fabric mechanical parameters for 3D cloth simulation in apparel CAD" (2024 systematic review) — measured parameters for 1940s fabrics: rayon crepe, wool gabardine, bias-cut charmeuse → Chapter 16

### Tier 2 — Mine in a Future Session (Strong Supporting Material)
- [x] Awesome Cloth Simulation GitHub (coreqode/awesome-cloth-simulation) — PBD advances, GPU cloth methods, high-resolution garment simulation → Chapter 19
- [x] SIGGRAPH Asia 2024 — "Efficient Cloth Simulation Using Non-distance Barriers and Subspace Reuse" → Chapter 20
- [x] "Real-Time Cloth Simulation in Extended Reality" (2025) — XR fidelity thresholds, presence-preserving cloth → Chapter 21
- [x] Style3D SIGGRAPH 2024 papers — AI-assisted garment simulation and neural cloth correction → Chapter 22
- [x] Incredibles 2 simulation technical breakdowns — kinematic springs, pose-based scaling, geometric relaxation → Chapter 23
- [x] Awesome Physically Based Rendering GitHub (neil3d/awesome-pbr) — GGX BRDF, velvet Ashikhmin model, UE5 material parameters → Chapter 24
- [x] Real-Time Cloth Rendering with Fiber-Level Detail (SIGGRAPH courses) — procedural yarn model, volumetric fabric, fiber type reference tables → Chapter 25

### Tier 3 — Experiential Layer (Platinum Venues / Future Phases)
- [x] Royal College of Music virtual performance simulator (2024–2025) — acoustic + visual immersion, stage presence, spatial audio → Chapter 30
- [x] VR concert research — "Investigating how immersive virtual reality mediates the experience of virtual concerts" → Chapter 31
- [x] Marvelous Designer + Unreal Engine workflows — USD export of simulation data into Chaos Cloth for MetaHumans → Chapter 32
- [x] SIGGRAPH 2025 "Advances in Real-Time Rendering" course notes — strand-based hair/fur, ray tracing for open worlds → Chapter 33
- [x] "Real-Time Cloth Simulation Using WebGPU" (2025 arXiv) — browser-friendly venue previews → Chapter 34
- [x] PBR Texture & Material Libraries (Poly Haven, ambientCG) — real-world scanned materials as reference data → Chapter 35

### Knowledge Base Chapters Outstanding
- [x] Chapter 17 (Velvet Strawberry Department Briefs) — Physics, Wardrobe, Camera, Lighting, Atmospheric, Production Design, Sound + Director's Unifying Statement — COMPLETE
- [x] Strengthen Chapter 11 (Pixar BSSRDF) with pbrt book subsurface scattering chapter → Chapter 14
- [x] Strengthen Chapter 12 (Disney Cloth) with 2024 fabric mechanical parameters for 1940s-specific fabrics → Chapter 16
- [x] Chapter 14 — Experiential Layer (acoustic simulation, spatial audio, crowd dynamics) — COMPLETE via Chapters 30–31

## Psychology and Immersion Bible
- [x] Cinématique Psychology and Immersion Bible v1.0 — 6 chapters, 283 lines, 5,391 words
  - [x] Chapter 1: Film Lighting and Biological Response (EPN, cortisol, chiaroscuro neuroscience)
  - [x] Chapter 2: Atmosphere, Rain, Fog, and Spatial Psychology (dominance reduction, enclosure)
  - [x] Chapter 3: Fashion, Clothing Movement, and Enclothed Cognition (mirror neurons, sweat arc)
  - [x] Chapter 4: Immersive Experience, Presence, and VR Concert Psychology (4 dimensions of presence)
  - [x] Chapter 5: Biopsychological Foundations — The Emotional Cocktail (dopamine, oxytocin, frisson)
  - [x] Chapter 6: The Velvet Strawberry Psychological Brief + Director's Psychological Unifying Statement
  - [x] Chapter 7: Psychology Department Brief (full brief for Expert Council integration)

## Cinématique Bible Status
- [x] Physics and Wardrobe Bible v1.0 — 35 chapters, 3,519 lines, 43,774 words — ALL TIERS COMPLETE
- [x] Psychology and Immersion Bible v1.0 — 7 chapters — COMPLETE
- [x] Expert Council system prompt upgraded with full Bible content (checkpoint 47d6caae)

## Video Generator Backend — COMPLETE
- [x] Upgrade Expert Council system prompt with Chapters 30–35 (acoustic-visual coherence, 4D presence, PBR material parameters)
- [x] Extend DB schema: add video_status, video_url, video_prompt, video_job_id, video_error fields to concerts table
- [x] Run DB migration for video generation fields (0002_nice_nick_fury.sql)
- [x] Build tRPC procedures: concerts.generateVideo + concerts.pollVideoStatus
- [x] Implement 10-layer Cinématique prompt formula (Chapter 6) in cinematiquePromptBuilder.ts
- [x] Pluggable video adapter (mock/runway/kling/luma) in videoGeneration.ts
- [x] Wire video generation result back to concert record in DB
- [x] Video status polling (5s interval) and display in Library/Concert Ticket pages
- [x] Write vitest tests for video generation procedure (36 tests passing, 3 test files)

## Backlog — Deferred Features
- [ ] Shot Selector UI on Generate Video flow — modal letting user pick which shot from the Director's Package to use as the video seed (primaryShotIndex param already exists in the procedure)
- [ ] Concert Ticket Open Graph meta tags — og:title, og:description, og:image for rich social sharing previews

## Poe API / Veo-3.1 Integration — COMPLETE
- [x] Build Poe API (Veo-3.1) video generation adapter in videoGeneration.ts
- [x] Implement async job flow: POST /v1/videos → poll GET /v1/videos/{id} → download /v1/videos/{id}/content → upload to S3
- [x] Set VIDEO_PROVIDER=poe, POE_API_KEY, POE_VIDEO_MODEL=Veo-3.1 via secrets
- [x] Validate API key against /v1/models endpoint (4/4 tests passing, Veo-3.1 confirmed available)
- [x] 40 tests passing across 4 test files

## Bug Fixes — Live Test Round 1
- [x] BUG: concert_characters insert fails — DIAGNOSED: no mismatch; error was from first attempt before fix; DB columns match schema correctly
- [x] BUG: Wizard creates duplicate concerts — FIXED: added submitted flag + early return guard in handleSubmit; button disabled on pending/submitted
- [x] BUG: Video generation fails with Poe API — FIXED: old code sent 10s duration (unsupported); new code sends 8s (supported: 4/6/8); error.code field added to type; 40 tests passing

## Bug Fixes — Live Test Round 2
- [x] BUG: concert_characters insert fails — FIXED: Drizzle mysql2 returns [ResultSetHeader, FieldPacket[]] array; insertId is at result[0].insertId not result.insertId; 40 tests passing

## Runway ML Direct API Integration — COMPLETE
- [x] Write direct Runway ML adapter in videoGeneration.ts (text_to_video endpoint, gen4.5, 5s duration)
- [x] Replace poeApiKey.test.ts with runwayApiKey.test.ts (validates RUNWAY_API_KEY via known task ID)
- [x] Fix secondary text readability (muted-foreground bumped from 0.55 to 0.70)
- [x] Add Delete Concert button to Library (two-click confirm, hard delete via deleteConcert helper)
- [x] Add progress percentage to video badge (polls progress from Runway API, shown as "Processing 42%")
- [x] 40 tests passing across 4 test files

## Bug Fix — Runway 400 promptText Too Long
- [x] Rewrite cinematiquePromptBuilder to produce ≤1000-char Runway-optimised prompt (max 929 chars)
- [x] Verify all preset combinations stay under 1000 chars (60 combos tested, all pass)
- [x] Run tests and save checkpoint — 40/40 passing
- [x] Fix typo in Library.tsx: ffunction → function


## Video Generation — COMPLETE ✅
- [x] End-to-end video generation working (Runway gen4.5)
- [x] Live progress polling (shows % during generation)
- [x] Video URL with JWT token captured and stored
- [x] Inline video player on Library card
- [x] Full Cinématique pipeline: Expert Council → Prompt → Video → Display

## Campaign / Advertising Video Workflow — IN PROGRESS

### Phase A: Database & Backend
- [x] Add campaigns table to schema (genre, brief, duration mode, song, shots, status)
- [x] Add campaign_shots table (shot number, prompt, video_url, status, duration)
- [x] Run DB migration for campaigns tables
- [x] Build multi-genre Expert Council prompt engine (campaignPromptBuilder.ts)
- [x] Genre presets: Psychedelic/Vaporwave, Noir Jazz, Indie Folk, Hip Hop, Electronic, Punk/Rock, Soul/R&B, Country, Experimental/Art
- [x] Duration modes: 15s, 30s, 60s, Full Song
- [x] tRPC procedures: campaigns.create, campaigns.generatePackage, campaigns.generateShot, campaigns.pollShot, campaigns.list, campaigns.get, campaigns.delete

### Phase B: Campaign UI
- [x] Campaign entry point in navigation (sidebar + home page CTA)
- [x] Genre selector page with visual previews per genre
- [x] Campaign brief form (song, genre, duration, campaign goal, artist/character notes)
- [x] Director's Package review page (storyboard, shot list, color palette, character design, set design, art dept notes)
- [x] Shot-by-shot generation UI with progress tracking
- [x] Campaign Library page (separate from Concert Library)

### Phase C: Production Design Guide PDF
- [x] PDF generator server route (campaignPdfGenerator.ts)
- [x] Title card section (campaign name, artist, genre, logline)
- [x] Character design section (wardrobe specs, material notes)
- [x] Color palette section (swatches with Kelvin values and emotional notes)
- [x] Set design section (key environments with lighting notes)
- [x] Shot storyboard section (numbered shots with descriptions)
- [x] Art department notes section
- [x] Download button on Director's Package page

### Phase D: Music Video Grammar Bible Integration
- [x] Music Video Grammar Bible v1.0 written and saved (impressionistic, narrative, performance modes + 9 genre chapters)
- [x] Genre visual grammar tables integrated into campaignPromptBuilder.ts
- [x] Impressionistic mode, narrative mode, performance mode all supported

### Phase E: Retry & Resilience
- [x] retryShot tRPC procedure (reset single failed shot to none, re-queue generation)
- [x] retryAllFailed tRPC procedure (bulk reset all failed shots in a campaign)
- [x] Per-shot Retry button (amber, appears on failed shots in shot list)
- [x] "Retry All Failed" bulk button (red, appears in shot list header when any shot has failed)

### Phase F: Polling Bug Fix
- [x] BUG: Campaign shots stuck at 5% forever — campaigns.get was DB-read-only, never called Runway API
- [x] FIX: Moved Runway inline polling into campaigns.get — every 5s refetch now checks Runway for all generating shots, downloads completed videos to S3, marks them complete
- [x] Rescued 5 stuck shots (all SUCCEEDED on Runway) — downloaded to S3, DB updated to complete

### Phase G: Prompt Editing & Regeneration
- [x] editShotPrompt tRPC procedure (update videoPrompt on a shot, reset status to none OR regenerate immediately)
- [x] Prompt edit modal in shot card UI (shows current prompt, character counter ≤1000, Save Only / Save & Regenerate buttons)
- [x] "Edit Prompt" pencil button on every shot card (available on none/complete/failed, hidden during generating/queued)
- [x] Character counter with colour warning (amber >800, red >950)

### Phase H: Campaign Mood Board
- [x] DB schema: campaign_mood_board_images table (id, campaignId, imageUrl, imageKey, label, isPrimary, sortOrder, createdAt)
- [x] DB schema: moodBoardPrimaryImageUrl column on campaigns table
- [x] DB helpers: getMoodBoardImages, addMoodBoardImage, removeMoodBoardImage, setPrimaryMoodBoardImage, clearPrimaryMoodBoardImage
- [x] S3 upload route: POST /api/mood-board/upload (multer, 10MB, image types only)
- [x] tRPC: moodBoardList, moodBoardAddByUrl, moodBoardSaveUpload, moodBoardRemove, moodBoardSetPrimary, moodBoardClearPrimary
- [x] Mood Board panel in campaign detail UI (collapsible, after Director's Package, before Shot List)
- [x] Image grid with primary badge, hover actions (Set Primary / Clear / Remove)
- [x] Add by URL mode with label input
- [x] Upload mode with file picker, progress, label input (max 6 images)
- [x] Primary image badge + "Active Reference" indicator in panel header
- [x] Pass primary mood board image URL to Runway on every shot generation (generateShot, retryShot, retryAllFailed, editShotPrompt regenerate)
- [x] Fix: pencil edit icon now always visible (zinc-300 bg-zinc-800/60) instead of ghost/invisible

### Phase I: Runway Image-to-Video Fix
- [x] BUG: Mood board primary image used as loose style hint (text_to_video + image reference) — Runway ignores it visually
- [x] FIX: Switch to image_to_video endpoint when primary image is present (image becomes first frame, prompt guides motion)
- [x] Keep text_to_video as fallback when no mood board primary image is pinned
- [x] Update Runway adapter in videoGeneration.ts to handle both modes
