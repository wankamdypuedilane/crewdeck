import { describe, expect, it } from "vitest";
import { cn } from "@/lib/utils";

describe("cn", () => {
  it("joins class names and skips falsy values", () => {
    expect(cn("px-2", false && "hidden", "py-1")).toBe("px-2 py-1");
  });

  it("lets the last conflicting Tailwind class win", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });
});
