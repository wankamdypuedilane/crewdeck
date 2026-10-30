import { describe, expect, it } from "vitest";
import { parseServerEnv } from "@/lib/env-schema";

describe("parseServerEnv", () => {
  it("accepts a valid configuration and applies defaults", () => {
    const env = parseServerEnv({ SUPABASE_SECRET_KEY: "sb_secret_example" });
    expect(env.NEXT_PUBLIC_SITE_URL).toBe("http://localhost:3000");
  });

  it("rejects a publishable key used as a secret key", () => {
    expect(() =>
      parseServerEnv({ SUPABASE_SECRET_KEY: "sb_publishable_example" }),
    ).toThrow(/SUPABASE_SECRET_KEY/);
  });

  it("never includes the secret value in the error message", () => {
    try {
      parseServerEnv({ SUPABASE_SECRET_KEY: "oops-real-looking-value" });
    } catch (error) {
      expect(String(error)).not.toContain("oops-real-looking-value");
    }
  });
});
