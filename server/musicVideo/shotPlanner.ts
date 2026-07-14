/**
 * shotPlanner.ts — Music Video Pipeline Stage 3
 * ===============================================
 * Genre-agnostic shot planner. Takes the audio structure (sections, energy
 * envelope, BPM) plus the creative brief (lyrics, genre description, characters)
 * and produces a shot list — one shot per segment, with Runway-ready prompts.
 *
 * Design principles (from spec §4 and user requirements):
 * ─────────────────────────────────────────────────────────
 * 1. Genre-agnostic: no preset visual style table, no noir defaults.
 *    Visual direction is derived per-song from lyrics, genre description,
 *    and audio-derived mood signals.
 *
 * 2. Bible distillation pattern (same as writeCinematicPrompt):
 *    The Cinématique Bible vocabulary is distilled into a brief before
 *    being sent to Claude. Raw bible text is NEVER sent to the model.
 *    The planner reads the creator's personal vocabulary (or platform default)
 *    and uses it as a visual world anchor, not a constraint.
 *
 * 3. One Claude call per segment (not one call for the whole video).
 *    Each segment gets its own call so the prompt can be tailored to the
 *    section's energy, position in the song, and lyric content.
 *
 * 4. Character consistency: if a character has a reference image, their
 *    name and description are included in the shot brief. The reference
 *    image is passed to Runway at generation time (not at planning time).
 *
 * 5. Lip sync selection: shots with a lead character and lyric content
 *    in a verse/chorus/bridge are flagged needsLipSync: true by default.
 *    The user can override this in the storyboard review gate.
 */

import type { AudioSection, EnergyPoint } from "./audioAnalyzer";
import type { VocabularyJson } from "../coverArt/promptBuilder";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PlannedCharacter {
  id: number;
  name: string;
  description: string | null;
  referenceImageUrl: string | null;
}

export interface PlannedShot {
  shotIndex: number;
  segmentType: "intro" | "verse" | "chorus" | "bridge" | "outro" | "instrumental" | "other";
  startTimeSeconds: number;
  targetDurationSeconds: number;
  description: string;
  cameraMovement: string;
  lightingNote: string;
  characterIds: number[];
  needsLipSync: boolean;
  transitionIn: "cut" | "dissolve" | "luma";
  videoPrompt: string;
}

