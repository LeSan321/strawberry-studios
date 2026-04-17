import React, { useState, useCallback } from "react";
import { Link, useLocation, useParams } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

type Step = 1 | 2 | 3 | 4 | 5;

interface WizardState {
  title: string;
  artistName: string;
  venue: string;
  moodPreset: string;
  customMoodDescription: string;
  visualPreset: string;
  cameraStyle: string;
  lightingKelvin: number;
  characters: Array<{ type: string; role: string; description: string }>;
  audioTitle: string;
}

const MOOD_PRESETS = [
  {
    id: "intimate_jazz",
    label: "Intimate Jazz",
    desc: "Close-up. Whispered. The camera breathes with the music.",
    kelvin: 2700,
    camera: "Intimate close-up, shallow depth of field, slow push-in"
  },
  {
    id: "high_energy",
    label: "High Energy",
    desc: "Dynamic cuts. Wide angles. The room is alive.",
    kelvin: 4200,
    camera: "Wide establishing, handheld energy, rapid cross-cuts"
  },
  {
    id: "noir_smoke",
    label: "Noir Smoke",
    desc: "Shadows dominate. Silhouettes. Mystery in every frame.",
    kelvin: 1800,
    camera: "Low angle, venetian shadow play, smoke foreground"
  },
  {
    id: "custom",
    label: "Custom",
    desc: "Define your own atmosphere. The Council will interpret.",
    kelvin: 3200,
    camera: "Director's choice"
  },
];

const VISUAL_PRESETS = [
  {
    id: "shadow_and_smoke",
    label: "Shadow and Smoke",
    desc: "Deep noir blacks, atmospheric haze, chiaroscuro lighting. The club breathes.",
    kelvin: 1800,
    fabric: "Velvet absorbs light; silk catches rim glow at 15° angle"
  },
  {
    id: "golden_rim",
    label: "Golden Rim",
    desc: "Amber footlights rim every surface in gold. Warm, theatrical, cinematic.",
    kelvin: 2400,
    fabric: "Satin catches amber at 30° — visible sheen without overexposure"
  },
  {
    id: "venetian_cage",
    label: "Venetian Cage",
    desc: "Geometric shadow bars from venetian blinds. The artist is framed, contained, powerful.",
    kelvin: 2200,
    fabric: "Matte fabrics show shadow geometry cleanly; avoid reflective surfaces"
  },
  {
    id: "match_flare",
    label: "Match Flare",
    desc: "A single match or lighter flare illuminates the scene. Intimate. Dangerous. Beautiful.",
    kelvin: 1600,
    fabric: "Linen and cotton catch warm micro-flare; silk creates halo effect"
  },
];

const CAMERA_STYLES = [
  { id: "intimate_close", label: "Intimate Close-Up", desc: "Shallow DOF, slow push-in, breath-close" },
  { id: "theatrical_wide", label: "Theatrical Wide", desc: "Full stage reveal, architectural framing" },
  { id: "dutch_angle", label: "Dutch Angle", desc: "Tilted frame, psychological tension" },
  { id: "over_shoulder", label: "Over the Shoulder", desc: "POV of the audience, immersive" },
  { id: "low_angle", label: "Low Angle", desc: "Heroic framing, the artist towers" },
  { id: "birds_eye", label: "Bird's Eye", desc: "Overhead, geometric, abstract" },
];

const CHARACTERS = [
  {
    id: "the_red_head_singer",
    label: "The Red Head Singer",
    desc: "Velvet voice, crimson hair. She owns every stage she steps onto.",
    role: "Lead Vocalist"
  },
  {
    id: "the_fedora_man",
    label: "The Fedora Man",
    desc: "He arrives late and leaves early. Mystery in every frame.",
    role: "Mysterious Figure"
  },
  {
    id: "custom",
    label: "Custom Character",
    desc: "Upload a reference image and describe your character.",
    role: "Custom"
  },
];

const STEPS = [
  { num: 1, label: "Track" },
  { num: 2, label: "Vibe" },
  { num: 3, label: "Visual" },
  { num: 4, label: "Cast" },
  { num: 5, label: "Review" },
];

