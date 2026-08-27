const { expect, test } = require("@playwright/test");

const baseUrl = process.env.E2E_BASE_URL || "http://127.0.0.1:5173";
const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;

test.describe("Knowledge Base RAG", () => {
  test.skip(!email || !password, "Set E2E_EMAIL and E2E_PASSWORD to run login flow.");

  test("login, open knowledge base, upload, ask, delete, logout", async ({ page }) => {
    await page.goto(`${baseUrl}/login`);

    await page.getByLabel("EMAIL").fill(email);
    await page.getByLabel("PASSWORD").fill(password);
    await page.getByRole("button", { name: "Masuk ke Dashboard" }).click();

    await page.goto(`${baseUrl}/knowledge-base`);
    await expect(page.getByText("Knowledge Base v3.0")).toBeVisible();
    await expect(page.getByText("RAG API", { exact: false })).toBeVisible();

    const fileChooserPromise = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Upload knowledge documents" }).click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
      name: "playwright-knowledge.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("Playwright knowledge base test document with newsroom context."),
    });

    await expect(page.getByText("Indexed", { exact: false })).toBeVisible();

    await page.getByLabel("Ask AI Knowledge Copilot").fill(
      "Summarize the uploaded knowledge document.",
    );
    await page.getByRole("button", { name: "Ask Copilot" }).click();

    await expect(page.getByText("Retrieved Context")).toBeVisible();
    await expect(page.getByText("Source Citation Cards")).toBeVisible();
    await expect(page.getByText("Confidence")).toBeVisible();

    page.on("dialog", (dialog) => dialog.accept());
    const deleteButton = page.getByRole("button", {
      name: /Delete playwright-knowledge/i,
    });
    if (await deleteButton.count()) {
      await deleteButton.first().click();
    }

    await page.locator('button[aria-haspopup="menu"]').click();
    await page.getByRole("menuitem", { name: "Logout" }).click();

    await expect(page).toHaveURL(/\/login$/);
  });
});
