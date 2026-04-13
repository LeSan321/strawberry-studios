import { Link } from "wouter";
import { trpc } from "@/lib/trpc";

const STATIC_PRESETS = [
  {
    slug: "shadow-and-smoke",
    name: "Shadow and Smoke",
    description: "Deep noir blacks, cigarette smoke, chiaroscuro lighting. The club breathes.",
    fabricPhysics: "Velvet absorbs light completely at 0-5° angle; silk catches rim glow at 15° with visible sheen. Avoid polyester — it creates unwanted specular highlights in low-key lighting.",
    lightingKelvin: 1800,
    cameraPsychology: "Low-key chiaroscuro creates psychological tension. The viewer leans in. Shadow conceals as much as light reveals — the unseen is as powerful as the seen.",
    colorHue: "18",
    accentColor: "oklch(0.52 0.22 18)",
  },
  {
    slug: "golden-rim",
    name: "Golden Rim",
    description: "Amber footlights rim every surface in gold. Warm, theatrical, cinematic.",
    fabricPhysics: "Satin catches amber at 30° — visible sheen without overexposure. Velvet shows warm undertones. Linen creates soft diffusion. Gold thread in fabric activates at 2400K.",
    lightingKelvin: 2400,
    cameraPsychology: "Warm amber light triggers nostalgia and intimacy. The golden rim separates subject from background, creating a halo of importance.",
    colorHue: "55",
    accentColor: "oklch(0.75 0.12 75)",
  },
  {
    slug: "venetian-cage",
    name: "Venetian Cage",
    description: "Geometric shadow bars from venetian blinds. The artist is framed, contained, powerful.",
    fabricPhysics: "Matte fabrics show shadow geometry cleanly — avoid reflective surfaces that break the pattern. Cotton and linen ideal. Shadow bars should fall across fabric at 45°.",
    lightingKelvin: 2200,
    cameraPsychology: "Geometric shadow bars create a sense of containment and power simultaneously. The performer is caged yet commanding.",
    colorHue: "240",
    accentColor: "oklch(0.55 0.12 240)",
  },
  {
    slug: "match-flare",
    name: "Match Flare",
    description: "A single match or lighter flare illuminates the scene. Intimate. Dangerous. Beautiful.",
    fabricPhysics: "Linen and cotton catch warm micro-flare naturally. Silk creates a halo effect around the flame source. Avoid dark fabrics that absorb the micro-light.",
    lightingKelvin: 1600,
    cameraPsychology: "The single point of light in darkness creates maximum psychological intimacy. Everything outside the flare radius becomes mysterious, implied, dangerous.",
    colorHue: "40",
    accentColor: "oklch(0.65 0.15 40)",
  },
];

export default function PresetLibrary() {
  const { data: dbPresets } = trpc.presets.list.useQuery();

  // Merge DB presets with static data (DB takes precedence)
  const presets = STATIC_PRESETS.map(sp => {
    const db = dbPresets?.find(p => p.slug === sp.slug);
    return db ? { ...sp, ...db } : sp;
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navigation */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-border/30">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-primary text-xl">✦</span>
          <span className="font-display text-xs tracking-widest text-foreground/90 uppercase">Strawberry Studios</span>
        </Link>
        <div className="flex items-center gap-6">
          <Link href="/venues" className="text-muted-foreground hover:text-foreground text-sm tracking-wider transition-colors uppercase font-light">Venues</Link>
          <Link href="/create" className="px-5 py-2 text-sm tracking-widest uppercase font-medium border border-primary text-primary hover:bg-primary hover:text-primary-foreground transition-all duration-300">
            Produce
          </Link>
        </div>
      </nav>

      {/* Header */}
      <div className="py-20 px-6 text-center relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse 60% 40% at 50% 50%, oklch(0.14 0.04 55 / 0.12), transparent)" }} />
        <p className="text-xs tracking-[0.4em] uppercase text-accent/70 mb-4 font-light">Visual Language</p>
        <h1 className="font-display text-4xl md:text-5xl text-foreground mb-4">Cinématique Presets</h1>
        <div className="w-16 h-px bg-accent/60 mx-auto mb-6" />
        <p className="text-muted-foreground font-serif text-lg max-w-xl mx-auto">
          Four distinct visual languages for the Velvet Strawberry Jazz Club. Each preset encodes fabric physics, Kelvin temperature, and camera psychology into a single cinematic identity.
        </p>
      </div>

      {/* Preset Cards */}
      <div className="max-w-6xl mx-auto px-6 pb-24">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {presets.map((preset, i) => (
            <div key={preset.slug}
              className="relative overflow-hidden group"
              style={{
                background: "linear-gradient(135deg, oklch(0.12 0.01 270) 0%, oklch(0.09 0.01 270) 100%)",
                border: `1px solid ${preset.accentColor} / 0.25`,
              }}>
              {/* Top accent bar */}
              <div className="h-1 w-full" style={{ background: `linear-gradient(to right, ${preset.accentColor}, transparent)` }} />

              <div className="p-8">
                {/* Preset number */}
                <div className="flex items-start justify-between mb-6">
                  <span className="font-display text-5xl font-bold opacity-10 text-foreground">0{i + 1}</span>
                  <div className="flex items-center gap-2 px-3 py-1"
                    style={{ border: `1px solid ${preset.accentColor} / 0.3`, background: `${preset.accentColor} / 0.05` }}>
                    <span className="text-xs tracking-widest uppercase font-light" style={{ color: preset.accentColor }}>
                      {preset.lightingKelvin}K
                    </span>
                  </div>
                </div>

                <h3 className="font-display text-2xl text-foreground mb-3">{preset.name}</h3>
                <p className="font-serif italic text-lg mb-6 leading-relaxed" style={{ color: preset.accentColor }}>
                  "{preset.description}"
                </p>

                <div className="space-y-4">
                  <div>
                    <p className="text-xs tracking-[0.3em] uppercase text-muted-foreground/60 mb-2 font-light">Fabric Physics</p>
                    <p className="text-sm text-muted-foreground leading-relaxed">{preset.fabricPhysics}</p>
                  </div>
                  <div>
                    <p className="text-xs tracking-[0.3em] uppercase text-muted-foreground/60 mb-2 font-light">Camera Psychology</p>
                    <p className="text-sm text-muted-foreground leading-relaxed">{preset.cameraPsychology}</p>
                  </div>
                </div>

                <div className="mt-6 pt-6 border-t border-border/20">
                  <Link href={`/create?preset=${preset.slug}`}
                    className="inline-flex items-center gap-2 text-sm tracking-widest uppercase font-light transition-all duration-300"
                    style={{ color: preset.accentColor }}>
                    Use This Preset →
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
