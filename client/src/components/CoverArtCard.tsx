/**
 * CoverArtCard — Phase N
 *
 * Displays the cover art for a campaign with:
 *   - 1:1 square display with placeholder state
 *   - Arc position selector (Gathering / Arriving / Open)
 *   - Three-option edit menu: Upload Image, Generate Cover Art, Regenerate
 *   - Regeneration limit indicator
 *   - Loading overlay during generation
 *   - Upload flow via /api/mood-board/upload (reuses existing endpoint)
 */

import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ImagePlus, RefreshCw, Upload, Pencil, Sparkles, Loader2, Lock } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type ArcPosition = "gathering" | "arriving" | "open";

interface CoverArtCardProps {
  campaignId: number;
  /** Current cover art URL (null if none set) */
  coverArtUrl?: string | null;
  /** Current cover art source */
  coverArtSource?: "generated" | "uploaded" | "none";
  /** Current arc position stored on the campaign */
  arcPosition?: ArcPosition;
  /** Current regeneration count */
  coverArtRegenerationsUsed?: number;
  /** Song lyrics if available (from linked audio track) */
  lyrics?: string;
  /** Campaign genre for production context */
  genre?: string;
  /** Called after any successful cover art change so parent can refetch */
  onCoverArtChanged?: () => void;
  /** Called when arc position is changed */
  onArcPositionChanged?: (position: ArcPosition) => void;
}

// ─── Arc Position Config ──────────────────────────────────────────────────────

const ARC_POSITIONS: {
  id: ArcPosition;
  label: string;
  shortLabel: string;
  description: string;
}[] = [
  {
    id: "gathering",
    label: "Gathering",
    shortLabel: "Gathering",
    description: "Intimate and compressed — the world before the song begins. Close, private, held.",
  },
  {
    id: "arriving",
    label: "Arriving",
    shortLabel: "Arriving",
    description: "Threshold and expanding — the moment of entry. The song is happening now.",
  },
  {
    id: "open",
    label: "Open",
    shortLabel: "Open",
    description: "Vast and resolved — the world after the song. Spacious, released, remembered.",
  },
];

const REGEN_LIMIT = 3;

// ─── Component ────────────────────────────────────────────────────────────────

