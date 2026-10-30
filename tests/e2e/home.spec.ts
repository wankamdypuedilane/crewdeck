import { expect, test } from "@playwright/test";

test("home page shows the value proposition", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("CrewDeck");
  await expect(
    page.getByRole("heading", { level: 1, name: /one shared board/i }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Start a workspace" })).toBeVisible();
});
