import { Link } from "wouter";
import { useAuth, useClerkSafe } from "@/_core/hooks/useAuth";
import { SignInButton } from "@/components/SignInButton";

const VENUES = [
  {
    id: "velvet-strawberry-jazz-club",
    name: "Velvet Strawberry Jazz Club",
    status: "active" as const,
    tagline: "Subterranean noir. Venetian shadows. Velvet and smoke.",
    description: "A subterranean jazz club draped in velvet and shadow. Venetian cage lighting casts geometric patterns across the stage as atmospheric haze drifts toward the ceiling. This is where noir meets music.",
    presets: ["Shadow and Smoke", "Golden Rim", "Venetian Cage", "Match Flare"],
    moods: ["Intimate Jazz", "High Energy", "Noir Smoke", "Custom"],
    characters: ["The Red Head Singer", "The Fedora Man"],
    icon: "🎷",
    accentColor: "oklch(0.52 0.22 18)",
    rimColor: "oklch(0.62 0.14 55)",
  },
  {
    id: "strawberry-in-the-round",
    name: "Strawberry in the Round",
    status: "coming_soon" as const,
    tagline: "360° immersive. The audience surrounds you.",
    description: "A 360° immersive performance space where the audience surrounds the artist. Intimate. Exposed. Electric. Every angle tells a story.",
    presets: [],
    moods: [],
    characters: [],
    icon: "⭕",
    accentColor: "oklch(0.45 0.15 240)",
    rimColor: "oklch(0.55 0.12 200)",
  },
  {
    id: "berries-on-the-rocks",
    name: "Berries on the Rocks",
    status: "coming_soon" as const,
    tagline: "Volcanic amphitheater. Raw. Cinematic. Elemental.",
    description: "An outdoor amphitheater carved into volcanic rock. Raw natural acoustics meet cinematic night sky. The elements are your co-director.",
    presets: [],
    moods: [],
    characters: [],
    icon: "🪨",
    accentColor: "oklch(0.48 0.12 40)",
    rimColor: "oklch(0.58 0.10 70)",
  },
];