export function CoverArtCard({
  campaignId,
  coverArtUrl,
  coverArtSource = "none",
  arcPosition: initialArcPosition = "arriving",
  coverArtRegenerationsUsed = 0,
  lyrics,
  genre,
  onCoverArtChanged,
  onArcPositionChanged,
}: CoverArtCardProps) {
  const [arcPosition, setArcPosition] = useState<ArcPosition>(initialArcPosition);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const regenRemaining = Math.max(0, REGEN_LIMIT - coverArtRegenerationsUsed);
  const canRegenerate = coverArtSource === "generated" && regenRemaining > 0;
  const hasArt = !!coverArtUrl && coverArtSource !== "none";

  // ── tRPC mutations ──────────────────────────────────────────────────────────

  const generateMutation = trpc.coverArt.generate.useMutation({
    onSuccess: (result) => {
      toast.success(
        result.isFirstGeneration
          ? "Cover art generated."
          : `Cover art regenerated. ${Math.max(0, REGEN_LIMIT - (coverArtRegenerationsUsed + 1))} regeneration${Math.max(0, REGEN_LIMIT - (coverArtRegenerationsUsed + 1)) === 1 ? "" : "s"} remaining.`
      );
      onCoverArtChanged?.();
    },
    onError: (err) => {
      toast.error(err.message ?? "Cover art generation failed.");
    },
    onSettled: () => setIsGenerating(false),
  });

  const setFromUploadMutation = trpc.coverArt.setFromUpload.useMutation({
    onSuccess: () => {
      toast.success("Cover art updated.");
      onCoverArtChanged?.();
    },
    onError: (err) => {
      toast.error(err.message ?? "Failed to save cover art.");
    },
    onSettled: () => setIsUploading(false),
  });

  // ── Arc position change ─────────────────────────────────────────────────────

  const handleArcChange = (position: ArcPosition) => {
    setArcPosition(position);
    onArcPositionChanged?.(position);
  };

  // ── Generate ────────────────────────────────────────────────────────────────

  const handleGenerate = (isRegeneration: boolean) => {
    if (isRegeneration && !canRegenerate) {
      toast.error("Regeneration limit reached — upload your own image to change cover art.");
      return;
    }
    setIsGenerating(true);
    generateMutation.mutate({
      campaignId,
      arcPosition,
      lyrics: lyrics ?? undefined,
      genre: genre ?? undefined,
      isRegeneration,
    });
  };

  // ── Upload ──────────────────────────────────────────────────────────────────

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type and size (max 10MB)
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image must be under 10MB.");
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/mood-board/upload", { method: "POST", body: formData });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Upload failed");
      }
      const { url } = await res.json();
      await setFromUploadMutation.mutateAsync({ campaignId, coverArtUrl: url });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
      setIsUploading(false);
    } finally {
      e.target.value = "";
    }
  };

  const isBusy = isGenerating || isUploading;

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-3">
      {/* Cover Art Display */}
      <div className="relative group">
        <div className="aspect-square w-full max-w-[280px] mx-auto rounded-lg overflow-hidden bg-zinc-900 border border-zinc-800">
          {hasArt ? (
            <img
              src={coverArtUrl!}
              alt="Campaign cover art"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-zinc-600">
              <ImagePlus className="w-10 h-10" />
              <span className="text-xs text-center px-4 leading-relaxed">
                No cover art yet.<br />Generate or upload below.
              </span>
            </div>
          )}

          {/* Loading overlay */}
          {isBusy && (
            <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-3 rounded-lg">
              <Loader2 className="w-8 h-8 text-rose-400 animate-spin" />
              <span className="text-xs text-zinc-300">
                {isGenerating ? "Generating cover art..." : "Uploading..."}
              </span>
            </div>
          )}
        </div>

        {/* Source badge */}
        {hasArt && !isBusy && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2">
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium tracking-wider uppercase ${
              coverArtSource === "generated"
                ? "bg-rose-900/80 text-rose-300 border border-rose-800/50"
                : "bg-zinc-800/80 text-zinc-400 border border-zinc-700/50"
            }`}>
              {coverArtSource === "generated" ? "AI Generated" : "Uploaded"}
            </span>
          </div>
        )}
      </div>

      {/* Arc Position Selector */}
      <div className="max-w-[280px] mx-auto space-y-1.5">
        <div className="text-[10px] text-zinc-500 uppercase tracking-wider text-center">Arc Position</div>
        <TooltipProvider delayDuration={300}>
          <div className="grid grid-cols-3 gap-1">
            {ARC_POSITIONS.map((arc) => (
              <Tooltip key={arc.id}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => handleArcChange(arc.id)}
                    disabled={isBusy}
                    className={`px-2 py-1.5 rounded text-xs font-medium transition-all ${
                      arcPosition === arc.id
                        ? "bg-rose-800/60 text-rose-200 border border-rose-700/60"
                        : "bg-zinc-800/40 text-zinc-500 border border-zinc-700/40 hover:text-zinc-300 hover:border-zinc-600/60"
                    } disabled:opacity-40 disabled:cursor-not-allowed`}
                  >
                    {arc.shortLabel}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[200px] text-center text-xs">
                  <p className="font-medium mb-0.5">{arc.label}</p>
                  <p className="text-zinc-400">{arc.description}</p>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </TooltipProvider>
      </div>

      {/* Edit Controls */}
      <div className="max-w-[280px] mx-auto">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              disabled={isBusy}
              className="w-full gap-2 border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-500 bg-zinc-900/60"
            >
              <Pencil className="w-3.5 h-3.5" />
              {isBusy
                ? isGenerating ? "Generating..." : "Uploading..."
                : hasArt ? "Change Cover Art" : "Add Cover Art"}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" className="w-56 bg-zinc-900 border-zinc-700">
            {/* Upload */}
            <DropdownMenuItem
              onClick={() => fileInputRef.current?.click()}
              className="gap-2 text-zinc-300 hover:text-white cursor-pointer"
            >
              <Upload className="w-4 h-4 text-zinc-400" />
              <div>
                <div className="text-sm">Upload Image</div>
                <div className="text-xs text-zinc-500">JPG, PNG, WebP — max 10MB</div>
              </div>
            </DropdownMenuItem>

            <DropdownMenuSeparator className="bg-zinc-800" />

            {/* Generate (first time) */}
            {!hasArt && (
              <DropdownMenuItem
                onClick={() => handleGenerate(false)}
                className="gap-2 text-zinc-300 hover:text-white cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-rose-400" />
                <div>
                  <div className="text-sm">Generate Cover Art</div>
                  <div className="text-xs text-zinc-500">Uses your Visual Universe + lyrics</div>
                </div>
              </DropdownMenuItem>
            )}

            {/* Regenerate (when art exists) */}
            {hasArt && coverArtSource === "generated" && (
              <>
                {canRegenerate ? (
                  <DropdownMenuItem
                    onClick={() => handleGenerate(true)}
                    className="gap-2 text-zinc-300 hover:text-white cursor-pointer"
                  >
                    <RefreshCw className="w-4 h-4 text-rose-400" />
                    <div>
                      <div className="text-sm">Regenerate</div>
                      <div className="text-xs text-zinc-500">
                        {regenRemaining} of {REGEN_LIMIT} remaining
                      </div>
                    </div>
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    disabled
                    className="gap-2 text-zinc-600 cursor-not-allowed"
                  >
                    <Lock className="w-4 h-4" />
                    <div>
                      <div className="text-sm">Regeneration limit reached</div>
                      <div className="text-xs text-zinc-600">Upload your own image to change</div>
                    </div>
                  </DropdownMenuItem>
                )}
              </>
            )}

            {/* Generate (when uploaded art exists) */}
            {hasArt && coverArtSource === "uploaded" && (
              <DropdownMenuItem
                onClick={() => handleGenerate(false)}
                className="gap-2 text-zinc-300 hover:text-white cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-rose-400" />
                <div>
                  <div className="text-sm">Generate Cover Art</div>
                  <div className="text-xs text-zinc-500">Replace upload with AI-generated art</div>
                </div>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Regen count indicator — only shown when art is generated and limit is being approached */}
      {coverArtSource === "generated" && coverArtRegenerationsUsed > 0 && (
        <div className="max-w-[280px] mx-auto">
          <div className="flex items-center justify-center gap-1.5">
            {Array.from({ length: REGEN_LIMIT }).map((_, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  i < coverArtRegenerationsUsed
                    ? "bg-rose-700/60"
                    : "bg-zinc-700/40"
                }`}
              />
            ))}
          </div>
          <div className="text-center text-[10px] text-zinc-600 mt-1">
            {regenRemaining > 0
              ? `${regenRemaining} regeneration${regenRemaining === 1 ? "" : "s"} remaining`
              : "Regeneration limit reached"}
          </div>
        </div>
      )}
    </div>
  );
}
