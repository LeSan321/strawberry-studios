
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import { storagePut, regenerateVideoUrl, isRunwayUrl } from "./storage";
import { z } from "zod";
import { generateVideo, pollVideoStatus, getActiveProvider } from "./videoGeneration";
import { buildCinématiqueVideoPrompt } from "./cinematiquePromptBuilder";
import { campaignsRouter } from "./routers/campaigns";
import {
  createConcert,
  getConcertsByUser,
  getConcertById,
  getConcertBySlug,
  updateConcert,
  addConcertCharacter,
  getConcertCharacters,
  createAudioTrack,
  getAudioTracksByUser,
  getAudioTrackById,
  getAllPresets,
  getPresetBySlug,
  upsertPreset,
  deleteConcert,
} from "./db";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateSlug(title: string): string {
  const base = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const suffix = Math.random().toString(36).substring(2, 8);
  return `${base}-${suffix}`;
}

const VENUE_LABELS: Record<string, string> = {
  velvet_strawberry_jazz_club: "Velvet Strawberry Jazz Club",
  strawberry_in_the_round: "Strawberry in the Round",
  berries_on_the_rocks: "Berries on the Rocks",
};

const MOOD_LABELS: Record<string, string> = {
  intimate_jazz: "Intimate Jazz",
  high_energy: "High Energy",
  noir_smoke: "Noir Smoke",
  custom: "Custom",
};

const VISUAL_LABELS: Record<string, string> = {
  shadow_and_smoke: "Shadow and Smoke",
  golden_rim: "Golden Rim",
  venetian_cage: "Venetian Cage",
  match_flare: "Match Flare",
  none: "None",
};

const CHARACTER_LABELS: Record<string, string> = {
  the_red_head_singer: "The Red Head Singer",
  the_fedora_man: "The Fedora Man",
  custom: "Custom",
};

// ─── Expert Council Prompt Generation ────────────────────────────────────────

