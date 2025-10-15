import { test, expect } from "playwright-test-coverage";
import type { Page } from "@playwright/test";
import { Role, type User } from "../src/service/pizzaService";

type MockUserRecord = {
  id: string;
  name: string;
  email: string;
  password: string;
  roles: { role: Role }[];
};

type MockBackendState = {
  users: Record<string, MockUserRecord>;
  nextUserId: number;
  tokens: Record<string, string>;
  loggedInUserId?: string;
};

const sanitizeUser = (user: MockUserRecord): User => {
  const { password: _password, ...rest } = user;
  return rest as User;
};

const createInitialState = (): MockBackendState => ({
  users: {
    "1": {
      id: "1",
      name: "Admin Admin",
      email: "a@jwt.com",
      password: "admin",
      roles: [{ role: Role.Admin }],
    },
  },
  nextUserId: 2,
  tokens: {},
  loggedInUserId: undefined,
});

async function setupUserTestBackend(page: Page) {
  const state = createInitialState();

  const issueToken = (userId: string) => {
    const token = `token-${userId}-${Date.now()}`;
    state.tokens[token] = userId;
    state.loggedInUserId = userId;
    return token;
  };

  const findUserByEmail = (email: string) =>
    Object.values(state.users).find((candidate) => candidate.email === email);

  const resolveUserFromRequest = (route: any): MockUserRecord | null => {
    const authHeader = route.request().headers()["authorization"];
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const userId = state.tokens[token];
      if (userId && state.users[userId]) {
        return state.users[userId];
      }
    }
    if (state.loggedInUserId) {
      return state.users[state.loggedInUserId] ?? null;
    }
    return null;
  };

  await page.route("*/**/api/auth", async (route) => {
    const method = route.request().method();
    const headers = { "Content-Type": "application/json" };

    if (method === "POST") {
      const body = route.request().postDataJSON();
      const userId = `${state.nextUserId++}`;
      const newUser: MockUserRecord = {
        id: userId,
        name: body.name ?? body.email,
        email: body.email,
        password: body.password,
        roles:
          Array.isArray(body.roles) && body.roles.length > 0
            ? body.roles
            : [{ role: Role.Diner }],
      };
      state.users[userId] = newUser;
      const token = issueToken(userId);
      await route.fulfill({
        headers,
        json: { user: sanitizeUser(newUser), token },
      });
      return;
    }

    if (method === "PUT") {
      const body = route.request().postDataJSON();
      const user = findUserByEmail(body.email);
      if (!user || user.password !== body.password) {
        await route.fulfill({
          status: 401,
          headers,
          json: { message: "Unauthorized" },
        });
        return;
      }
      const token = issueToken(user.id);
      await route.fulfill({
        headers,
        json: { user: sanitizeUser(user), token },
      });
      return;
    }

    if (method === "DELETE") {
      const authHeader = route.request().headers()["authorization"];
      if (authHeader) {
        const token = authHeader.replace("Bearer ", "");
        delete state.tokens[token];
      }
      state.loggedInUserId = undefined;
      await route.fulfill({ headers, json: { message: "logout successful" } });
      return;
    }

    await route.continue();
  });

  await page.route("*/**/api/user/me", async (route) => {
    const headers = { "Content-Type": "application/json" };
    const user = resolveUserFromRequest(route);
    await route.fulfill({ headers, json: user ? sanitizeUser(user) : null });
  });

  await page.route(/\/api\/user(\/.*)?$/, async (route) => {
    const headers = { "Content-Type": "application/json" };
    const url = new URL(route.request().url());
    const method = route.request().method();

    if (url.pathname === "/api/user" && method === "GET") {
      const response = Object.fromEntries(
        Object.values(state.users).map((user) => [user.id, sanitizeUser(user)])
      );
      await route.fulfill({ headers, json: response });
      return;
    }

    const match = url.pathname.match(/\/api\/user\/(\d+)$/);
    if (match) {
      const userId = match[1];
      const target = state.users[userId];
      if (!target) {
        await route.fulfill({
          status: 404,
          headers,
          json: { message: "user not found" },
        });
        return;
      }

      if (method === "PUT") {
        const body = route.request().postDataJSON();
        if (body.name) {
          target.name = body.name;
        }
        if (body.email) {
          target.email = body.email;
        }
        if (body.password) {
          target.password = body.password;
        }
        const token = issueToken(target.id);
        await route.fulfill({
          headers,
          json: { user: sanitizeUser(target), token },
        });
        return;
      }

      if (method === "DELETE") {
        delete state.users[userId];
        await route.fulfill({ headers, json: { message: "user deleted" } });
        return;
      }
    }

    await route.continue();
  });

  await page.route(/\/api\/franchise(\?.*)?$/, async (route) => {
    const headers = { "Content-Type": "application/json" };
    if (route.request().method() === "GET") {
      await route.fulfill({
        headers,
        json: {
          franchises: [
            {
              id: "10",
              name: "Mock Franchise",
              admins: [
                {
                  id: "1",
                  name: state.users["1"].name,
                  email: state.users["1"].email,
                },
              ],
              stores: [
                { id: "101", name: "Mock Store 1", totalRevenue: 12345 },
                { id: "102", name: "Mock Store 2", totalRevenue: 67890 },
              ],
            },
          ],
          more: false,
        },
      });
      return;
    }

    await route.fulfill({ headers, json: {} });
  });

  await page.route("*/**/api/order/menu", async (route) => {
    await route.fulfill({
      headers: { "Content-Type": "application/json" },
      json: [],
    });
  });

  await page.route("*/**/api/order", async (route) => {
    const headers = { "Content-Type": "application/json" };
    const method = route.request().method();

    if (method === "GET") {
      await route.fulfill({ headers, json: [] });
      return;
    }

    if (method === "POST") {
      await route.fulfill({
        headers,
        json: { order: { id: "42" }, jwt: "mock-jwt" },
      });
      return;
    }

    await route.continue();
  });
}

