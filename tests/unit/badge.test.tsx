import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Badge } from "@/components/ui/badge";

describe("Badge", () => {
  it("maps status variants to semantic tokens", () => {
    render(<Badge variant="success">Completed</Badge>);
    const badge = screen.getByText("Completed");
    expect(badge).toHaveClass("bg-success", "text-success-foreground");
    expect(badge).toHaveAttribute("data-variant", "success");
  });
});
