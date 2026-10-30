import { expect, test } from "@playwright/test";

// The design preview renders the real board components with sample data.
test.beforeEach(async ({ page }) => {
  await page.goto("/design/board");
});

test("cards can be moved with the keyboard alone", async ({ page }) => {
  const handle = page.getByRole("button", { name: "Move “Seat map prototype”" });
  await handle.focus();
  await page.keyboard.press("Space"); // pick up
  await page.keyboard.press("ArrowRight"); // over the next column
  // dnd-kit's live region tells screen reader users where the card is.
  await expect(page.getByText("Seat map prototype is over Done.")).toBeAttached();
  await page.keyboard.press("Space"); // drop

  const done = page.getByRole("region", { name: "Done" });
  await expect(done.getByText("Seat map prototype")).toBeVisible();
  await expect(page.getByRole("region", { name: "In progress" }).getByText("Seat map prototype")).toHaveCount(0);
});

test("cards can be moved with a single pointer, without dragging", async ({ page }) => {
  await page.getByRole("button", { name: "Actions for “Write release notes”" }).click();
  await page.getByRole("menuitem", { name: "In progress" }).click();
  await expect(page.getByRole("region", { name: "In progress" }).getByText("Write release notes")).toBeVisible();
});

test("cards can be dragged with the mouse", async ({ page }) => {
  const handle = page.getByRole("button", { name: "Move “Timetable screen: empty state”" });
  const target = page.getByRole("region", { name: "Done" }).getByRole("list");
  const from = (await handle.boundingBox())!;
  const to = (await target.boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  // Several steps: dnd-kit starts dragging after 5 pixels, then tracks the pointer.
  await page.mouse.move(from.x + 40, from.y + 10, { steps: 5 });
  await page.mouse.move(to.x + to.width / 2, to.y + to.height - 5, { steps: 15 });
  await page.mouse.up();
  await expect(page.getByRole("region", { name: "Done" }).getByText("Timetable screen: empty state")).toBeVisible();
});

test("a column over its work-in-progress limit is flagged", async ({ page }) => {
  await expect(page.getByRole("region", { name: "In progress" }).getByText("3 / 2")).toBeVisible();
  await expect(page.getByText("(over the work-in-progress limit)")).toBeAttached();
});
