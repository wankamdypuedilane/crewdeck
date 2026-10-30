import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/lib/auth/redirect";

describe("safeNextPath", () => {
  it.each([
    ["/dashboard", "/dashboard"],
    ["/workspaces/abc?view=list", "/workspaces/abc?view=list"],
  ])("keeps the in-app path %s", (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });

  it.each([
    "https://evil.example/login",
    "//evil.example",
    "/\\evil.example",
    "javascript:alert(1)",
    "dashboard",
  ])("rejects %s and falls back to /dashboard", (input) => {
    expect(safeNextPath(input)).toBe("/dashboard");
  });

  it("uses the fallback when nothing is given", () => {
    expect(safeNextPath(undefined, "/")).toBe("/");
  });
});