export default function CreateConcert() {
  const { user } = useAuth();
  const params = useParams<{ venueSlug?: string }>();
  const [, navigate] = useLocation();

  const [step, setStep] = useState<Step>(1);
  const [state, setState] = useState<WizardState>({
    title: "",
    artistName: user?.name ?? "",
    venue: params.venueSlug?.replace(/-/g, "_") ?? "velvet_strawberry_jazz_club",
    moodPreset: "intimate_jazz",
    customMoodDescription: "",
    visualPreset: "shadow_and_smoke",
    cameraStyle: "intimate_close",
    lightingKelvin: 2700,
    characters: [] as Array<{ type: string; role: "lead" | "supporting" | "background"; description: string }>,
    audioTitle: "",
  });

  const [submitted, setSubmitted] = useState(false);

  const createConcertMutation = trpc.concerts.create.useMutation({
    onSuccess: (data) => {
      toast.success("Concert created! Consulting the Expert Council...");
      navigate(`/library`);
    },
    onError: (err) => {
      setSubmitted(false);
      toast.error("Failed to create concert: " + err.message);
    }
  });

  const generateMutation = trpc.concerts.generate.useMutation({
    onSuccess: (data) => {
      toast.success("Director's Package ready!");
    },
    onError: (err) => {
      toast.error("Generation failed: " + err.message);
    }
  });

  const updateState = useCallback((updates: Partial<WizardState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  const toggleCharacter = useCallback((charId: string) => {
    setState(prev => {
      const exists = prev.characters.find(c => c.type === charId);
      if (exists) {
        return { ...prev, characters: prev.characters.filter(c => c.type !== charId) };
      } else {
        return {
          ...prev,
          characters: [...prev.characters, { type: charId, role: "lead" as const, description: "" }]
        };
      }
    });
  }, []);

  const handleSubmit = async () => {
    if (!state.title) {
      toast.error("Please enter a concert title");
      return;
    }
    if (submitted || createConcertMutation.isPending) return;
    setSubmitted(true);
    await createConcertMutation.mutateAsync({
      title: state.title,
      artistName: state.artistName,
      venue: state.venue as any,
      moodPreset: state.moodPreset as any,
      visualPreset: state.visualPreset as any,
      cameraStyle: state.cameraStyle,
      lightingKelvin: state.lightingKelvin,
      customMoodDescription: state.customMoodDescription,
      characters: state.characters as any,
    });
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="font-display text-2xl text-foreground mb-4">Sign In Required</p>
          <p className="text-muted-foreground mb-8">You must be signed in to produce a concert.</p>
          <a href={getLoginUrl()} className="px-8 py-3 bg-primary text-primary-foreground font-display text-sm tracking-widest uppercase">
            Sign In
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navigation */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-border/30">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-primary text-xl">✦</span>
          <span className="font-display text-xs tracking-widest text-foreground/90 uppercase">Strawberry Studios</span>
        </Link>
        <Link href="/venues" className="text-muted-foreground hover:text-foreground text-sm tracking-wider transition-colors uppercase font-light">
          ← Venues
        </Link>
      </nav>

      {/* Step Progress */}
      <div className="border-b border-border/30 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          {STEPS.map((s, i) => (
            <div key={s.num} className="flex items-center">
              <div className="flex flex-col items-center gap-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-display transition-all duration-300 ${
                  step > s.num ? "step-complete text-background" :
                  step === s.num ? "step-active text-primary-foreground" :
                  "bg-muted text-muted-foreground"
                }`}>
                  {step > s.num ? "✓" : s.num}
                </div>
                <span className={`text-xs tracking-wider uppercase font-light ${
                  step === s.num ? "text-foreground" : "text-muted-foreground"
                }`}>{s.label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`h-px w-12 md:w-24 mx-2 mb-4 transition-all duration-300 ${
                  step > s.num ? "bg-accent" : "bg-border/40"
                }`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <div className="max-w-4xl mx-auto px-6 py-12">

        {/* Step 1: Track & Title */}
        {step === 1 && (
          <div className="animate-fade-up">
            <div className="mb-10">
              <p className="text-xs tracking-[0.4em] uppercase text-primary/70 mb-2 font-light">Step 1 of 5</p>
              <h2 className="font-display text-3xl text-foreground mb-3">Name Your Concert</h2>
              <p className="text-muted-foreground font-serif">Give your production a title and confirm your artist name.</p>
            </div>

            <div className="space-y-6 max-w-xl">
              <div>
                <label className="block text-xs tracking-[0.3em] uppercase text-muted-foreground mb-3 font-light">
                  Concert Title *
                </label>
                <input
                  type="text"
                  value={state.title}
                  onChange={e => updateState({ title: e.target.value })}
                  placeholder="e.g. Midnight at the Velvet Strawberry"
                  className="w-full px-4 py-3 bg-input border border-border text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary transition-colors font-serif text-lg"
                />
              </div>

              <div>
                <label className="block text-xs tracking-[0.3em] uppercase text-muted-foreground mb-3 font-light">
                  Artist Name
                </label>
                <input
                  type="text"
                  value={state.artistName}
                  onChange={e => updateState({ artistName: e.target.value })}
                  placeholder="Your name or stage name"
                  className="w-full px-4 py-3 bg-input border border-border text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary transition-colors font-serif text-lg"
                />
              </div>

              <div>
                <label className="block text-xs tracking-[0.3em] uppercase text-muted-foreground mb-3 font-light">
                  Venue
                </label>
                <div className="px-4 py-3 border border-border/40 text-muted-foreground font-serif">
                  Velvet Strawberry Jazz Club
                </div>
              </div>

              <div className="pt-4 p-4 border border-border/30 bg-muted/20">
                <p className="text-xs tracking-[0.3em] uppercase text-muted-foreground/60 mb-2 font-light">Audio Track</p>
                <p className="text-sm text-muted-foreground font-serif">
                  Audio upload is available in your Library after creating this concert. You can attach an audio track from there.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Mood/Vibe */}
        {step === 2 && (
          <div className="animate-fade-up">
            <div className="mb-10">
              <p className="text-xs tracking-[0.4em] uppercase text-primary/70 mb-2 font-light">Step 2 of 5</p>
              <h2 className="font-display text-3xl text-foreground mb-3">Choose Your Vibe</h2>
              <p className="text-muted-foreground font-serif">The mood preset defines the emotional atmosphere of your concert.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              {MOOD_PRESETS.map(preset => (
                <button
                  key={preset.id}
                  onClick={() => updateState({ moodPreset: preset.id, lightingKelvin: preset.kelvin, cameraStyle: preset.camera })}
                  className={`text-left p-6 transition-all duration-300 ${
                    state.moodPreset === preset.id
                      ? "border-primary bg-primary/10 glow-crimson"
                      : "noir-card hover:border-primary/40"
                  }`}
                  style={{ border: state.moodPreset === preset.id ? "1px solid oklch(0.52 0.22 18)" : undefined }}>
                  <div className="flex items-start justify-between mb-3">
                    <h4 className="font-display text-base text-foreground">{preset.label}</h4>
                    {state.moodPreset === preset.id && (
                      <span className="text-primary text-lg">✦</span>
                    )}
                  </div>
                  <p className="text-muted-foreground text-sm font-serif leading-relaxed">{preset.desc}</p>
                  <div className="mt-3 flex items-center gap-3">
                    <span className="text-xs text-muted-foreground/50 font-light">{preset.kelvin}K</span>
                    <div className="w-px h-3 bg-border/40" />
                    <span className="text-xs text-muted-foreground/50 font-light truncate">{preset.camera.substring(0, 30)}...</span>
                  </div>
                </button>
              ))}
            </div>

            {state.moodPreset === "custom" && (
              <div className="max-w-xl">
                <label className="block text-xs tracking-[0.3em] uppercase text-muted-foreground mb-3 font-light">
                  Describe Your Atmosphere
                </label>
                <textarea
                  value={state.customMoodDescription}
                  onChange={e => updateState({ customMoodDescription: e.target.value })}
                  placeholder="Describe the emotional atmosphere you want to create. The Expert Council will interpret your vision..."
                  rows={4}
                  className="w-full px-4 py-3 bg-input border border-border text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary transition-colors font-serif resize-none"
                />
              </div>
            )}
          </div>
        )}

        {/* Step 3: Visual Preset & Camera */}
        {step === 3 && (
          <div className="animate-fade-up">
            <div className="mb-10">
              <p className="text-xs tracking-[0.4em] uppercase text-primary/70 mb-2 font-light">Step 3 of 5</p>
              <h2 className="font-display text-3xl text-foreground mb-3">Visual Style</h2>
              <p className="text-muted-foreground font-serif">Select a Cinématique visual preset and camera approach.</p>
            </div>

            <div className="mb-10">
              <p className="text-xs tracking-[0.3em] uppercase text-muted-foreground mb-4 font-light">Cinématique Preset</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {VISUAL_PRESETS.map(preset => (
                  <button
                    key={preset.id}
                    onClick={() => updateState({ visualPreset: preset.id, lightingKelvin: preset.kelvin })}
                    className={`text-left p-6 transition-all duration-300 ${
                      state.visualPreset === preset.id
                        ? "border-accent bg-accent/10"
                        : "noir-card hover:border-accent/40"
                    }`}
                    style={{ border: state.visualPreset === preset.id ? "1px solid oklch(0.62 0.14 55)" : undefined }}>
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-display text-sm text-foreground">{preset.label}</h4>
                      {state.visualPreset === preset.id && (
                        <span className="text-accent text-sm">✦</span>
                      )}
                    </div>
                    <p className="text-muted-foreground text-sm font-serif leading-relaxed mb-3">{preset.desc}</p>
                    <div className="text-xs text-muted-foreground/50 font-light">
                      <span className="text-accent/60">{preset.kelvin}K</span> · {preset.fabric.substring(0, 40)}...
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs tracking-[0.3em] uppercase text-muted-foreground mb-4 font-light">Camera Style</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {CAMERA_STYLES.map(cam => (
                  <button
                    key={cam.id}
                    onClick={() => updateState({ cameraStyle: cam.id })}
                    className={`text-left p-4 transition-all duration-300 ${
                      state.cameraStyle === cam.id
                        ? "border-primary/60 bg-primary/5"
                        : "border border-border/40 hover:border-border"
                    }`}
                    style={{ border: state.cameraStyle === cam.id ? "1px solid oklch(0.52 0.22 18 / 0.6)" : undefined }}>
                    <p className="font-serif text-sm text-foreground mb-1">{cam.label}</p>
                    <p className="text-xs text-muted-foreground/60">{cam.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Characters */}
        {step === 4 && (
          <div className="animate-fade-up">
            <div className="mb-10">
              <p className="text-xs tracking-[0.4em] uppercase text-primary/70 mb-2 font-light">Step 4 of 5</p>
              <h2 className="font-display text-3xl text-foreground mb-3">Cast Your Characters</h2>
              <p className="text-muted-foreground font-serif">Select resident characters or add your own. Multiple characters are supported.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              {CHARACTERS.map(char => {
                const isSelected = state.characters.some(c => c.type === char.id);
                return (
                  <button
                    key={char.id}
                    onClick={() => toggleCharacter(char.id)}
                    className={`text-left p-6 transition-all duration-300 ${
                      isSelected ? "border-accent bg-accent/10" : "noir-card hover:border-accent/40"
                    }`}
                    style={{ border: isSelected ? "1px solid oklch(0.62 0.14 55)" : undefined }}>
                    <div className="w-12 h-12 rounded-full mb-4 flex items-center justify-center"
                      style={{
                        background: isSelected
                          ? "linear-gradient(135deg, oklch(0.62 0.14 55 / 0.3), oklch(0.52 0.22 18 / 0.2))"
                          : "oklch(0.15 0.01 270)",
                        border: `1px solid ${isSelected ? "oklch(0.62 0.14 55 / 0.5)" : "oklch(0.20 0.02 270)"}`
                      }}>
                      <span className="text-xl opacity-60">👤</span>
                    </div>
                    <div className="flex items-start justify-between mb-2">
                      <span className="text-xs tracking-wider uppercase text-muted-foreground/60 font-light">{char.role}</span>
                      {isSelected && <span className="text-accent text-sm">✦</span>}
                    </div>
                    <h4 className="font-display text-sm text-foreground mb-2">{char.label}</h4>
                    <p className="text-muted-foreground text-xs font-serif leading-relaxed italic">{char.desc}</p>
                  </button>
                );
              })}
            </div>

            {state.characters.length === 0 && (
              <p className="text-muted-foreground/60 text-sm font-serif italic">
                No characters selected. The Director's Package will focus on atmosphere and environment.
              </p>
            )}
          </div>
        )}

        {/* Step 5: Review */}
        {step === 5 && (
          <div className="animate-fade-up">
            <div className="mb-10">
              <p className="text-xs tracking-[0.4em] uppercase text-primary/70 mb-2 font-light">Step 5 of 5</p>
              <h2 className="font-display text-3xl text-foreground mb-3">Review & Produce</h2>
              <p className="text-muted-foreground font-serif">Confirm your production brief. The Expert Council will generate your Director's Package.</p>
            </div>

            <div className="space-y-6 max-w-2xl">
              {/* Summary cards */}
              {[
                { label: "Concert Title", value: state.title || "(untitled)" },
                { label: "Artist", value: state.artistName || "(unnamed)" },
                { label: "Venue", value: "Velvet Strawberry Jazz Club" },
                { label: "Mood Preset", value: MOOD_PRESETS.find(m => m.id === state.moodPreset)?.label ?? state.moodPreset },
                { label: "Visual Preset", value: VISUAL_PRESETS.find(v => v.id === state.visualPreset)?.label ?? state.visualPreset },
                { label: "Camera Style", value: CAMERA_STYLES.find(c => c.id === state.cameraStyle)?.label ?? state.cameraStyle },
                { label: "Lighting", value: `${state.lightingKelvin}K` },
                {
                  label: "Characters",
                  value: state.characters.length > 0
                    ? state.characters.map(c => CHARACTERS.find(ch => ch.id === c.type)?.label ?? c.type).join(", ")
                    : "None selected"
                },
              ].map(item => (
                <div key={item.label} className="flex items-start justify-between py-3 border-b border-border/20">
                  <span className="text-xs tracking-[0.3em] uppercase text-muted-foreground font-light">{item.label}</span>
                  <span className="text-foreground/90 font-serif text-right max-w-xs">{item.value}</span>
                </div>
              ))}

              <div className="pt-4 p-6 border border-primary/20 bg-primary/5">
                <p className="text-xs tracking-[0.3em] uppercase text-primary/70 mb-2 font-light">Expert Council</p>
                <p className="text-sm text-muted-foreground font-serif leading-relaxed">
                  Upon submission, the Expert Council will analyze your brief and generate a complete Cinématique prompt with fabric physics directives, Kelvin lighting specifications, and camera psychology language — assembled into your Director's Package.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between mt-12 pt-6 border-t border-border/30">
          <button
            onClick={() => setStep(s => Math.max(1, s - 1) as Step)}
            disabled={step === 1}
            className="px-6 py-3 border border-border/40 text-muted-foreground hover:border-border hover:text-foreground transition-all duration-300 font-display text-sm tracking-widest uppercase disabled:opacity-30 disabled:cursor-not-allowed">
            ← Back
          </button>

          {step < 5 ? (
            <button
              onClick={() => setStep(s => Math.min(5, s + 1) as Step)}
              disabled={step === 1 && !state.title}
              className="px-8 py-3 bg-primary text-primary-foreground font-display text-sm tracking-widest uppercase hover:bg-primary/90 transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed">
              Continue →
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={createConcertMutation.isPending || submitted || !state.title}
              className="px-8 py-3 bg-primary text-primary-foreground font-display text-sm tracking-widest uppercase hover:bg-primary/90 transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed glow-crimson">
              {createConcertMutation.isPending ? "Consulting the Council..." : "Produce Concert →"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
