import * as React from "react";
import {
  Volume2,
  Play,
  Pause,
  RotateCcw,
  Gauge,
  Sparkles,
} from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { SpeechGuidanceState } from "../hooks/useSpeechGuidance";

export interface AudioGuidePlayerProps {
  speech: SpeechGuidanceState;
  script: { title: string; text: string };
  lang: "bn" | "en";
  topicId: string;
}

export const AudioGuidePlayer: React.FC<AudioGuidePlayerProps> = ({
  speech,
  script,
  lang,
  topicId,
}) => {
  const isBengali = lang === "bn";
  const { isSupported, isPlaying, isPaused, speed, speak, pause, resume, stop, toggleSpeed } =
    speech;

  const handleMainAction = () => {
    if (isPlaying) {
      pause();
    } else if (isPaused) {
      resume();
    } else {
      speak(script.text, lang, topicId);
    }
  };

  if (!isSupported) {
    return null;
  }

  const isCurrentTopicPlaying = (isPlaying || isPaused) && speech.activeTopicId === topicId;

  return (
    <div
      className={cn(
        "rounded-2xl border p-3.5 sm:p-4 transition-all duration-300 shadow-xs",
        isCurrentTopicPlaying
          ? "bg-gradient-to-r from-emerald-50 via-teal-50/60 to-blue-50/80 border-emerald-300 ring-2 ring-emerald-500/20"
          : "bg-gradient-to-r from-blue-50/90 via-indigo-50/50 to-white border-blue-200/90",
      )}
      role="region"
      aria-label={isBengali ? "অডিও ভয়েস নির্দেশিকা" : "Voice Audio Guidance"}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Left: Indicator & Description */}
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "h-10 w-10 rounded-xl flex items-center justify-center shrink-0 transition-transform shadow-xs",
              isCurrentTopicPlaying
                ? "bg-emerald-600 text-white animate-pulse"
                : "bg-blue-600 text-white",
            )}
          >
            {isCurrentTopicPlaying ? (
              <Volume2 className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Sparkles className="h-5 w-5" aria-hidden="true" />
            )}
          </div>

          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs sm:text-sm text-slate-900">
                {isBengali ? "ভয়েস সহায়িকা (অডিও নির্দেশিকা)" : "Voice Guidance (Audio Explainer)"}
              </span>
              {isCurrentTopicPlaying && (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                  {isPaused
                    ? isBengali
                      ? "বিরতি"
                      : "Paused"
                    : isBengali
                      ? "এখন শুনছেন"
                      : "Speaking"}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-600">
              {isBengali
                ? "বয়োজ্যেষ্ঠদের সুবিধার জন্য সহজ ও স্পষ্ট উচ্চারণে পড়ে শোনানো হবে"
                : "Spoken aloud clearly and calmly for parents who prefer listening"}
            </p>
          </div>
        </div>

        {/* Right: Controls */}
        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          {/* Speed Toggle */}
          <button
            type="button"
            onClick={toggleSpeed}
            title={isBengali ? "পড়ার গতি পরিবর্তন করুন" : "Toggle voice speed"}
            className={cn(
              "px-2.5 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all shadow-2xs",
              speed <= 0.85
                ? "bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50/50"
                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50",
            )}
            aria-label={
              isBengali
                ? `পড়ার গতি: ${speed <= 0.85 ? "ধীর গতি (০.৮৫x)" : "স্বাভাবিক (১.০x)"}`
                : `Voice speed: ${speed}x`
            }
          >
            <Gauge className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
            <span>
              {speed <= 0.85
                ? isBengali
                  ? "০.৮৫x ধীর"
                  : "0.85x Calm"
                : isBengali
                  ? "১.০x সাধারণ"
                  : "1.0x Normal"}
            </span>
          </button>

          {/* Stop Button (only when active) */}
          {isCurrentTopicPlaying && (
            <button
              type="button"
              onClick={stop}
              className="p-2 rounded-xl bg-white text-slate-600 border border-slate-200 hover:text-rose-600 hover:border-rose-200 transition-all shadow-2xs"
              title={isBengali ? "অডিও বন্ধ করুন" : "Stop audio"}
              aria-label={isBengali ? "অডিও বন্ধ করুন" : "Stop audio"}
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
            </button>
          )}

          {/* Main Play / Pause Button */}
          <button
            type="button"
            onClick={handleMainAction}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-xs active:scale-95",
              isCurrentTopicPlaying && !isPaused
                ? "bg-amber-600 hover:bg-amber-700 text-white"
                : isCurrentTopicPlaying && isPaused
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                  : "bg-blue-600 hover:bg-blue-700 text-white",
            )}
            aria-pressed={isCurrentTopicPlaying && !isPaused}
          >
            {isCurrentTopicPlaying && !isPaused ? (
              <>
                <Pause className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{isBengali ? "থামান (Pause)" : "Pause Audio"}</span>
              </>
            ) : isCurrentTopicPlaying && isPaused ? (
              <>
                <Play className="h-4 w-4 shrink-0 fill-current" aria-hidden="true" />
                <span>{isBengali ? "পুনরায় চালু করুন" : "Resume Audio"}</span>
              </>
            ) : (
              <>
                <Volume2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{isBengali ? "অডিও শুনুন (বাংলায়)" : "Listen to Guide"}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Spoken text transcript preview when speaking */}
      {isCurrentTopicPlaying && (
        <div className="mt-3 pt-3 border-t border-emerald-200/60 flex items-start gap-2 text-xs text-slate-700 bg-white/70 p-2.5 rounded-xl border border-emerald-100">
          <Volume2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="space-y-1">
            <span className="font-semibold text-emerald-900 block">
              {script.title}:
            </span>
            <p className="text-slate-600 text-[11px] leading-relaxed line-clamp-3">
              "{script.text}"
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
