# Riff ↔ Studios Bridge — Handoff v2
## Cover Art Data Flow Fixes + Art Direction Field

**Date:** May 2026  
**Author:** Strawberry Studios Manus  
**Applies to:** `client/src/pages/Upload.tsx` and `server/frequency/router.ts` in the Riff project

---

## Overview

This document covers two related changes that need to be made on the **Riff side** of the bridge. Both are small, targeted, and do not require any schema migration or new tRPC procedures.

| # | Change | File | Impact |
|---|---|---|---|
| 1 | Pre-populate `form.lyrics` from the stored track record on page load | `Upload.tsx` | Lyrics now reach the prompt builder |
| 2 | Rename Description field → "Art Direction" and wire to `steeringNote` | `Upload.tsx` + `frequency/router.ts` | Creator steering is intentional and first-priority |

---

## Fix 1 — Pre-populate `form.lyrics` from Stored Track Data

### Root Cause

The `handleGenerateCoverArt` handler sends `lyrics: form.lyrics || undefined`. The `form.lyrics` field is only populated if the user has typed lyrics into the lyrics text area **in the current session**. If the user navigates to the Upload page for an existing track (which already has lyrics stored in the database), `form.lyrics` starts as an empty string and the bridge receives `lyrics: undefined`.

Studios then has no lyric input, so the prompt is driven entirely by the Frequency vocabulary — which produces the same atmospheric default (mossy ground, open field, etc.) regardless of the song.

### Diagnosis Confirmation

The Studios `_debug` field in the bridge response exposes this. When you call `POST /api/bridge/cover-art/generate`, the response now includes:

```json
"_debug": {
  "lyricsReceived": null,
  "steeringNoteReceived": null,
  "lyricPhrasesExtracted": [],
  "promptUsed": "...",
  "promptCharCount": 412
}
```

If `lyricsReceived` is `null` or an empty string, the lyrics never arrived.

### The Fix

When the Upload page loads an existing track, pre-populate `form.lyrics` from the track's stored `lyrics` field. This is a one-line change in the `useEffect` (or wherever the form is initialised from the fetched track data).

**Locate the section in `Upload.tsx` where the form is populated from a fetched track.** It will look something like:

```tsx
// Existing pattern — wherever you set form state from the fetched track:
setForm({
  title: track.title ?? "",
  artist: track.artist ?? "",
  genre: track.genre ?? "",
  // ... other fields
});
```

**Add `lyrics` to this initialisation:**

```tsx
setForm({
  title: track.title ?? "",
  artist: track.artist ?? "",
  genre: track.genre ?? "",
  lyrics: track.lyrics ?? "",   // ← ADD THIS LINE
  // ... other fields
});
```

That is the entire fix. When the user clicks "Generate with AI", `form.lyrics` will now contain the stored lyrics and they will be sent to Studios as the `lyrics` field.

### Verification

After the fix, trigger a cover art generation and check the bridge response's `_debug.lyricsReceived` field — it should now contain the track's lyrics text, and `lyricPhrasesExtracted` should show 2–3 translated scene descriptors.

---

## Fix 2 — Art Direction Field (Description → `steeringNote`)

### Background

The Studios bridge now accepts an optional `steeringNote` field (max 300 characters). When present, it is placed at the **very beginning** of the assembled image prompt — before lyrics, before Frequency vocabulary, before everything. A few words from the creator override the system's defaults entirely.

This replaces the accidental workaround where users were putting scene descriptions into the Title field. The Art Direction field makes this intentional, clearly labelled, and properly wired.

### Bridge Schema Change (Already Live on Studios Side)

The `POST /api/bridge/cover-art/generate` endpoint now accepts:

```ts
{
  riffUserId: number;
  riffTrackId: number;
  lyrics?: string;
  steeringNote?: string;   // ← NEW — max 300 chars, optional
  genre?: string;
  arcPosition?: "gathering" | "arriving" | "open";
  isRegeneration?: boolean;
}
```

The `_debug` response now also includes `steeringNoteReceived` so you can verify what arrived.

### Riff-Side Changes Required

**Step 1 — Update the `generateCoverArt` tRPC procedure input schema** in `server/frequency/router.ts`:

```ts
// Before:
generateCoverArt: protectedProcedure
  .input(z.object({
    trackId: z.number().int().positive(),
    lyrics: z.string().optional(),
    genre: z.string().optional(),
    arcPosition: z.enum(["gathering", "arriving", "open"]).optional(),
  }))

// After:
generateCoverArt: protectedProcedure
  .input(z.object({
    trackId: z.number().int().positive(),
    lyrics: z.string().optional(),
    steeringNote: z.string().max(300).optional(),   // ← ADD
    genre: z.string().optional(),
    arcPosition: z.enum(["gathering", "arriving", "open"]).optional(),
  }))
```

