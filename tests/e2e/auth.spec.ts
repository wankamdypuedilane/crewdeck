import { expect, test } from "@playwright/test";

test("private pages send visitors to sign-in and remember where they were going", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fdashboard/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});

test("the sign-in form explains invalid input next to each field", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByLabel("E-mail").fill("not-an-email");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Enter a valid e-mail address.")).toBeVisible();
  await expect(page.getByLabel("E-mail")).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByText("Enter your password.")).toBeVisible();
});

test("sign-up rejects a short password before contacting Supabase", async ({ page }) => {
  await page.goto("/sign-up");
  await page.getByLabel("Full name").fill("Inès Martin");
  await page.getByLabel("E-mail").fill("ines@example.com");
  await page.getByLabel("Password").fill("short");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Use at least 10 characters.")).toBeVisible();
});

test("workspaces and boards are private", async ({ page }) => {
  await page.goto("/workspaces/00000000-0000-4000-8000-000000000000/boards/00000000-0000-4000-8000-000000000001");
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fworkspaces%2F/);
});

test("documents and download links are private", async ({ page, request }) => {
  const ws = "00000000-0000-4000-8000-000000000000";
  await page.goto(`/workspaces/${ws}/documents`);
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fworkspaces%2F.*%2Fdocuments/);
  // The Route Handler never reaches Storage without a session.
  const response = await request.get(`/workspaces/${ws}/documents/00000000-0000-4000-8000-000000000002/download`, { maxRedirects: 0 });
  expect(response.status()).toBe(307);
  expect(response.headers()["location"]).toMatch(/^\/sign-in\?next=/);
});
