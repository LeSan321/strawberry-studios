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
- [ ] Awesome Cloth Simulation GitHub (coreqode/awesome-cloth-simulation) — Research Papers section: PBD advances, GPU cloth methods, high-resolution garment simulation
- [ ] SIGGRAPH Asia 2024 — "Efficient Cloth Simulation Using Non-distance Barriers and Subspace Reuse" (GPU-based interactive high-resolution garments for real-time Unreal venues)
- [ ] "Real-Time Cloth Simulation in Extended Reality" (2025) — Unity vs. PBD with GPU acceleration for immersive concert experiences
- [ ] Style3D SIGGRAPH 2024 papers — AI-assisted garment simulation and correction
- [ ] Incredibles 2 simulation technical breakdowns — large-scale production challenges, hair/cloth/skin for 2200+ shots
- [ ] Awesome Physically Based Rendering GitHub (neil3d/awesome-pbr) — SIGGRAPH courses 2010–2017+, Sébastien Lagarde's writings
- [ ] Real-Time Cloth Rendering with Fiber-Level Detail (SIGGRAPH courses) — micro-level sheen, wrinkles, light interaction

### Tier 3 — Experiential Layer (Platinum Venues / Future Phases)
- [ ] Royal College of Music virtual performance simulator (2024–2025) — acoustic + visual immersion, stage presence, spatial audio
- [ ] VR concert research — "Investigating how immersive virtual reality mediates the experience of virtual concerts"
- [ ] Marvelous Designer + Unreal Engine workflows — USD export of simulation data into Chaos Cloth for MetaHumans
- [ ] SIGGRAPH 2025 "Advances in Real-Time Rendering" course notes — strand-based hair/fur, ray tracing for open worlds
- [ ] "Real-Time Cloth Simulation Using WebGPU" (2025 arXiv) — browser-friendly venue previews
- [ ] PBR Texture & Material Libraries (Poly Haven, ambientCG) — real-world scanned materials as reference data

### Knowledge Base Chapters Outstanding
- [ ] Chapter 11 (Velvet Strawberry Department Briefs) — Poe bot prompt ready; covers Physics, Wardrobe, Camera, Lighting, Atmospheric, Production Design, Sound + Director's Unifying Statement
- [x] Strengthen Chapter 11 (Pixar BSSRDF) with pbrt book subsurface scattering chapter → Chapter 14
- [x] Strengthen Chapter 12 (Disney Cloth) with 2024 fabric mechanical parameters for 1940s-specific fabrics → Chapter 16
- [ ] Chapter 14 — Experiential Layer (acoustic simulation, spatial audio, crowd dynamics) — after Tier 3 research