export default function Venues() {
  const { user } = useAuth();
  const { openSignIn } = useClerkSafe();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navigation */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-border/30">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-primary text-xl">✦</span>
          <span className="font-display text-xs tracking-widest text-foreground/90 uppercase">
            Strawberry Studios
          </span>
        </Link>
        <div className="flex items-center gap-6">
          <Link href="/presets" className="text-muted-foreground hover:text-foreground text-sm tracking-wider transition-colors uppercase font-light">
            Presets
          </Link>
          {user ? (
            <>
              <Link href="/library" className="text-muted-foreground hover:text-foreground text-sm tracking-wider transition-colors uppercase font-light">
                My Library
              </Link>
              <Link href="/create"
                className="px-5 py-2 text-sm tracking-widest uppercase font-medium border border-primary text-primary hover:bg-primary hover:text-primary-foreground transition-all duration-300">
                Produce
              </Link>
            </>
          ) : (
            <SignInButton />
          )}
        </div>
      </nav>

      {/* Header */}
      <div className="py-20 px-6 text-center relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse 60% 40% at 50% 50%, oklch(0.14 0.04 18 / 0.15), transparent)" }} />
        <p className="text-xs tracking-[0.4em] uppercase text-primary/70 mb-4 font-light">Select Your World</p>
        <h1 className="font-display text-4xl md:text-5xl text-foreground mb-4">The Venue Collection</h1>
        <div className="w-16 h-px bg-primary/60 mx-auto mb-6" />
        <p className="text-muted-foreground font-serif text-lg max-w-xl mx-auto">
          Each venue is a distinct cinematic world. Choose your stage, define your atmosphere, and begin production.
        </p>
      </div>

      {/* Venue Cards */}
      <div className="max-w-6xl mx-auto px-6 pb-24 space-y-8">
        {VENUES.map((venue) => (
          <div key={venue.id}
            className={`relative overflow-hidden ${venue.status === "coming_soon" ? "opacity-60" : ""}`}
            style={{
              background: "linear-gradient(135deg, oklch(0.12 0.01 270) 0%, oklch(0.09 0.01 270) 100%)",
              border: `1px solid ${venue.status === "active" ? `${venue.accentColor} / 0.4` : "oklch(0.20 0.02 270)"}`,
            }}>
            {/* Rim light */}
            <div className="absolute left-0 top-0 bottom-0 w-1"
              style={{ background: venue.status === "active" ? venue.accentColor : "transparent" }} />

            <div className="p-8 md:p-10">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                {/* Left: Icon + Status */}
                <div className="lg:col-span-1">
                  <div className="flex items-start gap-4 mb-6">
                    <div className="w-16 h-16 flex items-center justify-center flex-shrink-0"
                      style={{
                        background: `linear-gradient(135deg, ${venue.accentColor} / 0.15, transparent)`,
                        border: `1px solid ${venue.accentColor} / 0.3`
                      }}>
                      <span className="text-3xl opacity-70">{venue.icon}</span>
                    </div>
                    <div>
                      {venue.status === "active" ? (
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                          <span className="text-xs tracking-widest uppercase text-primary font-light">Open</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-2 h-2 rounded-full bg-muted-foreground/40" />
                          <span className="text-xs tracking-widest uppercase text-muted-foreground/60 font-light">Coming Soon</span>
                        </div>
                      )}
                      <h2 className="font-display text-xl text-foreground leading-tight">{venue.name}</h2>
                    </div>
                  </div>
                  <p className="font-serif italic text-muted-foreground text-base leading-relaxed mb-6">
                    {venue.tagline}
                  </p>
                  {venue.status === "active" && (
                    user ? (
                      <Link href={`/create/${venue.id}`}
                        className="inline-flex items-center gap-3 px-6 py-3 border font-display text-sm tracking-widest uppercase transition-all duration-300"
                        style={{
                          borderColor: venue.accentColor,
                          color: venue.accentColor,
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLElement).style.background = venue.accentColor;
                          (e.currentTarget as HTMLElement).style.color = "oklch(0.97 0.01 60)";
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLElement).style.background = "transparent";
                          (e.currentTarget as HTMLElement).style.color = venue.accentColor;
                        }}>
                        Produce Here →
                      </Link>
                    ) : (
                      <button
                        onClick={() => openSignIn()}
                        className="inline-flex items-center gap-3 px-6 py-3 border font-display text-sm tracking-widest uppercase transition-all duration-300"
                        style={{ borderColor: venue.accentColor, color: venue.accentColor }}>
                        Sign In to Produce →
                      </button>
                    )
                  )}
                </div>

                {/* Middle: Description */}
                <div className="lg:col-span-1">
                  <p className="text-muted-foreground leading-relaxed mb-6">{venue.description}</p>
                  {venue.characters.length > 0 && (
                    <div>
                      <p className="text-xs tracking-[0.3em] uppercase text-muted-foreground/60 mb-3 font-light">Resident Characters</p>
                      <div className="space-y-2">
                        {venue.characters.map(char => (
                          <div key={char} className="flex items-center gap-2">
                            <span className="text-accent/60 text-xs">✦</span>
                            <span className="text-sm text-foreground/70 font-serif">{char}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Right: Presets & Moods */}
                <div className="lg:col-span-1">
                  {venue.presets.length > 0 && (
                    <div className="mb-6">
                      <p className="text-xs tracking-[0.3em] uppercase text-muted-foreground/60 mb-3 font-light">Visual Presets</p>
                      <div className="flex flex-wrap gap-2">
                        {venue.presets.map(preset => (
                          <span key={preset}
                            className="px-2 py-1 text-xs tracking-wider font-light"
                            style={{
                              border: `1px solid ${venue.rimColor} / 0.3`,
                              color: `${venue.rimColor} / 0.8`,
                              background: `${venue.rimColor} / 0.05`
                            }}>
                            {preset}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {venue.moods.length > 0 && (
                    <div>
                      <p className="text-xs tracking-[0.3em] uppercase text-muted-foreground/60 mb-3 font-light">Mood Presets</p>
                      <div className="flex flex-wrap gap-2">
                        {venue.moods.map(mood => (
                          <span key={mood}
                            className="px-2 py-1 text-xs tracking-wider border border-border/40 text-muted-foreground/70 font-light">
                            {mood}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
