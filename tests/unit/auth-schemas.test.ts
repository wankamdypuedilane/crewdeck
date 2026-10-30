import { describe, expect, it } from "vitest";
import { signUpSchema, updatePasswordSchema } from "@/lib/auth/schemas";

const valid = {
  fullName: "Inès Martin",
  email: "ines@example.com",
  password: "a long and memorable phrase",
};

describe("signUpSchema", () => {
  it("accepts a valid sign-up", () => {
    expect(signUpSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects short passwords with a helpful message", () => {
    const result = signUpSchema.safeParse({ ...valid, password: "short" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe("Use at least 10 characters.");
  });

  it("ignores fields that are not part of the form", () => {
    const result = signUpSchema.safeParse({ ...valid, role: "owner" });
    expect(result.success && "role" in result.data).toBe(false);
  });
});

describe("updatePasswordSchema", () => {
  it("requires both passwords to match", () => {
    const result = updatePasswordSchema.safeParse({
      password: "correct horse battery",
      confirm: "correct horse battery staple",
    });
    expect(result.error?.issues[0].path).toEqual(["confirm"]);
  });
});
