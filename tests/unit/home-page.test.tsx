import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HomePage from "@/app/page";

describe("HomePage", () => {
  it("shows the main heading and both calls to action", () => {
    render(<HomePage />);
    expect(
      screen.getByRole("heading", { level: 1, name: /one shared board/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Start a workspace" })).toHaveAttribute(
      "href",
      "/sign-up",
    );
    expect(screen.getByRole("link", { name: "Sign in" })).toBeInTheDocument();
  });
});