async function generateCinématiquePrompt(params: {
  venue: string;
  moodPreset: string;
  visualPreset: string;
  cameraStyle: string;
  lightingKelvin: number;
  characters: Array<{ type: string; role: string; description?: string }>;
  customMoodDescription?: string;
  artistName?: string;
  title?: string;
}): Promise<{ prompt: string; directorsPackage: object }> {
  const venueName = VENUE_LABELS[params.venue] ?? params.venue;
  const moodName = MOOD_LABELS[params.moodPreset] ?? params.moodPreset;
  const visualName = VISUAL_LABELS[params.visualPreset] ?? params.visualPreset;
  const characterNames = params.characters.map(c => CHARACTER_LABELS[c.type] ?? c.type).join(", ") || "No specific characters";

  const systemPrompt = `You are the Expert Council of Strawberry Studios — a team of five specialized AI directors operating from the complete Cinématique Physics, Wardrobe, and Psychology Bible.

## DIRECTOR'S UNIFYING STATEMENT
This world is governed by real physical law, but shaped by emotional gravity. Nothing floats. Nothing cheats. If something feels magical, it will be because physics — not defiance of physics — made it so. We are not making a film. We are making a place the audience will remember having been, even though they have never been there.

## THE FIVE COUNCIL MEMBERS
1. The Fabric Physicist: Expert in how clothing, velvet, silk, and textiles behave under cinematic lighting. Knows bending stiffness values for every 1940s fabric, BRDF models for velvet and charmeuse, and how bias-cut silk charmeuse moves under stage lighting.
2. The Kelvin Architect: Master of color temperature from 1600K match-flare to 6500K daylight. Knows the precise Kelvin values for every Velvet Strawberry preset and how color temperature interacts with fabric spectral response.
3. The Camera Psychologist: Specialist in how camera angles, focal lengths, and movement create emotional states. Knows that 85mm compression creates romantic distance, 35mm feels human, and slow push-ins create emotional gravity.
4. The Atmospheric Physicist: Expert in how haze, smoke, and particle systems behave under directional light. Knows Mie scattering parameters, haze stratification physics, and how atmospheric density affects light beam visibility.
5. The Immersion Architect: Specialist in presence theory and the neuroscience of cinematic immersion. Knows the minimum presence thresholds for spatial presence, the chiaroscuro ratio required for felt depth, and the acoustic-visual coherence rules for the Velvet Strawberry.

## VELVET STRAWBERRY JAZZ CLUB — PHYSICS BRIEF
The Velvet Strawberry is a subterranean 1940s jazz club. Intimate space, 30ft depth maximum, 9–12ft ceiling. Tungsten practical lighting only — no fill, no overhead wash. Oil-based theatrical haze at medium density (0.4–0.6). Velvet and brass surfaces dominate. The physics of this world are non-negotiable:
- Light source: Tungsten practicals at 2200–2700K. No cool sources. No fill.
- Fabric: Deep crimson bias-cut silk charmeuse (lead vocalist), dark wool gabardine (fedora figure), velvet drapes throughout.
- Atmosphere: Oil-based haze, medium density, stratifies at 4–6ft height. Atmospheric micro-turbulence from heat sources.
- Camera: 35–85mm lenses. f/1.4–f/2.0 for close-ups. Slow push-ins (0.5–2cm/sec). Never handheld unless motivated.
- Shadow: Minimum 70% shadow coverage. Hard shadow edges only. Chiaroscuro ratio minimum 8:1.

## VELVET STRAWBERRY — WARDROBE BRIEF
The Lead Vocalist wears deep crimson bias-cut silk charmeuse. Bending stiffness: 0.0023 N·m (ultra-low). Shear modulus: 0.8 N/m. Under 2500K tungsten, the crimson shifts toward orange-red; under 2200K it deepens toward burgundy. The fabric moves with a 0.3–0.5 second lag behind body movement. Specular highlight: narrow, high-intensity, moves with viewing angle.
The Fedora Man wears dark charcoal wool gabardine. Bending stiffness: 0.0089 N·m (medium-high). Shear modulus: 2.1 N/m. Under 2200K tungsten, the charcoal reads as near-black with warm undertone. The fedora brim at 45° overhead creates a hard shadow across the upper face, leaving only the jaw and lips lit — the psychological grammar of concealment and threat.

## VELVET STRAWBERRY — LIGHTING BRIEF
Motivated sources only. Every light must have a practical source visible or implied in frame. The canonical light plot:
- Stage footlights: 2200K, low angle, creates upward shadow on performer faces
- Single overhead spot: 2500K, 45° angle, creates hard brim shadow on fedora
- Bar practicals: 2700K Edison bulbs, warm fill for background depth
- Candle/flame practical: 1800K, extreme close-up only, maximum intimacy
Forbidden: fluorescent, LED cool-white, overhead wash, soft boxes, any source above 3200K.

## VELVET STRAWBERRY — ATMOSPHERIC BRIEF
Oil-based haze at 0.4–0.6 density. Stratifies at 4–6ft height — below this line, haze is denser; above, it thins. Under a narrow spotlight beam, haze creates visible light columns (Mie forward scattering). Atmospheric micro-turbulence from heat sources within 2ft creates dynamic haze movement. Haze particle size: 1–5 microns. Forward scattering ratio: 0.85.

## VELVET STRAWBERRY — CAMERA BRIEF
The camera is a participant, not an observer. It moves with emotional logic, not mechanical logic. The canonical camera grammar:
- Slow push-in (0.5–2cm/sec): emotional gravity, intimacy building
- Low angle (below eye level): authority, power, stage presence
- High angle (above eye level): vulnerability, exposure, confession
- 85mm at f/1.4: romantic compression, background dissolution, subject isolation
- 35mm at f/2.0: human scale, environmental context, spatial presence
Forbidden: handheld without motivation, zoom (use dolly), wide-angle distortion on faces.

## PRESENCE THRESHOLDS — NON-NEGOTIABLE
Every generated frame must meet these minimum thresholds:
- Shadow coverage: minimum 70% of frame in deep shadow
- Chiaroscuro ratio: minimum 8:1 (lit area 8x brighter than ambient)
- Depth planes: minimum 4 visible planes (foreground, mid-ground, performer, background)
- Depth of field: f/1.4–f/2.0 equivalent for close-ups and medium shots
- Motion: minimum one element of motion per frame (haze drift, fabric movement, flame, or camera)
- Acoustic-visual coherence: minimum one fabric surface and one reflective surface visible per frame
- Hard shadow edges: required on all lit subjects — soft shadows are forbidden
- Social presence: performer gaze directed toward camera position in at least one shot per sequence
- Embodied camera: camera at standing height (1.5–1.8m) for establishing shots — never floating above
- Temporal presence: every frame must contain visible motion — haze drift 0.2–0.4m/s, fabric lag 0.3s

## FOUR-DIMENSIONAL PRESENCE FRAMEWORK (Ch. 31)
Every Director's Package must address all four presence dimensions simultaneously:
1. SPATIAL PRESENCE: Four visible depth planes, atmospheric haze stratified at 4–6ft, practical light falloff visible. Foreground object (glass, ashtray, candle) → mid-ground haze → performer → background darkness.
2. SOCIAL PRESENCE: Performer gaze toward camera position (not past it), intimate zone close-ups (implied social distance under 1.2m), performer awareness of the witness implied by the frame.
3. EMBODIED PRESENCE: Camera movement implies a body — slow push-in 0.5–2cm/sec, never mechanical zoom, slight breathing instability on long holds (0.2–0.3Hz). Camera height at standing height (1.6m) for establishing shots.
4. TEMPORAL PRESENCE: Every frame contains at least one moving element — haze drift, fabric movement, flame flicker, or smoke curl. Nothing is frozen. The performance is happening now.

## ACOUSTIC-VISUAL COHERENCE RULES (Ch. 30)
The Velvet Strawberry's acoustic signature (RT60 0.8s, velvet absorption 0.55–0.70, brass reflection 0.85–0.92) must be readable in the visual grammar:
- Every frame must include at least one visible acoustic surface: velvet drape, upholstered seat, or carpet (signals sound absorption, short reverberation, intimacy)
- Brass surfaces (bar fixtures, instrument bells, microphone stand) must be visible in at least one depth plane (signals high-frequency reflection, metallic edge to the acoustic character)
- Low ceiling must be implied or visible — ceiling practicals, overhead shadow, or ceiling reflection establish the 9–12ft height and short early reflection time
- Stage elevation (6–18 inches) must be visible to establish acoustic separation between performer and audience
- The camera must never be positioned higher than the performer's eye level during intimate moments — this preserves the acoustic intimacy grammar

## PBR MATERIAL PARAMETERS — VELVET STRAWBERRY SURFACES (Ch. 35)
All material descriptions must reference these physically measured values:
| Material | Albedo (2500K) | Roughness | Anisotropy | Key Property |
|---|---|---|---|---|
| Deep crimson velvet | 0.12–0.18 | 0.85–0.92 | 0.70 (pile direction) | Absorbs 85% of incident light — richness from absorption, not reflection |
| Silk charmeuse (crimson) | 0.35–0.45 | 0.08–0.15 | 0.30 (bias direction) | Fresnel edge highlight approaches 1.0 at grazing angles |
| Wool gabardine (charcoal) | 0.04–0.08 | 0.75–0.85 | 0.20 | Near-black with warm undertone under 2200K |
| Aged brass | 0.65–0.75 | 0.35–0.55 | 0.10 | Metallic 0.95 — warm gold reflection |
| Dark wood (bar) | 0.08–0.15 | 0.60–0.75 | 0.0 | Matte absorption, no specular |
| Glass (bar/mirrors) | 0.02–0.05 | 0.05–0.10 | 0.0 | Reflection plane — doubles spatial depth |

Critical principle: Velvet's crimson is not bright — it is deep. The darkness is in the material (albedo 0.12–0.18), not just in the lighting. The richness comes from what the material absorbs.

## STRAND-BASED HAIR AND MARSCHNER SHADING (Ch. 33)
The Red Head Singer's hair under tungsten lighting follows the Marschner three-path model:
- R path (cuticle reflection): warm orange-red specular highlight — moves with light angle
- TT path (transmission through strand): warm amber-gold glow — strongest when backlit
- TRT path (internal reflection): copper-red secondary highlight at 180° from source — visible as rim
Under 2500K tungsten, red hair shifts toward orange-red (R path) and warm amber (TT path). Under 2200K, it deepens toward copper-burgundy. This is physically accurate — not an aesthetic choice.
The fedora felt is compressed wool strands: high absorption, low specularity, slight directional sheen from felt pressing direction. Brim shadow under 45° overhead is hard-edged — this is the psychological grammar of concealment.

## CINÉMATIQUE PROMPT VOCABULARY
Use these specific phrases in generated prompts:
Fabric: "bias-cut silk charmeuse catches the light at the hip", "velvet pile direction creates gradient shadow", "wool gabardine holds its shape against the body", "fabric lag 0.3 seconds behind movement"
Light: "single tungsten practical at 2200K", "hard shadow edge at 45 degrees", "motivated source only", "footlight upwash", "match-flare at 1800K"
Camera: "slow push-in, emotional gravity", "85mm compression dissolves the background", "low angle establishes authority", "camera participates, does not observe"
Atmosphere: "oil-based haze stratifies at chest height", "Mie forward scattering creates light column", "atmospheric micro-turbulence near heat sources", "haze density 0.5"
Presence: "darkness as active content", "negative space implies depth", "four depth planes visible", "acoustic intimacy visual grammar"

## PSYCHOLOGICAL BRIEF — THE EMOTIONAL ARCHITECTURE
The Velvet Strawberry triggers a specific neurological state: low-key chiaroscuro lighting elevates cortisol slightly (alertness) while warm tungsten activates the parasympathetic system (safety). This combination — alert but safe — is the neurological signature of deep engagement. The haze reduces dominance cues and creates mystery. The performer in crimson activates the enclothed cognition response: the audience projects confidence and authority onto the vocalist before she sings a note. The fedora shadow triggers the early posterior negativity (EPN) response — the brain's threat-detection system — which heightens attention and presence.

Your task is to generate a complete Cinématique production prompt and Director's Package for a concert video production at ${venueName}.

You must output a JSON object with exactly these fields:
- "cinematiquePrompt": A rich, detailed AI video generation prompt (250-400 words) using the full Cinématique vocabulary above — fabric physics directives, Kelvin temperature specifications, camera psychology language, atmospheric physics, and presence threshold confirmations
- "shotList": An array of 5-7 shot objects, each with: "shotNumber", "shotType", "description", "duration", "cameraMovement", "lightingNote"
- "productionNotes": An object with: "fabricPhysics", "lightingSetup", "cameraPsychology", "atmosphericElements"
- "directorStatement": A 2-3 sentence artistic statement about this concert's visual identity

Every element of the output must be grounded in the physics, wardrobe, camera, and psychological briefs above. Generic cinematic language is forbidden. Every claim must be physically specific.`;

  const userPrompt = `Generate a Director's Package for:
- Concert: "${params.title ?? "Untitled Concert"}" by ${params.artistName ?? "the artist"}
- Venue: ${venueName}
- Mood Preset: ${moodName}${params.customMoodDescription ? ` — "${params.customMoodDescription}"` : ""}
- Visual Preset: ${visualName}
- Camera Style: ${params.cameraStyle}
- Lighting: ${params.lightingKelvin}K
- Characters: ${characterNames}

Apply the Cinématique prompt system: fabric physics directives, Kelvin temperature values, and camera psychology language throughout.`;

  const start = Date.now();
  const response = await invokeLLM({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "directors_package",
        strict: true,
        schema: {
          type: "object",
          properties: {
            cinematiquePrompt: { type: "string" },
            shotList: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  shotNumber: { type: "integer" },
                  shotType: { type: "string" },
                  description: { type: "string" },
                  duration: { type: "string" },
                  cameraMovement: { type: "string" },
                  lightingNote: { type: "string" },
                },
                required: ["shotNumber", "shotType", "description", "duration", "cameraMovement", "lightingNote"],
                additionalProperties: false,
              }
            },
            productionNotes: {
              type: "object",
              properties: {
                fabricPhysics: { type: "string" },
                lightingSetup: { type: "string" },
                cameraPsychology: { type: "string" },
                atmosphericElements: { type: "string" },
              },
              required: ["fabricPhysics", "lightingSetup", "cameraPsychology", "atmosphericElements"],
              additionalProperties: false,
            },
            directorStatement: { type: "string" },
          },
          required: ["cinematiquePrompt", "shotList", "productionNotes", "directorStatement"],
          additionalProperties: false,
        }
      }
    }
  });

  const content = response.choices[0].message.content;
  const parsed = JSON.parse(typeof content === "string" ? content : JSON.stringify(content));

  const directorsPackage = {
    version: "1.0",
    generatedAt: new Date().toISOString(),
    concert: {
      title: params.title,
      artistName: params.artistName,
      venue: venueName,
      moodPreset: moodName,
      visualPreset: visualName,
      cameraStyle: params.cameraStyle,
      lightingKelvin: params.lightingKelvin,
      characters: characterNames,
    },
    ...parsed,
  };

  return {
    prompt: parsed.cinematiquePrompt,
    directorsPackage,
  };
}

