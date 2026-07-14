#!/usr/bin/env python3
"""
analyze_audio.py — Music Video Pipeline Audio Analyzer
=======================================================
Analyzes an audio file and outputs a JSON object to stdout.

Usage:
    python3 analyze_audio.py <audio_file_path>

Output JSON schema:
{
  "tempoBpm": number,
  "beatGrid": number[],          // beat timestamps in seconds
  "sections": [                  // detected song sections
    { "label": string, "startSeconds": number, "endSeconds": number }
  ],
  "energyEnvelope": [            // RMS energy sampled at 1s intervals
    { "timeSeconds": number, "rms": number }
  ],
  "durationSeconds": number
}

Exit codes:
  0 = success (JSON on stdout)
  1 = error (error message on stderr)
"""

import sys
import json
import os
import warnings

# Suppress librosa/numba deprecation noise
warnings.filterwarnings("ignore")
os.environ.setdefault("NUMBA_DISABLE_JIT", "0")


def analyze(audio_path: str) -> dict:
    import librosa
    import numpy as np

    # Load audio — mono, native sample rate (up to 44100 Hz)
    y, sr = librosa.load(audio_path, sr=None, mono=True)
    duration = librosa.get_duration(y=y, sr=sr)

    # ── Tempo and beat grid ────────────────────────────────────────────────────
    tempo_arr, beat_frames = librosa.beat.beat_track(y=y, sr=sr, units="frames")
    tempo_bpm = float(tempo_arr) if hasattr(tempo_arr, "__len__") else float(tempo_arr)
    beat_times = librosa.frames_to_time(beat_frames, sr=sr).tolist()

    # ── Section boundaries via novelty-curve segmentation ─────────────────────
    # Use spectral novelty (onset strength envelope) + recurrence matrix
    # for robust section detection across genres.
    hop_length = 512
    mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=12, hop_length=hop_length)
    # Normalise per-coefficient
    mfcc_norm = librosa.util.normalize(mfcc, axis=1)

    # Build recurrence matrix and lag-pad for structural segmentation
    R = librosa.segment.recurrence_matrix(
        mfcc_norm, width=3, mode="affinity", sym=True
    )
    # Enhance diagonal (self-similarity)
    R_enhanced = librosa.segment.path_enhance(R, 15)

    # Laplacian segmentation — aim for 4–10 segments
    n_segments = max(4, min(10, int(duration / 15)))
    try:
        bounds_frames, _ = librosa.segment.agglomerative(R_enhanced, n_segments)
    except Exception:
        # Fallback: evenly spaced segments every ~20s
        step = max(1, int(20 * sr / hop_length))
        bounds_frames = list(range(0, R_enhanced.shape[0], step))

    bounds_times = librosa.frames_to_time(bounds_frames, sr=sr, hop_length=hop_length)
    # Ensure we start at 0 and end at duration
    bounds_times = sorted(set([0.0] + list(bounds_times) + [duration]))

    # Label sections heuristically based on position and energy
    rms_full = librosa.feature.rms(y=y, hop_length=hop_length)[0]
    rms_times = librosa.frames_to_time(
        range(len(rms_full)), sr=sr, hop_length=hop_length
    )

    def mean_energy_in_window(t_start: float, t_end: float) -> float:
        mask = (rms_times >= t_start) & (rms_times < t_end)
        vals = rms_full[mask]
        return float(np.mean(vals)) if len(vals) > 0 else 0.0

    global_mean_rms = float(np.mean(rms_full))
    n_segs = len(bounds_times) - 1
    sections = []
    for i in range(n_segs):
        t_start = float(bounds_times[i])
        t_end = float(bounds_times[i + 1])
        seg_energy = mean_energy_in_window(t_start, t_end)
        rel_pos = i / max(n_segs - 1, 1)  # 0.0 = first, 1.0 = last

        # Heuristic labelling
        if i == 0:
            label = "intro"
        elif i == n_segs - 1:
            label = "outro"
        elif rel_pos < 0.25:
            label = "verse"
        elif 0.25 <= rel_pos < 0.5:
            label = "chorus" if seg_energy >= global_mean_rms else "verse"
        elif 0.5 <= rel_pos < 0.75:
            label = "bridge" if seg_energy < global_mean_rms * 0.85 else "chorus"
        else:
            label = "verse"

        sections.append({
            "label": label,
            "startSeconds": round(t_start, 3),
            "endSeconds": round(t_end, 3),
        })

    # ── Energy envelope (1-second RMS samples) ────────────────────────────────
    # Compute RMS in 1-second windows for the energy curve
    frame_length = sr  # 1 second
    hop_1s = sr        # non-overlapping
    rms_1s = librosa.feature.rms(
        y=y, frame_length=frame_length, hop_length=hop_1s
    )[0]
    energy_envelope = [
        {"timeSeconds": round(float(i), 3), "rms": round(float(v), 6)}
        for i, v in enumerate(rms_1s)
        if i < int(duration) + 1
    ]

    return {
        "tempoBpm": round(tempo_bpm, 2),
        "beatGrid": [round(t, 3) for t in beat_times],
        "sections": sections,
        "energyEnvelope": energy_envelope,
        "durationSeconds": round(duration, 3),
    }


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: analyze_audio.py <audio_file_path>"}))
        sys.exit(1)

    audio_path = sys.argv[1]
    if not os.path.exists(audio_path):
        print(json.dumps({"error": f"File not found: {audio_path}"}))
        sys.exit(1)

    try:
        result = analyze(audio_path)
        print(json.dumps(result))
        sys.exit(0)
    except Exception as exc:
        import traceback
        print(json.dumps({
            "error": str(exc),
            "traceback": traceback.format_exc(),
        }), file=sys.stderr)
        sys.exit(1)
