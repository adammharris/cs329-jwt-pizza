import { test, expect } from "playwright-test-coverage";

test("has title", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle("JWT Pizza");
});

test("docs page", async ({ page }) => {
  await page.goto("/docs");
  expect(await page.getByText("JWT Pizza API")).toBeVisible();
});

test("history page", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "History" }).click();
  expect(await page.getByText("Mama Rucci, my my")).toBeVisible();
});

test("about page", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "About" }).click();
  expect(await page.getByText("The secret sauce")).toBeVisible();
});

test("not found page", async ({ page }) => {
  await page.goto("/bad/path");
  expect(await page.getByText("Oops")).toBeVisible();
});