// ─── Routers ──────────────────────────────────────────────────────────────────

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ─── Concerts ─────────────────────────────────────────────────────────────

  concerts: router({
    create: protectedProcedure
      .input(z.object({
        title: z.string().min(1).max(255),
        artistName: z.string().max(255).optional(),
        venue: z.enum(["velvet_strawberry_jazz_club", "strawberry_in_the_round", "berries_on_the_rocks"]).default("velvet_strawberry_jazz_club"),
        moodPreset: z.enum(["intimate_jazz", "high_energy", "noir_smoke", "custom"]).default("intimate_jazz"),
        visualPreset: z.enum(["shadow_and_smoke", "golden_rim", "venetian_cage", "match_flare", "none"]).default("shadow_and_smoke"),
        cameraStyle: z.string().max(128).optional(),
        lightingKelvin: z.number().int().min(1000).max(10000).optional(),
        customMoodDescription: z.string().max(1000).optional(),
        characters: z.array(z.object({
          type: z.string(),
          role: z.enum(["lead", "supporting", "background"]).default("lead"),
          description: z.string().optional(),
        })).default([]),
      }))
      .mutation(async ({ ctx, input }) => {
        const ticketSlug = generateSlug(input.title);
        const result = await createConcert({
          userId: ctx.user.id,
          title: input.title,
          artistName: input.artistName,
          venue: input.venue,
          moodPreset: input.moodPreset,
          visualPreset: input.visualPreset,
          cameraStyle: input.cameraStyle,
          lightingKelvin: input.lightingKelvin,
          customMoodDescription: input.customMoodDescription,
          status: "draft",
          ticketSlug,
          isPublic: false,
        });

        // Drizzle mysql2 returns [ResultSetHeader, FieldPacket[]] — insertId is at index 0
        const insertId = (result as any)[0]?.insertId as number;

        // Add characters
        for (const char of input.characters) {
          await addConcertCharacter({
            concertId: insertId,
            characterType: char.type as any,
            role: char.role,
            customDescription: char.description,
          });
        }

        return { id: insertId, ticketSlug };
      }),

    generate: protectedProcedure
      .input(z.object({ concertId: z.number().int() }))
      .mutation(async ({ ctx, input }) => {
        const concert = await getConcertById(input.concertId);
        if (!concert) throw new Error("Concert not found");
        if (concert.userId !== ctx.user.id) throw new Error("Unauthorized");

        const characters = await getConcertCharacters(input.concertId);

        await updateConcert(input.concertId, { status: "generating" });

        try {
          const { prompt, directorsPackage } = await generateCinématiquePrompt({
            venue: concert.venue,
            moodPreset: concert.moodPreset ?? "intimate_jazz",
            visualPreset: concert.visualPreset ?? "shadow_and_smoke",
            cameraStyle: concert.cameraStyle ?? "intimate_close",
            lightingKelvin: concert.lightingKelvin ?? 2700,
            characters: characters.map(c => ({ type: c.characterType, role: c.role ?? "lead" })),
            customMoodDescription: concert.customMoodDescription ?? undefined,
            artistName: concert.artistName ?? undefined,
            title: concert.title,
          });

          await updateConcert(input.concertId, {
            status: "complete",
            cinematiquePrompt: prompt,
            directorsPackage,
            isPublic: true,
          });

          return { success: true, prompt, directorsPackage };
        } catch (err) {
          await updateConcert(input.concertId, { status: "failed" });
          throw err;
        }
      }),

    list: protectedProcedure.query(async ({ ctx }) => {
      return getConcertsByUser(ctx.user.id);
    }),

    get: protectedProcedure
      .input(z.object({ id: z.number().int() }))
      .query(async ({ ctx, input }) => {
        const concert = await getConcertById(input.id);
        if (!concert) return null;
        if (concert.userId !== ctx.user.id) throw new Error("Unauthorized");
        const characters = await getConcertCharacters(input.id);
        return { ...concert, characters };
      }),

    getPublic: publicProcedure
      .input(z.object({ slug: z.string() }))
      .query(async ({ input }) => {
        const concert = await getConcertBySlug(input.slug);
        if (!concert || !concert.isPublic) return null;
        const characters = await getConcertCharacters(concert.id);
        return { ...concert, characters };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number().int() }))
      .mutation(async ({ ctx, input }) => {
        const concert = await getConcertById(input.id);
        if (!concert) throw new Error("Concert not found");
        if (concert.userId !== ctx.user.id) throw new Error("Unauthorized");
        await deleteConcert(input.id);
        return { success: true };
      }),

    // ── Video Generation ────────────────────────────────────────────────────

    generateVideo: protectedProcedure
      .input(z.object({
        concertId: z.number().int(),
        /** Optional: override the primary shot index (0-based) */
        primaryShotIndex: z.number().int().min(0).max(6).optional(),
        /** Duration in seconds (default: 8 — Veo-3.1 supports 4, 6, or 8 only) */
        durationSeconds: z.number().int().min(4).max(8).optional(),
        /** Aspect ratio */
        aspectRatio: z.enum(["16:9", "9:16", "1:1"]).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const concert = await getConcertById(input.concertId);
        if (!concert) throw new Error("Concert not found");
        if (concert.userId !== ctx.user.id) throw new Error("Unauthorized");
        if (!concert.directorsPackage) throw new Error("Director's Package not generated yet — run the Expert Council first");

        // Mark as queued immediately
        await updateConcert(input.concertId, { videoStatus: "queued" });

        try {
          // Build the 10-layer Cinématique video prompt
          const videoPrompt = buildCinématiqueVideoPrompt({
            directorsPackage: concert.directorsPackage as any,
            primaryShotIndex: input.primaryShotIndex ?? 0,
            durationSeconds: input.durationSeconds ?? 8,
          });

          // Store the assembled prompt before calling the API
          await updateConcert(input.concertId, {
            videoPrompt,
            videoStatus: "generating",
          });

          // Call the video generation API
          const result = await generateVideo({
            prompt: videoPrompt,
            durationSeconds: input.durationSeconds ?? 8,
            aspectRatio: input.aspectRatio ?? "16:9",
          });

          if (result.status === "complete") {
            await updateConcert(input.concertId, {
              videoStatus: "complete",
              videoUrl: result.videoUrl,
              videoJobId: result.jobId,
            });
            return {
              status: "complete" as const,
              videoUrl: result.videoUrl,
              jobId: result.jobId,
              videoPrompt,
              provider: getActiveProvider(),
            };
          } else if (result.status === "queued") {
            await updateConcert(input.concertId, {
              videoStatus: "generating",
              videoJobId: result.jobId,
            });
            return {
              status: "queued" as const,
              jobId: result.jobId,
              videoPrompt,
              provider: getActiveProvider(),
            };
          } else {
            await updateConcert(input.concertId, {
              videoStatus: "failed",
              videoError: result.error,
            });
            throw new Error(result.error);
          }
        } catch (err) {
          await updateConcert(input.concertId, {
            videoStatus: "failed",
            videoError: err instanceof Error ? err.message : String(err),
          });
          throw err;
        }
      }),

    pollVideoStatus: protectedProcedure
      .input(z.object({ concertId: z.number().int() }))
      .query(async ({ ctx, input }) => {
        const concert = await getConcertById(input.concertId);
        if (!concert) throw new Error("Concert not found");
        if (concert.userId !== ctx.user.id) throw new Error("Unauthorized");

        // If already complete or failed, return stored state
        if (concert.videoStatus === "complete") {
          return { status: "complete" as const, videoUrl: concert.videoUrl ?? "", jobId: concert.videoJobId ?? "" };
        }
        if (concert.videoStatus === "failed") {
          return { status: "failed" as const, error: concert.videoError ?? "Unknown error" };
        }
        if (concert.videoStatus === "none") {
          return { status: "none" as const };
        }

        // If generating/queued and we have a job ID, poll the provider
        if (concert.videoJobId) {
          const provider = getActiveProvider();
          const result = await pollVideoStatus(provider, concert.videoJobId);

          if (result.status === "complete") {
            await updateConcert(input.concertId, {
              videoStatus: "complete",
              videoUrl: result.videoUrl,
            });
            return { status: "complete" as const, videoUrl: result.videoUrl, jobId: concert.videoJobId };
          }
          if (result.status === "failed") {
            await updateConcert(input.concertId, {
              videoStatus: "failed",
              videoError: result.error,
            });
            return { status: "failed" as const, error: result.error };
          }
          return { status: "generating" as const, jobId: concert.videoJobId, progress: (result as any).progress ?? null };
        }

        return { status: concert.videoStatus as "queued" | "generating", progress: null };
      }),

    getVideoUrl: protectedProcedure
      .input(z.object({ concertId: z.number().int() }))
      .query(async ({ ctx, input }) => {
        const concert = await getConcertById(input.concertId);
        if (!concert) throw new Error("Concert not found");
        if (concert.userId !== ctx.user.id) throw new Error("Unauthorized");

        // If no video URL, return null
        if (!concert.videoUrl) {
          console.log(`[getVideoUrl] Concert ${input.concertId} has no video URL`);
          return { videoUrl: null };
        }

        // If URL is from our own S3 (not Runway CDN), it's already permanent
        if (!isRunwayUrl(concert.videoUrl)) {
          console.log(`[getVideoUrl] Concert ${input.concertId} already has permanent S3 URL`);
          return { videoUrl: concert.videoUrl };
        }

        // URL is a Runway CDN URL — try to re-download and save to our S3
        try {
          console.log(`[getVideoUrl] Downloading Runway video to S3 for concert ${input.concertId}`);
          const res = await fetch(concert.videoUrl);
          if (!res.ok) {
            // JWT token has expired, can't download anymore
            console.error(`[getVideoUrl] Runway URL expired (${res.status}) for concert ${input.concertId}`);
            return { videoUrl: null };
          }
          const buffer = Buffer.from(await res.arrayBuffer());
          const key = `cinematique-videos/concert-${input.concertId}-${Date.now()}.mp4`;
          const { url: permanentUrl } = await storagePut(key, buffer, "video/mp4");
          // Update the database with the permanent URL
          await updateConcert(input.concertId, { videoUrl: permanentUrl });
          console.log(`[getVideoUrl] Saved permanent URL for concert ${input.concertId}`);
          return { videoUrl: permanentUrl };
        } catch (error) {
          console.error(`[getVideoUrl] Failed to migrate video for concert ${input.concertId}:`, error);
          return { videoUrl: null };
        }
      }),
  }),

  // ─── Audio Tracks ──────────────────────────────────────────────────────────

  audio: router({
    getUploadUrl: protectedProcedure
      .input(z.object({
        filename: z.string(),
        mimeType: z.string(),
        fileSize: z.number().int(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Return a presigned-style upload endpoint
        // The client will POST the file to /api/audio/upload
        return { ready: true, userId: ctx.user.id };
      }),

    upload: protectedProcedure
      .input(z.object({
        title: z.string().min(1).max(255),
        fileUrl: z.string().url(),
        fileKey: z.string(),
        mimeType: z.string().optional(),
        fileSizeBytes: z.number().int().optional(),
        durationSeconds: z.number().int().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const result = await createAudioTrack({
          userId: ctx.user.id,
          title: input.title,
          fileUrl: input.fileUrl,
          fileKey: input.fileKey,
          mimeType: input.mimeType,
          fileSizeBytes: input.fileSizeBytes,
          durationSeconds: input.durationSeconds,
        });
        return { success: true, id: (result as any).insertId };
      }),

    list: protectedProcedure.query(async ({ ctx }) => {
      return getAudioTracksByUser(ctx.user.id);
    }),
  }),

  // ─── Cinématique Presets ──────────────────────────────────────────────────

  presets: router({
    list: publicProcedure.query(async () => {
      return getAllPresets();
    }),

    get: publicProcedure
      .input(z.object({ slug: z.string() }))
      .query(async ({ input }) => {
        return getPresetBySlug(input.slug);
      }),

    seed: protectedProcedure.mutation(async ({ ctx }) => {
      if (ctx.user.role !== "admin") throw new Error("Admin only");

      const PRESET_DATA = [
        {
          name: "Shadow and Smoke",
          slug: "shadow-and-smoke",
          description: "Deep noir blacks, atmospheric haze, chiaroscuro lighting. The club breathes.",
          fabricPhysics: "Velvet absorbs light completely at 0-5° angle; silk catches rim glow at 15° with visible sheen. Avoid polyester — it creates unwanted specular highlights in low-key lighting.",
          lightingKelvin: 1800,
          cameraPsychology: "Low-key chiaroscuro creates psychological tension. The viewer leans in. Shadow conceals as much as light reveals — the unseen is as powerful as the seen.",
          promptTemplate: "Cinematic noir jazz club interior, 1800K tungsten footlights, deep chiaroscuro shadows, atmospheric haze diffusing amber light, velvet curtains absorbing shadow at zero degrees, silk catching rim glow at fifteen degrees, venetian cage shadow patterns on performer, shallow depth of field, film grain texture, anamorphic lens flare",
          sortOrder: 1,
        },
        {
          name: "Golden Rim",
          slug: "golden-rim",
          description: "Amber footlights rim every surface in gold. Warm, theatrical, cinematic.",
          fabricPhysics: "Satin catches amber at 30° — visible sheen without overexposure. Velvet shows warm undertones. Linen creates soft diffusion. Gold thread in fabric activates at 2400K.",
          lightingKelvin: 2400,
          cameraPsychology: "Warm amber light triggers nostalgia and intimacy. The golden rim separates subject from background, creating a halo of importance. The viewer feels invited into a private moment.",
          promptTemplate: "Jazz club stage bathed in 2400K amber footlights, golden rim lighting separating performer from dark background, satin fabric catching warm glow at thirty degrees, theatrical stage lighting, warm bokeh in background, cinematic color grading, rich shadow detail, intimate performance atmosphere",
          sortOrder: 2,
        },
        {
          name: "Venetian Cage",
          slug: "venetian-cage",
          description: "Geometric shadow bars from venetian blinds. The artist is framed, contained, powerful.",
          fabricPhysics: "Matte fabrics show shadow geometry cleanly — avoid reflective surfaces that break the pattern. Cotton and linen ideal. Shadow bars should fall across fabric at 45° for maximum geometric impact.",
          lightingKelvin: 2200,
          cameraPsychology: "Geometric shadow bars create a sense of containment and power simultaneously. The performer is caged yet commanding. The viewer experiences both vulnerability and strength in the same frame.",
          promptTemplate: "Venetian blind shadow bars casting geometric patterns across jazz club stage, 2200K warm tungsten, performer framed within shadow cage, matte fabric showing clean shadow geometry at forty-five degrees, film noir aesthetic, strong directional sidelight, deep contrast, architectural shadow play",
          sortOrder: 3,
        },
        {
          name: "Match Flare",
          slug: "match-flare",
          description: "A single match or lighter flare illuminates the scene. Intimate. Dangerous. Beautiful.",
          fabricPhysics: "Linen and cotton catch warm micro-flare naturally. Silk creates a halo effect around the flame source. Avoid dark fabrics that absorb the micro-light — use cream, ivory, or warm white for maximum flare interaction.",
          lightingKelvin: 1600,
          cameraPsychology: "The single point of light in darkness creates maximum psychological intimacy. The viewer's eye is drawn to the flame source. Everything outside the flare radius becomes mysterious, implied, dangerous.",
          promptTemplate: "Single match or lighter flame illuminating jazz club scene, 1600K ultra-warm micro-light, linen fabric catching warm flare, silk creating halo effect around flame source, extreme chiaroscuro, intimate close-up framing, breath-close proximity, dangerous beauty, film grain, handheld camera psychology",
          sortOrder: 4,
        },
      ];

      for (const preset of PRESET_DATA) {
        await upsertPreset({ ...preset, isActive: true });
      }

      return { success: true, count: PRESET_DATA.length };
    }),
  }),

  // ─── Campaigns ────────────────────────────────────────────────────────────────────────────────

  campaigns: campaignsRouter,
});

export type AppRouter = typeof appRouter;

