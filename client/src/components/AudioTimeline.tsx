/**
 * AudioTimeline.tsx
 * =================
 * Visual timeline that maps music video shots against the audio waveform and beat grid.
 *
 * Renders:
 *  - Energy waveform (RMS bars across the song duration)
 *  - Beat tick marks from the librosa beat grid
 *  - Section bands (intro/verse/chorus/bridge/outro) with colour coding
 *  - Shot cards positioned proportionally by startTimeSeconds / totalDuration
 *
 * All positioning is purely CSS-based (percentage widths/lefts) — no canvas required.
 */

import React, { useMemo } from "react";

// ─── Types (mirrored from server) ─────────────────────────────────────────────

interface AudioSection {
  label: string;
  startSeconds: number;
  endSeconds: number;
}

interface AudioStructure {
  bpm: number;
  beatTimestamps: number[];
  sections: AudioSection[];
  energyCurve: number[];
  energyWindowSeconds: number;
  durationSeconds: number;
}

interface ShotCard {
  shotIndex: number;
  description: string;
  startTimeSeconds: number;
  targetDurationSeconds: number;
  videoStatus: string;
  sectionLabel?: string;
}

interface AudioTimelineProps {
  audioStructure: AudioStructure;
  shots: ShotCard[];
  totalDurationSeconds: number;
  /** Called when a shot card is clicked */
  onShotClick?: (shotIndex: number) => void;
  /** Index of the currently selected/focused shot */
  selectedShotIndex?: number | null;
}

// ─── Section colour palette ───────────────────────────────────────────────────

const SECTION_COLORS: Record<string, { bg: string; border: string; label: string }> = {
  intro:        { bg: "oklch(0.28 0.06 270 / 0.35)", border: "oklch(0.55 0.12 270 / 0.7)", label: "oklch(0.75 0.12 270)" },
  verse:        { bg: "oklch(0.28 0.08 18 / 0.30)",  border: "oklch(0.52 0.22 18 / 0.6)",  label: "oklch(0.72 0.18 18)"  },
  chorus:       { bg: "oklch(0.30 0.10 55 / 0.35)",  border: "oklch(0.62 0.14 55 / 0.7)",  label: "oklch(0.78 0.14 55)"  },
  bridge:       { bg: "oklch(0.28 0.07 310 / 0.30)", border: "oklch(0.55 0.14 310 / 0.6)", label: "oklch(0.72 0.14 310)" },
  outro:        { bg: "oklch(0.26 0.05 240 / 0.30)", border: "oklch(0.50 0.10 240 / 0.6)", label: "oklch(0.68 0.10 240)" },
  instrumental: { bg: "oklch(0.28 0.06 160 / 0.30)", border: "oklch(0.52 0.12 160 / 0.6)", label: "oklch(0.70 0.12 160)" },
  other:        { bg: "oklch(0.24 0.03 270 / 0.25)", border: "oklch(0.45 0.06 270 / 0.5)", label: "oklch(0.60 0.06 270)" },
};

function getSectionColor(label: string) {
  return SECTION_COLORS[label.toLowerCase()] ?? SECTION_COLORS.other;
}

// ─── Shot status colours ──────────────────────────────────────────────────────

