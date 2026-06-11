import { Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { SignInButton } from "@/components/SignInButton";

const TAGLINE = "Where Artists Become Legends";
const SUB_TAGLINE = "A virtual performance venue system powered by AI. Upload your track, choose your world, and step into the Velvet Strawberry Jazz Club.";

export default function Home() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4"
        style={{ background: "linear-gradient(to bottom, oklch(0.08 0.01 270 / 0.95), transparent)" }}>
        <div className="flex items-center gap-2">
          <span className="text-primary text-2xl">✦</span>
          <span className="font-display text-sm tracking-widest text-foreground/90 uppercase">
            Strawberry Studios
          </span>
        </div>
        <div className="flex items-center gap-6">
          <Link href="/venues" className="text-muted-foreground hover:text-foreground text-sm tracking-wider transition-colors uppercase font-light">
            Venues
          </Link>
          <Link href="/presets" className="text-muted-foreground hover:text-foreground text-sm tracking-wider transition-colors uppercase font-light">
            Presets
          </Link>
          {user ? (
            <Link href="/library" className="text-muted-foreground hover:text-foreground text-sm tracking-wider transition-colors uppercase font-light">
              My Library
            </Link>
          ) : null}
          {user ? (
            <Link href="/campaigns" className="text-muted-foreground hover:text-foreground text-sm tracking-wider transition-colors uppercase font-light">
              Campaigns
            </Link>
          ) : null}
          {user ? (
            <Link href="/frequency" className="text-muted-foreground hover:text-foreground text-sm tracking-wider transition-colors uppercase font-light">
              My Frequency
            </Link>
          ) : null}
          {user ? (
            <Link href="/create"
              className="px-5 py-2 text-sm tracking-widest uppercase font-medium border border-primary text-primary hover:bg-primary hover:text-primary-foreground transition-all duration-300">
              Produce
            </Link>
          ) : (
            <SignInButton />
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-screen flex flex-col items-center justify-center text-center px-6 overflow-hidden">
        {/* Atmospheric background layers */}
        <div className="absolute inset-0 pointer-events-none">
          {/* Deep noir gradient */}
          <div className="absolute inset-0"
            style={{
              background: "radial-gradient(ellipse 80% 60% at 50% 60%, oklch(0.14 0.04 18 / 0.25) 0%, transparent 70%)"
            }} />
          {/* Venetian blind shadow effect */}
          <div className="absolute inset-0 opacity-20"
            style={{
              backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 40px, oklch(0.08 0.01 270 / 0.8) 40px, oklch(0.08 0.01 270 / 0.8) 44px)"
            }} />
          {/* Smoke drift */}
          <div className="absolute bottom-0 left-0 right-0 h-64  opacity-30"
            style={{
              background: "linear-gradient(to top, oklch(0.12 0.02 270 / 0.8), transparent)"
            }} />
          {/* Amber rim light from below */}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2/3 h-32 opacity-20"
            style={{
              background: "radial-gradient(ellipse at center bottom, oklch(0.62 0.14 55 / 0.6), transparent 70%)"
            }} />
        </div>

        {/* Letterbox bars */}
        <div className="absolute top-0 left-0 right-0 h-16 bg-background z-10" />
        <div className="absolute bottom-0 left-0 right-0 h-12 bg-background z-10" />

        {/* Content */}
        <div className="relative z-20 max-w-4xl mx-auto">
          {/* Eyebrow */}
          <p className="animate-fade-up delay-100 text-xs tracking-[0.4em] uppercase text-primary/80 mb-6 font-light">
            Strawberry Riff Presents
          </p>

          {/* Main title */}
          <h1 className="animate-fade-up delay-200 font-display text-5xl md:text-7xl lg:text-8xl text-foreground mb-2 leading-none glow-text-primary">
            Strawberry
          </h1>
          <h1 className="animate-fade-up delay-300 font-display text-5xl md:text-7xl lg:text-8xl text-foreground mb-8 leading-none">
            Studios
          </h1>

          {/* Tagline */}
          <div className="animate-fade-up delay-400 flex items-center justify-center gap-4 mb-6">
            <div className="h-px w-16 bg-gradient-to-r from-transparent to-primary/60" />
            <p className="font-serif text-xl md:text-2xl italic text-accent tracking-wider">
              {TAGLINE}
            </p>
            <div className="h-px w-16 bg-gradient-to-l from-transparent to-primary/60" />
          </div>

          {/* Sub tagline */}
          <p className="animate-fade-up delay-500 text-muted-foreground text-base md:text-lg max-w-2xl mx-auto leading-relaxed font-light mb-12">
            {SUB_TAGLINE}
          </p>

          {/* CTA Buttons */}
          <div className="animate-fade-up delay-500 flex flex-col sm:flex-row gap-4 justify-center items-center">
            {user ? (
              <Link href="/create"
                className="group relative px-10 py-4 bg-primary text-primary-foreground font-display text-sm tracking-[0.2em] uppercase hover:bg-primary/90 transition-all duration-300 glow-primary">
                <span className="relative z-10">Enter the Studio</span>
              </Link>
            ) : (
              <SignInButton className="group relative px-10 py-4 bg-primary text-primary-foreground font-display text-sm tracking-[0.2em] uppercase hover:bg-primary/90 transition-all duration-300 glow-primary" />
            )}
            <Link href="/venues"
              className="px-10 py-4 border border-foreground/20 text-foreground/70 font-display text-sm tracking-[0.2em] uppercase hover:border-foreground/50 hover:text-foreground transition-all duration-300">
              Explore Venues
            </Link>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2 opacity-40">
          <span className="text-xs tracking-widest uppercase text-muted-foreground">Scroll</span>
          <div className="w-px h-8 bg-gradient-to-b from-muted-foreground to-transparent" />
        </div>
      </section>

      {/* Featured Venue — Velvet Strawberry Jazz Club */}
      <section className="relative py-32 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            {/* Venue visual */}
            <div className="relative">
              <div className="relative aspect-[4/3] overflow-hidden"
                style={{
                  background: "linear-gradient(135deg, oklch(0.10 0.02 18) 0%, oklch(0.07 0.01 270) 100%)",
                  border: "1px solid oklch(0.52 0.22 18 / 0.3)"
                }}>
                {/* Atmospheric interior */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-8xl mb-4 opacity-20 ">🎷</div>
                    <div className="w-32 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent mx-auto" />
                  </div>
                </div>
                {/* Venetian cage shadow overlay */}
                <div className="absolute inset-0 opacity-30"
                  style={{
                    backgroundImage: "repeating-linear-gradient(90deg, transparent, transparent 20px, oklch(0.08 0.01 270 / 0.9) 20px, oklch(0.08 0.01 270 / 0.9) 22px)"
                  }} />
                {/* Amber footlight glow */}
                <div className="absolute bottom-0 left-0 right-0 h-24"
                  style={{
                    background: "linear-gradient(to top, oklch(0.62 0.14 55 / 0.3), transparent)"
                  }} />
                {/* Status badge */}
                <div className="absolute top-4 right-4 flex items-center gap-2 px-3 py-1"
                  style={{ background: "oklch(0.08 0.01 270 / 0.9)", border: "1px solid oklch(0.52 0.22 18 / 0.4)" }}>
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  <span className="text-xs tracking-widest uppercase text-primary font-light">Live</span>
                </div>
              </div>
              {/* Rim light effect */}
              <div className="absolute -bottom-2 left-4 right-4 h-4 blur-xl opacity-40"
                style={{ background: "oklch(0.62 0.14 55 / 0.6)" }} />
            </div>

            {/* Venue description */}
            <div>
              <p className="text-xs tracking-[0.4em] uppercase text-primary/70 mb-4 font-light">
                Featured Venue
              </p>
              <h2 className="font-display text-3xl md:text-4xl text-foreground mb-6 leading-tight">
                Velvet Strawberry<br />Jazz Club
              </h2>
              <div className="w-16 h-px bg-primary/60 mb-6" />
              <p className="text-muted-foreground leading-relaxed mb-8 font-serif text-lg">
                A subterranean jazz club draped in velvet and shadow. Venetian cage lighting casts geometric patterns across the stage as atmospheric haze drifts toward the ceiling. This is where noir meets music — and where your performance becomes cinema.
              </p>

              {/* Preset tags */}
              <div className="flex flex-wrap gap-2 mb-8">
                {["Shadow and Smoke", "Golden Rim", "Venetian Cage", "Match Flare"].map(preset => (
                  <span key={preset}
                    className="px-3 py-1 text-xs tracking-wider uppercase font-light"
                    style={{
                      border: "1px solid oklch(0.62 0.14 55 / 0.3)",
                      color: "oklch(0.62 0.14 55 / 0.9)",
                      background: "oklch(0.62 0.14 55 / 0.05)"
                    }}>
                    {preset}
                  </span>
                ))}
              </div>

              {user ? (
                <Link href="/create/velvet-strawberry-jazz-club"
                  className="inline-flex items-center gap-3 px-8 py-3 border border-primary text-primary hover:bg-primary hover:text-primary-foreground transition-all duration-300 font-display text-sm tracking-widest uppercase">
                  Produce Here
                  <span>→</span>
                </Link>
              ) : (
                <button
                  onClick={() => { const clerk = require('@clerk/react').useClerk(); clerk.openSignIn(); }}
                  className="inline-flex items-center gap-3 px-8 py-3 border border-primary text-primary hover:bg-primary hover:text-primary-foreground transition-all duration-300 font-display text-sm tracking-widest uppercase">
                  Produce Here
                  <span>→</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Coming Soon Venues */}
      <section className="py-24 px-6"
        style={{ background: "linear-gradient(to bottom, transparent, oklch(0.10 0.01 270 / 0.5), transparent)" }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs tracking-[0.4em] uppercase text-primary/70 mb-4 font-light">The Venue Collection</p>
            <h2 className="font-display text-3xl md:text-4xl text-foreground">More Worlds Coming</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {[
              {
                name: "Strawberry in the Round",
                desc: "A 360° immersive performance space where the audience surrounds the artist. Intimate. Exposed. Electric.",
                icon: "⭕"
              },
              {
                name: "Berries on the Rocks",
                desc: "An outdoor amphitheater carved into volcanic rock. Raw natural acoustics meet cinematic night sky.",
                icon: "🪨"
              }
            ].map(venue => (
              <div key={venue.name} className="relative p-8 studios-card opacity-60">
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <span className="text-6xl opacity-5">{venue.icon}</span>
                </div>
                <div className="relative">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="px-2 py-0.5 text-xs tracking-widest uppercase border border-muted-foreground/30 text-muted-foreground/60">
                      Coming Soon
                    </span>
                  </div>
                  <h3 className="font-display text-xl text-foreground/70 mb-3">{venue.name}</h3>
                  <p className="text-muted-foreground/60 font-serif text-base leading-relaxed">{venue.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-32 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-20">
            <p className="text-xs tracking-[0.4em] uppercase text-primary/70 mb-4 font-light">The Process</p>
            <h2 className="font-display text-3xl md:text-4xl text-foreground">From Track to Cinema</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {[
              { step: "01", title: "Upload Your Track", desc: "M4A, MP3, or WAV. Trim, normalize, and set your entry point." },
              { step: "02", title: "Choose Your Vibe", desc: "Intimate Jazz. High Energy. Noir Smoke. Or define your own." },
              { step: "03", title: "Consult the Council", desc: "Our Expert Council translates your vision into Cinématique prompts." },
              { step: "04", title: "Receive the Package", desc: "A complete Director's Package — shot list, prompts, and production script." },
            ].map((item, i) => (
              <div key={item.step} className="relative text-center">
                {/* Connector line */}
                {i < 3 && (
                  <div className="hidden md:block absolute top-6 left-1/2 w-full h-px"
                    style={{ background: "linear-gradient(to right, oklch(0.52 0.22 18 / 0.4), transparent)" }} />
                )}
                <div className="relative">
                  <div className="w-12 h-12 mx-auto mb-4 flex items-center justify-center step-active rounded-full">
                    <span className="font-display text-xs text-primary-foreground">{item.step}</span>
                  </div>
                  <h4 className="font-serif text-lg text-foreground mb-2">{item.title}</h4>
                  <p className="text-muted-foreground text-sm leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Resident Characters */}
      <section className="py-24 px-6"
        style={{ background: "oklch(0.10 0.01 270 / 0.5)" }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs tracking-[0.4em] uppercase text-primary/70 mb-4 font-light">The Cast</p>
            <h2 className="font-display text-3xl text-foreground">Resident Characters</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto">
            {[
              {
                name: "The Red Head Singer",
                desc: "Velvet voice, crimson hair, and a gaze that cuts through smoke. She owns every stage she steps onto.",
                role: "Lead Vocalist"
              },
              {
                name: "The Fedora Man",
                desc: "He arrives late and leaves early. The brim of his hat hides everything except what he wants you to see.",
                role: "Mysterious Figure"
              }
            ].map(char => (
              <div key={char.name} className="studios-card p-8">
                <div className="w-16 h-16 rounded-full mb-6 flex items-center justify-center animate-pulse-ring"
                  style={{
                    background: "linear-gradient(135deg, oklch(0.18 0.04 18), oklch(0.12 0.02 55))",
                    border: "1px solid oklch(0.62 0.14 55 / 0.4)"
                  }}>
                  <span className="text-2xl opacity-60">👤</span>
                </div>
                <span className="text-xs tracking-widest uppercase text-accent/70 font-light">{char.role}</span>
                <h4 className="font-display text-lg text-foreground mt-2 mb-3">{char.name}</h4>
                <p className="text-muted-foreground font-serif text-base leading-relaxed italic">{char.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-32 px-6 text-center relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0"
            style={{ background: "radial-gradient(ellipse 60% 50% at 50% 50%, oklch(0.14 0.04 18 / 0.2), transparent)" }} />
        </div>
        <div className="relative max-w-2xl mx-auto">
          <p className="text-xs tracking-[0.4em] uppercase text-primary/70 mb-6 font-light">
            Strawberry Riff Platinum
          </p>
          <h2 className="font-display text-4xl md:text-5xl text-foreground mb-6">
            Your Stage Awaits
          </h2>
          <p className="text-muted-foreground font-serif text-lg mb-10 leading-relaxed">
            Independent artists deserve world-class production. Strawberry Studios is your distributed Hollywood — no budget required, no gatekeepers.
          </p>
          {user ? (
            <Link href="/create"
              className="inline-flex items-center gap-3 px-12 py-5 bg-primary text-primary-foreground font-display text-sm tracking-[0.2em] uppercase hover:bg-primary/90 transition-all duration-300 glow-primary">
              Begin Production
            </Link>
          ) : (
            <a href={getLoginUrl()}
              className="inline-flex items-center gap-3 px-12 py-5 bg-primary text-primary-foreground font-display text-sm tracking-[0.2em] uppercase hover:bg-primary/90 transition-all duration-300 glow-primary">
              Begin Production
            </a>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-border/30">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-primary">✦</span>
            <span className="font-display text-xs tracking-widest uppercase text-muted-foreground">
              Strawberry Studios
            </span>
          </div>
          <p className="text-muted-foreground/50 text-xs tracking-wider">
            Part of the Strawberry Riff ecosystem. A virtual performance venue for independent artists.
          </p>
          <div className="flex gap-6">
            <Link href="/venues" className="text-muted-foreground/50 hover:text-muted-foreground text-xs tracking-wider uppercase transition-colors">Venues</Link>
            <Link href="/presets" className="text-muted-foreground/50 hover:text-muted-foreground text-xs tracking-wider uppercase transition-colors">Presets</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
