/**
 * FindYourFrequency — Phase O
 *
 * 5-screen diagnostic onboarding flow:
 *   Screen 1 — Introduction
 *   Screen 2 — Question 1 (the music that knew you)
 *   Screen 3 — Questions 2, 3, 4
 *   Screen 4 — Loading → Reflection (LLM-generated, creator's own words)
 *   Screen 5 — Vocabulary Preview + Name Your Frequency
 *
 * Inherits the Studios dark aesthetic — deep black, rose accents, light tracking.
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2, ChevronRight, ChevronLeft, Sparkles, Check, Radio } from "lucide-react";
import { useLocation } from "wouter";

// ─── Types ────────────────────────────────────────────────────────────────────

type Screen = "intro" | "q1" | "q234" | "reflection" | "vocabulary";

interface DiagnosticAnswers {
  q1: string;
  q2: string;
  q3: string;
  q4: string;
}

interface SynthesisResult {
  reflection: string;
  suggestedName: string;
  arcType: string;
  vocabulary: VocabularyJson;
  diagnosticAnswers: DiagnosticAnswers;
}

interface VocabTerm {
  term: string;
  instruction: string;
}

interface VocabularyJson {
  environment: VocabTerm[];
  emotionalRegister: VocabTerm[];
  arcTerms: VocabTerm[];
  forbiddenTerms: VocabTerm[];
  relationshipGeometry: VocabTerm[];
  colorLight: VocabTerm[];
}

// ─── Vocabulary category config ───────────────────────────────────────────────

const VOCAB_CATEGORIES: { key: keyof VocabularyJson; label: string; description: string }[] = [
  { key: "environment", label: "Environment", description: "The world the image inhabits" },
  { key: "emotionalRegister", label: "Emotional Register", description: "The feeling the image carries" },
  { key: "arcTerms", label: "Arc Terms", description: "The directional movement present" },
  { key: "colorLight", label: "Color & Light", description: "Palette and light source" },
  { key: "relationshipGeometry", label: "Relationship Geometry", description: "The space between figures" },
  { key: "forbiddenTerms", label: "What This Is Not", description: "Explicit exclusions" },
];

// ─── Arc type labels ──────────────────────────────────────────────────────────

const ARC_TYPE_LABELS: Record<string, string> = {
  expansive_mythic: "Expansive Mythic",
  witnessing_lateral: "Witnessing Lateral",
  intimate_relational: "Intimate Relational",
  sustained_ambient: "Sustained Ambient",
  erosive_revelatory: "Erosive Revelatory",
  cyclical_return: "Cyclical Return",
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function FindYourFrequency() {
  const [, navigate] = useLocation();
  const [screen, setScreen] = useState<Screen>("intro");
  const [answers, setAnswers] = useState<DiagnosticAnswers>({ q1: "", q2: "", q3: "", q4: "" });
  const [synthesis, setSynthesis] = useState<SynthesisResult | null>(null);
  const [frequencyName, setFrequencyName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const synthesizeMutation = trpc.frequency.synthesize.useMutation({
    onSuccess: (result) => {
      setSynthesis(result);
      setFrequencyName(result.suggestedName);
      setScreen("vocabulary");
    },
    onError: (err) => {
      toast.error(err.message ?? "Synthesis failed — please try again.");
      setScreen("q234");
    },
  });

  const saveMutation = trpc.frequency.save.useMutation({
    onSuccess: (result) => {
      toast.success(`"${result.frequencyName}" saved as your active frequency.`);
      navigate("/");
    },
    onError: (err) => {
      toast.error(err.message ?? "Failed to save frequency.");
    },
    onSettled: () => setIsSaving(false),
  });

  const handleSynthesize = () => {
    if (!answers.q1.trim() || !answers.q2.trim() || !answers.q3.trim() || !answers.q4.trim()) {
      toast.error("Please answer all four questions before continuing.");
      return;
    }
    setScreen("reflection");
    synthesizeMutation.mutate(answers);
  };

  const handleSave = () => {
    if (!synthesis) return;
    if (!frequencyName.trim()) {
      toast.error("Please give your frequency a name.");
      return;
    }
    setIsSaving(true);
    saveMutation.mutate({
      frequencyName: frequencyName.trim(),
      arcType: synthesis.arcType as Parameters<typeof saveMutation.mutate>[0]["arcType"],
      vocabulary: synthesis.vocabulary,
      synthesisFingerprint: synthesis.reflection,
      diagnosticAnswers: synthesis.diagnosticAnswers,
    });
  };

  // ─── Screen renders ─────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Subtle top accent line */}
      <div className="h-px bg-gradient-to-r from-transparent via-rose-800/60 to-transparent" />

      <div className="max-w-2xl mx-auto px-6 py-16">
        {screen === "intro" && <IntroScreen onStart={() => setScreen("q1")} />}
        {screen === "q1" && (
          <Q1Screen
            value={answers.q1}
            onChange={(v) => setAnswers((a) => ({ ...a, q1: v }))}
            onBack={() => setScreen("intro")}
            onNext={() => setScreen("q234")}
          />
        )}
        {screen === "q234" && (
          <Q234Screen
            answers={answers}
            onChange={(field, value) => setAnswers((a) => ({ ...a, [field]: value }))}
            onBack={() => setScreen("q1")}
            onNext={handleSynthesize}
          />
        )}
        {screen === "reflection" && (
          <ReflectionScreen
            isLoading={synthesizeMutation.isPending}
            reflection={synthesis?.reflection ?? null}
            onFeelsTrue={() => {/* already on vocabulary screen after synthesis */}}
            onAdjust={() => {
              setSynthesis(null);
              setScreen("q234");
            }}
          />
        )}
        {screen === "vocabulary" && synthesis && (
          <VocabularyScreen
            synthesis={synthesis}
            frequencyName={frequencyName}
            onNameChange={setFrequencyName}
            onBack={() => setScreen("q234")}
            onSave={handleSave}
            isSaving={isSaving}
          />
        )}
      </div>
    </div>
  );
}

