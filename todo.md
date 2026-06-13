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

### Phase J: Mood Board UX Redesign
- [x] Auto-fix: set first mood board image as primary for all campaigns where images exist but moodBoardPrimaryImageUrl is NULL (DB migration applied)
- [x] Remove hidden hover-only "Set Primary" button -- replaced with click-to-select interaction
- [x] Clicking any image immediately makes it the active reference (calls moodBoardSetPrimary inline)
- [x] Active reference image shows prominent rose border + ring + always-visible "Active" badge
- [x] Non-primary images show "Click to activate" hint on hover
- [x] Active Reference preview strip at top of mood board panel (thumbnail + label + Clear button)
- [x] Amber warning strip shown when images exist but none is active
- [x] Remove button always visible in top-right corner of each image (no hover required)

### Phase K: Visual Universe Data Model
- [x] Add creator_frequencies table to schema (userId, frequencyName, arcType, vocabularyJson, synthesisFingerprint, diagnosticAnswersJson, isDefault)
- [x] Add platform_default_vocabulary table to schema (vocabularyJson, version)
- [x] Add arcPosition column to campaigns table (gathering/arriving/open, default arriving)
- [x] Add frequencyId column to campaigns table (optional FK to creator_frequencies)
- [x] Generate migration SQL via pnpm drizzle-kit generate
- [x] Apply migration via webdev_execute_sql
- [x] Add DB helpers: getCreatorFrequency, saveCreatorFrequency, getDefaultCreatorFrequency, getPlatformDefaultVocabulary, upsertPlatformDefaultVocabulary
- [x] Seed platform default vocabulary record
- [x] Seed Blooming Frontier frequency record for owner
- [x] Write vitest coverage for all new DB helpers

### Phase L: Cover Art Prompt Builder
- [x] Create server/coverArt/ directory
- [x] Write coverArtPromptBuilder.ts — ArcPosition types, VocabularyJson types, CoverArtPromptInput/Output types
- [x] Implement ARC_FRAMING sentences for gathering / arriving / open
- [x] Implement ARC_WEIGHTS — per-category term counts for each arc position
- [x] Implement buildCoverArtPrompt() — 8-layer assembly with 900-char truncation guard
- [x] Implement extractLyricPhrases() — LLM-based lyric pre-processing (async, graceful fallback)
- [x] Implement resolveVocabulary() — fallback hierarchy (personal → platform default)
- [x] Write 34 vitest tests covering arc framing, weighting, lyric phrases, production context, char limit, vocabulary integrity, and full pipeline smoke tests
- [x] All 122 tests passing (34 new Phase L tests)

### Phase M: Cover Art Generation Procedure
- [x] Add coverArtUrl, coverArtSource, coverArtGeneratedAt, coverArtRegenerationsUsed columns to campaigns schema
- [x] Generate migration SQL and apply via webdev_execute_sql
- [x] Add DB helpers: getCampaignCoverArt, setCampaignCoverArtFromUpload, setCampaignCoverArtFromGeneration, COVER_ART_REGEN_LIMIT
- [x] Build server/coverArt/router.ts with coverArt.getState, coverArt.generate, coverArt.setFromUpload procedures
- [x] Implement 3-regeneration cap (no reset) in generate procedure — atomic SQL LEAST() increment
- [x] Wire coverArt router into main routers.ts
- [x] Write vitest coverage for generation procedure and regeneration cap (16 tests, upload-to-reset loop prevention verified)

### Phase N: Cover Art UI
- [x] Build CoverArtCard component — cover art display (1:1 square), placeholder state, loading overlay
- [x] Arc position selector — Gathering / Arriving / Open three-button toggle with tooltips
- [x] Edit menu — three-option dropdown: Upload Image, Generate Cover Art, Regenerate
- [x] Regeneration limit indicator — dot bar shows used/remaining regenerations
- [x] Upload flow — file input, S3 upload via /api/mood-board/upload, setFromUpload mutation
- [x] Generate flow — calls coverArt.generate with arc position, lyrics, genre
- [x] Regenerate flow — isRegeneration: true, blocked when limit reached with Lock icon
- [x] Integrate CoverArtCard into Campaigns detail page — sidebar layout alongside campaign brief
- [x] Loading overlay (spinner), error toasts, empty placeholder state

