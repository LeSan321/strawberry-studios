import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import { storagePut } from "./storage";
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

  const systemPrompt = `You are the Expert Council of Strawberry Studios — a team of three specialized AI directors:
1. The Fabric Physicist: Expert in how clothing, velvet, silk, and textiles behave under cinematic lighting
2. The Kelvin Architect: Master of color temperature, from 1600K match-flare to 6500K daylight
3. The Camera Psychologist: Specialist in how camera angles and movement create emotional states

Your task is to generate a complete Cinématique production prompt and Director's Package for a concert video production at ${venueName}.

You must output a JSON object with exactly these fields:
- "cinematiquePrompt": A rich, detailed AI video generation prompt (200-300 words) using fabric physics directives, Kelvin temperature specifications, and camera psychology language
- "shotList": An array of 5-7 shot objects, each with: "shotNumber", "shotType", "description", "duration", "cameraMovement", "lightingNote"
- "productionNotes": An object with: "fabricPhysics", "lightingSetup", "cameraPsychology", "atmosphericElements"
- "directorStatement": A 2-3 sentence artistic statement about this concert's visual identity`;

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

        const insertId = (result as any).insertId as number;

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
        await updateConcert(input.id, { status: "failed" }); // soft delete via status
        return { success: true };
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
          description: "Deep noir blacks, cigarette smoke, chiaroscuro lighting. The club breathes.",
          fabricPhysics: "Velvet absorbs light completely at 0-5° angle; silk catches rim glow at 15° with visible sheen. Avoid polyester — it creates unwanted specular highlights in low-key lighting.",
          lightingKelvin: 1800,
          cameraPsychology: "Low-key chiaroscuro creates psychological tension. The viewer leans in. Shadow conceals as much as light reveals — the unseen is as powerful as the seen.",
          promptTemplate: "Cinematic noir jazz club interior, 1800K tungsten footlights, deep chiaroscuro shadows, cigarette smoke diffusing amber light, velvet curtains absorbing shadow at zero degrees, silk catching rim glow at fifteen degrees, venetian cage shadow patterns on performer, shallow depth of field, film grain texture, anamorphic lens flare",
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
});

export type AppRouter = typeof appRouter;
