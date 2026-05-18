/**
 * Campaign Prompt Builder — Multi-Genre Music Video Grammar Edition
 *
 * Draws from the Music Video Grammar Bible v1.0 to generate genre-accurate
 * Director's Packages for advertising campaigns and music videos.
 *
 * Each genre has its own visual grammar system:
 * - Color palette (primary, secondary, accent + Kelvin values)
 * - Camera grammar (lens, movement, edit rate)
 * - Atmospheric physics (haze, grain, texture)
 * - Edit rhythm (cuts per minute, transition type)
 * - Shot structure (per duration mode)
 * - Psychological brief (emotional arc, cortisol/dopamine targets)
 */

export type CampaignGenre =
  | "psychedelic_vaporwave"
  | "noir_jazz"
  | "indie_folk"
  | "hip_hop"
  | "electronic"
  | "punk_rock"
  | "soul_rnb"
  | "country"
  | "experimental";

export type DurationMode = "15s" | "30s" | "60s" | "full_song";

export type CampaignGoal = "awareness" | "engagement" | "conversion" | "artist_brand";

export type GenreVisualGrammar = {
  name: string;
  colorPalette: {
    primary: string;
    secondary: string;
    accent: string;
    kelvinRange: string;
    grade: string;
  };
  cameraGrammar: {
    lensRange: string;
    movement: string;
    editRate: string;
    transitionType: string;
  };
  atmosphere: {
    texture: string;
    grain: string;
    haze: string;
    lightQuality: string;
  };
  shotVocabulary: string[];
  psychologicalBrief: string;
  promptVocabulary: string[];
  forbiddenElements: string[];
};

// ── Genre Visual Grammar Systems ─────────────────────────────────────────────