### Phase O: Find Your Frequency Onboarding
- [x] Build frequency.synthesize tRPC procedure (LLM vocabulary synthesis from 4 diagnostic answers)
- [x] Build frequency.save tRPC procedure (persist CreatorFrequency record, set as default)
- [x] Build frequency.getDefault tRPC procedure (return current default frequency for user)
- [x] Build FindYourFrequency 5-screen UI: Question 1 (sound/space), Question 2 (light/color), Question 3 (world/texture), Question 4 (arc/time)
- [x] Build Reflection screen — LLM-generated paragraph from the 4 answers
- [x] Build Vocabulary Preview screen — 6-category vocabulary display with edit capability
- [x] Build Name Your Frequency screen — text input + save button
- [x] Add entry point to UI — "My Frequency" nav link in Home.tsx navigation
- [x] Wire completed frequency into coverArt.generate procedure (resolveVocabulary already uses user's default — confirmed)
- [x] Write vitest coverage for synthesize procedure and vocabulary structure validation (13 tests)

### Phase P: Free Tier Auto-Generate at Publish
- [x] Add countCampaignsByUser DB helper to db.ts
- [x] Add campaigns.publish tRPC procedure with ownership check, 8-published-song limit, and isPublic toggle
- [x] Tier detection: free = role 'user', premium = role 'admin'
- [x] Wire silent auto-generate trigger into publish procedure (fire and forget, free-tier only, one-time)
- [x] Auto-generate uses: platform default vocabulary, lyrics from campaign, arriving arc position
- [x] One-time only — fires only when coverArtUrl is null AND coverArtRegenerationsUsed === 0
- [x] Premium users bypass song limit and auto-generate
- [x] Soft landing message: "You've built something real here — N songs and counting. Upgrade to keep going and unlock your full Visual Universe."
- [x] Add Publish Campaign button to CampaignDetail UI (calls campaigns.publish, shows Published badge when live)
- [x] Write vitest coverage for publish procedure and song limit logic (11 tests, 162 total passing)

### Phase Q: Studios-Riff Bridge & Reskin
- [x] Clone Riff repo and audit design tokens, component structure, and relevant pages
- [x] Reskin Studios to match Riff design language (deep plum bg, raspberry pink accent, Space Grotesk + Inter fonts)
- [x] Replace Velvet Strawberry noir utility classes (noir-card, glow-crimson, glow-gold) with Riff-matched equivalents
- [x] Add riffUserId column to users table (migration applied)
- [x] Build server/bridgeRoutes.ts — authenticated REST bridge endpoints: GET /frequency/:riffUserId, POST /frequency/synthesize, POST /frequency/save, POST /cover-art/generate
- [x] Mount bridge routes in server/_core/index.ts
- [x] Write riff_studios_bridge_handoff.md — precise Riff-side implementation document (9 sections, exact file paths and diffs)
- [ ] Set BRIDGE_API_KEY secret in Studios (shared with Riff as STUDIOS_BRIDGE_KEY)
- [ ] Set STUDIOS_BRIDGE_URL and STUDIOS_BRIDGE_KEY secrets in Riff project
- [ ] Riff-side implementation (handled by Riff Manus instance — see handoff doc)

### Phase R: Bridge Bug Fix — Vocabulary Shape Mismatch
- [x] BRIDGE_API_KEY secret set and validated in Studios
- [x] STUDIOS_BRIDGE_URL and STUDIOS_BRIDGE_KEY secrets set in Riff (Railway)
- [x] Riff-side implementation complete (handled by Riff Manus)
- [x] BUG: /api/bridge/cover-art/generate returning 500 "Generation failed"
- [x] ROOT CAUSE: bridge synthesize returns plain string[] with key `colorAndLight`; promptBuilder expects VocabularyTerm[] with key `colorLight` — pickTerms() was returning undefined for every term
- [x] FIX: Added normalizeVocabulary() to bridgeRoutes.ts — converts string[] or VocabularyTerm[], maps colorAndLight→colorLight and texture→relationshipGeometry
- [x] FIX: Added detailed step-by-step logging to cover-art/generate handler
- [x] FIX: Surface real error message in 500 response (detail field)
- [x] VERIFIED: curl test returns 200 with valid coverArtUrl — 166 tests passing

### Phase S: Cover Art Prompt Quality Fix
- [x] DIAGNOSED: all images looked identical (radial burst motif) — three root causes identified
- [x] ROOT CAUSE 1: arc framing sentences were dominant visual instructions ("the frontier present at the edge of frame", "scale expanding outward") — image model latched onto these as the primary subject
- [x] ROOT CAUSE 2: abstract vocabulary terms ("present tense", "through not away from", "not yet resolved but not abandoned") are meaningless to image models — model fell back to training defaults (radial bursts)
- [x] ROOT CAUSE 3: lyrics were buried at the end after all abstract vocabulary — model committed to the radial burst before reading song-specific content
- [x] FIX 1: Rewrote arc framing to brief camera-direction modifiers ("mid-distance scale, threshold moment, world opening,") — no longer a dominant scene description
- [x] FIX 2: Restructured assembly order — lyrics come FIRST as the primary visual anchor
- [x] FIX 3: Added "no radial effects, no lens flares" to quality tail to explicitly block the recurring motif
- [x] FIX 4: Changed forbidden terms from "avoid: X" to "no X" — direct negatives work better with image models
- [x] FIX 5: Added pickTermsWithFallback() helper for future use when instruction fields are more concrete
- [x] Updated 9 promptBuilder tests to match new format (arc framing strings, no 'avoid:' prefix, lyric-first order, no 'lyric anchors:' prefix)
- [x] 166/166 tests passing

### Phase T: Lyric Extraction — Metaphor-to-Scene Translation Fix
- [x] DIAGNOSED: extractLyricPhrases() was extracting verbatim lyric phrases — metaphors like "fire in my veins" and "wild heart beats" were passed directly to the image model, which rendered them literally (fantasy figure with fire, etc.)
- [x] ROOT CAUSE: system prompt said "extract verbatim" — correct for concrete lyrics, wrong for metaphorical/emotional lyrics (which most rock/pop songs use)
- [x] FIX: Rewrote extractLyricPhrases() system prompt to be a music-to-visual TRANSLATOR, not an extractor — LLM now translates emotional metaphors into concrete photographable scenes
- [x] New system prompt: explicit examples showing "fire in my veins" → "headlights on empty highway at 2am", "leather jacket, wind-blown hair"; "beyond the canyon wall" → "red rock canyon at golden hour", "lone figure on canyon rim"
- [x] Added explicit avoidance list: "glowing orbs, radial bursts, fantasy landscapes, literal fire/lightning, sci-fi elements, circular motifs"
- [x] Genre awareness added: "a rock song should feel like a photograph from that world (bar, stage, highway, desert), not a fantasy painting"
- [x] 166/166 tests passing

## Bug Fix — Lyrics Not Reaching Prompt Builder
- [x] DIAGNOSED: lyrics data flow issue — Riff sends form.lyrics (empty on page load) not stored track lyrics; title/description fields used as accidental lyric source
- [x] FIX (Studios side): Add steeringNote field to bridge schema and promptBuilder — creator art direction note placed at highest priority (Layer 0) before lyrics and vocabulary
- [x] FIX (Studios side): steeringNote wired through bridgeRoutes.ts → buildCoverArtPrompt() → _debug response
- [x] 4 new steeringNote vitest tests added (175/175 passing)
- [ ] FIX (Riff side): Pre-populate form.lyrics from stored track record on page load — see riff_studios_bridge_handoff_v2.md
- [ ] FIX (Riff side): Rename Description field to "Art Direction" and wire to steeringNote in generateCoverArt call — see riff_studios_bridge_handoff_v2.md

## Bug Fix — Bridge Save insertId (userId = default error)
- [x] ROOT CAUSE: Drizzle mysql2 returns [ResultSetHeader, FieldPacket[]] array; `(result as any).insertId` was undefined; new shadow users got `userId = undefined` → DB error "Field 'userId' doesn't have a default value"
- [x] FIX: Changed `resolveStudiosUserId` in bridgeRoutes.ts to use `(result as any)[0].insertId`
- [x] FIX: Fixed same pattern in db.ts for `createCampaign`, `createCampaignShot`, `addMoodBoardImage` (all now use `[0].insertId`)
- [x] FIX: Fixed same pattern in routers.ts for audio track upload
- [x] VERIFIED: Bridge save test returns `{success:true, frequencyId:90002}` with correct vocabulary stored as JSON object; 175/175 tests passing

## Bug Fix — vocabularyJson Double-Encoding (Frequency Terms Not Reaching Prompt)
- [x] ROOT CAUSE: Riff sends vocabularyJson as a JSON.stringify'd string; MySQL JSON column stores it as a JSON string value (not object); Drizzle reads it back as a JS string; `normalizeVocabulary()` received a string instead of object → all `toTerms()` calls got `undefined` → every vocabulary category was empty
- [x] FIX: Added `parseVocabJson()` helper in bridgeRoutes.ts that detects string vs object and JSON.parses if needed; called before `normalizeVocabulary()` in cover-art/generate route
- [x] VERIFIED: New prompt now contains personal vocabulary terms: "constricted spaces, breaking walls, open vistas", "fractured light, glowing fissures", "resilient, transformative", "propelling, erupting, unraveling", "no depressing, no hopeless, no poisonous"
- [x] 175/175 tests passing

## Bug Fix — Morose Default Cover Art (Mossy Rocks, Backs-Turned Figures)
- [x] Fix platform default vocabulary: replace abstract philosophical terms with concrete photographable instructions that produce varied, energetic scenes
- [x] Add genre-aware human presence fallback: when no mood tags are present, derive energy/presence from genre string (upbeat/country/reggae → active, facing camera; melancholic/dark → introspective)
- [x] Fix melancholic mood energy map: "turned away or distant" → "facing camera or in profile, present and still"
- [x] Fix arriving arc Cinemétique rendering: "figure off-center" → "figure facing forward or in profile"
- [x] Add "No backs-to-camera. Figures face forward or in profile." to quality tail (all prompts)
- [x] 175/175 tests passing

## Bug Fix — Lyrics Not Sent with Cover Art Generation
- [ ] Diagnose: trace where lyrics are stored in Riff DB and where they drop out of the bridge call payload (lyricsPresent=false in all recent logs)
- [ ] Fix: ensure lyrics are always fetched and included in the cover-art/generate bridge payload
- [ ] Verify: lyricsPresent=true in server log for a song that has lyrics; lyric phrases appear in prompt

## Emotional Physics Framework — Life Signal Randomizer Integration — COMPLETE ✅
- [x] Build Life Signal Registry v1.0 (20 signals, 5 domains, weights, incompatibility rules, arc eligibility)
- [x] Implement selectLifeSignals() with weighted selection, arc filtering, incompatibility enforcement, and rotation memory
- [x] Add lastUsedLifeSignalIds to CoverArtPromptInput and CoverArtPromptOutput.layers
- [x] Add lastUsedLifeSignalIds column to campaigns table (schema + migration 0010)
- [x] Thread rotation memory through getCampaignCoverArt → buildCoverArtPrompt → setCampaignCoverArtFromGeneration
- [x] Expose lifeSignalIds and lifeSignalBlock in bridge route _debug response
- [x] Write lifeSignalRandomizer.test.ts (registry integrity, arc eligibility, incompatibility, rotation memory, promptBuilder integration)
- [x] Update promptBuilder.test.ts for non-deterministic life signal layer
- [x] 204/204 tests passing

## Emotional Physics Framework — Auto-Evaluation Heuristic + Adaptive Weight Tuning — COMPLETE ✅

### Phase U: Auto-Evaluation Heuristic (Structural Self-Checker)
- [x] Build coverArtEvaluator.ts — 5-dimension structural QA module
- [x] Dimension 1: Coherence Score (0–4) — checks for physics grammar tokens: scale, lighting, composition, atmosphere, texture
- [x] Dimension 2: Depth Score (0–4) — checks for depth tokens per arc (chiaroscuro/shadow for gathering, transition/motion for arriving, vast/horizon for open)
- [x] Dimension 3: Tension Score (0–4) — counts tension tokens, applies arc-specific max cap (gathering=4, arriving=3, open=3), warns on overcompression
- [x] Dimension 4: Life Signal Score (0–4) — validates signal presence, arc eligibility, intensity total (chaos penalty >4), reuse warning, incompatibility warning
- [x] Dimension 5: Arc Alignment Score (0–4) — checks for arc-specific alignment tokens and penalises mismatched tokens from other arcs
- [x] ARC_PHYSICS profiles for gathering/arriving/open (shadowRatioRange, withholdingLevel, scaleRange, motionLevel, maxTensionScore)
- [x] SELF_HEALING_THRESHOLD = 14 — prompts below this score receive adjustment suggestions
- [x] Adjustment engine: inject_physics_block, inject_life_signal, inject_tension_token, rerun_arc_modulation, reduce_moderate_signals, reselect_life_signals
- [x] resolveLifeSignals() helper — maps signal IDs to LifeSignal objects (silently drops unknowns)
- [x] Wire evaluateCoverArtPrompt() into coverArt.generate procedure (post-prompt-build, pre-image-generation)
- [x] QA scores surfaced in generate response (evaluation.totalScore, isHealthy, warnings, scores object)
- [x] QA scores logged to console on every generation

### Phase V: Adaptive Weight Tuning System (Controlled Evolution Engine)
- [x] Build coverArtAdaptiveController.ts — adaptive weight tuning module
- [x] WINDOW_SIZE = 50, ADAPTATION_INTERVAL = 20, LDI_THRESHOLD = 0.6
- [x] WEIGHT_MIN = 0.2, WEIGHT_MAX = 2.0 (hard bounds — entropy protection)
- [x] TARGET_RANGES: total 15–18, lifeSignal 2.5–3.2, coherence 3.0–3.8, tension 2.5–3.5
- [x] buildDefaultAdaptiveWeights() — initialises all 20 signal weights and 5 domain weights to 1.0
- [x] computeStabilityMetrics(window) — avgTotal, per-dimension averages, signalFrequency map, domainDistribution, LDI
- [x] shouldAdapt(weights, windowSize) — fires when generationsSinceLastAdaptation ≥ 20 AND windowSize ≥ 50
- [x] Rule A1: Underpowered boost — boosts domain weights when avgLifeSignal < 2.5
- [x] Rule A2: Overscoring dampener — reduces domain weights when avgTotal > 18
- [x] Rule B: Repetition suppression — reduces signal weight when frequency > 30%
- [x] Rule C: Chaos dampening — reduces moderate-intensity signal weights when avgIntensity > 3.5
- [x] Rule D: Arc flattening detector — boosts domain weights when one arc dominates > 60% of window
- [x] Soft exploration injection — randomly boosts 2 low-weight signals by 0.1 to prevent stagnation
- [x] Long-Term Diversity Index (LDI) — unique signals used / total available; warns when < 0.6
- [x] getEffectiveSignalWeight() — registry base weight × signal multiplier × domain multiplier
- [x] DB schema: cover_art_generation_logs table (userId, arc, lifeSignalIds, intensityTotal, qaScores, timestamp)
- [x] DB schema: cover_art_adaptive_weights table (userId unique, signalWeights, domainWeights, generation counters, lastAdaptedAt)
- [x] DB migration 0011 applied (cover_art_adaptive_weights + cover_art_generation_logs)
- [x] DB helpers: appendCoverArtGenerationLog, getRecentCoverArtGenerationLogs, getCoverArtGenerationLogCount, getCoverArtAdaptiveWeights, upsertCoverArtAdaptiveWeights
- [x] Wire adaptive cycle into coverArt.generate procedure (fire-and-forget after image generation)
- [x] Generation log persisted on every generation (fire-and-forget, non-blocking)
- [x] Adaptive cycle fires every 20 generations when rolling window ≥ 50 entries
- [x] Write coverArtEvaluator.test.ts (38 tests: 5 dimensions, ARC_PHYSICS profiles, resolveLifeSignals, adjustment engine)
- [x] Write coverArtAdaptiveController tests inside coverArtEvaluator.test.ts (buildDefaultAdaptiveWeights, computeStabilityMetrics, shouldAdapt, runAdaptationCycle, getEffectiveSignalWeight, TARGET_RANGES)
- [x] 242/242 tests passing

## Emotional Physics Framework — Arc Modulation Matrix — COMPLETE ✅
- [x] Build arcModulationMatrix.ts — 8-dimension physics translation layer
- [x] ArcModulationProfile typed data for gathering / arriving / open (shadowRatio, depthStructure, scale, motionTime, irregularity, withholdingLevel, lightDiffusion, biologicalAnchors)
- [x] ARC_MODULATION_PROFILES: gathering = high shadow / shallow / high withholding / minimal motion; arriving = mid shadow / layered / medium withholding / noticeable motion; open = low shadow / deep / low withholding / ambient motion
- [x] 8 translation tables: LIGHT_STRUCTURE, SHADOW_RATIO, SCALE, DEPTH_STRUCTURE, MOTION_TIME, IRREGULARITY, WITHHOLDING, BIOLOGICAL_ANCHORS — each maps profile value to photographable prompt language
- [x] buildArcModulationDirectives() — assembles 8 strings into comma-joined promptDirective + structured dimensions object
- [x] getArcModulationProfile() — returns raw typed profile for evaluator/other consumers
- [x] Integrated into promptBuilder as Layer 3 (between Cinématique rendering and Life Signal block)
- [x] CoverArtPromptOutput.layers extended with arcModulation and arcModulationDimensions fields
- [x] MAX_CHARS raised from 900 → 1400 (Runway accepts up to 1500; matrix adds ~450 chars)
- [x] Write arcModulationMatrix.test.ts (26 tests: profile integrity, per-arc physics, translation correctness, arc isolation, promptBuilder integration)
- [x] 268/268 tests passing

## Bug Fix — Runway 400 promptText Too Long (Arc Modulation Matrix) — COMPLETE ✅
- [x] ROOT CAUSE: MAX_CHARS was raised to 1400 to accommodate Arc Modulation Matrix (~470 chars), but Runway's actual API hard limit is 1000 characters — published site was returning 500 on every generation
- [x] FIX: Compressed Arc Modulation Matrix from 8 separate clauses (~470 chars) to 3-4 tightly worded compact directives (~120 chars) — all 8 physics dimensions preserved semantically
- [x] FIX: Lowered MAX_CHARS from 1400 → 980 (20-char safety margin below Runway's 1000-char limit)
- [x] Updated all 1400-char assertions in promptBuilder.test.ts and arcModulationMatrix.test.ts to 980
- [x] 268/268 tests passing

## Clerk Authentication Migration — COMPLETE ✅

### Backend
- [x] Install @clerk/express and @clerk/backend
- [x] Create server/_core/clerk-auth.ts — verifyBearerToken(), getClerkMiddleware(), authenticateRequest()
- [x] Update server/_core/env.ts — add clerkSecretKey and clerkPublishableKey
- [x] Update server/_core/context.ts — use Clerk token verification instead of Manus OAuth
- [x] Update server/_core/index.ts — replace Manus OAuth middleware with Clerk middleware
- [x] Update server/db.ts — upsertUser() returns the user object
- [x] Rewrite server/bridgeRoutes.ts — Clerk Bearer token auth, no shadow user mapping
- [x] Add frequency.generateCoverArt tRPC mutation (for Riff server-to-server calls)

### Frontend
- [x] Install @clerk/react
- [x] Update client/src/main.tsx — ClerkProvider, tRPC client sends Clerk Bearer tokens
- [x] Update client/src/_core/hooks/useAuth.ts — uses Clerk hooks (useUser, useClerk)
- [x] Update client/src/const.ts — remove Manus OAuth, add Clerk helpers
- [x] Create client/src/components/SignInButton.tsx — Clerk modal sign-in
- [x] Update all pages (Home, Venues, Library, CreateConcert, DashboardLayout) to use SignInButton

### Bug Fix — Clerk Publishable Key Missing (Root Cause of "Please login (10001)")
- [x] ROOT CAUSE: @clerk/express reads CLERK_PUBLISHABLE_KEY (no VITE_ prefix) from env; Studios only had VITE_CLERK_PUBLISHABLE_KEY; clerkMiddleware threw "Publishable key is missing" on every request; getAuth(req).userId returned null; all protected procedures returned "Please login (10001)"
- [x] FIX: Added env alias in clerk-auth.ts — sets process.env.CLERK_PUBLISHABLE_KEY from ENV.clerkPublishableKey if not already set
- [x] FIX: Added CLERK_PUBLISHABLE_KEY secret via webdev_request_secrets (same value as VITE_CLERK_PUBLISHABLE_KEY)
- [x] FIX: Added detailed logging to verifyBearerToken for easier future debugging
- [x] VERIFIED: Server now logs "[Clerk] Initializing middleware with publishable key: pk_test_aW50ZWdyYWwt..." on startup
- [x] Write clerk-keys.test.ts — 5 tests validating both CLERK_PUBLISHABLE_KEY and VITE_CLERK_PUBLISHABLE_KEY are set and match

## Missing Frequency Bridge Endpoints (Riff server-to-server) — IN PROGRESS

- [x] Add GET /api/bridge/frequency/default — returns { hasFrequency, frequency | null }
- [x] Add POST /api/bridge/frequency/synthesize — runs LLM synthesis, returns SynthesisResult
- [x] Add POST /api/bridge/frequency/save — saves frequency to DB, returns { ok, frequencyId }