**Step 2 — Pass `steeringNote` through to the bridge fetch** in the same procedure:

```ts
// Before:
body: JSON.stringify({
  riffUserId: ctx.user.id,
  riffTrackId: input.trackId,
  lyrics: input.lyrics,
  genre: input.genre,
  arcPosition: input.arcPosition ?? "arriving",
}),

// After:
body: JSON.stringify({
  riffUserId: ctx.user.id,
  riffTrackId: input.trackId,
  lyrics: input.lyrics,
  steeringNote: input.steeringNote,   // ← ADD
  genre: input.genre,
  arcPosition: input.arcPosition ?? "arriving",
}),
```

**Step 3 — Update the `handleGenerateCoverArt` handler in `Upload.tsx`** to read from the Description field and pass it as `steeringNote`:

```tsx
// Before:
const result = await generateCoverArtMutation.mutateAsync({
  trackId,
  lyrics: form.lyrics || undefined,
  genre: form.genre || undefined,
  arcPosition: "arriving",
});

// After:
const result = await generateCoverArtMutation.mutateAsync({
  trackId,
  lyrics: form.lyrics || undefined,
  steeringNote: form.description?.trim() || undefined,   // ← ADD
  genre: form.genre || undefined,
  arcPosition: "arriving",
});
```

> **Note:** Replace `form.description` with whatever the actual field name is in the Riff form state for the Description text area. If the field is named differently (e.g., `form.brief`, `form.notes`), use that name instead.

**Step 4 — Rename the Description label to "Art Direction" in the Upload page UI:**

Find the label and input for the Description field in `Upload.tsx` and update the label text and placeholder:

```tsx
// Before (approximate):
<label>Description</label>
<Textarea
  placeholder="Describe your track..."
  value={form.description}
  onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))}
/>

// After:
<label>Art Direction <span className="text-xs text-gray-400 font-normal ml-1">(optional)</span></label>
<Textarea
  placeholder="A few words to steer the image — mood, setting, color, moment. The system handles the rest."
  value={form.description}
  onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))}
  maxLength={300}
/>
```

The field name in `form` state does **not** need to change — only the label text and placeholder copy need updating. This keeps the existing save/load logic intact.

---

## How the Two Fixes Work Together

Once both fixes are in place, the cover art generation pipeline works as follows:

1. **Art Direction note** (from the renamed Description field) → placed first in the prompt as the creator's primary directive
2. **Lyrics** (pre-populated from the stored track record) → translated into 2–3 concrete photographable scenes by OpenAI GPT-4o-mini, placed second
3. **Frequency vocabulary** (creator's personal visual universe) → fills in atmosphere, color, light, and environment
4. **Arc position** → sets scale and cinematic framing
5. **Genre** → lowest-weight production context

A creator who writes "golden hour, empty road" in the Art Direction field gets exactly that as the dominant scene, with their Frequency coloring the atmosphere and the lyric translation adding specificity. A creator who leaves Art Direction blank gets a prompt driven entirely by their lyrics and Frequency — which is the correct default.

---

## Testing Checklist

After implementing both fixes, verify the following:

| Test | Expected `_debug` output |
|---|---|
| Generate with lyrics stored, no Art Direction | `lyricsReceived`: lyrics text, `steeringNoteReceived`: null, `lyricPhrasesExtracted`: 2–3 items |
| Generate with lyrics stored + Art Direction filled | `lyricsReceived`: lyrics text, `steeringNoteReceived`: art direction text, prompt starts with art direction text |
| Generate with no lyrics, Art Direction filled | `lyricsReceived`: null, `steeringNoteReceived`: art direction text, prompt starts with art direction text |
| Generate with nothing filled | `lyricsReceived`: null, `steeringNoteReceived`: null, prompt driven by Frequency vocabulary only |

---

## No Schema Migration Required

Neither fix requires any database schema changes on the Riff side. The `tracks` table already has a `lyrics` column (used for the lyrics editor). The Description field already exists in the form state. This is purely a data-wiring change.

---

## Summary of Files to Edit in Riff

| File | Change |
|---|---|
| `server/frequency/router.ts` | Add `steeringNote` to `generateCoverArt` input schema and bridge fetch body |
| `client/src/pages/Upload.tsx` | Pre-populate `form.lyrics` from track data on load; pass `steeringNote` from `form.description`; rename Description label to "Art Direction" with new placeholder |
