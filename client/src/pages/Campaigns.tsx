import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Film, Plus, ChevronRight, Clapperboard, Palette, Camera, Zap, Music, Clock, Target, Trash2, Download, Share2, Eye, RefreshCw, Pencil, ImagePlus, X, Star, Link, Upload } from "lucide-react";
import { CoverArtCard } from "@/components/CoverArtCard";

// ── Genre definitions (mirrors server) ───────────────────────────────────────

const GENRES = [
  {
    id: "psychedelic_vaporwave",
    name: "Psychedelic / Vaporwave",
    emoji: "🌈",
    colors: ["#FF00FF", "#00FFFF", "#FF6600"],
    description: "Chromatic aberration, VHS scan lines, neon saturation",
    editRate: "Fast: 12–18 cuts/min",
  },
  {
    id: "noir_jazz",
    name: "Noir Jazz",
    emoji: "🎷",
    colors: ["#1a0a00", "#8B4513", "#FFD700"],
    description: "Chiaroscuro, tungsten amber, deep shadow",
    editRate: "Slow: 4–8 cuts/min",
  },
  {
    id: "indie_folk",
    name: "Indie Folk",
    emoji: "🌿",
    colors: ["#D4A853", "#4A7C59", "#C4956A"],
    description: "Golden hour, 16mm grain, natural environments",
    editRate: "Medium: 6–10 cuts/min",
  },
  {
    id: "hip_hop",
    name: "Hip Hop",
    emoji: "🎤",
    colors: ["#000000", "#FFD700", "#FF0000"],
    description: "Low angle hero shots, gold and chrome, beat-synced cuts",
    editRate: "Fast: 15–24 cuts/min",
  },
  {
    id: "electronic",
    name: "Electronic / EDM",
    emoji: "⚡",
    colors: ["#0080FF", "#8000FF", "#00FFFF"],
    description: "Laser arrays, LED walls, strobe effects",
    editRate: "Explosive on drop: 30+ cuts/min",
  },
  {
    id: "punk_rock",
    name: "Punk / Rock",
    emoji: "🎸",
    colors: ["#000000", "#FF0000", "#FFFFFF"],
    description: "Aggressive handheld, heavy grain, confrontational",
    editRate: "Very fast: 20–30 cuts/min",
  },
  {
    id: "soul_rnb",
    name: "Soul / R&B",
    emoji: "🕯️",
    colors: ["#6B1A1A", "#C8860A", "#2C4A3E"],
    description: "Warm practicals, smooth dolly, rich textures",
    editRate: "Medium: 6–10 cuts/min",
  },
  {
    id: "country",
    name: "Country",
    emoji: "🌾",
    colors: ["#D4A853", "#4682B4", "#8B4513"],
    description: "Golden hour, open landscapes, Americana film look",
    editRate: "Slow to medium: 5–8 cuts/min",
  },
  {
    id: "experimental",
    name: "Experimental / Art",
    emoji: "🔮",
    colors: ["#000000", "#FFFFFF", "#7F00FF"],
    description: "Concept-driven, abstract, pattern-completion invitation",
    editRate: "Concept-driven",
  },
] as const;

const DURATION_MODES = [
  { id: "15s", label: "15 seconds", description: "TikTok hook, paid ad", shots: 3 },
  { id: "30s", label: "30 seconds", description: "Instagram Reel, YouTube pre-roll", shots: 5 },
  { id: "60s", label: "60 seconds", description: "Extended ad, YouTube Shorts", shots: 8 },
  { id: "full_song", label: "Full Song", description: "YouTube, press kit, artist page", shots: 12 },
] as const;

const CAMPAIGN_GOALS = [
  { id: "awareness", label: "Awareness", description: "Introduce artist & sound", icon: "👁️" },
  { id: "engagement", label: "Engagement", description: "Build emotional connection", icon: "❤️" },
  { id: "conversion", label: "Conversion", description: "Drive streams & follows", icon: "🚀" },
  { id: "artist_brand", label: "Artist Brand", description: "Define visual universe", icon: "🌟" },
] as const;

// ── Types ─────────────────────────────────────────────────────────────────────

type GenreId = typeof GENRES[number]["id"];
type DurationModeId = typeof DURATION_MODES[number]["id"];
type CampaignGoalId = typeof CAMPAIGN_GOALS[number]["id"];

interface DirectorsPackage {
  logline?: string;
  visualIdentityStatement?: string;
  colorPalette?: { primary: string; secondary: string; accent: string; kelvin: string; grade: string; emotionalNote: string };
  characterDesign?: { appearance: string; wardrobe: string; materialNotes: string; lightingInteraction: string };
  setDesign?: Array<{ name: string; description: string; lightingSetup: string; atmosphericNote: string }>;
  shotList?: Array<{
    shotNumber: number; shotType: string; description: string; durationSeconds: number;
    cameraMovement: string; lightingNote: string; atmosphericNote: string; editNote: string; emotionalFunction: string;
  }>;
  productionNotes?: { cameraPackage: string; lightingSetup: string; atmosphericSetup: string; postGrade: string };
  artDepartmentNotes?: { tone: string; timePeriod: string; palette: string; texture: string; theme: string };
  directorStatement?: string;
}

// ── New Campaign Dialog ───────────────────────────────────────────────────────

function NewCampaignDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [genre, setGenre] = useState<GenreId | null>(null);
  const [durationMode, setDurationMode] = useState<DurationModeId>("30s");
  const [campaignGoal, setCampaignGoal] = useState<CampaignGoalId>("awareness");
  const [title, setTitle] = useState("");
  const [artistName, setArtistName] = useState("");
  const [brief, setBrief] = useState("");
  const [characterNotes, setCharacterNotes] = useState("");
  const createMutation = trpc.campaigns.create.useMutation({
    onSuccess: () => {
      setOpen(false);
      setStep(1);
      setGenre(null);
      setTitle("");
      setBrief("");
      setCharacterNotes("");
      onCreated();
      toast.success("Campaign created — generate the Director's Package to begin.");
    },
    onError: (err) => toast.error(err.message),
  });

  const handleCreate = () => {
    if (!genre || !title) return;
    createMutation.mutate({ title, artistName: artistName || undefined, genre, durationMode, campaignGoal, brief: brief || undefined, characterNotes: characterNotes || undefined });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2 bg-rose-700 hover:bg-rose-600 text-white">
          <Plus className="w-4 h-4" /> New Campaign
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl bg-zinc-950 border-zinc-800 text-white max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-light tracking-widest uppercase text-rose-400">
            {step === 1 ? "Choose Genre" : step === 2 ? "Campaign Brief" : "Production Settings"}
          </DialogTitle>
        </DialogHeader>

        {/* Step 1: Genre Selection */}
        {step === 1 && (
          <div className="space-y-4">
            <p className="text-zinc-400 text-sm">The genre determines the entire visual grammar system — color palette, camera movement, edit rhythm, and atmospheric physics.</p>
            <div className="grid grid-cols-3 gap-3">
              {GENRES.map((g) => (
                <button
                  key={g.id}
                  onClick={() => setGenre(g.id)}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    genre === g.id
                      ? "border-rose-500 bg-rose-950/40"
                      : "border-zinc-800 hover:border-zinc-600 bg-zinc-900/50"
                  }`}
                >
                  <div className="text-2xl mb-1">{g.emoji}</div>
                  <div className="text-sm font-medium text-white">{g.name}</div>
                  <div className="text-xs text-zinc-500 mt-1">{g.description}</div>
                  <div className="flex gap-1 mt-2">
                    {g.colors.map((c, i) => (
                      <div key={i} className="w-4 h-4 rounded-full border border-zinc-700" style={{ backgroundColor: c }} />
                    ))}
                  </div>
                </button>
              ))}
            </div>
            <div className="flex justify-end">
              <Button onClick={() => setStep(2)} disabled={!genre} className="bg-rose-700 hover:bg-rose-600">
                Next: Campaign Brief <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Campaign Brief */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs text-zinc-400 uppercase tracking-wider">Campaign Title *</label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Sonic Insurrection — Awareness" className="bg-zinc-900 border-zinc-700 text-white" />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-zinc-400 uppercase tracking-wider">Artist Name</label>
                <Input value={artistName} onChange={(e) => setArtistName(e.target.value)} placeholder="LeSan Riedmann" className="bg-zinc-900 border-zinc-700 text-white" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs text-zinc-400 uppercase tracking-wider">Campaign Brief</label>
              <Textarea
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                placeholder="Describe the campaign goal, emotional tone, key visual ideas, and any specific requirements. The Expert Council will use this to generate the Director's Package."
                className="bg-zinc-900 border-zinc-700 text-white min-h-[100px]"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-zinc-400 uppercase tracking-wider">Character / Artist Notes</label>
              <Textarea
                value={characterNotes}
                onChange={(e) => setCharacterNotes(e.target.value)}
                placeholder="Describe the artist's appearance, wardrobe style, distinctive features, or any specific character requirements for visual consistency across shots."
                className="bg-zinc-900 border-zinc-700 text-white min-h-[80px]"
              />
            </div>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)} className="border-zinc-700 text-zinc-400">Back</Button>
              <Button onClick={() => setStep(3)} disabled={!title} className="bg-rose-700 hover:bg-rose-600">
                Next: Settings <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Production Settings */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="space-y-3">
              <label className="text-xs text-zinc-400 uppercase tracking-wider">Duration Mode</label>
              <div className="grid grid-cols-2 gap-3">
                {DURATION_MODES.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => setDurationMode(d.id)}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      durationMode === d.id ? "border-rose-500 bg-rose-950/40" : "border-zinc-800 hover:border-zinc-600 bg-zinc-900/50"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-rose-400" />
                      <span className="text-sm font-medium text-white">{d.label}</span>
                    </div>
                    <div className="text-xs text-zinc-500 mt-1">{d.description}</div>
                    <div className="text-xs text-zinc-600 mt-1">{d.shots} shots</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-xs text-zinc-400 uppercase tracking-wider">Campaign Goal</label>
              <div className="grid grid-cols-2 gap-3">
                {CAMPAIGN_GOALS.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => setCampaignGoal(g.id)}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      campaignGoal === g.id ? "border-rose-500 bg-rose-950/40" : "border-zinc-800 hover:border-zinc-600 bg-zinc-900/50"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{g.icon}</span>
                      <span className="text-sm font-medium text-white">{g.label}</span>
                    </div>
                    <div className="text-xs text-zinc-500 mt-1">{g.description}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Summary */}
            <div className="bg-zinc-900/60 rounded-lg p-4 border border-zinc-800 space-y-2">
              <div className="text-xs text-zinc-400 uppercase tracking-wider mb-3">Campaign Summary</div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-zinc-500">Title:</span> <span className="text-white">{title}</span></div>
                <div><span className="text-zinc-500">Genre:</span> <span className="text-white">{GENRES.find(g => g.id === genre)?.name}</span></div>
                <div><span className="text-zinc-500">Duration:</span> <span className="text-white">{DURATION_MODES.find(d => d.id === durationMode)?.label}</span></div>
                <div><span className="text-zinc-500">Goal:</span> <span className="text-white">{CAMPAIGN_GOALS.find(g => g.id === campaignGoal)?.label}</span></div>
              </div>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(2)} className="border-zinc-700 text-zinc-400">Back</Button>
              <Button onClick={handleCreate} disabled={createMutation.isPending} className="bg-rose-700 hover:bg-rose-600">
                {createMutation.isPending ? "Creating..." : "Create Campaign"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Campaign Card ─────────────────────────────────────────────────────────────

function CampaignCard({ campaign, onSelect, onDelete }: {
  campaign: { id: number; title: string; genre: string; durationMode: string; campaignGoal: string; status: string; createdAt: Date | string };
  onSelect: (id: number) => void;
  onDelete: (id: number) => void;
}) {
  const genre = GENRES.find(g => g.id === campaign.genre);
  const statusColors: Record<string, string> = {
    draft: "bg-zinc-700 text-zinc-300",
    generating_package: "bg-amber-900 text-amber-300",
    package_ready: "bg-blue-900 text-blue-300",
    generating_shots: "bg-purple-900 text-purple-300",
    complete: "bg-green-900 text-green-300",
    failed: "bg-red-900 text-red-300",
  };

  return (
    <Card className="bg-zinc-900/60 border-zinc-800 hover:border-zinc-600 transition-all cursor-pointer group">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0" onClick={() => onSelect(campaign.id)}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">{genre?.emoji ?? "🎬"}</span>
              <h3 className="text-white font-medium truncate">{campaign.title}</h3>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              <Badge className={`text-xs ${statusColors[campaign.status] ?? "bg-zinc-700 text-zinc-300"}`}>
                {campaign.status.replace("_", " ").toUpperCase()}
              </Badge>
              <Badge variant="outline" className="text-xs border-zinc-700 text-zinc-400">
                {genre?.name ?? campaign.genre}
              </Badge>
              <Badge variant="outline" className="text-xs border-zinc-700 text-zinc-400">
                {DURATION_MODES.find(d => d.id === campaign.durationMode)?.label ?? campaign.durationMode}
              </Badge>
            </div>
            <div className="text-xs text-zinc-600 mt-2">
              {new Date(campaign.createdAt).toLocaleDateString()}
            </div>
          </div>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
            <Button size="sm" variant="ghost" onClick={() => onSelect(campaign.id)} className="text-zinc-400 hover:text-white h-8 w-8 p-0">
              <Eye className="w-3.5 h-3.5" />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onDelete(campaign.id)} className="text-zinc-400 hover:text-red-400 h-8 w-8 p-0">
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Shot Card ─────────────────────────────────────────────────────────────────

function ShotCard({ shot, campaignId, onGenerate, onRetry, onEditPrompt }: {
  shot: {
    id: number; shotNumber: number; description?: string | null; shotType?: string | null;
    cameraMovement?: string | null; lightingNote?: string | null; durationSeconds?: number | null;
    videoStatus: string; videoUrl?: string | null; videoPrompt?: string | null; progress?: number | null;
  };
  campaignId: number;
  onGenerate: (shotId: number) => void;
  onRetry?: (shotId: number) => void;
  onEditPrompt?: (shot: { id: number; shotNumber: number; videoPrompt?: string | null }) => void;
}) {
  const statusColors: Record<string, string> = {
    none: "text-zinc-500",
    queued: "text-amber-400",
    generating: "text-blue-400",
    complete: "text-green-400",
    failed: "text-red-400",
  };

  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-rose-900/50 border border-rose-800 flex items-center justify-center text-rose-300 text-sm font-bold">
            {shot.shotNumber}
          </div>
          <div>
            <div className="text-sm font-medium text-white">{shot.shotType ?? "Shot"}</div>
            <div className={`text-xs ${statusColors[shot.videoStatus] ?? "text-zinc-500"}`}>
              {shot.videoStatus === "generating" ? `Generating... ${shot.progress ?? 0}%` : shot.videoStatus.toUpperCase()}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {shot.durationSeconds && (
            <span className="text-xs text-zinc-500">{shot.durationSeconds}s</span>
          )}
          {shot.videoStatus === "none" && (
            <Button size="sm" onClick={() => onGenerate(shot.id)} className="bg-rose-700 hover:bg-rose-600 text-xs h-7 px-3">
              <Zap className="w-3 h-3 mr-1" /> Generate
            </Button>
          )}
          {shot.videoStatus === "failed" && onRetry && (
            <Button size="sm" onClick={() => onRetry(shot.id)} className="bg-amber-800 hover:bg-amber-700 text-xs h-7 px-3">
              <RefreshCw className="w-3 h-3 mr-1" /> Retry
            </Button>
          )}
          {onEditPrompt && shot.videoStatus !== "generating" && shot.videoStatus !== "queued" && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onEditPrompt(shot)}
              className="text-zinc-300 hover:text-white bg-zinc-800/60 hover:bg-zinc-700 h-7 w-7 p-0"
              title="Edit prompt"
            >
              <Pencil className="w-3 h-3" />
            </Button>
          )}
        </div>
      </div>

      {shot.description && (
        <p className="text-sm text-zinc-400">{shot.description}</p>
      )}

      <div className="grid grid-cols-2 gap-2 text-xs">
        {shot.cameraMovement && (
          <div className="flex items-center gap-1 text-zinc-500">
            <Camera className="w-3 h-3" /> {shot.cameraMovement}
          </div>
        )}
        {shot.lightingNote && (
          <div className="flex items-center gap-1 text-zinc-500">
            <Palette className="w-3 h-3" /> {shot.lightingNote}
          </div>
        )}
      </div>

      {shot.videoStatus === "generating" && (
        <Progress value={shot.progress ?? 10} className="h-1 bg-zinc-800" />
      )}

      {shot.videoStatus === "complete" && shot.videoUrl && (
        <video
          src={shot.videoUrl}
          controls
          className="w-full rounded-lg aspect-video bg-black"
          playsInline
        />
      )}
    </div>
  );
}

// ── Campaign Detail View ──────────────────────────────────────────────────────

function CampaignDetail({ campaignId, onBack }: { campaignId: number; onBack: () => void }) {
  const utils = trpc.useUtils();

  const { data, isLoading, refetch } = trpc.campaigns.get.useQuery({ id: campaignId });

  // Prompt edit modal state
  const [editingShot, setEditingShot] = useState<{ id: number; shotNumber: number; videoPrompt?: string | null } | null>(null);
  const [editedPrompt, setEditedPrompt] = useState("");

  // Mood board state
  const [moodBoardOpen, setMoodBoardOpen] = useState(false);
  const [moodBoardUrlInput, setMoodBoardUrlInput] = useState("");
  const [moodBoardLabelInput, setMoodBoardLabelInput] = useState("");
  const [moodBoardAddMode, setMoodBoardAddMode] = useState<"url" | "upload" | null>(null);
  const [moodBoardUploading, setMoodBoardUploading] = useState(false);

  const { data: moodBoardImages, refetch: refetchMoodBoard } = trpc.campaigns.moodBoardList.useQuery(
    { campaignId },
    { enabled: moodBoardOpen }
  );

  const moodBoardAddByUrlMutation = trpc.campaigns.moodBoardAddByUrl.useMutation({
    onSuccess: () => { refetchMoodBoard(); refetch(); setMoodBoardUrlInput(""); setMoodBoardLabelInput(""); setMoodBoardAddMode(null); toast.success("Reference image added."); },
    onError: (err) => toast.error(err.message),
  });

  const moodBoardSaveUploadMutation = trpc.campaigns.moodBoardSaveUpload.useMutation({
    onSuccess: () => { refetchMoodBoard(); refetch(); setMoodBoardLabelInput(""); setMoodBoardAddMode(null); toast.success("Reference image uploaded."); },
    onError: (err) => toast.error(err.message),
  });

  const moodBoardRemoveMutation = trpc.campaigns.moodBoardRemove.useMutation({
    onSuccess: () => { refetchMoodBoard(); refetch(); toast.success("Reference image removed."); },
    onError: (err) => toast.error(err.message),
  });

  const moodBoardSetPrimaryMutation = trpc.campaigns.moodBoardSetPrimary.useMutation({
    onSuccess: () => { refetchMoodBoard(); refetch(); toast.success("Primary reference updated — new shots will use this image."); },
    onError: (err) => toast.error(err.message),
  });

  const moodBoardClearPrimaryMutation = trpc.campaigns.moodBoardClearPrimary.useMutation({
    onSuccess: () => { refetchMoodBoard(); refetch(); toast.success("Primary reference cleared."); },
    onError: (err) => toast.error(err.message),
  });

  const handleMoodBoardFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMoodBoardUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/mood-board/upload", { method: "POST", body: formData });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error ?? "Upload failed"); }
      const { url, key } = await res.json();
      await moodBoardSaveUploadMutation.mutateAsync({ campaignId, imageUrl: url, imageKey: key, label: moodBoardLabelInput || undefined });
    } catch (err: any) {
      toast.error(err.message ?? "Upload failed");
    } finally {
      setMoodBoardUploading(false);
      e.target.value = "";
    }
  };

  const publishMutation = trpc.campaigns.publish.useMutation({
    onSuccess: () => {
      refetch();
      toast.success("Campaign published — it's now visible to the world.");
    },
    onError: (err) => toast.error(err.message),
  });

  const generatePackageMutation = trpc.campaigns.generatePackage.useMutation({
    onSuccess: () => {
      refetch();
      toast.success("Director's Package generated — storyboard is ready.");
    },
    onError: (err) => toast.error(err.message),
  });

  const generateShotMutation = trpc.campaigns.generateShot.useMutation({
    onSuccess: () => {
      refetch();
      toast.success("Shot queued — video generation started.");
    },
    onError: (err) => toast.error(err.message),
  });

  const retryShotMutation = trpc.campaigns.retryShot.useMutation({
    onSuccess: () => {
      refetch();
      toast.success("Shot retrying — video generation restarted.");
    },
    onError: (err) => toast.error(`Retry failed: ${err.message}`),
  });

  const editShotPromptMutation = trpc.campaigns.editShotPrompt.useMutation({
    onSuccess: (result, variables) => {
      refetch();
      setEditingShot(null);
      if (variables.regenerate) {
        toast.success("Prompt updated — regenerating shot with new instructions.");
      } else {
        toast.success("Prompt saved — click Generate when ready.");
      }
    },
    onError: (err) => toast.error(`Prompt edit failed: ${err.message}`),
  });

  const retryAllMutation = trpc.campaigns.retryAllFailed.useMutation({
    onSuccess: (result) => {
      refetch();
      if (result.retried > 0) {
        toast.success(`Retrying ${result.retried} shot${result.retried > 1 ? "s" : ""}...`);
      } else {
        toast.info("No failed shots to retry.");
      }
      if (result.errors.length > 0) {
        toast.error(`${result.errors.length} shot(s) still failing: ${result.errors[0]}`);
      }
    },
    onError: (err) => toast.error(`Retry all failed: ${err.message}`),
  });

  // Poll for generating shots
  useEffect(() => {
    if (!data) return;
    const generatingShots = data.shots.filter(s => s.videoStatus === "generating");
    if (generatingShots.length === 0) return;
    const interval = setInterval(() => refetch(), 5000);
    return () => clearInterval(interval);
  }, [data, refetch]);

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-zinc-500 animate-pulse">Loading campaign...</div>
    </div>
  );

  if (!data) return null;

  const { campaign, shots } = data;
  const pkg = campaign.directorsPackage as DirectorsPackage | null;
  const genre = GENRES.find(g => g.id === campaign.genre);

  return (
    <>
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={onBack} className="text-zinc-400 hover:text-white p-2">
            ← Back
          </Button>
          <div>
            <h2 className="text-xl font-light tracking-wider text-white">{campaign.title}</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm text-zinc-500">{genre?.emoji} {genre?.name}</span>
              <span className="text-zinc-700">·</span>
              <span className="text-sm text-zinc-500">{DURATION_MODES.find(d => d.id === campaign.durationMode)?.label}</span>
              <span className="text-zinc-700">·</span>
              <span className="text-sm text-zinc-500">{CAMPAIGN_GOALS.find(g => g.id === campaign.campaignGoal)?.label}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {pkg && (
            <a
              href={`/api/campaigns/${campaignId}/pdf`}
              download
              className="inline-flex items-center gap-2 px-4 py-2 text-sm border border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-500 rounded-md transition-colors"
            >
              <Download className="w-4 h-4" />
              Production Guide PDF
            </a>
          )}
          {campaign.status === "draft" && (
            <Button
              onClick={() => generatePackageMutation.mutate({ id: campaignId })}
              disabled={generatePackageMutation.isPending}
              className="bg-rose-700 hover:bg-rose-600 gap-2"
            >
              <Clapperboard className="w-4 h-4" />
              {generatePackageMutation.isPending ? "Generating Package..." : "Generate Director's Package"}
            </Button>
          )}
          {!campaign.isPublic && campaign.status !== "draft" && (
            <Button
              onClick={() => publishMutation.mutate({ campaignId })}
              disabled={publishMutation.isPending}
              className="bg-emerald-700 hover:bg-emerald-600 gap-2"
            >
              <Eye className="w-4 h-4" />
              {publishMutation.isPending ? "Publishing..." : "Publish Campaign"}
            </Button>
          )}
          {campaign.isPublic && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-emerald-900/40 border border-emerald-700/50 text-emerald-400">
              <Eye className="w-3 h-3" /> Published
            </span>
          )}
        </div>
      </div>

      {/* Cover Art + Campaign Info — side by side */}
      <div className="flex gap-6 items-start">
        {/* Cover Art Card */}
        <div className="shrink-0 w-[280px]">
          <div className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Cover Art</div>
          <CoverArtCard
            campaignId={campaignId}
            coverArtUrl={campaign.coverArtUrl}
            coverArtSource={campaign.coverArtSource ?? "none"}
            arcPosition={(campaign.arcPosition as "gathering" | "arriving" | "open") ?? "arriving"}
            coverArtRegenerationsUsed={campaign.coverArtRegenerationsUsed ?? 0}
            genre={campaign.genre}
            onCoverArtChanged={() => refetch()}
            onArcPositionChanged={(_pos) => {
              // Arc position is saved on the campaign record via the generate call
              // No separate save needed — it's passed at generation time
            }}
          />
        </div>

        {/* Campaign brief / notes */}
        <div className="flex-1 min-w-0 space-y-3">
          {campaign.brief && (
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-4">
              <div className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Campaign Brief</div>
              <p className="text-zinc-300 text-sm leading-relaxed">{campaign.brief}</p>
            </div>
          )}
          {campaign.characterNotes && (
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-4">
              <div className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Character Notes</div>
              <p className="text-zinc-300 text-sm leading-relaxed">{campaign.characterNotes}</p>
            </div>
          )}
          {!campaign.brief && !campaign.characterNotes && (
            <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-lg p-4">
              <p className="text-zinc-600 text-sm italic">No brief or character notes added.</p>
            </div>
          )}
        </div>
      </div>

      {/* Generating Package State */}
      {campaign.status === "generating_package" && (
        <div className="bg-amber-950/30 border border-amber-800/50 rounded-lg p-6 text-center space-y-3">
          <div className="text-amber-400 text-lg animate-pulse">Expert Council is working...</div>
          <p className="text-zinc-400 text-sm">The multi-genre Expert Council is generating your Director's Package. This takes 15–30 seconds.</p>
          <Progress value={undefined} className="h-1 bg-zinc-800" />
        </div>
      )}

      {/* Director's Package */}
      {pkg && (
        <div className="space-y-4">
          {/* Logline */}
          {pkg.logline && (
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-4">
              <div className="text-xs text-rose-400 uppercase tracking-wider mb-2">Logline</div>
              <p className="text-white text-lg font-light italic">"{pkg.logline}"</p>
            </div>
          )}

          {/* Visual Identity + Director Statement */}
          <div className="grid grid-cols-2 gap-4">
            {pkg.visualIdentityStatement && (
              <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-4">
                <div className="text-xs text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Eye className="w-3 h-3" /> Visual Identity
                </div>
                <p className="text-zinc-300 text-sm">{pkg.visualIdentityStatement}</p>
              </div>
            )}
            {pkg.directorStatement && (
              <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-4">
                <div className="text-xs text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Film className="w-3 h-3" /> Director's Statement
                </div>
                <p className="text-zinc-300 text-sm">{pkg.directorStatement}</p>
              </div>
            )}
          </div>

          {/* Color Palette + Character Design */}
          <div className="grid grid-cols-2 gap-4">
            {pkg.colorPalette && (
              <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-4">
                <div className="text-xs text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-1">
                  <Palette className="w-3 h-3" /> Color Palette
                </div>
                <div className="space-y-2 text-sm">
                  <div><span className="text-zinc-500">Primary:</span> <span className="text-white">{pkg.colorPalette.primary}</span></div>
                  <div><span className="text-zinc-500">Secondary:</span> <span className="text-white">{pkg.colorPalette.secondary}</span></div>
                  <div><span className="text-zinc-500">Accent:</span> <span className="text-white">{pkg.colorPalette.accent}</span></div>
                  <div><span className="text-zinc-500">Kelvin:</span> <span className="text-white">{pkg.colorPalette.kelvin}</span></div>
                  <div><span className="text-zinc-500">Grade:</span> <span className="text-white">{pkg.colorPalette.grade}</span></div>
                  {pkg.colorPalette.emotionalNote && (
                    <div className="pt-2 border-t border-zinc-800 text-zinc-400 italic text-xs">{pkg.colorPalette.emotionalNote}</div>
                  )}
                </div>
              </div>
            )}
            {pkg.characterDesign && (
              <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-4">
                <div className="text-xs text-zinc-400 uppercase tracking-wider mb-3">Character Design</div>
                <div className="space-y-2 text-sm">
                  <div><span className="text-zinc-500">Appearance:</span> <span className="text-white">{pkg.characterDesign.appearance}</span></div>
                  <div><span className="text-zinc-500">Wardrobe:</span> <span className="text-white">{pkg.characterDesign.wardrobe}</span></div>
                  <div><span className="text-zinc-500">Materials:</span> <span className="text-white">{pkg.characterDesign.materialNotes}</span></div>
                  <div><span className="text-zinc-500">Light Interaction:</span> <span className="text-white">{pkg.characterDesign.lightingInteraction}</span></div>
                </div>
              </div>
            )}
          </div>

          {/* Set Design */}
          {pkg.setDesign && pkg.setDesign.length > 0 && (
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-4">
              <div className="text-xs text-zinc-400 uppercase tracking-wider mb-3">Set Design</div>
              <div className="grid grid-cols-3 gap-3">
                {pkg.setDesign.map((set, i) => (
                  <div key={i} className="bg-zinc-800/50 rounded-lg p-3 space-y-1">
                    <div className="text-sm font-medium text-white">{set.name}</div>
                    <div className="text-xs text-zinc-400">{set.description}</div>
                    <div className="text-xs text-zinc-500 italic">{set.lightingSetup}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Art Department Notes */}
          {pkg.artDepartmentNotes && (
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-4">
              <div className="text-xs text-zinc-400 uppercase tracking-wider mb-3">Art Department Notes</div>
              <div className="grid grid-cols-5 gap-3 text-sm">
                {Object.entries(pkg.artDepartmentNotes).map(([key, value]) => (
                  <div key={key}>
                    <div className="text-xs text-zinc-500 capitalize mb-1">{key}</div>
                    <div className="text-white text-xs">{value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Mood Board Panel */}
      {pkg && (
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg overflow-hidden">
          <button
            className="w-full flex items-center justify-between p-4 text-left hover:bg-zinc-800/30 transition-colors"
            onClick={() => setMoodBoardOpen(o => !o)}
          >
            <div className="flex items-center gap-2">
              <ImagePlus className="w-4 h-4 text-rose-400" />
              <span className="text-sm uppercase tracking-wider text-zinc-300">Mood Board</span>
              {data?.campaign?.moodBoardPrimaryImageUrl && (
                <Badge className="bg-rose-900/50 text-rose-300 text-xs border-rose-800">Active Reference</Badge>
              )}
              {moodBoardImages && moodBoardImages.length > 0 && (
                <span className="text-xs text-zinc-500">{moodBoardImages.length} image{moodBoardImages.length !== 1 ? "s" : ""}</span>
              )}
            </div>
            <span className="text-zinc-500 text-xs">{moodBoardOpen ? "^" : "v"}</span>
          </button>

          {moodBoardOpen && (
            <div className="p-4 pt-0 space-y-4">
              <p className="text-xs text-zinc-500">
                Upload reference images to anchor the visual style of every shot. <span className="text-rose-400 font-medium">Click any image to make it the active reference</span> — Runway will use it as the first frame when generating shots.
              </p>

              {/* Active reference preview strip */}
              {moodBoardImages && moodBoardImages.length > 0 && (() => {
                const primary = moodBoardImages.find(i => i.isPrimary);
                return primary ? (
                  <div className="flex items-center gap-3 bg-rose-950/40 border border-rose-800/50 rounded-lg p-3">
                    <img src={primary.imageUrl} alt="Active reference" className="w-16 h-10 object-cover rounded border border-rose-700" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 text-rose-300 text-xs font-medium">
                        <Star className="w-3 h-3 fill-current" /> Active Reference
                      </div>
                      <p className="text-zinc-400 text-xs mt-0.5 truncate">{primary.label ?? "This image will be used as the first frame of every generated shot"}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => moodBoardClearPrimaryMutation.mutate({ campaignId })}
                      className="text-zinc-500 hover:text-zinc-300 text-xs h-7 px-2 shrink-0"
                    >
                      Clear
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 bg-amber-950/30 border border-amber-800/40 rounded-lg p-3">
                    <span className="text-amber-400 text-xs">No active reference selected. Click an image below to activate it.</span>
                  </div>
                );
              })()}

              {/* Image grid — click to select active reference */}
              {moodBoardImages && moodBoardImages.length > 0 && (
                <div className="grid grid-cols-3 gap-3">
                  {moodBoardImages.map((img) => (
                    <div
                      key={img.id}
                      className={`relative group rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${
                        img.isPrimary
                          ? "border-rose-500 ring-2 ring-rose-500/30"
                          : "border-zinc-700 hover:border-rose-600/60"
                      }`}
                      onClick={() => {
                        if (!img.isPrimary) {
                          moodBoardSetPrimaryMutation.mutate({ campaignId, imageId: img.id });
                        }
                      }}
                    >
                      <img
                        src={img.imageUrl}
                        alt={img.label ?? "Mood board reference"}
                        className="w-full aspect-video object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='60'%3E%3Crect fill='%23333' width='100' height='60'/%3E%3Ctext fill='%23666' x='50' y='35' text-anchor='middle' font-size='10'%3EImage error%3C/text%3E%3C/svg%3E"; }}
                      />
                      {/* Always-visible active badge */}
                      {img.isPrimary && (
                        <div className="absolute top-1 left-1 bg-rose-600 text-white text-xs px-1.5 py-0.5 rounded flex items-center gap-1 shadow-lg">
                          <Star className="w-2.5 h-2.5 fill-current" /> Active
                        </div>
                      )}
                      {/* Click-to-activate hint on non-primary images */}
                      {!img.isPrimary && (
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                          <span className="opacity-0 group-hover:opacity-100 transition-opacity text-white text-xs font-medium bg-rose-700/90 px-2 py-1 rounded">
                            Click to activate
                          </span>
                        </div>
                      )}
                      {img.label && (
                        <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-xs text-zinc-300 px-2 py-1 truncate">{img.label}</div>
                      )}
                      {/* Remove button — always visible in corner */}
                      <button
                        className="absolute top-1 right-1 bg-black/60 hover:bg-red-900/80 text-zinc-400 hover:text-red-300 rounded p-0.5 transition-colors"
                        onClick={(e) => { e.stopPropagation(); moodBoardRemoveMutation.mutate({ campaignId, imageId: img.id }); }}
                        title="Remove image"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add image controls */}
              {(!moodBoardImages || moodBoardImages.length < 6) && (
                <div className="space-y-3">
                  {moodBoardAddMode === null && (
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => setMoodBoardAddMode("url")} className="border-zinc-700 text-zinc-300 hover:text-white text-xs gap-1">
                        <Link className="w-3 h-3" /> Add by URL
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setMoodBoardAddMode("upload")} className="border-zinc-700 text-zinc-300 hover:text-white text-xs gap-1">
                        <Upload className="w-3 h-3" /> Upload Image
                      </Button>
                    </div>
                  )}

                  {moodBoardAddMode === "url" && (
                    <div className="space-y-2">
                      <Input
                        value={moodBoardUrlInput}
                        onChange={(e) => setMoodBoardUrlInput(e.target.value)}
                        placeholder="https://example.com/reference-image.jpg"
                        className="bg-zinc-900 border-zinc-700 text-white text-sm"
                      />
                      <Input
                        value={moodBoardLabelInput}
                        onChange={(e) => setMoodBoardLabelInput(e.target.value)}
                        placeholder="Label (optional - e.g. Lighting reference)"
                        className="bg-zinc-900 border-zinc-700 text-white text-sm"
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => moodBoardAddByUrlMutation.mutate({ campaignId, imageUrl: moodBoardUrlInput, label: moodBoardLabelInput || undefined })}
                          disabled={!moodBoardUrlInput || moodBoardAddByUrlMutation.isPending}
                          className="bg-rose-700 hover:bg-rose-600 text-xs"
                        >
                          {moodBoardAddByUrlMutation.isPending ? "Adding..." : "Add Image"}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => { setMoodBoardAddMode(null); setMoodBoardUrlInput(""); }} className="text-zinc-400 text-xs">Cancel</Button>
                      </div>
                    </div>
                  )}

                  {moodBoardAddMode === "upload" && (
                    <div className="space-y-2">
                      <Input
                        value={moodBoardLabelInput}
                        onChange={(e) => setMoodBoardLabelInput(e.target.value)}
                        placeholder="Label (optional - e.g. Color reference)"
                        className="bg-zinc-900 border-zinc-700 text-white text-sm"
                      />
                      <div className="flex gap-2 items-center">
                        <label className="cursor-pointer">
                          <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={handleMoodBoardFileUpload} disabled={moodBoardUploading} />
                          <span className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-md border transition-colors ${
                            moodBoardUploading
                              ? "border-zinc-700 text-zinc-500 cursor-not-allowed"
                              : "border-zinc-600 text-zinc-300 hover:text-white hover:border-zinc-400 cursor-pointer"
                          }`}>
                            <Upload className="w-3 h-3" />
                            {moodBoardUploading ? "Uploading..." : "Choose File"}
                          </span>
                        </label>
                        <Button size="sm" variant="ghost" onClick={() => { setMoodBoardAddMode(null); setMoodBoardLabelInput(""); }} className="text-zinc-400 text-xs">Cancel</Button>
                      </div>
                      <p className="text-xs text-zinc-600">Supported: JPG, PNG, WEBP, GIF - max 10MB</p>
                    </div>
                  )}
                </div>
              )}

              {moodBoardImages && moodBoardImages.length >= 6 && (
                <p className="text-xs text-zinc-500">Maximum 6 reference images reached. Remove one to add another.</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Shot List */}
      {shots.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm uppercase tracking-wider text-zinc-400 flex items-center gap-2">
              <Clapperboard className="w-4 h-4" /> Shot List ({shots.length} shots)
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-500">
                {shots.filter(s => s.videoStatus === "complete").length} / {shots.length} complete
              </span>
              {shots.some(s => s.videoStatus === "failed") && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => retryAllMutation.mutate({ campaignId })}
                  disabled={retryAllMutation.isPending}
                  className="text-xs h-7 px-3 border-red-800 text-red-400 hover:text-red-300 hover:border-red-600"
                >
                  <RefreshCw className="w-3 h-3 mr-1" />
                  {retryAllMutation.isPending ? "Retrying..." : "Retry All Failed"}
                </Button>
              )}
            </div>
          </div>
          <div className="space-y-3">
            {shots.map((shot) => (
              <ShotCard
                key={shot.id}
                shot={shot}
                campaignId={campaignId}
                onGenerate={(shotId) => generateShotMutation.mutate({ campaignId, shotId })}
                onRetry={(shotId) => retryShotMutation.mutate({ campaignId, shotId })}
                onEditPrompt={(s) => { setEditingShot(s); setEditedPrompt(s.videoPrompt ?? ""); }}
              />
            ))}
          </div>
        </div>
      )}
    </div>

    {/* Prompt Edit Modal */}
    {editingShot && (
      <Dialog open={true} onOpenChange={(open) => { if (!open) setEditingShot(null); }}>
        <DialogContent className="bg-zinc-950 border-zinc-800 text-white max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-rose-300 font-cinzel">
              Edit Prompt - Shot {editingShot.shotNumber}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-xs text-zinc-500">
              This is the exact prompt sent to Runway. Edit it to change camera movement, lighting, atmosphere, subject, or any visual element. Keep it under 1000 characters.
            </p>
            <div className="relative">
              <Textarea
                value={editedPrompt}
                onChange={(e) => setEditedPrompt(e.target.value)}
                rows={8}
                maxLength={1000}
                className="bg-zinc-900 border-zinc-700 text-white text-sm font-mono resize-none focus:border-rose-700"
                placeholder="Describe the shot in cinematic terms - camera movement, lighting, subject, atmosphere..."
              />
              <div className={`absolute bottom-2 right-3 text-xs ${
                editedPrompt.length > 950 ? "text-red-400" :
                editedPrompt.length > 800 ? "text-amber-400" : "text-zinc-500"
              }`}>
                {editedPrompt.length} / 1000
              </div>
            </div>
            <div className="flex items-center gap-3 justify-end">
              <Button
                variant="ghost"
                onClick={() => setEditingShot(null)}
                className="text-zinc-400 hover:text-white"
              >
                Cancel
              </Button>
              <Button
                variant="outline"
                onClick={() => editShotPromptMutation.mutate({ campaignId, shotId: editingShot.id, prompt: editedPrompt, regenerate: false })}
                disabled={editShotPromptMutation.isPending || editedPrompt.trim().length === 0}
                className="border-zinc-700 text-zinc-300 hover:text-white"
              >
                Save Prompt Only
              </Button>
              <Button
                onClick={() => editShotPromptMutation.mutate({ campaignId, shotId: editingShot.id, prompt: editedPrompt, regenerate: true })}
                disabled={editShotPromptMutation.isPending || editedPrompt.trim().length === 0 || editedPrompt.length > 1000}
                className="bg-rose-700 hover:bg-rose-600"
              >
                <Zap className="w-4 h-4 mr-2" />
                {editShotPromptMutation.isPending ? "Submitting..." : "Save & Regenerate"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    )}
    </>
  );
}

