import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { getAudioScript, AudioGuidanceContext } from "../lib/bengaliAudioGuidance";
import { ParentSimpleGuideCard } from "../components/ParentSimpleGuideCard";

describe("Bengali Audio Voice Guidance Feature", () => {
  const mockContext: AudioGuidanceContext = {
    ownerName: "Tanmoy Sharma",
    loanEmiFormatted: "₹16,166",
    loanDueDay: "24th",
    loanUpi: "tanmoyr450-1@oksbi",
    loanLender: "HDFC Bank",
    loanAccount: "1008001234",
  };

  describe("getAudioScript (Spoken Content Generator)", () => {
    it("generates empathetic Bengali scripts for all 5 emergency guidance topics", () => {
      const mfScript = getAudioScript("mf", "bn", mockContext);
      expect(mfScript.title).toContain("মিউচুয়াল ফান্ড");
      expect(mfScript.text).toContain("নমস্কার। কোনো রকম উদ্বেগের কারণ নেই।");
      expect(mfScript.text).toContain("ক্যাম্পস বা কে-ফিনটেক");

      const insScript = getAudioScript("insurance", "bn", mockContext);
      expect(insScript.title).toContain("বীমা");
      expect(insScript.text).toContain("ক্যাশলেস");
      expect(insScript.text).toContain("হেলথ ইন্সুরেন্স");

      const loanScript = getAudioScript("loan", "bn", mockContext);
      expect(loanScript.title).toContain("লোনের কিস্তি");
      expect(loanScript.text).toContain("24th তারিখে ₹16,166 টাকা");
      expect(loanScript.text).toContain("tanmoyr450-1@oksbi");

      const bankScript = getAudioScript("bank", "bn", mockContext);
      expect(bankScript.title).toContain("ব্যাংক একাউন্ট");
      expect(bankScript.text).toContain("নমিনী");

      const rulesScript = getAudioScript("rules", "bn", mockContext);
      expect(rulesScript.title).toContain("সতর্কবার্তা");
      expect(rulesScript.text).toContain("ওটিপি বা এটিএম পিন");
    });

    it("generates clear English scripts when language is switched to en", () => {
      const mfScript = getAudioScript("mf", "en", mockContext);
      expect(mfScript.title).toBe("How to Claim Mutual Funds and Stocks");
      expect(mfScript.text).toContain("CAMS and KFintech");

      const loanScript = getAudioScript("loan", "en", mockContext);
      expect(loanScript.title).toBe("Car Loan EMI Payment Instructions");
      expect(loanScript.text).toContain("tanmoyr450-1@oksbi");
    });
  });

  describe("ParentSimpleGuideCard with Audio Guide Player", () => {
    let mockSpeak: any;
    let mockCancel: any;
    let mockPause: any;
    let mockResume: any;

    beforeEach(() => {
      mockSpeak = vi.fn((utterance: SpeechSynthesisUtterance) => {
        // simulate onstart
        if (utterance.onstart) {
          (utterance.onstart as any)(new Event("start"));
        }
      });
      mockCancel = vi.fn();
      mockPause = vi.fn();
      mockResume = vi.fn();

      const mockVoices = [
        {
          name: "Bangla India",
          lang: "bn-IN",
          default: false,
          localService: true,
          voiceURI: "bn-IN-voice",
        },
        {
          name: "English India",
          lang: "en-IN",
          default: false,
          localService: true,
          voiceURI: "en-IN-voice",
        },
      ];

      // Polyfill window.speechSynthesis for testing environment
      Object.defineProperty(window, "speechSynthesis", {
        writable: true,
        value: {
          speak: mockSpeak,
          cancel: mockCancel,
          pause: mockPause,
          resume: mockResume,
          getVoices: vi.fn(() => mockVoices),
          onvoiceschanged: null,
        },
      });

      // Polyfill SpeechSynthesisUtterance constructor
      class MockSpeechSynthesisUtterance {
        text: string;
        lang: string = "";
        voice: any = null;
        rate: number = 1.0;
        pitch: number = 1.0;
        onstart: ((this: SpeechSynthesisUtterance, ev: SpeechSynthesisEvent) => any) | null = null;
        onend: ((this: SpeechSynthesisUtterance, ev: SpeechSynthesisEvent) => any) | null = null;
        onerror: ((this: SpeechSynthesisUtterance, ev: SpeechSynthesisErrorEvent) => any) | null = null;
        onpause: ((this: SpeechSynthesisUtterance, ev: SpeechSynthesisEvent) => any) | null = null;
        onresume: ((this: SpeechSynthesisUtterance, ev: SpeechSynthesisEvent) => any) | null = null;

        constructor(text?: string) {
          this.text = text || "";
        }
      }

      Object.defineProperty(window, "SpeechSynthesisUtterance", {
        writable: true,
        value: MockSpeechSynthesisUtterance,
      });
    });

    it("renders voice guidance bar with Bengali audio button and passes axe", async () => {
      const { container } = render(
        <ParentSimpleGuideCard
          ownerName="Tanmoy Sharma"
          loans={[
            {
              lender: "HDFC Bank",
              account_number: "1008001234",
              emi_paise: 1616600,
              due_day: 24,
              payment_instructions: { upi_id: "tanmoyr450-1@oksbi" },
            },
          ]}
        />,
      );

      // Verify the voice guidance player is visible
      expect(
        screen.getByRole("region", { name: /অডিও ভয়েস নির্দেশিকা/i }),
      ).toBeInTheDocument();

      const playBtn = screen.getByRole("button", { name: /অডিও শুনুন \(বাংলায়\)/i });
      expect(playBtn).toBeInTheDocument();

      // Speed control button defaults to 0.85x calm rate
      const speedBtn = screen.getByRole("button", { name: /পড়ার গতি: ধীর গতি \(০\.৮৫x\)/i });
      expect(speedBtn).toBeInTheDocument();

      // Accessibility check
      expect(await axe(container)).toHaveNoViolations();
    });

    it("plays Bengali speech when user clicks play, selecting bn-IN voice", async () => {
      const user = userEvent.setup();
      render(
        <ParentSimpleGuideCard
          ownerName="Tanmoy Sharma"
          loans={[
            {
              lender: "HDFC Bank",
              account_number: "1008001234",
              emi_paise: 1616600,
              due_day: 24,
              payment_instructions: { upi_id: "tanmoyr450-1@oksbi" },
            },
          ]}
        />,
      );

      const playBtn = screen.getByRole("button", { name: /অডিও শুনুন \(বাংলায়\)/i });
      await user.click(playBtn);

      expect(mockSpeak).toHaveBeenCalled();
      const calledUtterance = mockSpeak.mock.calls[0][0];
      expect(calledUtterance.lang).toBe("bn-IN");
      expect(calledUtterance.rate).toBe(0.85);
      expect(calledUtterance.voice.lang).toBe("bn-IN");
      expect(calledUtterance.text).toContain("নমস্কার। কোনো রকম উদ্বেগের কারণ নেই।");

      // Now should show pause button and playing badge
      expect(screen.getByText(/এখন শুনছেন/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /থামান \(pause\)/i })).toBeInTheDocument();
    });

    it("stops audio playback when switching tabs or language", async () => {
      const user = userEvent.setup();
      render(
        <ParentSimpleGuideCard
          ownerName="Tanmoy Sharma"
          loans={[
            {
              lender: "HDFC Bank",
              account_number: "1008001234",
              emi_paise: 1616600,
              due_day: 24,
              payment_instructions: { upi_id: "tanmoyr450-1@oksbi" },
            },
          ]}
        />,
      );

      // Start audio
      const playBtn = screen.getByRole("button", { name: /অডিও শুনুন \(বাংলায়\)/i });
      await user.click(playBtn);
      expect(mockSpeak).toHaveBeenCalledTimes(1);

      // Switch tab to Car Loan EMI
      const loanTab = screen.getByRole("tab", { name: /গাড়ির লোন emi/i });
      await user.click(loanTab);

      // Verify speech is stopped
      expect(mockCancel).toHaveBeenCalled();

      // Play audio on loan tab
      const loanPlayBtn = screen.getByRole("button", { name: /অডিও শুনুন \(বাংলায়\)/i });
      await user.click(loanPlayBtn);

      const secondUtterance = mockSpeak.mock.calls[1][0];
      expect(secondUtterance.text).toContain("গাড়ির লোনের কিস্তি");
      expect(secondUtterance.text).toContain("tanmoyr450-1@oksbi");
    });

    it("toggles playback speed between 0.85x (calm) and 1.0x (normal)", async () => {
      const user = userEvent.setup();
      render(<ParentSimpleGuideCard ownerName="Tanmoy Sharma" />);

      const speedBtn = screen.getByRole("button", { name: /পড়ার গতি: ধীর গতি \(০\.৮৫x\)/i });
      await user.click(speedBtn);

      // Should now be 1.0x
      expect(
        screen.getByRole("button", { name: /পড়ার গতি: স্বাভাবিক \(১\.০x\)/i }),
      ).toBeInTheDocument();
    });
  });
});
