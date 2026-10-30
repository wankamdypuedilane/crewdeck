import { expect, test } from "@playwright/test";

// The design preview renders the real document components with sample data;
// uploads and deletions stay in memory.
test.beforeEach(async ({ page }) => {
  await page.goto("/design/documents");
});

test("each document links to its download route", async ({ page }) => {
  const link = page.getByRole("link", { name: "Ferry timetable — winter 2027.pdf" });
  await expect(link).toHaveAttribute("href", /\/workspaces\/[0-9a-f-]{36}\/documents\/[0-9a-f-]{36}\/download$/);
});

test("an accepted file is uploaded and announced", async ({ page }) => {
  await page.getByLabel("Add a document").setInputFiles({
    name: "Harbour survey.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.7\n% sample\n"),
  });
  await page.getByRole("button", { name: "Upload" }).click();
  await expect(page.getByRole("status")).toHaveText("“Harbour survey.pdf” was added.");
  await expect(page.getByRole("link", { name: "Harbour survey.pdf" })).toBeVisible();
});

test("an unsupported file is refused with an explanation", async ({ page }) => {
  // setInputFiles ignores the accept attribute, like a user choosing "All files".
  await page.getByLabel("Add a document").setInputFiles({
    name: "invoice.html",
    mimeType: "text/html",
    buffer: Buffer.from("<script>alert(1)</script>"),
  });
  await page.getByRole("button", { name: "Upload" }).click();
  await expect(page.getByRole("status")).toContainText("This type of file is not accepted.");
  await expect(page.getByLabel("Add a document")).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByRole("link", { name: "invoice.html" })).toHaveCount(0);
});

test("a document can be deleted with the keyboard, after confirmation", async ({ page }) => {
  await page.getByRole("button", { name: "Delete “Interview notes.md”" }).focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Delete this document?" });
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape"); // changing one's mind is safe
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("link", { name: "Interview notes.md" })).toBeVisible();

  await page.getByRole("button", { name: "Delete “Interview notes.md”" }).focus();
  await page.keyboard.press("Enter");
  await dialog.getByRole("button", { name: "Delete document" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("link", { name: "Interview notes.md" })).toHaveCount(0);
});

test("members cannot delete their teammates' documents", async ({ page }) => {
  await expect(page.getByRole("link", { name: "Seat map sketch.png" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Delete “Seat map sketch.png”" })).toHaveCount(0);
});
