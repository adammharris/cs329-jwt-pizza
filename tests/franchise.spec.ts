import { test, expect } from "playwright-test-coverage";
import type { Page, Route } from "@playwright/test";
import { Role, User } from "../src/service/pizzaService";

async function initLogin(
  page: Page,
  user: User & { email: string; password: string }
) {
  let tokenIssued = false;

  await page.route("**/api/auth", async (route: Route) => {
    if (route.request().method() === "PUT") {
      const body = route.request().postDataJSON();
      expect(body).toEqual({ email: user.email, password: user.password });
      tokenIssued = true;
      await route.fulfill({ json: { user, token: "tok-" + user.id } });
      return;
    }
    await route.continue();
  });

  await page.route("**/api/user/me", async (route: Route) => {
    await route.fulfill({ json: tokenIssued ? user : null });
  });

  await page.goto("/");
  await page.getByRole("link", { name: "Login" }).click();
  await page.getByRole("textbox", { name: "Email address" }).fill(user.email);
  await page
    .getByRole("textbox", { name: "Password" })
    .fill(user.password || "");
  await page.getByRole("button", { name: "Login" }).click();

  // Avatar initials
  const initials = (user.name || "")
    .split(" ")
    .map((p) => p[0])
    .join("");
  await expect(page.getByRole("link", { name: initials })).toBeVisible();
}

test("Admin can create a franchise (POST /api/franchise + list refresh)", async ({
  page,
}) => {
  const admin: User & { email: string; password: string } = {
    id: "900",
    name: "Alice Admin",
    email: "admin@jwt.com",
    password: "secret",
    roles: [{ role: Role.Admin }],
  };

  let createCalled = false;
  let afterCreate = false;
  const newFranchise = {
    name: "MegaPizza",
    admins: [{ email: "fran@jwt.com" }],
    stores: [],
  };
  const createdResponse = {
    id: "1001",
    ...newFranchise,
    admins: [{ email: "fran@jwt.com", id: "77", name: "Fran Chisee" }],
  };

  // Handle POST to create franchise (more specific route first)
  await page.route("**/api/franchise", async (route: Route) => {
    const method = route.request().method();

    if (method === "POST") {
      const body = route.request().postDataJSON();
      expect(body).toMatchObject(newFranchise);
      createCalled = true;
      afterCreate = true;
      await route.fulfill({ json: createdResponse });
      return;
    }

    await route.continue();
  });

  // Handle GET list requests with query params
  await page.route("**/api/franchise?*", async (route: Route) => {
    const url = route.request().url();
    if (url.includes("page=0&limit=3")) {
      await route.fulfill({
        json: { franchises: afterCreate ? [createdResponse] : [], more: false },
      });
      return;
    }
    await route.continue();
  });

  await initLogin(page, admin);
  await page.getByRole("link", { name: "Admin" }).click();
  await page.getByRole("button", { name: "Add Franchise" }).click();
  await page.getByPlaceholder("franchise name").fill("MegaPizza");
  await page.getByPlaceholder("franchisee admin email").fill("fran@jwt.com");
  const createResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().includes("/api/franchise")
  );

  await page.getByRole("button", { name: "Create" }).click();
  await createResponsePromise;

  expect(createCalled).toBeTruthy();
  await expect(page.getByText("MegaPizza")).toBeVisible();
});

test("Admin can close a franchise (DELETE /api/franchise/:id)", async ({
  page,
}) => {
  const admin: User & { email: string; password: string } = {
    id: "901",
    name: "Bob Admin",
    email: "bob.admin@jwt.com",
    password: "secret",
    roles: [{ role: Role.Admin }],
  };
  const franchise = {
    id: "555",
    name: "CloseMe",
    admins: [{ id: "901", name: "Bob Admin", email: "bob.admin@jwt.com" }],
    stores: [],
  };
  let deleteCalled = false;

  // Handle all franchise endpoints
  await page.route("**/api/franchise/**", async (route: Route) => {
    const url = route.request().url();
    const method = route.request().method();

    // DELETE specific franchise - check for ID at end of path
    if (method === "DELETE" && url.match(/\/api\/franchise\/555$/)) {
      deleteCalled = true;
      await route.fulfill({ json: { message: "franchise deleted" } });
      return;
    }

    await route.continue();
  });

  // Handle franchise list requests
  await page.route("**/api/franchise?*", async (route: Route) => {
    const url = route.request().url();
    if (url.includes("page=0&limit=3")) {
      await route.fulfill({
        json: { franchises: deleteCalled ? [] : [franchise], more: false },
      });
      return;
    }
    await route.continue();
  });

  await initLogin(page, admin);
  await page.getByRole("link", { name: "Admin" }).click();
  // Click the franchise Close button (first Close on page)
  await page.getByRole("button", { name: "Close" }).click();
  await expect(page).toHaveURL(/close-franchise/);
  await page.getByRole("button", { name: "Close" }).click();

  // Wait for the DELETE to complete and page to navigate
  await page.waitForTimeout(500);

  expect(deleteCalled).toBeTruthy();
  // After navigation, franchise should not be visible
  await expect(page.getByRole("main")).not.toContainText("CloseMe");
});

