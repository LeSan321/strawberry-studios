/**
 * MusicVideos.tsx — Music Video Generation Pipeline UI
 * =====================================================
 * Three views in one page:
 *   1. List view — all music video projects for the user
 *   2. New video form — Riff track selector + frequency toggle + create & plan
 *   3. Project detail — audio timeline, storyboard review gate, generation progress, delivery
 */

import { useState, useMemo } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AudioTimeline } from "@/components/AudioTimeline";

// ─── Types ────────────────────────────────────────────────────────────────────

type MusicVideoStatus =
  | "draft"
  | "analyzing_audio"
  | "planning"
  | "awaiting_review"
  | "generating_shots"
  | "lip_syncing"
  | "assembling"
  | "complete"
  | "failed";

const STATUS_LABELS: Record<MusicVideoStatus, string> = {
  draft: "Draft",
  analyzing_audio: "Analyzing Audio…",
  planning: "Planning Shots…",
  awaiting_review: "Ready for Review",
  generating_shots: "Generating Shots…",
  lip_syncing: "Lip Syncing…",
  assembling: "Assembling…",
  complete: "Complete",
  failed: "Failed",
};

const STATUS_COLORS: Record<MusicVideoStatus, string> = {
  draft: "bg-zinc-700 text-zinc-200",
  analyzing_audio: "bg-amber-900/60 text-amber-200",
  planning: "bg-amber-900/60 text-amber-200",
  awaiting_review: "bg-violet-900/60 text-violet-200",
  generating_shots: "bg-blue-900/60 text-blue-200",
  lip_syncing: "bg-blue-900/60 text-blue-200",
  assembling: "bg-blue-900/60 text-blue-200",
  complete: "bg-emerald-900/60 text-emerald-200",
  failed: "bg-red-900/60 text-red-200",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const s = status as MusicVideoStatus;
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[s] ?? "bg-zinc-700 text-zinc-200"}`}
    >
      {STATUS_LABELS[s] ?? status}
    </span>
  );
}

function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// ─── New Video Form ───────────────────────────────────────────────────────────

function NewVideoForm({ onCreated }: { onCreated: (id: number) => void }) {
  const [title, setTitle] = useState("");
  const [artistName, setArtistName] = useState("");
  const [audioMode, setAudioMode] = useState<"riff" | "url">("riff");
  const [selectedRiffTrackId, setSelectedRiffTrackId] = useState<number | null>(null);
  const [audioUrl, setAudioUrl] = useState("");
  const [useMyFrequency, setUseMyFrequency] = useState(true);
  const [lyrics, setLyrics] = useState("");
  const [genreDescription, setGenreDescription] = useState("");

  // Fetch Riff tracks for the selector
  const { data: riffTracksData, isLoading: riffTracksLoading, error: riffTracksError } =
    trpc.musicVideo.getRiffTracks.useQuery(undefined, {
      retry: false,
      staleTime: 60_000,
    });

  const riffTracks = riffTracksData?.tracks ?? [];

  const utils = trpc.useUtils();
  const createMutation = trpc.musicVideo.create.useMutation({
    onError: (err) => toast.error(`Failed to create project: ${err.message}`),
  });
  const analyzeMutation = trpc.musicVideo.analyze.useMutation({
    onError: (err) => toast.error(`Audio analysis failed: ${err.message}`),
  });
  const planMutation = trpc.musicVideo.plan.useMutation({
    onSuccess: () => utils.musicVideo.list.invalidate(),
    onError: (err) => toast.error(`Shot planning failed: ${err.message}`),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }

    // Determine audio source
    const selectedTrack = riffTracks.find((t) => t.id === selectedRiffTrackId);
    const hasRiffTrack = audioMode === "riff" && selectedRiffTrackId !== null;
    const hasDirectUrl = audioMode === "url" && audioUrl.trim().length > 0;

    try {
      // Step 1: Create project (bridge resolves audioUrl server-side if riffTrackId is set)
      const result = await createMutation.mutateAsync({
        title: title.trim(),
        artistName: artistName.trim() || undefined,
        riffTrackId: hasRiffTrack ? selectedRiffTrackId! : undefined,
        riffTrackTitle: hasRiffTrack && selectedTrack ? selectedTrack.title : undefined,
        audioUrl: hasDirectUrl ? audioUrl.trim() : undefined,
        useMyFrequency,
        lyrics: lyrics.trim() || undefined,
        genreDescription: genreDescription.trim() ||
          (hasRiffTrack && selectedTrack ? selectedTrack.genre : undefined),
        durationSeconds: hasRiffTrack && selectedTrack ? selectedTrack.duration : undefined,
      });

      const { id, resolvedAudioUrl } = result;
      toast.info("Project created. Starting audio analysis…");

      // Step 2: Analyze audio
      const effectiveAudioUrl = resolvedAudioUrl ?? (hasDirectUrl ? audioUrl.trim() : null);
      if (effectiveAudioUrl) {
        await analyzeMutation.mutateAsync({ musicVideoId: id, audioUrl: effectiveAudioUrl });
        toast.info("Audio analyzed. Planning shots…");

        // Step 3: Plan shots
        await planMutation.mutateAsync({ musicVideoId: id });
        toast.success("Shot plan ready for review!");
      } else {
        toast.success("Project created. Select a track or add an audio URL to continue.");
      }

      await utils.musicVideo.list.invalidate();
      onCreated(id);
    } catch {
      // Errors handled by individual mutation onError handlers
    }
  };

  const isLoading =
    createMutation.isPending || analyzeMutation.isPending || planMutation.isPending;

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Title */}
      <div className="space-y-1.5">
        <Label htmlFor="mv-title">Song Title *</Label>
        <Input
          id="mv-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Midnight Signal"
          disabled={isLoading}
          className="bg-zinc-900 border-zinc-700"
        />
      </div>

      {/* Artist */}
      <div className="space-y-1.5">
        <Label htmlFor="mv-artist">Artist Name</Label>
        <Input
          id="mv-artist"
          value={artistName}
          onChange={(e) => setArtistName(e.target.value)}
          placeholder="e.g. The Frequency Collective"
          disabled={isLoading}
          className="bg-zinc-900 border-zinc-700"
        />
      </div>

      {/* Audio source toggle */}
      <div className="space-y-3">
        <Label>Audio Source</Label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setAudioMode("riff")}
            className={`flex-1 py-2 px-3 rounded text-sm transition-colors ${
              audioMode === "riff"
                ? "bg-primary text-primary-foreground"
                : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
            }`}
            disabled={isLoading}
          >
            🍓 From Riff Library
          </button>
          <button
            type="button"
            onClick={() => setAudioMode("url")}
            className={`flex-1 py-2 px-3 rounded text-sm transition-colors ${
              audioMode === "url"
                ? "bg-primary text-primary-foreground"
                : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
            }`}
            disabled={isLoading}
          >
            Direct URL
          </button>
        </div>

        {audioMode === "riff" && (
          <div className="space-y-1.5">
            {riffTracksLoading ? (
              <div className="flex items-center gap-2 text-sm text-zinc-500 py-2">
                <span className="h-3 w-3 rounded-full border-2 border-zinc-500/30 border-t-zinc-500 animate-spin" />
                Loading your Riff library…
              </div>
            ) : riffTracksError || riffTracksData?.error ? (
              <div className="text-xs text-amber-400 bg-amber-950/30 border border-amber-900/40 rounded p-2">
                Could not load Riff library. You can still use a direct URL below.
              </div>
            ) : riffTracks.length === 0 ? (
              <div className="text-xs text-zinc-500 bg-zinc-900/50 border border-zinc-800 rounded p-3">
                No tracks in your Riff library yet.{" "}
                <a
                  href="https://strawberryriff.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Create or upload a track on Riff
                </a>{" "}
                to use it here.
              </div>
            ) : (
              <Select
                value={selectedRiffTrackId?.toString() ?? ""}
                onValueChange={(v) => setSelectedRiffTrackId(Number(v))}
                disabled={isLoading}
              >
                <SelectTrigger className="bg-zinc-900 border-zinc-700">
                  <SelectValue placeholder="Select a track from your Riff library…" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-700">
                  {riffTracks.map((track) => (
                    <SelectItem key={track.id} value={track.id.toString()}>
                      <div className="flex items-center gap-2">
                        {track.coverArtUrl && (
                          <img
                            src={track.coverArtUrl}
                            alt=""
                            className="w-6 h-6 rounded object-cover shrink-0"
                          />
                        )}
                        <span className="truncate">{track.title}</span>
                        {track.genre && (
                          <span className="text-xs text-zinc-500 shrink-0">{track.genre}</span>
                        )}
                        {track.duration > 0 && (
                          <span className="text-xs text-zinc-600 shrink-0 font-mono">
                            {formatDuration(track.duration)}
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        )}

        {audioMode === "url" && (
          <div className="space-y-1.5">
            <Input
              id="mv-audio"
              value={audioUrl}
              onChange={(e) => setAudioUrl(e.target.value)}
              placeholder="https://… (mp3, wav, m4a)"
              type="url"
              disabled={isLoading}
              className="bg-zinc-900 border-zinc-700"
            />
            <p className="text-xs text-zinc-600">
              Tip: You can also upload a track on{" "}
              <a
                href="https://strawberryriff.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Riff
              </a>{" "}
              and select it from your library above.
            </p>
          </div>
        )}
      </div>

      {/* Use My Frequency toggle */}
      <div className="flex items-start justify-between gap-4 p-3 bg-zinc-900/60 border border-zinc-800 rounded-lg">
        <div className="space-y-0.5">
          <Label htmlFor="mv-frequency" className="text-sm cursor-pointer">
            Use My Frequency
          </Label>
          <p className="text-xs text-zinc-500">
            Pull your visual language from Riff to steer the shot planner — colour palette, texture vocabulary, emotional arc.
          </p>
        </div>
        <Switch
          id="mv-frequency"
          checked={useMyFrequency}
          onCheckedChange={setUseMyFrequency}
          disabled={isLoading}
          className="shrink-0 mt-0.5"
        />
      </div>

      {/* Genre description */}
      <div className="space-y-1.5">
        <Label htmlFor="mv-genre">
          Visual World{" "}
          <span className="text-muted-foreground text-xs">(optional — describe the feel, not just the genre)</span>
        </Label>
        <Input
          id="mv-genre"
          value={genreDescription}
          onChange={(e) => setGenreDescription(e.target.value)}
          placeholder="e.g. Ambient electronic — vast, cold, geometric, deep space"
          disabled={isLoading}
          className="bg-zinc-900 border-zinc-700"
        />
      </div>

      {/* Lyrics */}
      <div className="space-y-1.5">
        <Label htmlFor="mv-lyrics">
          Lyrics{" "}
          <span className="text-muted-foreground text-xs">(optional — improves shot descriptions)</span>
        </Label>
        <Textarea
          id="mv-lyrics"
          value={lyrics}
          onChange={(e) => setLyrics(e.target.value)}
          placeholder="Paste full lyrics here…"
          rows={5}
          disabled={isLoading}
          className="bg-zinc-900 border-zinc-700 resize-none"
        />
      </div>

      <Button
        type="submit"
        disabled={isLoading || !title.trim()}
        className="w-full"
      >
        {isLoading ? (
          <span className="flex items-center gap-2">
            <span className="h-4 w-4 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin" />
            {createMutation.isPending
              ? "Creating project…"
              : analyzeMutation.isPending
              ? "Analyzing audio…"
              : "Planning shots…"}
          </span>
        ) : (
          "Create & Plan"
        )}
      </Button>
    </form>
  );
}

// ─── Shot Card (storyboard review) ───────────────────────────────────────────

function ShotCard({
  shot,
  musicVideoId,
  isHighlighted,
  onUpdated,
}: {
  shot: {
    id: number;
    shotIndex: number;
    segmentType: string;
    startTimeSeconds: number;
    targetDurationSeconds: number;
    description: string | null;
    cameraMovement: string | null;
    lightingNote: string | null;
    videoPrompt: string | null;
    needsLipSync: boolean;
    transitionIn: string;
    videoStatus: string;
    videoUrl: string | null;
    videoError: string | null;
  };
  musicVideoId: number;
  isHighlighted?: boolean;
  onUpdated: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [prompt, setPrompt] = useState(shot.videoPrompt ?? "");
  const [description, setDescription] = useState(shot.description ?? "");

  const updateMutation = trpc.musicVideo.updateShot.useMutation({
    onSuccess: () => {
      setEditing(false);
      onUpdated();
      toast.success(`Shot ${shot.shotIndex + 1} updated`);
    },
    onError: (err) => toast.error(`Update failed: ${err.message}`),
  });

  const handleSave = () => {
    updateMutation.mutate({
      shotId: shot.id,
      description: description.trim() || undefined,
      videoPrompt: prompt.trim() || undefined,
    });
  };

  const isGenerating = shot.videoStatus === "generating" || shot.videoStatus === "queued";
  const isComplete = shot.videoStatus === "complete";
  const isFailed = shot.videoStatus === "failed";

  return (
    <div
      id={`shot-${shot.shotIndex}`}
      className={`border rounded-lg p-4 space-y-3 transition-all ${
        isHighlighted
          ? "border-amber-600/60 bg-amber-950/20"
          : "border-zinc-800 bg-zinc-950/50"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-mono text-zinc-500">#{shot.shotIndex + 1}</span>
          <Badge variant="outline" className="text-xs capitalize border-zinc-700 text-zinc-400">
            {shot.segmentType}
          </Badge>
          <span className="text-xs text-zinc-500">{shot.startTimeSeconds}s</span>
          <span className="text-xs text-zinc-500">·</span>
          <span className="text-xs text-zinc-500">{shot.targetDurationSeconds}s clip</span>
          {shot.needsLipSync && (
            <Badge variant="outline" className="text-xs border-violet-700 text-violet-400">
              lip sync
            </Badge>
          )}
          <span className={`text-xs px-1.5 py-0.5 rounded ${
            isComplete ? "bg-emerald-900/50 text-emerald-300" :
            isFailed ? "bg-red-900/50 text-red-300" :
            isGenerating ? "bg-blue-900/50 text-blue-300" :
            "bg-zinc-800 text-zinc-400"
          }`}>
            {shot.videoStatus}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-zinc-500 hover:text-zinc-200 shrink-0"
          onClick={() => setEditing(!editing)}
        >
          {editing ? "Cancel" : "Edit"}
        </Button>
      </div>

      {editing ? (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs text-zinc-400">Description</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="bg-zinc-900 border-zinc-700 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-zinc-400">Video Prompt (Runway)</Label>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              className="bg-zinc-900 border-zinc-700 text-sm resize-none font-mono"
            />
            <p className="text-xs text-zinc-600">{prompt.length}/980 chars</p>
          </div>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className="w-full"
          >
            {updateMutation.isPending ? "Saving…" : "Save Changes"}
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {shot.description && (
            <p className="text-sm text-zinc-300">{shot.description}</p>
          )}
          {shot.cameraMovement && (
            <p className="text-xs text-zinc-500">
              <span className="text-zinc-600">Camera:</span> {shot.cameraMovement}
            </p>
          )}
          {shot.lightingNote && (
            <p className="text-xs text-zinc-500">
              <span className="text-zinc-600">Light:</span> {shot.lightingNote}
            </p>
          )}
          {shot.videoPrompt && (
            <details className="group">
              <summary className="text-xs text-zinc-600 cursor-pointer hover:text-zinc-400 select-none">
                View prompt
              </summary>
              <p className="mt-1 text-xs text-zinc-500 font-mono bg-zinc-900/50 p-2 rounded border border-zinc-800 whitespace-pre-wrap">
                {shot.videoPrompt}
              </p>
            </details>
          )}
          {isComplete && shot.videoUrl && (
            <video
              src={shot.videoUrl}
              controls
              className="w-full rounded border border-zinc-800 mt-2"
              style={{ maxHeight: 160 }}
            />
          )}
          {isFailed && shot.videoError && (
            <p className="text-xs text-red-400 bg-red-950/30 p-2 rounded border border-red-900/50">
              {shot.videoError}
            </p>
          )}
          {isGenerating && (
            <div className="flex items-center gap-2 text-xs text-blue-400">
              <span className="h-3 w-3 rounded-full border-2 border-blue-400/30 border-t-blue-400 animate-spin" />
              Generating…
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Project Detail View ──────────────────────────────────────────────────────

function ProjectDetail({
  projectId,
  onBack,
}: {
  projectId: number;
  onBack: () => void;
}) {
  const [highlightedShotIndex, setHighlightedShotIndex] = useState<number | null>(null);
  const utils = trpc.useUtils();

  const { data: project, isLoading, refetch } = trpc.musicVideo.get.useQuery(
    { id: projectId },
    {
      refetchInterval: (query) => {
        const status = query.state.data?.status;
        if (
          status === "analyzing_audio" ||
          status === "planning" ||
          status === "generating_shots" ||
          status === "assembling"
        ) {
          return 4000;
        }
        return false;
      },
    }
  );

  const approveMutation = trpc.musicVideo.approve.useMutation({
    onSuccess: () => {
      refetch();
      toast.success("Storyboard approved! Starting shot generation…");
    },
    onError: (err) => toast.error(`Approve failed: ${err.message}`),
  });

  const generateShotsMutation = trpc.musicVideo.generateShots.useMutation({
    onSuccess: () => {
      refetch();
      toast.info("Shot generation started. This may take several minutes.");
    },
    onError: (err) => toast.error(`Generation failed: ${err.message}`),
  });

  const assembleMutation = trpc.musicVideo.assemble.useMutation({
    onSuccess: () => {
      refetch();
      toast.info("Assembly started…");
    },
    onError: (err) => toast.error(`Assembly failed: ${err.message}`),
  });

  const deleteMutation = trpc.musicVideo.delete.useMutation({
    onSuccess: () => {
      utils.musicVideo.list.invalidate();
      onBack();
      toast.success("Project deleted");
    },
    onError: (err) => toast.error(`Delete failed: ${err.message}`),
  });

  // Adapt server audio structure to AudioTimeline prop shape
  const timelineAudioStructure = useMemo(() => {
    const as = project?.audioStructure;
    if (!as) return null;
    return {
      bpm: as.tempoBpm ?? 0,
      beatTimestamps: as.beatGrid ?? [],
      sections: (as.sections ?? []).map((s: { label: string; startSeconds: number; endSeconds: number }) => ({
        label: s.label,
        startSeconds: s.startSeconds,
        endSeconds: s.endSeconds,
      })),
      energyCurve: (as.energyEnvelope ?? []).map((p: { rms: number }) => p.rms),
      energyWindowSeconds: 0.5,
      durationSeconds: project?.durationSeconds ?? 0,
    };
  }, [project?.audioStructure, project?.durationSeconds]);

  const timelineShots = useMemo(() => {
    return (project?.shots ?? []).map((s) => ({
      shotIndex: s.shotIndex,
      description: s.description ?? "",
      startTimeSeconds: s.startTimeSeconds,
      targetDurationSeconds: s.targetDurationSeconds,
      videoStatus: s.videoStatus,
      sectionLabel: s.segmentType,
    }));
  }, [project?.shots]);

  const handleTimelineShotClick = (shotIndex: number) => {
    setHighlightedShotIndex(shotIndex);
    // Scroll to the shot card
    const el = document.getElementById(`shot-${shotIndex}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <span className="h-8 w-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-24 text-zinc-500">
        Project not found.{" "}
        <button onClick={onBack} className="text-primary hover:underline">
          Go back
        </button>
      </div>
    );
  }

  const status = project.status as MusicVideoStatus;
  const shots = project.shots ?? [];
  const completedShots = shots.filter((s) => s.videoStatus === "complete").length;
  const totalShots = shots.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <button
            onClick={onBack}
            className="text-xs text-zinc-500 hover:text-zinc-300 mb-2 flex items-center gap-1"
          >
            ← All Projects
          </button>
          <h2 className="text-xl font-display text-foreground">{project.title}</h2>
          {project.artistName && (
            <p className="text-sm text-zinc-400 mt-0.5">{project.artistName}</p>
          )}
          {(project as any).riffTrackTitle && (
            <p className="text-xs text-zinc-600 mt-0.5">
              🍓 Riff track: {(project as any).riffTrackTitle}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <StatusBadge status={project.status} />
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="text-xs text-zinc-600 hover:text-red-400">
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this project?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete all shots, characters, and audio analysis for "{project.title}". This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => deleteMutation.mutate({ id: projectId })}
                  className="bg-red-600 hover:bg-red-700"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Audio structure summary */}
      {project.audioStructure && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-zinc-900/50 border border-zinc-800 rounded p-3 text-center">
            <p className="text-lg font-mono text-foreground">
              {project.audioStructure.tempoBpm ?? "—"}
            </p>
            <p className="text-xs text-zinc-500 mt-0.5">BPM</p>
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800 rounded p-3 text-center">
            <p className="text-lg font-mono text-foreground">
              {formatDuration(project.durationSeconds)}
            </p>
            <p className="text-xs text-zinc-500 mt-0.5">Duration</p>
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800 rounded p-3 text-center">
            <p className="text-lg font-mono text-foreground">
              {project.audioStructure.sections?.length ?? "—"}
            </p>
            <p className="text-xs text-zinc-500 mt-0.5">Sections</p>
          </div>
        </div>
      )}

      {/* ── Audio Timeline ── */}
      {timelineAudioStructure && shots.length > 0 && (
        <Card className="border-zinc-800 bg-zinc-950/60">
          <CardContent className="pt-5 pb-4 px-5">
            <AudioTimeline
              audioStructure={timelineAudioStructure}
              shots={timelineShots}
              totalDurationSeconds={project.durationSeconds ?? timelineAudioStructure.durationSeconds}
              onShotClick={handleTimelineShotClick}
              selectedShotIndex={highlightedShotIndex}
            />
          </CardContent>
        </Card>
      )}

      {/* Pipeline status messages */}
      {(status === "analyzing_audio" || status === "planning") && (
        <div className="flex items-center gap-3 p-4 bg-amber-950/30 border border-amber-900/50 rounded-lg">
          <span className="h-5 w-5 rounded-full border-2 border-amber-400/30 border-t-amber-400 animate-spin shrink-0" />
          <p className="text-sm text-amber-300">
            {status === "analyzing_audio"
              ? "Analyzing audio with librosa — detecting tempo, beat grid, and section boundaries…"
              : "Planning shots with Claude — one shot per section, genre-aware…"}
          </p>
        </div>
      )}

      {(status === "generating_shots" || status === "assembling") && (
        <div className="flex items-center gap-3 p-4 bg-blue-950/30 border border-blue-900/50 rounded-lg">
          <span className="h-5 w-5 rounded-full border-2 border-blue-400/30 border-t-blue-400 animate-spin shrink-0" />
          <p className="text-sm text-blue-300">
            {status === "generating_shots"
              ? `Generating shots with Runway… ${completedShots}/${totalShots} complete`
              : "Assembling final video with ffmpeg…"}
          </p>
        </div>
      )}

      {status === "failed" && project.errorMessage && (
        <div className="p-4 bg-red-950/30 border border-red-900/50 rounded-lg">
          <p className="text-sm text-red-300 font-medium mb-1">Pipeline failed</p>
          <p className="text-xs text-red-400">{project.errorMessage}</p>
        </div>
      )}

      {/* Review gate — storyboard */}
      {(status === "awaiting_review" ||
        status === "generating_shots" ||
        status === "assembling" ||
        status === "complete") &&
        shots.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-zinc-300 uppercase tracking-wider">
                Shot Plan — {totalShots} shots
              </h3>
              {status === "awaiting_review" && (
                <Button
                  size="sm"
                  onClick={async () => {
                    try {
                      await approveMutation.mutateAsync({ musicVideoId: projectId });
                      await generateShotsMutation.mutateAsync({ musicVideoId: projectId });
                    } catch {
                      // Errors handled by individual mutation onError handlers
                    }
                  }}
                  disabled={approveMutation.isPending || generateShotsMutation.isPending}
                  className="bg-violet-700 hover:bg-violet-600 text-white text-xs"
                >
                  {approveMutation.isPending || generateShotsMutation.isPending
                    ? "Starting…"
                    : "✓ Approve & Generate"}
                </Button>
              )}
              {status === "assembling" && (
                <Button
                  size="sm"
                  onClick={() => assembleMutation.mutate({ musicVideoId: projectId })}
                  disabled={assembleMutation.isPending}
                  className="bg-blue-700 hover:bg-blue-600 text-white text-xs"
                >
                  {assembleMutation.isPending ? "Starting…" : "Assemble Video"}
                </Button>
              )}
            </div>

            <div className="space-y-3">
              {shots.map((shot) => (
                <ShotCard
                  key={shot.id}
                  shot={shot as any}
                  musicVideoId={projectId}
                  isHighlighted={highlightedShotIndex === shot.shotIndex}
                  onUpdated={refetch}
                />
              ))}
            </div>
          </div>
        )}

      {/* Delivery */}
      {status === "complete" && project.finalVideoUrl && (
        <div className="space-y-4 p-5 bg-emerald-950/20 border border-emerald-900/40 rounded-lg">
          <h3 className="text-sm font-medium text-emerald-300 uppercase tracking-wider">
            ✓ Music Video Complete
          </h3>
          <video
            src={project.finalVideoUrl}
            controls
            className="w-full rounded border border-emerald-900/50"
          />
          <div className="flex gap-3 flex-wrap">
            <a
              href={project.finalVideoUrl}
              download
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm bg-emerald-800 hover:bg-emerald-700 text-white rounded transition-colors"
            >
              ↓ Download MP4
            </a>
            {project.projectFileUrl && (
              <a
                href={project.projectFileUrl}
                download
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded transition-colors"
              >
                ↓ Download .mlt (Kdenlive)
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MusicVideos() {
  const { user } = useAuth();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);

  const { data: projects, isLoading } = trpc.musicVideo.list.useQuery(undefined, {
    enabled: !!user,
  });

  if (!user) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-zinc-400">Sign in to access Music Video generation.</p>
          <Link href="/" className="text-primary hover:underline text-sm">
            ← Back to home
          </Link>
        </div>
      </div>
    );
  }

  if (selectedId !== null) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <ProjectDetail projectId={selectedId} onBack={() => setSelectedId(null)} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4"
        style={{ background: "linear-gradient(to bottom, oklch(0.08 0.01 270 / 0.95), transparent)" }}
      >
        <div className="flex items-center gap-2">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-primary text-2xl">✦</span>
            <span className="font-display text-sm tracking-widest text-foreground/90 uppercase">
              Strawberry Studios
            </span>
          </Link>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/library"
            className="text-muted-foreground hover:text-foreground text-sm tracking-wider transition-colors uppercase font-light"
          >
            Library
          </Link>
          <Link
            href="/campaigns"
            className="text-muted-foreground hover:text-foreground text-sm tracking-wider transition-colors uppercase font-light"
          >
            Campaigns
          </Link>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-4 pt-24 pb-16">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-display text-foreground tracking-wide">
              Music Videos
            </h1>
            <p className="text-sm text-zinc-500 mt-1">
              AI-generated music videos — audio analysis → shot planning → Runway generation → assembly
            </p>
          </div>
          <Dialog open={showNewForm} onOpenChange={setShowNewForm}>
            <DialogTrigger asChild>
              <Button className="shrink-0">+ New Video</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>New Music Video</DialogTitle>
              </DialogHeader>
              <NewVideoForm
                onCreated={(id) => {
                  setShowNewForm(false);
                  setSelectedId(id);
                }}
              />
            </DialogContent>
          </Dialog>
        </div>

        <Separator className="mb-8 bg-zinc-800" />

        {/* Project list */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <span className="h-8 w-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
          </div>
        ) : !projects || projects.length === 0 ? (
          <div className="text-center py-16 space-y-4">
            <p className="text-zinc-500 text-sm">No music video projects yet.</p>
            <Button
              variant="outline"
              onClick={() => setShowNewForm(true)}
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            >
              Create your first video
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {projects.map((project) => (
              <button
                key={project.id}
                onClick={() => setSelectedId(project.id)}
                className="w-full text-left border border-zinc-800 hover:border-zinc-600 rounded-lg p-4 bg-zinc-950/50 hover:bg-zinc-900/50 transition-all group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground group-hover:text-primary transition-colors truncate">
                      {project.title}
                    </p>
                    {project.artistName && (
                      <p className="text-sm text-zinc-500 truncate">{project.artistName}</p>
                    )}
                    {(project as any).riffTrackTitle && (
                      <p className="text-xs text-zinc-600 truncate">
                        🍓 {(project as any).riffTrackTitle}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {project.durationSeconds && (
                      <span className="text-xs text-zinc-600 font-mono">
                        {formatDuration(project.durationSeconds)}
                      </span>
                    )}
                    <StatusBadge status={project.status} />
                  </div>
                </div>
                {project.genreDescription && (
                  <p className="text-xs text-zinc-600 mt-1.5 truncate">{project.genreDescription}</p>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
