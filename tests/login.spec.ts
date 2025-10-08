import { Page } from "@playwright/test";
import { test, expect } from "playwright-test-coverage";
import { User, Role } from "../src/service/pizzaService";

async function basicInit(page: Page) {
  let loggedInUser: User | undefined;
  const validUsers: Record<string, User> = {
    "d@jwt.com": {
      id: "3",
      name: "Kai Chen",
      email: "d@jwt.com",
      password: "a",
      roles: [{ role: Role.Diner }],
    },
  };

  // Authorize login for the given user
  await page.route("*/**/api/auth", async (route) => {
    const method = route.request().method();

    if (method === "PUT") {
      const loginReq = route.request().postDataJSON();
      const user = validUsers[loginReq.email];
      if (!user || user.password !== loginReq.password) {
        await route.fulfill({ status: 401, json: { error: "Unauthorized" } });
        return;
      }
      loggedInUser = validUsers[loginReq.email];
      const loginRes = {
        user: loggedInUser,
        token: "abcdef",
      };
      await route.fulfill({ json: loginRes });
      return;
    }

    if (method === "DELETE") {
      loggedInUser = undefined;
      await route.fulfill({ json: { message: "logout successful" } });
      return;
    }

    await route.continue();
  });

  // Return the currently logged in user
  await page.route("*/**/api/user/me", async (route) => {
    expect(route.request().method()).toBe("GET");
    await route.fulfill({ json: loggedInUser });
  });

  // A standard menu
  await page.route("*/**/api/order/menu", async (route) => {
    const menuRes = [
      {
        id: 1,
        title: "Veggie",
        image: "pizza1.png",
        price: 0.0038,
        description: "A garden of delight",
      },
      {
        id: 2,
        title: "Pepperoni",
        image: "pizza2.png",
        price: 0.0042,
        description: "Spicy treat",
      },
    ];
    expect(route.request().method()).toBe("GET");
    await route.fulfill({ json: menuRes });
  });

  // Standard franchises and stores
  await page.route(/\/api\/franchise(\?.*)?$/, async (route) => {
    const franchiseRes = {
      franchises: [
        {
          id: 2,
          name: "LotaPizza",
          stores: [
            { id: 4, name: "Lehi" },
            { id: 5, name: "Springville" },
            { id: 6, name: "American Fork" },
          ],
        },
        { id: 3, name: "PizzaCorp", stores: [{ id: 7, name: "Spanish Fork" }] },
        { id: 4, name: "topSpot", stores: [] },
      ],
    };
    expect(route.request().method()).toBe("GET");
    await route.fulfill({ json: franchiseRes });
  });

  // Order a pizza.
  await page.route("*/**/api/order", async (route) => {
    const method = route.request().method();

    if (method === "POST") {
      const orderReq = route.request().postDataJSON();
      const orderRes = {
        order: { ...orderReq, id: 23 },
        jwt: "eyJpYXQ",
      };
      expect(method).toBe("POST");
      await route.fulfill({ json: orderRes });
      return;
    }

    if (method === "GET") {
      await route.fulfill({ json: [] });
      return;
    }

    await route.continue();
  });

  await page.goto("/");
}

test("login", async ({ page }) => {
  await basicInit(page);
  await page.getByRole("link", { name: "Login" }).click();
  await page.getByRole("textbox", { name: "Email address" }).fill("d@jwt.com");
  await page.getByRole("textbox", { name: "Password" }).fill("a");
  await page.getByRole("button", { name: "Login" }).click();

  await expect(page.getByRole("link", { name: "KC" })).toBeVisible();
});

