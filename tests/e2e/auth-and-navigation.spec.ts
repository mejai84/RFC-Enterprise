import { test, expect } from "@playwright/test";

test.describe("Módulo de Autenticación y Navegación Base", () => {
  test("debe cargar la página principal (landing) con la identidad RFC", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Representaciones Figueroa/i);
    await expect(page.locator("nav.site-nav")).toContainText(/Representaciones/i);
    await expect(page.getByRole("link", { name: /Portal de empleados/i })).toBeVisible();
  });

  test("debe redirigir al login al intentar acceder a una ruta protegida sin sesión", async ({ page }) => {
    await page.goto("/inventory");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator("h1")).toContainText(/Bienvenido de nuevo/i);
  });

  test("debe mostrar el formulario de login y validar inputs requeridos", async ({ page }) => {
    await page.goto("/login");
    const emailInput = page.getByLabel(/Correo electrónico/i);
    const passwordInput = page.getByLabel(/Contraseña/i);
    const submitButton = page.getByRole("button", { name: /Ingresar/i });

    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(submitButton).toBeVisible();
  });
});