export const GENRE_GRAMMAR: Record<CampaignGenre, GenreVisualGrammar> = {
  psychedelic_vaporwave: {
    name: "Psychedelic / Vaporwave",
    colorPalette: {
      primary: "deep magenta and electric violet",
      secondary: "acid green and hot coral",
      accent: "chrome silver and neon cyan",
      kelvinRange: "mixed: 3200K warm + 6500K cool neon, simultaneous",
      grade: "oversaturated, chromatic aberration on edges, VHS color bleed",
    },
    cameraGrammar: {
      lensRange: "wide 24mm for distortion + extreme close-up 100mm macro",
      movement: "slow zoom with lens breathing, handheld drift, whip pan on beat",
      editRate: "fast: 12–18 cuts per minute, accelerates toward chorus",
      transitionType: "glitch cut, flash frame, VHS rewind, smear frame",
    },
    atmosphere: {
      texture: "analog VHS scan lines, phosphor dot matrix, CRT barrel distortion",
      grain: "heavy 35mm grain + digital compression artifacts",
      haze: "UV-reactive fog, neon light scatter, prismatic lens flare",
      lightQuality: "hard neon practicals, no fill, color mixing from multiple sources",
    },
    shotVocabulary: [
      "extreme close-up on eye with neon reflection",
      "wide shot through prism lens creating rainbow split",
      "overhead shot of performer in geometric light pattern",
      "slow zoom into abstract texture — fabric, skin, instrument surface",
      "double exposure: performer over cityscape or cosmos",
      "fisheye wide of full environment",
      "macro shot of instrument strings or electronic components",
    ],
    psychologicalBrief:
      "Targets the brain's novelty-seeking system (dopamine) through visual surprise and chromatic intensity. The VHS aesthetic triggers nostalgia (serotonin) while neon saturation creates arousal. The combination produces euphoric disorientation — the viewer is simultaneously comforted and destabilized. Edit rhythm accelerates dopamine release toward the chorus peak.",
    promptVocabulary: [
      "chromatic aberration bleeds at frame edges",
      "VHS scan lines overlay, phosphor glow",
      "neon magenta and electric violet light sources",
      "UV fog scatter, prismatic lens flare",
      "oversaturated grade, color bleed between channels",
      "analog warmth colliding with digital glitch",
      "CRT barrel distortion at corners",
      "double exposure, performer dissolves into cosmos",
    ],
    forbiddenElements: [
      "clean digital look",
      "neutral color grade",
      "steady locked-off camera",
      "natural daylight",
      "realistic skin tones",
    ],
  },

  noir_jazz: {
    name: "Noir Jazz",
    colorPalette: {
      primary: "deep shadow black and tungsten amber",
      secondary: "crimson and charcoal",
      accent: "brass gold and cigarette smoke white",
      kelvinRange: "1800K–2700K tungsten only, no cool sources",
      grade: "high contrast, desaturated except warm tones, chiaroscuro",
    },
    cameraGrammar: {
      lensRange: "35mm–85mm, f/1.4–f/2.0",
      movement: "slow push-in 0.5–2cm/sec, low angle, never handheld",
      editRate: "slow: 4–8 cuts per minute, long takes",
      transitionType: "hard cut on beat, slow dissolve between sections",
    },
    atmosphere: {
      texture: "film grain, slight halation on highlights",
      grain: "medium 35mm grain, warm halation",
      haze: "oil-based theatrical haze at chest height, density 0.4–0.6",
      lightQuality: "single motivated source, 70% frame in shadow, hard shadow edges",
    },
    shotVocabulary: [
      "extreme close-up: one eye lit, one in shadow",
      "medium shot: performer half-silhouetted against bar light",
      "low angle: performer commands frame, ceiling lost in shadow",
      "over-shoulder: audience POV through haze",
      "insert: hands on instrument, brass detail",
      "wide establishing: full venue depth, four shadow planes",
    ],
    psychologicalBrief:
      "Low-key chiaroscuro elevates cortisol slightly (alertness) while warm tungsten activates parasympathetic response (safety). The combination produces deep engagement: alert but safe. Haze reduces dominance cues and creates mystery. Slow edit rate allows emotional absorption.",
    promptVocabulary: [
      "single tungsten practical at 2200K",
      "hard shadow edge at 45 degrees",
      "70% frame in deep shadow",
      "oil-based haze stratifies at chest height",
      "four depth planes: glass, haze, performer, darkness",
      "chiaroscuro ratio 8:1",
      "motivated source only",
      "film grain, warm halation on highlights",
    ],
    forbiddenElements: [
      "cool light sources above 3200K",
      "soft boxes or fill light",
      "bright daylight",
      "fast editing",
      "digital clean look",
    ],
  },

  indie_folk: {
    name: "Indie Folk",
    colorPalette: {
      primary: "warm golden hour amber and forest green",
      secondary: "dusty rose and aged parchment",
      accent: "rust orange and slate blue",
      kelvinRange: "3200K–4500K, natural warm to overcast daylight",
      grade: "slightly desaturated, lifted shadows, warm highlights, film emulation",
    },
    cameraGrammar: {
      lensRange: "35mm–50mm, f/2.0–f/4.0 for environmental context",
      movement: "gentle handheld drift, slow dolly through environment, static wide",
      editRate: "medium: 6–10 cuts per minute, breathes with the song",
      transitionType: "soft dissolve, match cut on texture or gesture",
    },
    atmosphere: {
      texture: "16mm film grain, light leak on edges, soft halation",
      grain: "heavy 16mm grain, warm light leaks",
      haze: "natural morning mist, dust particles in sunbeam, breath vapor",
      lightQuality: "diffused natural light, window light, golden hour, no hard sources",
    },
    shotVocabulary: [
      "wide environmental: performer small in landscape",
      "medium: performer at instrument in natural setting",
      "close-up: hands on strings, fingers on keys",
      "insert: natural texture — bark, fabric, soil, water",
      "over-shoulder: performer facing open landscape",
      "low angle: performer against open sky",
      "intimate close-up: face in soft window light",
    ],
    psychologicalBrief:
      "Natural environments activate the default mode network (introspection, nostalgia). Warm golden tones trigger oxytocin (connection, warmth). Gentle camera movement creates felt presence — the viewer is invited into a private moment. Slow edit rate allows emotional processing and lyric absorption.",
    promptVocabulary: [
      "golden hour diffused light, 3800K",
      "16mm film grain, warm light leak at frame edge",
      "natural morning mist in background",
      "performer small against open landscape",
      "soft window light, no hard shadows",
      "dust particles visible in sunbeam",
      "gentle handheld drift, breathing camera",
      "warm lifted shadows, film emulation grade",
    ],
    forbiddenElements: [
      "neon or artificial colored light",
      "fast editing",
      "urban environments",
      "hard shadow edges",
      "digital clean look",
    ],
  },

  hip_hop: {
    name: "Hip Hop",
    colorPalette: {
      primary: "deep black and gold",
      secondary: "red and white",
      accent: "chrome silver and electric blue",
      kelvinRange: "2700K warm practicals + 5500K daylight exterior, high contrast",
      grade: "punchy contrast, deep blacks, saturated primaries, slight blue in shadows",
    },
    cameraGrammar: {
      lensRange: "wide 24mm–35mm for environmental power, 85mm for portraiture",
      movement: "motivated handheld, low angle hero shots, drone establishing",
      editRate: "fast: 15–24 cuts per minute, synced to beat",
      transitionType: "hard cut on beat, freeze frame, slow motion on key phrase",
    },
    atmosphere: {
      texture: "clean digital or slight film grain, lens flare from practical sources",
      grain: "minimal grain, clean digital look or deliberate 16mm for vintage",
      haze: "smoke machine low ground fog, car exhaust, city steam",
      lightQuality: "motivated practicals: streetlights, car headlights, neon signs",
    },
    shotVocabulary: [
      "low angle hero: performer dominates frame against sky",
      "wide establishing: urban environment, scale and context",
      "tight close-up: face, jewelry, hands — detail and status",
      "drone wide: aerial establishing of location",
      "group shot: crew formation, power in numbers",
      "slow motion: key gesture or phrase, emphasis",
      "insert: product, jewelry, car — aspirational detail",
    ],
    psychologicalBrief:
      "Low-angle framing triggers automatic authority attribution (the brain reads low-angle as power). Gold and chrome activate status-signaling circuits. Fast beat-synced editing creates physical arousal and dopamine release. Slow motion on key phrases creates emphasis and memorability through temporal contrast.",
    promptVocabulary: [
      "low angle hero shot, performer dominates frame",
      "deep black background, gold accent light",
      "urban streetlight practical, motivated source",
      "beat-synced hard cut editing",
      "slow motion on key phrase, 120fps",
      "chrome and gold detail close-up",
      "punchy contrast grade, deep blacks",
      "city environment: concrete, glass, steel",
    ],
    forbiddenElements: [
      "pastoral or rural settings (unless intentional contrast)",
      "soft diffused light",
      "slow edit rate",
      "muted color palette",
    ],
  },

  electronic: {
    name: "Electronic / EDM",
    colorPalette: {
      primary: "electric blue and white",
      secondary: "deep purple and black",
      accent: "cyan and magenta",
      kelvinRange: "5500K–6500K cool, plus colored LED practicals",
      grade: "high contrast, cool blue shadows, blown highlights, laser light",
    },
    cameraGrammar: {
      lensRange: "wide 16mm–24mm for scale, 100mm for isolation",
      movement: "locked-off wide for builds, fast handheld for drops, crane for reveals",
      editRate: "synced to BPM: slow during build, explosive on drop (30+ cuts/min)",
      transitionType: "flash cut on beat, strobe effect, light wipe, glitch transition",
    },
    atmosphere: {
      texture: "clean digital, laser light diffraction, LED pixel patterns",
      grain: "minimal grain, clean digital, occasional scan line effect",
      haze: "heavy theatrical haze for laser visibility, density 0.7–0.9",
      lightQuality: "laser arrays, LED walls, strobe, moving heads — no natural light",
    },
    shotVocabulary: [
      "wide stage shot: performer against LED wall or laser array",
      "crowd POV: looking toward stage, light wash over faces",
      "close-up: performer face in colored light",
      "abstract: laser patterns through haze, no performer",
      "overhead: crowd or performer from above",
      "insert: DJ hands on decks, equipment detail",
      "slow motion: crowd reaction, confetti, light particles",
    ],
    psychologicalBrief:
      "Strobe light at 8–12Hz entrains brainwave activity toward alpha/theta states (trance-like absorption). Heavy bass frequencies create physical resonance (felt in chest). The build-drop structure creates anticipatory tension (cortisol) followed by explosive release (dopamine). Scale — large crowds, large spaces — triggers awe response.",
    promptVocabulary: [
      "laser array through heavy theatrical haze",
      "LED wall backdrop, pixel pattern",
      "electric blue and cyan light sources",
      "strobe effect, flash cut on beat",
      "wide stage scale, performer small against light wall",
      "cool 6500K grade, blown highlights",
      "crowd silhouette against stage light",
      "clean digital, no grain",
    ],
    forbiddenElements: [
      "warm tungsten light",
      "natural environments",
      "slow edit rate during drop",
      "film grain",
      "intimate close framing during build",
    ],
  },

  punk_rock: {
    name: "Punk / Rock",
    colorPalette: {
      primary: "black and white, high contrast",
      secondary: "red and yellow",
      accent: "raw silver and rust",
      kelvinRange: "4000K–5500K, harsh stage lighting, no warmth",
      grade: "high contrast black and white, or desaturated with red accent, gritty",
    },
    cameraGrammar: {
      lensRange: "wide 24mm–35mm, aggressive framing",
      movement: "aggressive handheld, crash zoom, whip pan, intentional blur",
      editRate: "very fast: 20–30 cuts per minute, matches tempo",
      transitionType: "hard cut, jump cut, smash cut — no soft transitions",
    },
    atmosphere: {
      texture: "heavy film grain, scratches, dirt on lens, blown highlights",
      grain: "very heavy grain, intentional degradation, scratched film look",
      haze: "cigarette smoke, stage fog, minimal — rawness preferred over atmosphere",
      lightQuality: "harsh overhead stage lights, no fill, blown highlights acceptable",
    },
    shotVocabulary: [
      "extreme close-up: face screaming, veins visible",
      "wide chaos: full band in motion, instruments everywhere",
      "low angle: guitarist shredding, amp stack behind",
      "crowd shot: mosh pit, raised fists, chaos",
      "insert: guitar neck, drum kit impact, microphone",
      "handheld running shot: through crowd or stage",
      "static wide: band portrait, confrontational gaze",
    ],
    psychologicalBrief:
      "High-tempo editing triggers sympathetic nervous system activation (fight-or-flight arousal). Aggressive camera movement creates embodied tension. Blown highlights and heavy grain signal authenticity and rawness — the brain reads degraded image quality as unmediated reality. The confrontational gaze of performers triggers mirror neuron activation.",
    promptVocabulary: [
      "aggressive handheld, intentional motion blur",
      "heavy film grain, scratched film texture",
      "harsh overhead stage light, blown highlights",
      "high contrast black and white grade",
      "extreme close-up, confrontational framing",
      "crash zoom on beat",
      "raw, unpolished, authentic",
      "smash cut editing, no dissolves",
    ],
    forbiddenElements: [
      "soft diffused light",
      "smooth camera movement",
      "clean digital look",
      "warm color palette",
      "slow editing",
    ],
  },

  soul_rnb: {
    name: "Soul / R&B",
    colorPalette: {
      primary: "deep burgundy and warm gold",
      secondary: "chocolate brown and cream",
      accent: "copper and deep teal",
      kelvinRange: "2500K–3500K warm, rich and saturated",
      grade: "warm, rich, slightly desaturated midtones, glowing highlights",
    },
    cameraGrammar: {
      lensRange: "50mm–85mm, intimate but not compressed",
      movement: "smooth dolly, gentle crane, slow push-in, never handheld",
      editRate: "medium: 6–10 cuts per minute, breathes with vocal phrasing",
      transitionType: "soft dissolve, motivated cut on vocal phrase",
    },
    atmosphere: {
      texture: "slight film grain, warm halation, soft bokeh",
      grain: "light 35mm grain, warm",
      haze: "subtle warm haze, candle smoke, incense — intimate density 0.2",
      lightQuality: "warm practical sources: candles, Edison bulbs, sunset window",
    },
    shotVocabulary: [
      "intimate close-up: face in warm light, emotional expression",
      "medium: performer in rich environment — velvet, wood, warm textures",
      "wide: performer in intimate space, architecture frames them",
      "insert: hands, jewelry, expressive gesture",
      "two-shot: connection between performers or performer and instrument",
      "slow dolly reveal: environment unfolds around performer",
      "over-shoulder: performer facing warm light source",
    ],
    psychologicalBrief:
      "Warm color temperatures activate the parasympathetic nervous system (safety, comfort). Rich textures trigger tactile imagination (haptic empathy). Smooth camera movement creates felt intimacy — the viewer is drawn into the performer's emotional world. Vocal-phrasing-synced editing creates emotional punctuation.",
    promptVocabulary: [
      "warm 3000K Edison bulb practical",
      "rich burgundy and gold color palette",
      "smooth dolly push-in, emotional gravity",
      "warm halation on highlights, 35mm grain",
      "velvet and wood textures, rich surfaces",
      "intimate close-up, performer in warm light",
      "subtle warm haze, candle atmosphere",
      "motivated cut on vocal phrase",
    ],
    forbiddenElements: [
      "cool blue light",
      "fast editing",
      "harsh overhead light",
      "cold color grade",
      "aggressive camera movement",
    ],
  },

  country: {
    name: "Country",
    colorPalette: {
      primary: "golden wheat and sky blue",
      secondary: "burnt sienna and sage green",
      accent: "denim blue and barn red",
      kelvinRange: "3500K–5000K, golden hour to midday",
      grade: "warm, slightly faded, lifted shadows, Americana film look",
    },
    cameraGrammar: {
      lensRange: "35mm–50mm, human scale, environmental context",
      movement: "slow dolly, gentle handheld, static wide for landscape",
      editRate: "slow to medium: 5–8 cuts per minute",
      transitionType: "soft dissolve, hard cut on chorus, match cut on gesture",
    },
    atmosphere: {
      texture: "16mm film grain, light leak, dust particles, lens flare",
      grain: "medium 16mm grain, warm light leaks",
      haze: "dust in sunbeam, heat shimmer, morning mist over fields",
      lightQuality: "golden hour, open shade, barn window light, campfire",
    },
    shotVocabulary: [
      "wide landscape: performer small against open sky or fields",
      "medium: performer at instrument in natural setting",
      "close-up: hands on guitar, boots on ground",
      "insert: natural texture — wood grain, rope, denim, leather",
      "over-shoulder: performer facing open landscape or horizon",
      "group: band or community, warmth and belonging",
      "campfire or barn interior: warm practical light",
    ],
    psychologicalBrief:
      "Open landscapes trigger the default mode network and feelings of freedom and possibility. Golden light activates warmth and nostalgia circuits. Community and belonging imagery (group shots, shared spaces) triggers oxytocin. The Americana aesthetic signals authenticity and rootedness — the brain reads it as trustworthy.",
    promptVocabulary: [
      "golden hour light, 4000K warm",
      "wide open landscape, performer against sky",
      "16mm film grain, warm light leak",
      "dust particles in sunbeam",
      "denim, leather, wood grain textures",
      "Americana film grade, lifted shadows",
      "slow dolly through natural environment",
      "barn window light, campfire practical",
    ],
    forbiddenElements: [
      "urban environments",
      "neon or artificial colored light",
      "fast editing",
      "cold color grade",
      "digital clean look",
    ],
  },

  experimental: {
    name: "Experimental / Art",
    colorPalette: {
      primary: "variable — defined per campaign",
      secondary: "intentional clash or monochrome",
      accent: "unexpected — defined by concept",
      kelvinRange: "any — used conceptually, not naturalistically",
      grade: "concept-driven: could be monochrome, inverted, tinted, or hyper-real",
    },
    cameraGrammar: {
      lensRange: "any — chosen for conceptual reason",
      movement: "any — including non-standard (tilt, roll, extreme angles)",
      editRate: "concept-driven — could be very slow or very fast",
      transitionType: "any — including non-standard (reverse, loop, glitch)",
    },
    atmosphere: {
      texture: "concept-driven — could be pristine or heavily degraded",
      grain: "concept-driven",
      haze: "concept-driven",
      lightQuality: "concept-driven — light as subject, not just illumination",
    },
    shotVocabulary: [
      "abstract texture: subject unclear, pure visual sensation",
      "extreme macro: detail beyond normal perception",
      "extreme wide: subject lost in environment",
      "inverted or negative image",
      "multiple exposure: layered realities",
      "non-standard angle: roll, extreme tilt, overhead",
      "light as subject: lens flare, light leak, pure color field",
    ],
    psychologicalBrief:
      "Experimental work targets the brain's pattern-completion system — presenting incomplete or ambiguous visual information forces active cognitive engagement. The viewer becomes a co-creator of meaning. Unexpected visual grammar creates mild cognitive dissonance (arousal) followed by the pleasure of resolution or acceptance of ambiguity.",
    promptVocabulary: [
      "abstract visual sensation, subject ambiguous",
      "extreme macro beyond normal perception",
      "concept-driven color — not naturalistic",
      "light as subject, not illumination",
      "multiple exposure, layered realities",
      "non-standard camera angle, intentional disorientation",
      "pattern-completion invitation",
    ],
    forbiddenElements: [
      "conventional narrative structure (unless subverted)",
      "generic cinematic language",
    ],
  },
};