test("purchase with login", async ({ page }) => {
  await basicInit(page);

  await page.route("*/**/api/order/verify", async (route) => {
    await route.fulfill({
      json: {
        message: "valid",
        payload: { status: "fresh", size: "large" },
      },
    });
  });

  // Go to order page
  await page.getByRole("button", { name: "Order now" }).click();

  // Create order
  await expect(page.locator("h2")).toContainText("Awesome is a click away");
  await page.getByRole("combobox").selectOption("4");
  await page.getByRole("link", { name: "Image Description Veggie A" }).click();
  await page.getByRole("link", { name: "Image Description Pepperoni" }).click();
  await expect(page.locator("form")).toContainText("Selected pizzas: 2");
  await page.getByRole("button", { name: "Checkout" }).click();

  // Login
  await page.getByPlaceholder("Email address").click();
  await page.getByPlaceholder("Email address").fill("d@jwt.com");
  await page.getByPlaceholder("Email address").press("Tab");
  await page.getByPlaceholder("Password").fill("a");
  await page.getByRole("button", { name: "Login" }).click();

  // Pay
  await expect(page.getByRole("main")).toContainText(
    "Send me those 2 pizzas right now!"
  );
  await expect(page.locator("tbody")).toContainText("Veggie");
  await expect(page.locator("tbody")).toContainText("Pepperoni");
  await expect(page.locator("tfoot")).toContainText("0.008 ₿");
  await page.getByRole("button", { name: "Pay now" }).click();

  // Check balance
  await expect(page.getByText("0.008")).toBeVisible();

  await page.waitForURL("**/delivery");
  await expect(
    page.getByRole("heading", { name: "Here is your JWT Pizza!" })
  ).toBeVisible();

  const verifyButton = page.getByRole("button", { name: "Verify" });
  const waitForVerifyResponse = () =>
    page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().includes("/api/order/verify")
    );

  let verifyResponsePromise = waitForVerifyResponse();
  await verifyButton.click();
  await verifyResponsePromise;

  const modal = page.locator("#hs-jwt-modal");
  await expect(modal).toContainText("valid");
});

test("delivery verify handles invalid token", async ({ page }) => {
  await basicInit(page);

  await page.route("*/**/api/order/verify", async (route) => {
    await route.fulfill({
      status: 400,
      json: { message: "invalid token" },
    });
  });

  await page.goto("/delivery");
  await expect(
    page.getByRole("heading", { name: "Here is your JWT Pizza!" })
  ).toBeVisible();

  const verifyButton = page.getByRole("button", { name: "Verify" });
  const verifyResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().includes("/api/order/verify")
  );
  await verifyButton.click();
  await verifyResponsePromise;

  const modal = page.locator("#hs-jwt-modal");
  await expect(modal).toContainText("invalid");
});

test("docs page renders secured endpoints", async ({ page }) => {
  await basicInit(page);

  await page.route("*/**/api/docs", async (route) => {
    await route.fulfill({
      json: {
        endpoints: [
          {
            method: "GET",
            path: "/api/ping",
            description: "Health check",
            example: "curl /api/ping",
            response: { ok: true },
            requiresAuth: false,
          },
          {
            method: "POST",
            path: "/api/secure",
            description: "Secured endpoint",
            example: "curl -X POST /api/secure",
            response: { ok: true },
            requiresAuth: true,
          },
        ],
      },
    });
  });

  await page.goto("/docs/service");
  await expect(
    page.getByRole("heading", { name: "JWT Pizza API" })
  ).toBeVisible();
  await expect(page.locator("body")).toContainText("Health check");
  await expect(page.locator("body")).toContainText("Secured endpoint");
  await expect(page.locator("body")).toContainText("🔐");
});

test("logout", async ({ page }) => {
  await basicInit(page);
  await page.getByRole("link", { name: "Login" }).click();
  await page.getByRole("textbox", { name: "Email address" }).fill("d@jwt.com");
  await page.getByRole("textbox", { name: "Password" }).fill("a");
  await page.getByRole("button", { name: "Login" }).click();

  await expect(page.getByRole("link", { name: "KC" })).toBeVisible();

  // Logout
  const logoutLink = page.getByRole("link", { name: "Logout" });
  await expect(logoutLink).toBeVisible();
  const logoutResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "DELETE" &&
      response.url().includes("/api/auth")
  );

  await logoutLink.click();
  await logoutResponsePromise;
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("link", { name: "Login" })).toBeVisible();
});
