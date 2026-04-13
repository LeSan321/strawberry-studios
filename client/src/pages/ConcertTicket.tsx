import { useParams, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

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

export default function ConcertTicket() {
  const params = useParams<{ slug: string }>();
  const { data: concert, isLoading } = trpc.concerts.getPublic.useQuery(
    { slug: params.slug ?? "" },
    { enabled: !!params.slug }
  );

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success("Concert link copied to clipboard!");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground font-serif">Loading concert...</p>
        </div>
      </div>
    );
  }

  if (!concert) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="font-display text-2xl text-foreground mb-4">Concert Not Found</p>
          <p className="text-muted-foreground font-serif mb-8">This concert may be private or no longer available.</p>
          <Link href="/" className="px-8 py-3 border border-primary text-primary hover:bg-primary hover:text-primary-foreground transition-all font-display text-sm tracking-widest uppercase">
            Return Home
          </Link>
        </div>
      </div>
    );
  }

  const venueName = VENUE_LABELS[concert.venue] ?? concert.venue;
  const moodName = MOOD_LABELS[concert.moodPreset ?? ""] ?? concert.moodPreset ?? "";
  const visualName = VISUAL_LABELS[concert.visualPreset ?? ""] ?? concert.visualPreset ?? "";
  const dp = concert.directorsPackage as any;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Letterbox top */}
      <div className="h-3 bg-background border-b border-primary/20" />

      {/* Navigation */}
      <nav className="flex items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-primary text-xl">✦</span>
          <span className="font-display text-xs tracking-widest text-foreground/90 uppercase">Strawberry Studios</span>
        </Link>
        <button onClick={handleShare}
          className="px-5 py-2 text-sm tracking-widest uppercase font-light border border-border/40 text-muted-foreground hover:border-border hover:text-foreground transition-all duration-300">
          Share Concert
        </button>
      </nav>

      {/* Hero — Concert Identity */}
      <section className="relative py-24 px-6 text-center overflow-hidden">
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse 70% 50% at 50% 50%, oklch(0.14 0.04 18 / 0.2), transparent)" }} />
        <div className="relative max-w-3xl mx-auto">
          <p className="text-xs tracking-[0.4em] uppercase text-primary/70 mb-6 font-light">
            Strawberry Riff Presents
          </p>
          <h1 className="font-display text-4xl md:text-6xl text-foreground mb-4 glow-text-crimson">
            {concert.title}
          </h1>
          {concert.artistName && (
            <div className="flex items-center justify-center gap-4 mb-6">
              <div className="h-px w-12 bg-primary/40" />
              <p className="font-serif text-xl italic text-accent">{concert.artistName}</p>
              <div className="h-px w-12 bg-primary/40" />
            </div>
          )}
          <p className="font-serif text-muted-foreground text-lg mb-8">{venueName}</p>

          {/* Production tags */}
          <div className="flex flex-wrap gap-2 justify-center mb-8">
            {moodName && (
              <span className="px-3 py-1 text-xs tracking-wider uppercase border border-primary/30 text-primary/70 font-light">
                {moodName}
              </span>
            )}
            {visualName && visualName !== "None" && (
              <span className="px-3 py-1 text-xs tracking-wider uppercase border border-accent/30 text-accent/70 font-light">
                {visualName}
              </span>
            )}
            {concert.lightingKelvin && (
              <span className="px-3 py-1 text-xs tracking-wider uppercase border border-border/30 text-muted-foreground/60 font-light">
                {concert.lightingKelvin}K
              </span>
            )}
          </div>

          {/* Share CTA */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button onClick={handleShare}
              className="px-8 py-3 bg-primary text-primary-foreground font-display text-sm tracking-widest uppercase hover:bg-primary/90 transition-all glow-crimson">
              Share This Concert
            </button>
            <Link href="/"
              className="px-8 py-3 border border-border/40 text-muted-foreground hover:border-border hover:text-foreground transition-all font-display text-sm tracking-widest uppercase">
              Strawberry Studios
            </Link>
          </div>
        </div>
      </section>

      {/* Director's Statement */}
      {dp?.directorStatement && (
        <section className="py-16 px-6 border-t border-border/20">
          <div className="max-w-3xl mx-auto text-center">
            <p className="text-xs tracking-[0.4em] uppercase text-primary/70 mb-6 font-light">Director's Statement</p>
            <blockquote className="font-serif text-xl italic text-foreground/80 leading-relaxed">
              "{dp.directorStatement}"
            </blockquote>
          </div>
        </section>
      )}

      {/* Characters */}
      {concert.characters && concert.characters.length > 0 && (
        <section className="py-16 px-6 border-t border-border/20">
          <div className="max-w-4xl mx-auto">
            <p className="text-xs tracking-[0.4em] uppercase text-primary/70 mb-8 font-light text-center">The Cast</p>
            <div className="flex flex-wrap gap-4 justify-center">
              {concert.characters.map((char: any) => (
                <div key={char.id} className="noir-card px-6 py-4 text-center">
                  <p className="text-xs tracking-wider uppercase text-muted-foreground/60 font-light mb-1">{char.role}</p>
                  <p className="font-display text-sm text-foreground">
                    {CHARACTER_LABELS[char.characterType] ?? char.characterType}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Shot List */}
      {dp?.shotList && dp.shotList.length > 0 && (
        <section className="py-16 px-6 border-t border-border/20">
          <div className="max-w-4xl mx-auto">
            <p className="text-xs tracking-[0.4em] uppercase text-primary/70 mb-8 font-light text-center">Shot List</p>
            <div className="space-y-4">
              {dp.shotList.map((shot: any) => (
                <div key={shot.shotNumber} className="noir-card p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 flex items-center justify-center flex-shrink-0 step-active rounded-full">
                      <span className="font-display text-xs text-primary-foreground">{shot.shotNumber}</span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-xs tracking-wider uppercase text-accent/70 font-light">{shot.shotType}</span>
                        <span className="text-xs text-muted-foreground/50">·</span>
                        <span className="text-xs text-muted-foreground/50 font-light">{shot.duration}</span>
                      </div>
                      <p className="text-foreground/90 font-serif mb-2">{shot.description}</p>
                      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground/60 font-light">
                        <span>Camera: {shot.cameraMovement}</span>
                        <span>Light: {shot.lightingNote}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Production Notes */}
      {dp?.productionNotes && (
        <section className="py-16 px-6 border-t border-border/20">
          <div className="max-w-4xl mx-auto">
            <p className="text-xs tracking-[0.4em] uppercase text-primary/70 mb-8 font-light text-center">Production Notes</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                { label: "Fabric Physics", value: dp.productionNotes.fabricPhysics },
                { label: "Lighting Setup", value: dp.productionNotes.lightingSetup },
                { label: "Camera Psychology", value: dp.productionNotes.cameraPsychology },
                { label: "Atmospheric Elements", value: dp.productionNotes.atmosphericElements },
              ].map(note => (
                <div key={note.label} className="noir-card p-6">
                  <p className="text-xs tracking-[0.3em] uppercase text-muted-foreground/60 mb-3 font-light">{note.label}</p>
                  <p className="text-sm text-muted-foreground font-serif leading-relaxed">{note.value}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Cinématique Prompt */}
      {concert.cinematiquePrompt && (
        <section className="py-16 px-6 border-t border-border/20">
          <div className="max-w-3xl mx-auto">
            <p className="text-xs tracking-[0.4em] uppercase text-primary/70 mb-6 font-light text-center">Cinématique Prompt</p>
            <div className="p-6 border border-accent/20 bg-accent/5">
              <p className="font-serif text-foreground/80 leading-relaxed italic">{concert.cinematiquePrompt}</p>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(concert.cinematiquePrompt ?? "");
                  toast.success("Prompt copied!");
                }}
                className="mt-4 text-xs tracking-widest uppercase font-light text-accent/70 hover:text-accent transition-colors">
                Copy Prompt →
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Footer CTA */}
      <section className="py-20 px-6 border-t border-border/20 text-center">
        <p className="text-xs tracking-[0.4em] uppercase text-primary/70 mb-4 font-light">Create Your Own</p>
        <h2 className="font-display text-3xl text-foreground mb-6">Your Stage Awaits</h2>
        <p className="text-muted-foreground font-serif mb-8 max-w-md mx-auto">
          Produce your own concert at the Velvet Strawberry Jazz Club. Part of the Strawberry Riff ecosystem.
        </p>
        <Link href="/"
          className="inline-flex items-center gap-3 px-10 py-4 bg-primary text-primary-foreground font-display text-sm tracking-[0.2em] uppercase hover:bg-primary/90 transition-all glow-crimson">
          Enter Strawberry Studios
        </Link>
      </section>

      {/* Letterbox bottom */}
      <div className="h-3 bg-background border-t border-primary/20" />
    </div>
  );
}
