import { Page } from "@playwright/test";
import { test, expect } from "playwright-test-coverage";
import { Role } from "../src/service/pizzaService";
/*
method: 'POST',
path: '/api/auth',
description: 'Register a new user',
example: `curl -X POST localhost:3000/api/auth -d '{"name":"pizza diner", "email":"d@jwt.com", "password":"diner"}' -H 'Content-Type: application/json'`,
response: { user: { id: 2, name: 'pizza diner', email: 'd@jwt.com', roles: [{ role: 'diner' }] }, token: 'tttttt' },
*/
async function init(page: Page) {
  await page.route("*/**/api/auth", async (route) => {
    const registerReq = route.request().postDataJSON();
    expect(registerReq).toEqual({
      name: "Billy Bob",
      email: "a@jwt.com",
      password: "a",
    });
    const registerRes = {
      user: {
        id: "10",
        name: "Billy Bob",
        email: "a@jwt.com",
        roles: [{ role: Role.Diner }],
      },
      token: "abcdef",
    };
    expect(route.request().method()).toBe("POST");
    await route.fulfill({ json: registerRes });
  });
}

test("register", async ({ page }) => {
  await init(page);
  await page.goto("/register");
  await page.getByRole("textbox", { name: "Full name" }).fill("Billy Bob");
  await page.getByRole("textbox", { name: "Email address" }).click();
  await page.getByRole("textbox", { name: "Email address" }).fill("a@jwt.com");
  await page.getByRole("textbox", { name: "Email address" }).press("Tab");
  await page.getByRole("textbox", { name: "Password" }).fill("a");
  await page.getByRole("button", { name: "Register" }).click();
  await page.getByRole("link", { name: "BB" }).click();
  expect(await page.getByText("name: Billy Bobemail: a@jwt.")).toBeVisible;
});
