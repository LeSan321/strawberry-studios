import { useEffect, useState, useRef } from "react";
import { Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";


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

const STATUS_STYLES: Record<string, { label: string; color: string }> = {
  draft: { label: "Draft", color: "oklch(0.55 0.03 60)" },
  generating: { label: "Generating...", color: "oklch(0.62 0.14 55)" },
  complete: { label: "Complete", color: "oklch(0.55 0.15 145)" },
  failed: { label: "Failed", color: "oklch(0.52 0.22 18)" },
};

const VIDEO_STATUS_STYLES: Record<string, { label: string; color: string; icon: string }> = {
  none: { label: "No Video", color: "oklch(0.45 0.02 270)", icon: "○" },
  queued: { label: "Video Queued", color: "oklch(0.62 0.14 55)", icon: "◌" },
  generating: { label: "Video Generating", color: "oklch(0.62 0.14 55)", icon: "◎" },
  complete: { label: "Video Ready", color: "oklch(0.55 0.15 145)", icon: "●" },
  failed: { label: "Video Failed", color: "oklch(0.52 0.22 18)", icon: "✕" },
};

// Polling hook for concerts with video in progress
function useVideoPolling(concertId: number, videoStatus: string | null) {
  const utils = trpc.useUtils();
  const isPolling = videoStatus === "queued" || videoStatus === "generating";

  const { data } = trpc.concerts.pollVideoStatus.useQuery(
    { concertId },
    {
      enabled: isPolling,
      refetchInterval: isPolling ? 5000 : false,
    }
  );

  useEffect(() => {
    if (data?.status === "complete" || data?.status === "failed") {
      utils.concerts.list.invalidate();
    }
  }, [data?.status]);

  return data;
}

function ConcertCard({ concert }: { concert: any }) {
  const utils = trpc.useUtils();
  const [generatingId, setGeneratingId] = useState<number | null>(null);
  const [generatingVideoId, setGeneratingVideoId] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [freshVideoUrl, setFreshVideoUrl] = useState<string | null>(null);
  // Use a ref to prevent double-clicks even across re-renders
  const generatingRef = useRef(false);
  const videoStatus = concert.videoStatus ?? "none";
  const videoStatusStyle = VIDEO_STATUS_STYLES[videoStatus] ?? VIDEO_STATUS_STYLES.none;
  // Show generating state if status is 'generating' from DB OR local state is active
  const isGeneratingPackage = concert.status === "generating" || generatingId === concert.id;
  const statusStyle = STATUS_STYLES[isGeneratingPackage ? "generating" : concert.status] ?? STATUS_STYLES.draft;
  // Fetch fresh video URL when video is complete
  const { data: videoUrlData } = trpc.concerts.getVideoUrl.useQuery(
    { concertId: concert.id },
    { enabled: videoStatus === "complete" && !freshVideoUrl }
  );

  useEffect(() => {
    if (videoUrlData?.videoUrl) {
      setFreshVideoUrl(videoUrlData.videoUrl);
    }
  }, [videoUrlData?.videoUrl]);

  // Poll while video is in progress
  const pollData = useVideoPolling(concert.id, videoStatus);
  // Also poll while package is generating so the card updates automatically
  const isPackagePolling = concert.status === "generating" || generatingId === concert.id;
  const { data: packagePollData } = trpc.concerts.get.useQuery(
    { id: concert.id },
    { enabled: isPackagePolling, refetchInterval: isPackagePolling ? 3000 : false }
  );
  useEffect(() => {
    if (packagePollData?.status === "complete" || packagePollData?.status === "failed") {
      generatingRef.current = false;
      setGeneratingId(null);
      utils.concerts.list.invalidate();
    }
  }, [packagePollData?.status]);

  const generateMutation = trpc.concerts.generate.useMutation({
    onSuccess: () => {
      toast.success("Director's Package generated!");
      generatingRef.current = false;
      setGeneratingId(null);
      utils.concerts.list.invalidate();
    },
    onError: (err) => {
      toast.error("Generation failed: " + err.message);
      generatingRef.current = false;
      setGeneratingId(null);
    },
  });

  const generateVideoMutation = trpc.concerts.generateVideo.useMutation({
    onSuccess: (result) => {
      setGeneratingVideoId(null);
      if (result.status === "complete") {
        toast.success("Video generated!");
      } else {
        toast.success("Video generation started — we'll update when it's ready.");
      }
      utils.concerts.list.invalidate();
    },
    onError: (err) => {
      toast.error("Video generation failed: " + err.message);
      setGeneratingVideoId(null);
      utils.concerts.list.invalidate();
    },
  });

  const deleteMutation = trpc.concerts.delete.useMutation({
    onSuccess: () => {
      toast.success("Concert deleted.");
      utils.concerts.list.invalidate();
    },
    onError: (err) => {
      toast.error("Delete failed: " + err.message);
      setConfirmDelete(false);
    },
  });

  const handleGenerate = async () => {
    // Prevent double-click even if button re-enables between renders
    if (generatingRef.current || isGeneratingPackage) return;
    generatingRef.current = true;
    setGeneratingId(concert.id);
    await generateMutation.mutateAsync({ concertId: concert.id });
  };

  const handleGenerateVideo = async () => {
    setGeneratingVideoId(concert.id);
    await generateVideoMutation.mutateAsync({ concertId: concert.id });
  };

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      // Auto-reset confirm state after 4 seconds
      setTimeout(() => setConfirmDelete(false), 4000);
      return;
    }
    await deleteMutation.mutateAsync({ id: concert.id });
  };

  // Extract progress from poll data
  const videoProgress = (pollData as any)?.progress;
  const progressLabel = videoProgress != null
    ? ` ${Math.round(videoProgress * 100)}%`
    : "";

  return (
    <div className="studios-card p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Status row */}
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <div className="w-2 h-2 rounded-full" style={{ background: statusStyle.color }} />
            <span className="text-xs tracking-widest uppercase font-light" style={{ color: statusStyle.color }}>
              {statusStyle.label}
            </span>
            {/* Video status badge */}
            {videoStatus !== "none" && (
              <>
                <span className="text-muted-foreground/30 text-xs">·</span>
                <span className="text-xs font-mono" style={{ color: videoStatusStyle.color }}>
                  {videoStatusStyle.icon}
                </span>
                <span className="text-xs tracking-widest uppercase font-light" style={{ color: videoStatusStyle.color }}>
                  {videoStatusStyle.label}{(videoStatus === "generating" || videoStatus === "queued") ? progressLabel : ""}
                </span>
              </>
            )}
          </div>

          <h3 className="font-display text-lg text-foreground mb-1 truncate">{concert.title}</h3>
          {concert.artistName && (
            <p className="text-muted-foreground font-serif text-sm mb-3">{concert.artistName}</p>
          )}
          <div className="flex flex-wrap gap-2">
            <span className="px-2 py-0.5 text-xs border border-border/30 text-muted-foreground/70 font-light">
              Velvet Strawberry Jazz Club
            </span>
            {concert.moodPreset && (
              <span className="px-2 py-0.5 text-xs border border-border/30 text-muted-foreground/70 font-light">
                {MOOD_LABELS[concert.moodPreset] ?? concert.moodPreset}
              </span>
            )}
            {concert.visualPreset && concert.visualPreset !== "none" && (
              <span className="px-2 py-0.5 text-xs border border-border/30 text-muted-foreground/70 font-light">
                {VISUAL_LABELS[concert.visualPreset] ?? concert.visualPreset}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2 flex-shrink-0">
          {/* Director's Package generation */}
          {(concert.status === "draft" || concert.status === "generating") && (
            <>
              <button
                onClick={handleGenerate}
                disabled={isGeneratingPackage}
                className="px-4 py-2 border border-primary text-primary hover:bg-primary hover:text-primary-foreground transition-all duration-300 font-display text-xs tracking-widest uppercase disabled:opacity-40 disabled:cursor-not-allowed">
                {isGeneratingPackage ? (
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                    Consulting Council...
                  </span>
                ) : "Generate Package"}
              </button>
              {isGeneratingPackage && (
                <p className="text-xs text-muted-foreground/60 text-right max-w-[160px] leading-tight">
                  Expert Council reviewing (~45s)
                </p>
              )}
            </>
          )}
          {concert.status === "failed" && (
            <button
              onClick={handleGenerate}
              className="px-4 py-2 border border-primary/50 text-primary/70 hover:bg-primary/10 transition-all duration-300 font-display text-xs tracking-widest uppercase">
              Retry
            </button>
          )}

          {/* Video generation — only available when Director's Package is complete */}
          {concert.status === "complete" && videoStatus === "none" && (
            <button
              onClick={handleGenerateVideo}
              disabled={generatingVideoId === concert.id}
              className="px-4 py-2 border border-accent text-accent hover:bg-accent hover:text-accent-foreground transition-all duration-300 font-display text-xs tracking-widest uppercase disabled:opacity-40">
              {generatingVideoId === concert.id ? "Starting..." : "Generate Video"}
            </button>
          )}
          {concert.status === "complete" && videoStatus === "failed" && (
            <button
              onClick={handleGenerateVideo}
              disabled={generatingVideoId === concert.id}
              className="px-4 py-2 border border-accent/50 text-accent/70 hover:bg-accent/10 transition-all duration-300 font-display text-xs tracking-widest uppercase disabled:opacity-40">
              Retry Video
            </button>
          )}
          {(videoStatus === "queued" || videoStatus === "generating") && (
            <div className="px-4 py-2 border border-accent/30 text-accent/50 font-display text-xs tracking-widest uppercase flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-accent/50 animate-pulse" />
              Processing{progressLabel}
            </div>
          )}

          {/* View Ticket */}
          {concert.status === "complete" && concert.ticketSlug && (
            <Link href={`/concert/${concert.ticketSlug}`}
              className="px-4 py-2 border border-border/40 text-muted-foreground hover:border-border hover:text-foreground transition-all duration-300 font-display text-xs tracking-widest uppercase text-center">
              View Ticket
            </Link>
          )}
          {concert.status === "complete" && concert.ticketSlug && (
            <button
              onClick={() => {
                const url = `${window.location.origin}/concert/${concert.ticketSlug}`;
                navigator.clipboard.writeText(url).catch(() => {});
                toast.success("Concert link copied!");
              }}
              className="px-4 py-2 border border-border/30 text-muted-foreground/60 hover:border-border/60 hover:text-muted-foreground transition-all duration-300 font-display text-xs tracking-widest uppercase">
              Copy Link
            </button>
          )}

          {/* Delete Concert */}
          <button
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            className={`px-4 py-2 border font-display text-xs tracking-widest uppercase transition-all duration-300 disabled:opacity-40 ${
              confirmDelete
                ? "border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                : "border-border/20 text-muted-foreground/40 hover:border-destructive/50 hover:text-destructive/70"
            }`}>
            {deleteMutation.isPending ? "Deleting..." : confirmDelete ? "Confirm Delete" : "Delete"}
          </button>
        </div>
      </div>

      {/* Video preview (when complete) */}
      {videoStatus === "complete" && (freshVideoUrl || concert.videoUrl) && (
        <div className="mt-4 pt-4 border-t border-border/20">
          <p className="text-xs tracking-[0.3em] uppercase text-accent/60 mb-3 font-light">Cinématique Video</p>
          <video
            src={freshVideoUrl || concert.videoUrl}
            controls
            className="w-full max-h-48 object-cover"
            style={{ background: "oklch(0.08 0.01 270)" }}
          />
        </div>
      )}

      {/* Director's Package prompt preview */}
      {concert.status === "complete" && concert.cinematiquePrompt && videoStatus === "none" && (
        <div className="mt-4 pt-4 border-t border-border/20">
          <p className="text-xs tracking-[0.3em] uppercase text-muted-foreground/60 mb-2 font-light">Cinématique Prompt Preview</p>
          <p className="text-sm text-muted-foreground font-serif italic leading-relaxed line-clamp-3">
            {concert.cinematiquePrompt}
          </p>
        </div>
      )}

      <p className="text-xs text-muted-foreground/40 font-light mt-3">
        Created {new Date(concert.createdAt).toLocaleDateString()}
      </p>
    </div>
  );
}

export default function Library() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"concerts" | "audio">("concerts");
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const audioInputRef = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();

  const { data: concerts, isLoading: concertsLoading } = trpc.concerts.list.useQuery(undefined, {
    enabled: !!user,
  });

  const { data: audioTracks, isLoading: audioLoading } = trpc.audio.list.useQuery(undefined, {
    enabled: !!user,
  });

  const uploadAudioMutation = trpc.audio.upload.useMutation({
    onSuccess: () => {
      toast.success("Audio track saved!");
      setUploadingAudio(false);
      utils.audio.list.invalidate();
    },
    onError: (err) => {
      toast.error("Upload failed: " + err.message);
      setUploadingAudio(false);
    },
  });

  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingAudio(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", file.name.replace(/\.[^.]+$/, ""));

      const response = await fetch("/api/audio/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("Upload failed");
      const { url, key } = await response.json();

      await uploadAudioMutation.mutateAsync({
        title: file.name.replace(/\.[^.]+$/, ""),
        fileUrl: url,
        fileKey: key,
        mimeType: file.type,
        fileSizeBytes: file.size,
      });
    } catch (err: any) {
      toast.error("Upload failed: " + err.message);
      setUploadingAudio(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="font-display text-2xl text-foreground mb-4">Sign In Required</p>
          <p className="text-muted-foreground mb-8">Access your project library by signing in.</p>
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
        <div className="flex items-center gap-6">
          <Link href="/venues" className="text-muted-foreground hover:text-foreground text-sm tracking-wider transition-colors uppercase font-light">Venues</Link>
          <Link href="/create"
            className="px-5 py-2 text-sm tracking-widest uppercase font-medium border border-primary text-primary hover:bg-primary hover:text-primary-foreground transition-all duration-300">
            + New Concert
          </Link>
        </div>
      </nav>

      {/* Header */}
      <div className="py-12 px-6 border-b border-border/30">
        <div className="max-w-6xl mx-auto">
          <p className="text-xs tracking-[0.4em] uppercase text-primary/70 mb-2 font-light">Your Productions</p>
          <h1 className="font-display text-3xl text-foreground">Project Library</h1>
          {user.name && (
            <p className="text-muted-foreground font-serif mt-2">{user.name}</p>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border/30 px-6">
        <div className="max-w-6xl mx-auto flex gap-8">
          {(["concerts", "audio"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-4 text-sm tracking-widest uppercase font-light border-b-2 transition-all duration-300 ${
                activeTab === tab
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}>
              {tab === "concerts" ? "Concerts" : "Audio Tracks"}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-6 py-12">

        {/* Concerts Tab */}
        {activeTab === "concerts" && (
          <div>
            {concertsLoading ? (
              <div className="text-center py-20 text-muted-foreground font-serif">Loading your concerts...</div>
            ) : !concerts || concerts.length === 0 ? (
              <div className="text-center py-20">
                <div className="text-6xl opacity-20 mb-6">🎷</div>
                <p className="font-display text-xl text-foreground/60 mb-4">No concerts yet</p>
                <p className="text-muted-foreground font-serif mb-8">Begin your first production at the Velvet Strawberry Jazz Club.</p>
                <Link href="/create"
                  className="px-8 py-3 bg-primary text-primary-foreground font-display text-sm tracking-widest uppercase hover:bg-primary/90 transition-all">
                  Start Producing
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {concerts.map(concert => (
                  <ConcertCard key={concert.id} concert={concert} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Audio Tracks Tab */}
        {activeTab === "audio" && (
          <div>
            <div className="flex items-center justify-between mb-8">
              <p className="text-muted-foreground font-serif">Upload M4A, MP3, or WAV tracks for your concerts.</p>
              <button
                onClick={() => audioInputRef.current?.click()}
                disabled={uploadingAudio}
                className="px-6 py-3 border border-primary text-primary hover:bg-primary hover:text-primary-foreground transition-all duration-300 font-display text-sm tracking-widest uppercase disabled:opacity-40">
                {uploadingAudio ? "Uploading..." : "+ Upload Track"}
              </button>
              <input
                ref={audioInputRef}
                type="file"
                accept=".m4a,.mp3,.wav,.aac"
                className="hidden"
                onChange={handleAudioUpload}
              />
            </div>

            {audioLoading ? (
              <div className="text-center py-20 text-muted-foreground font-serif">Loading audio tracks...</div>
            ) : !audioTracks || audioTracks.length === 0 ? (
              <div className="text-center py-20">
                <div className="text-6xl opacity-20 mb-6">🎵</div>
                <p className="font-display text-xl text-foreground/60 mb-4">No audio tracks yet</p>
                <p className="text-muted-foreground font-serif mb-8">Upload your first track to attach it to a concert production.</p>
                <button
                  onClick={() => audioInputRef.current?.click()}
                  className="px-8 py-3 border border-primary text-primary hover:bg-primary hover:text-primary-foreground transition-all font-display text-sm tracking-widest uppercase">
                  Upload Track
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {audioTracks.map(track => (
                  <div key={track.id} className="studios-card p-5 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="w-10 h-10 flex items-center justify-center flex-shrink-0"
                        style={{ background: "oklch(0.15 0.02 270)", border: "1px solid oklch(0.62 0.14 55 / 0.3)" }}>
                        <span className="text-lg opacity-60">🎵</span>
                      </div>
                      <div className="min-w-0">
                        <p className="font-serif text-foreground truncate">{track.title}</p>
                        <div className="flex items-center gap-3 mt-1">
                          {track.mimeType && (
                            <span className="text-xs text-muted-foreground/50 uppercase font-light">
                              {track.mimeType.split("/")[1]}
                            </span>
                          )}
                          {track.durationSeconds && (
                            <span className="text-xs text-muted-foreground/50 font-light">
                              {Math.floor(track.durationSeconds / 60)}:{String(track.durationSeconds % 60).padStart(2, "0")}
                            </span>
                          )}
                          {track.fileSizeBytes && (
                            <span className="text-xs text-muted-foreground/50 font-light">
                              {(track.fileSizeBytes / 1024 / 1024).toFixed(1)} MB
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <a href={track.fileUrl} target="_blank" rel="noopener noreferrer"
                        className="px-3 py-1.5 border border-border/40 text-muted-foreground hover:border-border hover:text-foreground transition-all font-display text-xs tracking-widest uppercase">
                        Play
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