test("updateUser", async ({ page }) => {
  await setupUserTestBackend(page);
  const email = `user${Math.floor(Math.random() * 10000)}@jwt.com`;
  await page.goto("/");
  await page.getByRole("link", { name: "Register" }).click();
  await page.getByRole("textbox", { name: "Full name" }).fill("pizza diner");
  await page.getByRole("textbox", { name: "Email address" }).fill(email);
  await page.getByRole("textbox", { name: "Password" }).fill("diner");
  await page.getByRole("button", { name: "Register" }).click();

  await page.getByRole("link", { name: "pd" }).click();

  await expect(page.getByRole("main")).toContainText("pizza diner");
  await page.getByRole("button", { name: "Edit" }).click();
  await expect(page.locator("h3")).toContainText("Edit user");
  await page.getByRole("textbox").first().fill("pizza dinerx");
  await page.getByRole("button", { name: "Update" }).click();

  await page.waitForSelector('[role="dialog"].hidden', { state: "attached" });

  await expect(page.getByRole("main")).toContainText("pizza dinerx");

  await page.getByRole("link", { name: "Logout" }).click();
  await page.getByRole("link", { name: "Login" }).click();

  await page.getByRole("textbox", { name: "Email address" }).fill(email);
  await page.getByRole("textbox", { name: "Password" }).fill("diner");
  await page.getByRole("button", { name: "Login" }).click();

  await page.getByRole("link", { name: "pd" }).click();

  await expect(page.getByRole("main")).toContainText("pizza dinerx");
});

test("listUsers", async ({ page }) => {
  await setupUserTestBackend(page);
  await page.goto("/");
  await page.getByRole("link", { name: "Login" }).click();
  await page.getByRole("textbox", { name: "Email address" }).fill("a@jwt.com");
  await page.getByRole("textbox", { name: "Password" }).fill("admin");
  await page.getByRole("button", { name: "Login" }).click();
  await page.getByRole("link", { name: "Admin" }).click();
  // As an admin I can see a list of all users. Each user's name, email, and role is displayed. The list is paginated. The list can be filtered by user name.
  const usersTable = page.getByRole("table", { name: "Users" });
  await expect(usersTable).toBeVisible();

  const adminRow = usersTable.getByRole("row").filter({ hasText: "a@jwt.com" });
  await expect(adminRow).toContainText("admin");
  const paginationControls = usersTable.locator("tfoot");
  const nextButton = paginationControls.getByRole("button", { name: "»" });
  const prevButton = paginationControls.getByRole("button", { name: "«" });

  await expect(nextButton).toBeVisible();
  await expect(prevButton).toBeDisabled();
});

test("deleteUser", async ({ page }) => {
  await setupUserTestBackend(page);
  const email = `11user${Math.floor(Math.random() * 10000)}@jwt.com`;
  await page.goto("/");
  await page.getByRole("link", { name: "Register" }).click();
  await page.getByRole("textbox", { name: "Full name" }).fill("pizza diner");
  await page.getByRole("textbox", { name: "Email address" }).fill(email);
  await page.getByRole("textbox", { name: "Password" }).fill("diner");
  await page.getByRole("button", { name: "Register" }).click();

  await page.getByRole("link", { name: "Logout" }).click();

  await page.goto("/");
  await page.getByRole("link", { name: "Login" }).click();
  await page.getByRole("textbox", { name: "Email address" }).fill("a@jwt.com");
  await page.getByRole("textbox", { name: "Password" }).fill("admin");
  await page.getByRole("button", { name: "Login" }).click();
  await page.getByRole("link", { name: "Admin" }).click();

  //As an admin I can delete any user.
  const userRow = page.getByRole("row").filter({ hasText: email });
  await expect(userRow).toBeVisible();
  await userRow.getByRole("button", { name: "Delete" }).click();
  await expect(userRow).toHaveCount(0);
});