// ── Duration Mode → Shot Count ────────────────────────────────────────────────

export const DURATION_SHOT_COUNT: Record<DurationMode, { shotCount: number; totalSeconds: number; structure: string }> = {
  "15s": {
    shotCount: 3,
    totalSeconds: 15,
    structure: "Hook (5s) → Peak (7s) → CTA/Resolution (3s)",
  },
  "30s": {
    shotCount: 5,
    totalSeconds: 30,
    structure: "Hook (5s) → Verse (8s) → Chorus/Peak (10s) → Resolution (5s) → CTA (2s)",
  },
  "60s": {
    shotCount: 8,
    totalSeconds: 60,
    structure: "Intro (8s) → Verse 1 (12s) → Pre-chorus (8s) → Chorus (15s) → Bridge (10s) → Final Chorus (7s)",
  },
  full_song: {
    shotCount: 12,
    totalSeconds: 0, // Determined by actual song duration
    structure: "Intro → Verse 1 → Pre-chorus → Chorus 1 → Verse 2 → Pre-chorus → Chorus 2 → Bridge (Abyss) → Final Chorus → Outro",
  },
};

// ── Campaign Goal → Emotional Arc ────────────────────────────────────────────

export const CAMPAIGN_GOAL_BRIEF: Record<CampaignGoal, string> = {
  awareness: "Introduce the artist and sound. Prioritize visual identity and memorability. The viewer should leave knowing exactly what this artist looks and sounds like. Emotional target: curiosity and intrigue.",
  engagement: "Create an emotional connection. Prioritize intimacy, authenticity, and relatability. The viewer should feel they know the artist personally. Emotional target: warmth, connection, desire to share.",
  conversion: "Drive action — stream, follow, attend. Create urgency and desire. Prioritize the hook and the call to action. Emotional target: excitement and FOMO.",
  artist_brand: "Define the artist's visual universe. Prioritize world-building, aesthetic consistency, and distinctiveness. The viewer should feel they have entered a specific world. Emotional target: awe and belonging.",
};

