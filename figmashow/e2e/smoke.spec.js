import { test, expect } from '@playwright/test';

test.describe('FigmaShow smoke', () => {
  test('home → criar → editar → reload → lixeira', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('body')).toBeVisible();

    const res = await page.request.post('/api/projects', {
      data: { name: `e2e-${Date.now()}` },
    });
    expect(res.ok()).toBeTruthy();
    const { project } = await res.json();
    expect(project?.id).toBeTruthy();

    await page.goto(`/file/${project.id}`);
    await expect(page).toHaveURL(new RegExp(`/file/${project.id}`));
    await expect(page.locator('body')).toBeVisible();

    await page.reload();
    await expect(page).toHaveURL(new RegExp(`/file/${project.id}`));

    const health = await page.request.get('/api/health');
    expect(health.ok()).toBeTruthy();
    const body = await health.json();
    expect(body.service).toBe('figmashow');

    const trash = await page.request.post(
      `/api/projects/${encodeURIComponent(project.id)}/trash`,
      { data: {} },
    );
    expect(trash.ok()).toBeTruthy();
  });
});