// ── Main Campaigns Page ───────────────────────────────────────────────────────

export default function Campaigns() {
  const { user, loading: authLoading } = useAuth();
  const [selectedCampaignId, setSelectedCampaignId] = useState<number | null>(null);
  const utils = trpc.useUtils();

  const { data: campaigns, isLoading, refetch } = trpc.campaigns.list.useQuery(undefined, {
    enabled: !!user,
  });

  const deleteMutation = trpc.campaigns.delete.useMutation({
    onSuccess: () => {
      refetch();
      toast.success("Campaign deleted.");
    },
    onError: (err) => toast.error(err.message),
  });

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-zinc-500 animate-pulse">Loading campaigns...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-zinc-500">Sign in to access Campaigns</div>
      </div>
    );
  }

  if (selectedCampaignId) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <CampaignDetail campaignId={selectedCampaignId} onBack={() => setSelectedCampaignId(null)} />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-light tracking-widest uppercase text-white flex items-center gap-3">
            <Film className="w-6 h-6 text-rose-400" />
            Campaigns
          </h1>
          <p className="text-zinc-500 text-sm mt-1">
            Multi-genre advertising videos and music video productions
          </p>
        </div>
        <NewCampaignDialog onCreated={refetch} />
      </div>

      {/* Empty State */}
      {(!campaigns || campaigns.length === 0) && (
        <div className="text-center py-20 space-y-4">
          <div className="text-6xl">🎬</div>
          <h2 className="text-xl font-light text-zinc-400">No campaigns yet</h2>
          <p className="text-zinc-600 text-sm max-w-md mx-auto">
            Create your first campaign to generate a multi-genre Director's Package with storyboard, color palette, character design, and shot-by-shot video production.
          </p>
          <NewCampaignDialog onCreated={refetch} />
        </div>
      )}

      {/* Campaign Grid */}
      {campaigns && campaigns.length > 0 && (
        <div className="grid grid-cols-2 gap-4">
          {campaigns.map((campaign) => (
            <CampaignCard
              key={campaign.id}
              campaign={campaign}
              onSelect={setSelectedCampaignId}
              onDelete={(id) => deleteMutation.mutate({ id })}
            />
          ))}
        </div>
      )}
    </div>
  );
}
