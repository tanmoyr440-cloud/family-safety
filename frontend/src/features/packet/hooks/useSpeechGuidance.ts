import * as React from "react";

export interface SpeechGuidanceState {
  isSupported: boolean;
  isPlaying: boolean;
  isPaused: boolean;
  speed: number;
  activeTopicId: string | null;
  speak: (text: string, lang: "bn" | "en", topicId?: string) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  setSpeed: (speed: number) => void;
  toggleSpeed: () => void;
}

export function useSpeechGuidance(): SpeechGuidanceState {
  const [isSupported, setIsSupported] = React.useState<boolean>(false);
  const [isPlaying, setIsPlaying] = React.useState<boolean>(false);
  const [isPaused, setIsPaused] = React.useState<boolean>(false);
  const [speed, setSpeedState] = React.useState<number>(0.85); // 0.85x calm rate for seniors
  const [activeTopicId, setActiveTopicId] = React.useState<string | null>(null);
  const [voices, setVoices] = React.useState<SpeechSynthesisVoice[]>([]);

  // Reference to current active utterance and text for speed adjustments
  const currentTextRef = React.useRef<{ text: string; lang: "bn" | "en"; topicId?: string } | null>(null);

  React.useEffect(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      setIsSupported(true);

      const updateVoices = () => {
        try {
          const availableVoices = window.speechSynthesis.getVoices();
          setVoices(availableVoices);
        } catch {
          // Ignore voice fetching errors on restricted webviews
        }
      };

      updateVoices();
      window.speechSynthesis.onvoiceschanged = updateVoices;

      return () => {
        try {
          window.speechSynthesis.cancel();
        } catch {
          // ignore
        }
      };
    }
  }, []);

  const stop = React.useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    }
    setIsPlaying(false);
    setIsPaused(false);
    setActiveTopicId(null);
    currentTextRef.current = null;
  }, []);

  const pause = React.useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        window.speechSynthesis.pause();
        setIsPaused(true);
      } catch {
        // ignore
      }
    }
  }, []);

  const resume = React.useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        window.speechSynthesis.resume();
        setIsPaused(false);
      } catch {
        // ignore
      }
    }
  }, []);

  const speak = React.useCallback(
    (text: string, lang: "bn" | "en", topicId?: string) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) {
        return;
      }

      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }

      currentTextRef.current = { text, lang, topicId };

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = speed;
      utterance.pitch = 1.0;

      // Select matching voice
      if (lang === "bn") {
        utterance.lang = "bn-IN";
        const bnVoice = voices.find(
          (v) =>
            v.lang.toLowerCase().startsWith("bn") ||
            v.name.toLowerCase().includes("bengali") ||
            v.name.toLowerCase().includes("bangla"),
        );
        if (bnVoice) {
          utterance.voice = bnVoice;
        }
      } else {
        utterance.lang = "en-IN";
        const enVoice = voices.find((v) => v.lang.toLowerCase().startsWith("en-in")) ||
          voices.find((v) => v.lang.toLowerCase().startsWith("en"));
        if (enVoice) {
          utterance.voice = enVoice;
        }
      }

      utterance.onstart = () => {
        setIsPlaying(true);
        setIsPaused(false);
        setActiveTopicId(topicId || null);
      };

      utterance.onend = () => {
        setIsPlaying(false);
        setIsPaused(false);
        setActiveTopicId(null);
      };

      utterance.onerror = () => {
        setIsPlaying(false);
        setIsPaused(false);
        setActiveTopicId(null);
      };

      try {
        window.speechSynthesis.speak(utterance);
      } catch {
        setIsPlaying(false);
        setIsPaused(false);
      }
    },
    [speed, voices],
  );

  const setSpeed = React.useCallback(
    (newSpeed: number) => {
      setSpeedState(newSpeed);
      // If currently playing, restart at new speed smoothly
      if (isPlaying && currentTextRef.current) {
        const { text, lang, topicId } = currentTextRef.current;
        speak(text, lang, topicId);
      }
    },
    [isPlaying, speak],
  );

  const toggleSpeed = React.useCallback(() => {
    const nextSpeed = speed <= 0.85 ? 1.0 : 0.85;
    setSpeed(nextSpeed);
  }, [setSpeed, speed]);

  return React.useMemo(
    () => ({
      isSupported,
      isPlaying,
      isPaused,
      speed,
      activeTopicId,
      speak,
      pause,
      resume,
      stop,
      setSpeed,
      toggleSpeed,
    }),
    [
      isSupported,
      isPlaying,
      isPaused,
      speed,
      activeTopicId,
      speak,
      pause,
      resume,
      stop,
      setSpeed,
      toggleSpeed,
    ],
  );
}