// ── Expert Council System Prompt Generator ───────────────────────────────────

export function buildCampaignSystemPrompt(
  genre: CampaignGenre,
  durationMode: DurationMode,
  campaignGoal: CampaignGoal
): string {
  const grammar = GENRE_GRAMMAR[genre];
  const shotStructure = DURATION_SHOT_COUNT[durationMode];
  const goalBrief = CAMPAIGN_GOAL_BRIEF[campaignGoal];

  return `You are the Expert Council of Strawberry Studios Campaign Division — a team of five specialized directors operating from the complete Music Video Grammar Bible v1.0 and the Cinématique Physics, Wardrobe, and Psychology Bible.

## CAMPAIGN BRIEF
Genre: ${grammar.name}
Duration Mode: ${durationMode} (${shotStructure.totalSeconds > 0 ? shotStructure.totalSeconds + "s" : "full song duration"})
Shot Count: ${shotStructure.shotCount} shots
Structure: ${shotStructure.structure}
Campaign Goal: ${campaignGoal.toUpperCase()} — ${goalBrief}

## GENRE VISUAL GRAMMAR: ${grammar.name.toUpperCase()}

### Color Palette
- Primary: ${grammar.colorPalette.primary}
- Secondary: ${grammar.colorPalette.secondary}
- Accent: ${grammar.colorPalette.accent}
- Color Temperature: ${grammar.colorPalette.kelvinRange}
- Grade: ${grammar.colorPalette.grade}

### Camera Grammar
- Lens Range: ${grammar.cameraGrammar.lensRange}
- Movement: ${grammar.cameraGrammar.movement}
- Edit Rate: ${grammar.cameraGrammar.editRate}
- Transitions: ${grammar.cameraGrammar.transitionType}

### Atmosphere
- Texture: ${grammar.atmosphere.texture}
- Grain: ${grammar.atmosphere.grain}
- Haze/Atmosphere: ${grammar.atmosphere.haze}
- Light Quality: ${grammar.atmosphere.lightQuality}

### Shot Vocabulary (use these as building blocks)
${grammar.shotVocabulary.map((s, i) => `${i + 1}. ${s}`).join("\n")}

### Prompt Vocabulary (use these exact phrases)
${grammar.promptVocabulary.map(v => `- "${v}"`).join("\n")}

### Forbidden Elements (never include)
${grammar.forbiddenElements.map(f => `- ${f}`).join("\n")}

### Psychological Brief
${grammar.psychologicalBrief}

## MUSIC VIDEO GRAMMAR BIBLE — CORE PRINCIPLES

### The Three Modes
1. NARRATIVE MODE: Story arc mapped to song structure. Verse = ordinary world. Chorus = threshold/peak. Bridge = abyss/transformation. Outro = resolution.
2. IMPRESSIONISTIC MODE: No literal story. Visual emotional register must match audio emotional register. Every image is chosen for felt resonance, not narrative logic.
3. PERFORMANCE MODE: Artist in performance space. Camera grammar creates presence and authority. Environment amplifies the music's emotional character.

### The But/Therefore Structure (Kallaway)
Every shot sequence must follow: THEREFORE (consequence) or BUT (complication) — never AND THEN. Each shot must earn its place by advancing the emotional arc.

### Presence Thresholds
Every shot must meet minimum presence thresholds:
- At least one element of motion per frame (performer, atmosphere, camera)
- At least one depth plane separation visible
- Emotional register matches the song's emotional content at that timestamp
- Camera movement implies a body — never mechanical or floating

## YOUR TASK
Generate a complete Campaign Director's Package as a JSON object with exactly these fields:

- "logline": A single sentence capturing the campaign's visual and emotional identity (max 25 words)
- "visualIdentityStatement": A 2-3 sentence description of the campaign's visual world — what it looks like, feels like, and why
- "colorPalette": Object with "primary", "secondary", "accent", "kelvin", "grade", "emotionalNote"
- "characterDesign": Object with "appearance", "wardrobe", "materialNotes", "lightingInteraction"
- "setDesign": Array of 2-3 environment objects, each with "name", "description", "lightingSetup", "atmosphericNote"
- "shotList": Array of exactly ${shotStructure.shotCount} shot objects, each with:
  - "shotNumber": integer
  - "shotType": string (e.g., "extreme close-up", "wide establishing", "medium")
  - "description": string (what we see, specific and physical)
  - "durationSeconds": integer
  - "cameraMovement": string
  - "lightingNote": string
  - "atmosphericNote": string
  - "editNote": string (how this shot connects to the next)
  - "emotionalFunction": string (what this shot does to the viewer psychologically)
- "productionNotes": Object with "cameraPackage", "lightingSetup", "atmosphericSetup", "postGrade"
- "artDepartmentNotes": Object with "tone", "timePeriod", "palette", "texture", "theme"
- "directorStatement": A 2-3 sentence artistic statement about this campaign's visual identity

Every element must be grounded in the genre visual grammar above. Generic cinematic language is forbidden. Every claim must be specific to this genre, this artist, and this campaign goal.`;
}