function getShotStatusColor(status: string): string {
  switch (status) {
    case "complete":   return "oklch(0.62 0.14 55)";
    case "generating": return "oklch(0.62 0.14 270)";
    case "failed":     return "oklch(0.55 0.22 18)";
    case "pending":    return "oklch(0.45 0.06 270)";
    default:           return "oklch(0.40 0.04 270)";
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AudioTimeline({
  audioStructure,
  shots,
  totalDurationSeconds,
  onShotClick,
  selectedShotIndex,
}: AudioTimelineProps) {
  const duration = totalDurationSeconds || audioStructure.durationSeconds || 1;

  // Normalise energy curve to 0–1 range for display
  const normEnergy = useMemo(() => {
    const curve = audioStructure.energyCurve ?? [];
    if (curve.length === 0) return [];
    const max = Math.max(...curve, 0.001);
    return curve.map((v) => v / max);
  }, [audioStructure.energyCurve]);

  // Beat tick positions as percentages
  const beatPcts = useMemo(() => {
    return (audioStructure.beatTimestamps ?? []).map((t) => (t / duration) * 100);
  }, [audioStructure.beatTimestamps, duration]);

  // Section bands
  const sections = audioStructure.sections ?? [];

  // Sort shots by index
  const sortedShots = useMemo(
    () => [...shots].sort((a, b) => a.shotIndex - b.shotIndex),
    [shots]
  );

  return (
    <div className="w-full select-none" style={{ fontFamily: "var(--font-sans)" }}>
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs tracking-widest uppercase font-light" style={{ color: "oklch(0.55 0.06 270)" }}>
          Audio Timeline
        </span>
        <span className="text-xs font-mono" style={{ color: "oklch(0.50 0.04 270)" }}>
          {audioStructure.bpm > 0 ? `${Math.round(audioStructure.bpm)} BPM` : ""}
          {audioStructure.bpm > 0 && duration > 0 ? "  ·  " : ""}
          {duration > 0 ? `${Math.floor(duration / 60)}:${String(Math.round(duration % 60)).padStart(2, "0")}` : ""}
        </span>
      </div>

      {/* ── Timeline track ── */}
      <div
        className="relative w-full rounded overflow-hidden"
        style={{
          height: "120px",
          background: "oklch(0.10 0.02 270 / 0.8)",
          border: "1px solid oklch(0.22 0.04 270 / 0.6)",
        }}
      >
        {/* Section bands */}
        {sections.map((sec, i) => {
          const left = (sec.startSeconds / duration) * 100;
          const width = ((sec.endSeconds - sec.startSeconds) / duration) * 100;
          const color = getSectionColor(sec.label);
          return (
            <div
              key={i}
              className="absolute top-0 bottom-0"
              style={{
                left: `${left}%`,
                width: `${width}%`,
                background: color.bg,
                borderRight: `1px solid ${color.border}`,
              }}
            >
              <span
                className="absolute top-1 left-1 text-[9px] tracking-widest uppercase font-light truncate"
                style={{ color: color.label, maxWidth: "90%" }}
              >
                {sec.label}
              </span>
            </div>
          );
        })}

        {/* Energy waveform bars */}
        {normEnergy.length > 0 && (
          <div className="absolute inset-x-0 bottom-0 flex items-end" style={{ height: "50px", gap: "1px", padding: "0 1px" }}>
            {normEnergy.map((v, i) => (
              <div
                key={i}
                className="flex-1 min-w-0"
                style={{
                  height: `${Math.max(v * 100, 4)}%`,
                  background: `oklch(0.52 0.22 18 / ${0.3 + v * 0.5})`,
                  borderRadius: "1px 1px 0 0",
                }}
              />
            ))}
          </div>
        )}

        {/* Beat tick marks */}
        {beatPcts.map((pct, i) => (
          <div
            key={i}
            className="absolute bottom-0"
            style={{
              left: `${pct}%`,
              width: "1px",
              height: "8px",
              background: "oklch(0.62 0.14 55 / 0.4)",
            }}
          />
        ))}

        {/* Shot cards on timeline */}
        {sortedShots.map((shot) => {
          const left = (shot.startTimeSeconds / duration) * 100;
          const width = (shot.targetDurationSeconds / duration) * 100;
          const isSelected = selectedShotIndex === shot.shotIndex;
          const statusColor = getShotStatusColor(shot.videoStatus);

          return (
            <div
              key={shot.shotIndex}
              className="absolute top-2 cursor-pointer transition-all duration-150"
              style={{
                left: `${left}%`,
                width: `${Math.max(width, 3)}%`,
                height: "60px",
                background: isSelected
                  ? "oklch(0.18 0.06 270 / 0.95)"
                  : "oklch(0.14 0.04 270 / 0.90)",
                border: `1px solid ${isSelected ? "oklch(0.62 0.14 55 / 0.9)" : statusColor + " / 0.6"}`,
                borderRadius: "3px",
                overflow: "hidden",
                boxShadow: isSelected ? `0 0 8px ${statusColor} / 0.4` : "none",
              }}
              onClick={() => onShotClick?.(shot.shotIndex)}
              title={`Shot ${shot.shotIndex + 1}: ${shot.description}`}
            >
              {/* Shot number badge */}
              <div
                className="absolute top-0 left-0 px-1 text-[8px] font-mono font-bold"
                style={{
                  background: statusColor,
                  color: "oklch(0.08 0.01 270)",
                  borderRadius: "2px 0 2px 0",
                }}
              >
                {shot.shotIndex + 1}
              </div>

              {/* Shot description (truncated) */}
              <p
                className="absolute bottom-1 left-1 right-1 text-[8px] leading-tight truncate"
                style={{ color: "oklch(0.65 0.06 270)" }}
              >
                {shot.description}
              </p>

              {/* Status dot */}
              <div
                className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full"
                style={{ background: statusColor }}
              />
            </div>
          );
        })}
      </div>

      {/* ── Time ruler ── */}
      <div className="relative w-full mt-1" style={{ height: "16px" }}>
        {Array.from({ length: Math.ceil(duration / 30) + 1 }, (_, i) => {
          const t = i * 30;
          if (t > duration) return null;
          const pct = (t / duration) * 100;
          const mins = Math.floor(t / 60);
          const secs = t % 60;
          return (
            <span
              key={i}
              className="absolute text-[9px] font-mono"
              style={{
                left: `${pct}%`,
                transform: "translateX(-50%)",
                color: "oklch(0.45 0.04 270)",
              }}
            >
              {mins}:{String(secs).padStart(2, "0")}
            </span>
          );
        })}
      </div>

      {/* ── Section legend ── */}
      {sections.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {Array.from(new Set(sections.map((s) => s.label.toLowerCase()))).map((label) => {
            const color = getSectionColor(label);
            return (
              <div key={label} className="flex items-center gap-1">
                <div
                  className="w-2 h-2 rounded-sm"
                  style={{ background: color.border }}
                />
                <span className="text-[9px] tracking-wider uppercase font-light" style={{ color: color.label }}>
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default AudioTimeline;