test("Franchisee can create a store (POST /api/franchise/:id/store)", async ({
  page,
}) => {
  const fran: User & { email: string; password: string } = {
    id: "300",
    name: "Fiona Franchisee",
    email: "fiona@jwt.com",
    password: "secret",
    roles: [{ role: Role.Franchisee }],
  };
  const franchise = {
    id: "2000",
    name: "StoreTest",
    admins: [{ email: fran.email, id: fran.id, name: fran.name }],
    stores: [],
  };
  let storeCreated = false;

  // GET user franchise
  await page.route(`**/api/franchise/${fran.id}`, async (route: Route) => {
    await route.fulfill({
      json: [
        storeCreated
          ? {
              ...franchise,
              stores: [{ id: 101, name: "Downtown", totalRevenue: 0 }],
            }
          : franchise,
      ],
    });
  });

  // POST create store
  await page.route(
    `**/api/franchise/${franchise.id}/store`,
    async (route: Route) => {
      if (route.request().method() === "POST") {
        const body = route.request().postDataJSON();
        expect(body).toMatchObject({ name: "Downtown" });
        storeCreated = true;
        await route.fulfill({
          json: { id: 101, name: "Downtown", totalRevenue: 0 },
        });
        return;
      }
      await route.continue();
    }
  );

  await initLogin(page, fran);
  await page.goto("/franchise-dashboard");
  await expect(page.getByRole("heading", { name: "StoreTest" })).toBeVisible();
  await page.getByRole("button", { name: "Create store" }).click();
  await page.getByPlaceholder("store name").fill("Downtown");
  await page.getByRole("button", { name: "Create" }).click();

  // Wait for navigation back to franchise dashboard
  await page.waitForURL("**/franchise-dashboard");

  expect(storeCreated).toBeTruthy();
  await expect(page.getByText("Downtown")).toBeVisible();
});

test("Franchisee can close a store (DELETE /api/franchise/:fid/store/:sid)", async ({
  page,
}) => {
  const fran: User & { email: string; password: string } = {
    id: "301",
    name: "Carl Franchisee",
    email: "carl@jwt.com",
    password: "secret",
    roles: [{ role: Role.Franchisee }],
  };
  const franchise = {
    id: "2010",
    name: "StoreClose",
    admins: [{ email: fran.email, id: fran.id, name: fran.name }],
    stores: [{ id: 5, name: "OldTown", totalRevenue: 0 }],
  };
  let storeDeleted = false;

  await page.route(`**/api/franchise/${fran.id}`, async (route: Route) => {
    await route.fulfill({
      json: [storeDeleted ? { ...franchise, stores: [] } : franchise],
    });
  });

  await page.route(
    `**/api/franchise/${franchise.id}/store/${franchise.stores[0].id}`,
    async (route: Route) => {
      if (route.request().method() === "DELETE") {
        storeDeleted = true;
        await route.fulfill({ json: { message: "store deleted" } });
        return;
      }
      await route.continue();
    }
  );

  await initLogin(page, fran);
  await page.goto("/franchise-dashboard");
  await expect(page.getByText("OldTown")).toBeVisible();
  // Click the Close button on the store row (second Close on screen typically)
  const storeCloseBtn = page
    .locator('tbody:has-text("OldTown") button:has-text("Close")')
    .first();
  await storeCloseBtn.click();
  await expect(page).toHaveURL(/close-store/);
  await page.getByRole("button", { name: "Close" }).click();

  // Wait for navigation back to franchise dashboard
  await page.waitForURL("**/franchise-dashboard");

  expect(storeDeleted).toBeTruthy();
  await expect(page.getByRole("main")).not.toContainText("OldTown");
});