// ─── Screen 1: Introduction ───────────────────────────────────────────────────

function IntroScreen({ onStart }: { onStart: () => void }) {
  return (
    <div className="space-y-10 animate-in fade-in duration-500">
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-rose-400 text-xs uppercase tracking-widest">
          <Radio className="w-3.5 h-3.5" />
          Strawberry Studios
        </div>
        <h1 className="text-4xl font-light tracking-wide text-white leading-tight">
          Find Your<br />
          <span className="text-rose-300">Frequency</span>
        </h1>
      </div>

      <div className="space-y-4 text-zinc-400 leading-relaxed">
        <p className="text-lg text-zinc-300 font-light italic">
          Same core identity. Spectrum of expression.
        </p>
        <p>
          Every creator has a visual world that belongs to their music — a specific quality of light,
          a particular kind of space, a way that things move or hold still. Most platforms ignore this.
          They generate cover art from genre tags and stock imagery grammar.
        </p>
        <p>
          Find Your Frequency is different. It listens to how you talk about your music — not what
          genre it is, but what it feels like from the inside — and builds a persistent visual vocabulary
          from your own words. That vocabulary becomes the lens through which every piece of cover art
          is generated.
        </p>
        <p>
          Four questions. No right answers. The platform reflects back what it hears.
        </p>
      </div>

      <div className="pt-2">
        <Button
          onClick={onStart}
          className="bg-rose-700 hover:bg-rose-600 gap-2 px-8 py-6 text-base"
        >
          Begin
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

// ─── Screen 2: Question 1 ─────────────────────────────────────────────────────

function Q1Screen({
  value,
  onChange,
  onBack,
  onNext,
}: {
  value: string;
  onChange: (v: string) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <ScreenHeader step={1} total={4} />

      <div className="space-y-4">
        <p className="text-xl font-light text-white leading-relaxed">
          Think of a piece of music that felt like it already knew something about you.
          What was happening in your life when you found it?
        </p>
        <p className="text-sm text-zinc-500">
          Take your time. There's no word limit and no wrong answer.
        </p>
      </div>

      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Write freely..."
        className="min-h-[200px] bg-zinc-900/60 border-zinc-700 text-white placeholder:text-zinc-600 focus:border-rose-700/60 resize-none text-base leading-relaxed"
      />

      <ScreenNav
        onBack={onBack}
        onNext={onNext}
        nextDisabled={value.trim().length < 10}
        nextLabel="Continue"
      />
    </div>
  );
}

// ─── Screen 3: Questions 2, 3, 4 ─────────────────────────────────────────────

function Q234Screen({
  answers,
  onChange,
  onBack,
  onNext,
}: {
  answers: DiagnosticAnswers;
  onChange: (field: keyof DiagnosticAnswers, value: string) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const allAnswered =
    answers.q2.trim().length >= 10 &&
    answers.q3.trim().length >= 10 &&
    answers.q4.trim().length >= 10;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <ScreenHeader step={2} total={4} label="Three more questions" />

      <div className="space-y-6">
        <QuestionBlock
          question="Where does a listener start when they enter your music — and where are they when it ends? Not what happens. What changes inside them."
          value={answers.q2}
          onChange={(v) => onChange("q2", v)}
          placeholder="Describe the internal journey..."
        />
        <QuestionBlock
          question="Is there a feeling your music is specifically not — something you're making space against?"
          value={answers.q3}
          onChange={(v) => onChange("q3", v)}
          placeholder="What does your music refuse to be..."
        />
        <QuestionBlock
          question="If the world your music creates were a single place — not a genre reference, not an album cover — where would it be and what time of day?"
          value={answers.q4}
          onChange={(v) => onChange("q4", v)}
          placeholder="A place and a time..."
        />
      </div>

      <ScreenNav
        onBack={onBack}
        onNext={onNext}
        nextDisabled={!allAnswered}
        nextLabel="Listen to my answers"
        nextIcon={<Sparkles className="w-4 h-4" />}
      />
    </div>
  );
}

// ─── Screen 4: Reflection ─────────────────────────────────────────────────────

function ReflectionScreen({
  isLoading,
  reflection,
  onFeelsTrue,
  onAdjust,
}: {
  isLoading: boolean;
  reflection: string | null;
  onFeelsTrue: () => void;
  onAdjust: () => void;
}) {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-6">
          <Loader2 className="w-10 h-10 text-rose-400 animate-spin" />
          <div className="text-center space-y-2">
            <p className="text-zinc-300 text-lg font-light">Listening...</p>
            <p className="text-zinc-500 text-sm">Reading your answers for what they carry.</p>
          </div>
        </div>
      ) : reflection ? (
        <div className="space-y-8">
          <div className="space-y-2">
            <div className="text-xs text-rose-400 uppercase tracking-widest">What I heard</div>
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-6">
              <p className="text-zinc-200 text-lg font-light leading-relaxed italic">
                "{reflection}"
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={onFeelsTrue}
              className="bg-rose-700 hover:bg-rose-600 gap-2 flex-1"
            >
              <Check className="w-4 h-4" />
              That feels true
            </Button>
            <Button
              onClick={onAdjust}
              variant="outline"
              className="border-zinc-700 text-zinc-300 hover:text-white flex-1"
            >
              Something's off — let me adjust
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ─── Screen 5: Vocabulary Preview + Name ─────────────────────────────────────

function VocabularyScreen({
  synthesis,
  frequencyName,
  onNameChange,
  onBack,
  onSave,
  isSaving,
}: {
  synthesis: SynthesisResult;
  frequencyName: string;
  onNameChange: (name: string) => void;
  onBack: () => void;
  onSave: () => void;
  isSaving: boolean;
}) {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="space-y-2">
        <div className="text-xs text-rose-400 uppercase tracking-widest">Your Visual Universe</div>
        <p className="text-zinc-400 text-sm leading-relaxed">
          This vocabulary was built from your words. It will be used to generate cover art that
          reflects your music's actual visual world — not a genre template.
        </p>
      </div>

      {/* Arc type badge */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-zinc-500 uppercase tracking-wider">Arc type:</span>
        <span className="text-xs bg-rose-900/40 text-rose-300 border border-rose-800/50 px-2 py-0.5 rounded-full">
          {ARC_TYPE_LABELS[synthesis.arcType] ?? synthesis.arcType}
        </span>
      </div>

      {/* Vocabulary grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {VOCAB_CATEGORIES.map(({ key, label, description }) => {
          const terms = synthesis.vocabulary[key];
          if (!terms || terms.length === 0) return null;
          return (
            <div key={key} className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-4 space-y-3">
              <div>
                <div className="text-xs text-rose-400 uppercase tracking-wider font-medium">{label}</div>
                <div className="text-xs text-zinc-600 mt-0.5">{description}</div>
              </div>
              <div className="space-y-2">
                {terms.map((term, i) => (
                  <div key={i} className="space-y-0.5">
                    <div className="text-sm text-white font-medium">{term.term}</div>
                    <div className="text-xs text-zinc-500 leading-relaxed">{term.instruction}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Name your frequency */}
      <div className="space-y-3 pt-2 border-t border-zinc-800">
        <div>
          <label className="text-sm text-zinc-300 font-medium">Name your frequency</label>
          <p className="text-xs text-zinc-500 mt-0.5">
            We suggested "{synthesis.suggestedName}" — change it to anything that feels right.
          </p>
        </div>
        <Input
          value={frequencyName}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="e.g. Blooming Frontier"
          maxLength={100}
          className="bg-zinc-900/60 border-zinc-700 text-white placeholder:text-zinc-600 focus:border-rose-700/60 text-lg"
        />
      </div>

      {/* Save controls */}
      <div className="flex gap-3 pt-2">
        <Button
          variant="ghost"
          onClick={onBack}
          className="text-zinc-500 hover:text-zinc-300 gap-1"
        >
          <ChevronLeft className="w-4 h-4" />
          Adjust answers
        </Button>
        <Button
          onClick={onSave}
          disabled={isSaving || !frequencyName.trim()}
          className="bg-rose-700 hover:bg-rose-600 gap-2 flex-1"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Check className="w-4 h-4" />
              Save My Frequency
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function ScreenHeader({
  step,
  total,
  label,
}: {
  step: number;
  total: number;
  label?: string;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="flex gap-1">
          {Array.from({ length: total }).map((_, i) => (
            <div
              key={i}
              className={`h-1 w-8 rounded-full transition-colors ${
                i < step ? "bg-rose-600" : "bg-zinc-800"
              }`}
            />
          ))}
        </div>
        <span className="text-xs text-zinc-500">
          {label ?? `Question ${step} of ${total}`}
        </span>
      </div>
    </div>
  );
}

function QuestionBlock({
  question,
  value,
  onChange,
  placeholder,
}: {
  question: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="space-y-3">
      <p className="text-base text-zinc-200 font-light leading-relaxed">{question}</p>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-h-[100px] bg-zinc-900/60 border-zinc-700 text-white placeholder:text-zinc-600 focus:border-rose-700/60 resize-none leading-relaxed"
      />
    </div>
  );
}

function ScreenNav({
  onBack,
  onNext,
  nextDisabled,
  nextLabel,
  nextIcon,
}: {
  onBack: () => void;
  onNext: () => void;
  nextDisabled?: boolean;
  nextLabel: string;
  nextIcon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between pt-2">
      <Button
        variant="ghost"
        onClick={onBack}
        className="text-zinc-500 hover:text-zinc-300 gap-1"
      >
        <ChevronLeft className="w-4 h-4" />
        Back
      </Button>
      <Button
        onClick={onNext}
        disabled={nextDisabled}
        className="bg-rose-700 hover:bg-rose-600 gap-2 disabled:opacity-40"
      >
        {nextLabel}
        {nextIcon ?? <ChevronRight className="w-4 h-4" />}
      </Button>
    </div>
  );
}