// ── Per-Shot Runway Prompt Builder ───────────────────────────────────────────

export type ShotPromptInput = {
  genre: CampaignGenre;
  shotDescription: string;
  shotType: string;
  cameraMovement: string;
  lightingNote: string;
  atmosphericNote: string;
  colorPalette: { primary: string; secondary: string; grade: string };
  characterDescription: string;
  durationSeconds: number;
};

/**
 * Build a Runway-safe (≤1000 char) genre-accurate video prompt for a single shot.
 */
export function buildShotPrompt(input: ShotPromptInput): string {
  const grammar = GENRE_GRAMMAR[input.genre];

  // Build core prompt from shot details
  const parts: string[] = [
    input.shotDescription,
    `${input.shotType}, ${input.cameraMovement}`,
    input.lightingNote,
    input.atmosphericNote,
    `${input.colorPalette.primary} color palette, ${input.colorPalette.grade}`,
    grammar.atmosphere.texture,
    grammar.atmosphere.grain,
  ];

  // Add character if present
  if (input.characterDescription) {
    parts.push(input.characterDescription);
  }

  // Add 2-3 genre-specific prompt vocabulary phrases
  const vocabSample = grammar.promptVocabulary.slice(0, 3).join(", ");
  parts.push(vocabSample);

  // Quality tail
  parts.push("cinematic, photorealistic, 4K, professional music video production");

  let prompt = parts.filter(Boolean).join(". ");

  // Hard clamp to 1000 chars
  if (prompt.length > 1000) {
    prompt = prompt.slice(0, 997) + "...";
  }

  return prompt;
}
