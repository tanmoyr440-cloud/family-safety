import { describe, it, expect } from "vitest";
import { maskPhone, maskAccount } from "./masks";

describe("Masking helpers", () => {
  describe("maskPhone", () => {
    it("masks standard 10-digit Indian numbers", () => {
      expect(maskPhone("9876543210")).toBe("+91 98*** **210");
    });

    it("masks +91 prefixed Indian numbers", () => {
      expect(maskPhone("+919876543210")).toBe("+91 98*** **210");
      expect(maskPhone("+91 98765 43210")).toBe("+91 98*** **210");
    });

    it("handles null or undefined safely", () => {
      expect(maskPhone(null)).toBe("—");
      expect(maskPhone(undefined)).toBe("—");
      expect(maskPhone("")).toBe("—");
    });

    it("handles short or generic numbers gracefully", () => {
      expect(maskPhone("+123456789")).toBe("+12****789");
    });
  });

  describe("maskAccount", () => {
    it("masks standard account numbers to last 4 digits", () => {
      expect(maskAccount("123456781234")).toBe("XXXX1234");
      expect(maskAccount("ACC987654321")).toBe("XXXX4321");
    });

    it("leaves short accounts unchanged or handles null", () => {
      expect(maskAccount("1234")).toBe("1234");
      expect(maskAccount(null)).toBe("—");
      expect(maskAccount(undefined)).toBe("—");
    });
  });
});