export interface ShotPlannerInput {
  /** The music video project ID */
  musicVideoId: number;
  /** Song title */
  title: string;
  /** Artist name */
  artistName: string | null;
  /** Full song lyrics */
  lyrics: string | null;
  /** Free-text genre and visual style description */
  genreDescription: string | null;
  /** Detected audio sections from the analyzer */
  sections: AudioSection[];
  /** Energy envelope for mood signals */
  energyEnvelope: EnergyPoint[];
  /** Estimated tempo in BPM */
  tempoBpm: number | null;
  /** Characters registered for this video */
  characters: PlannedCharacter[];
  /** Creator's personal vocabulary (or platform default) */
  vocabulary: VocabularyJson | null;
  /** Creator's synthesis fingerprint (one-paragraph visual world description) */
  synthesisFingerprint: string | null;
  /** Vocabulary source label for the brief */
  vocabSource: "personal" | "platform_default" | "none";
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Map a section label to a segmentType enum value */
function toSegmentType(label: string): PlannedShot["segmentType"] {
  const l = label.toLowerCase();
  if (l.includes("intro")) return "intro";
  if (l.includes("verse")) return "verse";
  if (l.includes("chorus") || l.includes("hook") || l.includes("refrain")) return "chorus";
  if (l.includes("bridge") || l.includes("pre-chorus") || l.includes("prechorus")) return "bridge";
  if (l.includes("outro") || l.includes("coda") || l.includes("fade")) return "outro";
  if (l.includes("instrumental") || l.includes("solo") || l.includes("break")) return "instrumental";
  return "other";
}

/** Get the mean RMS energy for a time window */
function meanEnergy(
  envelope: EnergyPoint[],
  startSeconds: number,
  endSeconds: number
): number {
  const points = envelope.filter(
    (p) => p.timeSeconds >= startSeconds && p.timeSeconds < endSeconds
  );
  if (points.length === 0) return 0;
  return points.reduce((sum, p) => sum + p.rms, 0) / points.length;
}

/** Determine target clip duration based on segment length and BPM */
function targetDuration(
  segmentDurationSeconds: number,
  bpm: number | null
): 5 | 10 {
  // For short segments or fast BPM, use 5s clips
  if (segmentDurationSeconds <= 8) return 5;
  if (bpm && bpm > 130) return 5;
  // For longer segments, 10s gives more visual breathing room
  return 10;
}

/** Determine transition style based on segment type and energy */
function transitionStyle(
  segmentType: PlannedShot["segmentType"],
  energy: number,
  globalMeanEnergy: number
): PlannedShot["transitionIn"] {
  if (segmentType === "intro") return "dissolve";
  if (segmentType === "outro") return "dissolve";
  if (segmentType === "bridge") return "dissolve";
  if (energy < globalMeanEnergy * 0.7) return "dissolve"; // low energy → soft cut
  return "cut"; // default: hard cut
}

/** Extract the lyric lines most relevant to a section by position */
function lyricsForSection(
  lyrics: string | null,
  section: AudioSection,
  totalDuration: number
): string {
  if (!lyrics?.trim()) return "";
  const lines = lyrics.split("\n").filter((l) => l.trim());
  if (lines.length === 0) return "";
  // Estimate which lines belong to this section by position ratio
  const ratio = section.startSeconds / Math.max(totalDuration, 1);
  const startLine = Math.floor(ratio * lines.length);
  const endLine = Math.min(
    lines.length,
    startLine + Math.max(2, Math.floor(lines.length / 8))
  );
  return lines.slice(startLine, endLine).join("\n");
}

/** Build the Claude brief for a single shot */
function buildShotBrief(params: {
  section: AudioSection;
  sectionIndex: number;
  totalSections: number;
  sectionLyrics: string;
  energy: number;
  globalMeanEnergy: number;
  title: string;
  artistName: string | null;
  genreDescription: string | null;
  characters: PlannedCharacter[];
  vocabulary: VocabularyJson | null;
  synthesisFingerprint: string | null;
  vocabSource: "personal" | "platform_default" | "none";
  tempoBpm: number | null;
}): string {
  const {
    section,
    sectionIndex,
    totalSections,
    sectionLyrics,
    energy,
    globalMeanEnergy,
    title,
    artistName,
    genreDescription,
    characters,
    vocabulary,
    synthesisFingerprint,
    vocabSource,
    tempoBpm,
  } = params;

  const parts: string[] = [];

  parts.push(`SONG: "${title}"${artistName ? ` by ${artistName}` : ""}`);

  if (genreDescription?.trim()) {
    parts.push(`GENRE/VISUAL WORLD: ${genreDescription.trim()}`);
  }

  const segType = toSegmentType(section.label);
  const positionLabel = sectionIndex === 0
    ? "opening of the song"
    : sectionIndex === totalSections - 1
    ? "final section of the song"
    : `section ${sectionIndex + 1} of ${totalSections} (${segType})`;

  parts.push(`SONG SECTION: ${section.label} — ${positionLabel}`);
  parts.push(`SECTION TIMING: ${section.startSeconds.toFixed(1)}s – ${section.endSeconds.toFixed(1)}s`);

  if (tempoBpm && tempoBpm > 0) {
    parts.push(`TEMPO: ${tempoBpm} BPM`);
  }

  const energyLevel = energy > globalMeanEnergy * 1.2
    ? "high energy — peak moment, maximum intensity"
    : energy < globalMeanEnergy * 0.8
    ? "low energy — quiet, intimate, or reflective"
    : "medium energy — building or sustained";
  parts.push(`ENERGY LEVEL: ${energyLevel}`);

  if (sectionLyrics.trim()) {
    parts.push(`LYRICS FOR THIS SECTION:\n${sectionLyrics}`);
  }

  if (characters.length > 0) {
    const charList = characters
      .map((c) => `- ${c.name}${c.description ? `: ${c.description}` : ""}`)
      .join("\n");
    parts.push(`CHARACTERS IN THIS VIDEO:\n${charList}`);
  }

  if (vocabulary && vocabSource !== "none") {
    const vocabTerms: string[] = [
      ...vocabulary.environment.slice(0, 3).map((t) => t.term),
      ...vocabulary.emotionalRegister.slice(0, 2).map((t) => t.term),
      ...vocabulary.colorLight.slice(0, 2).map((t) => t.term),
      ...vocabulary.arcTerms.slice(0, 2).map((t) => t.term),
    ];
    if (vocabTerms.length > 0) {
      parts.push(
        `VISUAL VOCABULARY (${vocabSource === "personal" ? "creator's personal aesthetic" : "platform aesthetic"} — weave into the scene): ${vocabTerms.join(", ")}`
      );
    }
    const forbidden = vocabulary.forbiddenTerms.slice(0, 3).map((t) => t.term);
    if (forbidden.length > 0) {
      parts.push(`AVOID: ${forbidden.join(", ")}`);
    }
  }

  if (synthesisFingerprint?.trim()) {
    parts.push(
      `CREATOR'S VISUAL WORLD: ${synthesisFingerprint.slice(0, 300).trim()}`
    );
  }

  return parts.join("\n\n");
}

// ─── System prompt ────────────────────────────────────────────────────────────

const SHOT_PLANNER_SYSTEM_PROMPT = `You are a world-class music video director and cinematographer. Your task is to plan a single shot for a specific section of a music video.

You will receive a creative brief describing the song, section, energy level, lyrics, characters, and visual vocabulary. Based on this, you will output a JSON object describing the shot.

Rules:
- The shot must be genre-authentic: if the genre is punk, the shot looks punk; if it is ambient electronic, the shot is atmospheric and abstract; if it is country, the shot is grounded and real
- The shot must be specific and visual — not generic ("a figure in darkness") but concrete ("a woman in a sequined jacket, back to camera, facing a crowd of thousands, stage lights cutting through smoke")
- Camera movement must be specific: "slow push in", "handheld drift left", "crane rise", "static wide", "rack focus from foreground to background"
- Lighting note must be specific: "golden hour backlight through dust", "neon underlight from below", "single practial lamp casting long shadows", "overcast flat light"
- The videoPrompt is the exact text that will be sent to Runway Gen 4.5. It must be:
  * 80–200 words, written as a unified cinematic scene description (not a keyword list)
  * Specific about what is happening — a verb moment, not a noun inventory
  * Include: subject, action, environment, light source, color palette, camera position
  * End with: "Cinematic music video. Photorealistic. No text, no logos."
- If characters are listed, decide whether they appear in this shot based on the section type and energy
- For verse and chorus sections with a lead character and lyric content, set needsLipSync to true
- For instrumental, intro, and outro sections, set needsLipSync to false

Return ONLY valid JSON matching this exact schema:
{
  "description": "string — one sentence describing the shot for the storyboard",
  "cameraMovement": "string — specific camera movement directive",
  "lightingNote": "string — specific lighting description",
  "characterIds": [array of character IDs from the provided list, or empty array],
  "needsLipSync": boolean,
  "videoPrompt": "string — the full Runway-ready prompt (80–200 words)"
}`;

// ─── Main planner function ────────────────────────────────────────────────────

/**
 * Plan all shots for a music video.
 *
 * Makes one Claude call per section. Returns an array of PlannedShot objects
 * ready to be inserted into the music_video_shots table.
 */
export async function planMusicVideoShots(
  input: ShotPlannerInput
): Promise<PlannedShot[]> {
  const { invokeLLM } = await import("../_core/llm");

  const {
    sections,
    energyEnvelope,
    tempoBpm,
    lyrics,
    title,
    artistName,
    genreDescription,
    characters,
    vocabulary,
    synthesisFingerprint,
    vocabSource,
  } = input;

  if (sections.length === 0) {
    throw new Error("Cannot plan shots: no sections provided from audio analysis");
  }

  const totalDuration = sections[sections.length - 1]?.endSeconds ?? 0;
  const allEnergy = energyEnvelope.map((p) => p.rms);
  const globalMeanEnergy =
    allEnergy.length > 0
      ? allEnergy.reduce((a, b) => a + b, 0) / allEnergy.length
      : 0;

  const shots: PlannedShot[] = [];

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    const segType = toSegmentType(section.label);
    const segDuration = section.endSeconds - section.startSeconds;
    const energy = meanEnergy(energyEnvelope, section.startSeconds, section.endSeconds);
    const sectionLyrics = lyricsForSection(lyrics, section, totalDuration);

    const brief = buildShotBrief({
      section,
      sectionIndex: i,
      totalSections: sections.length,
      sectionLyrics,
      energy,
      globalMeanEnergy,
      title,
      artistName,
      genreDescription,
      characters,
      vocabulary,
      synthesisFingerprint,
      vocabSource,
      tempoBpm,
    });

    let shotData: {
      description: string;
      cameraMovement: string;
      lightingNote: string;
      characterIds: number[];
      needsLipSync: boolean;
      videoPrompt: string;
    };

    try {
      const response = await invokeLLM({
        messages: [
          { role: "system", content: SHOT_PLANNER_SYSTEM_PROMPT },
          {
            role: "user",
            content: `Plan the shot for this section:\n\n${brief}`,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "shot_plan",
            strict: true,
            schema: {
              type: "object",
              properties: {
                description: { type: "string" },
                cameraMovement: { type: "string" },
                lightingNote: { type: "string" },
                characterIds: {
                  type: "array",
                  items: { type: "number" },
                },
                needsLipSync: { type: "boolean" },
                videoPrompt: { type: "string" },
              },
              required: [
                "description",
                "cameraMovement",
                "lightingNote",
                "characterIds",
                "needsLipSync",
                "videoPrompt",
              ],
              additionalProperties: false,
            },
          },
        },
      });

      const rawContent = response.choices?.[0]?.message?.content ?? "";
      const raw = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent);
      // Strip markdown code fences if present (defensive — same pattern as other LLM calls)
      const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
      shotData = JSON.parse(cleaned);
    } catch (err) {
      // Fallback: generate a basic shot description without LLM
      console.warn(`[ShotPlanner] LLM call failed for section ${i} (${section.label}):`, err);
      shotData = {
        description: `${segType} — ${section.label} section (${section.startSeconds.toFixed(0)}s–${section.endSeconds.toFixed(0)}s)`,
        cameraMovement: "static wide",
        lightingNote: "natural light",
        characterIds: characters.length > 0 ? [characters[0].id] : [],
        needsLipSync:
          (segType === "verse" || segType === "chorus") && characters.length > 0,
        videoPrompt: `Music video shot. ${genreDescription ?? ""}. ${section.label} section. ${sectionLyrics.slice(0, 100)}. Cinematic music video. Photorealistic. No text, no logos.`,
      };
    }

    // Validate and filter characterIds to only include known character IDs
    const validCharacterIds = (shotData.characterIds ?? []).filter((id) =>
      characters.some((c) => c.id === id)
    );

    shots.push({
      shotIndex: i,
      segmentType: segType,
      startTimeSeconds: Math.round(section.startSeconds),
      targetDurationSeconds: targetDuration(segDuration, tempoBpm),
      description: shotData.description ?? "",
      cameraMovement: shotData.cameraMovement ?? "static wide",
      lightingNote: shotData.lightingNote ?? "natural light",
      characterIds: validCharacterIds,
      needsLipSync: shotData.needsLipSync ?? false,
      transitionIn: transitionStyle(segType, energy, globalMeanEnergy),
      videoPrompt: (shotData.videoPrompt ?? "").slice(0, 980), // Runway 1000-char limit
    });
  }

  return shots;
}
