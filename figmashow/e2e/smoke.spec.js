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

  test('canvas: add node via API → reload → 409 conflict', async ({ page }) => {
    const create = await page.request.post('/api/projects', {
      data: { name: `e2e-canvas-${Date.now()}` },
    });
    expect(create.ok()).toBeTruthy();
    const { project } = await create.json();
    const projectId = project.id;

    const got = await page.request.get(
      `/api/projects/${encodeURIComponent(projectId)}`,
    );
    expect(got.ok()).toBeTruthy();
    const { board } = await got.json();
    expect(board?.screens?.length).toBeGreaterThan(0);
    const screenId = board.screens[0].id;
    const rev0 = Number(board.revision) || 0;

    const ops = await page.request.post(
      `/api/projects/${encodeURIComponent(projectId)}/operations`,
      {
        data: {
          expectedRevision: rev0,
          operations: [
            {
              type: 'add_node',
              screenId,
              node: {
                type: 'rect',
                name: 'e2e-rect',
                x: 40,
                y: 80,
                w: 120,
                h: 60,
                fill: '#3b82f6',
              },
            },
          ],
        },
      },
    );
    expect(ops.ok()).toBeTruthy();
    const opsBody = await ops.json();
    const rev1 = Number(opsBody.revision);
    expect(rev1).toBeGreaterThan(rev0);

    await page.goto(`/file/${projectId}`);
    await expect(page.locator('.canvas-wrap')).toBeVisible();
    await page.reload();
    await expect(page).toHaveURL(new RegExp(`/file/${projectId}`));

    const after = await page.request.get(
      `/api/projects/${encodeURIComponent(projectId)}`,
    );
    const afterBoard = (await after.json()).board;
    const names = JSON.stringify(afterBoard.screens);
    expect(names).toContain('e2e-rect');

    // 409: PUT com revisão antiga
    const conflict = await page.request.put(
      `/api/projects/${encodeURIComponent(projectId)}`,
      {
        data: {
          board: afterBoard,
          expectedRevision: rev0,
        },
      },
    );
    expect(conflict.status()).toBe(409);

    // versão create + restore
    const ver = await page.request.post(
      `/api/projects/${encodeURIComponent(projectId)}/versions`,
      {
        data: { name: 'e2e-snap', expectedRevision: rev1 },
      },
    );
    expect(ver.ok()).toBeTruthy();
    const verBody = await ver.json();
    expect(verBody.version?.id).toBeTruthy();
    expect(verBody.version?.board?.screens).toBeTruthy();

    const rev2 = Number(verBody.revision);
    const restore = await page.request.post(
      `/api/projects/${encodeURIComponent(projectId)}/versions`,
      {
        data: {
          restore: verBody.version.id,
          expectedRevision: rev2,
        },
      },
    );
    expect(restore.ok()).toBeTruthy();

    // SSE revision endpoint
    const revRes = await page.request.get(
      `/api/projects/${encodeURIComponent(projectId)}/revision`,
    );
    expect(revRes.ok()).toBeTruthy();

    await page.request.post(
      `/api/projects/${encodeURIComponent(projectId)}/trash`,
      { data: {} },
    );
  });

  test('quadro: create_screen custom size + move via PUT', async ({ page }) => {
    const create = await page.request.post('/api/projects', {
      data: { name: `e2e-frame-${Date.now()}` },
    });
    expect(create.ok()).toBeTruthy();
    const { project } = await create.json();
    const projectId = project.id;

    const got = await page.request.get(
      `/api/projects/${encodeURIComponent(projectId)}`,
    );
    const { board } = await got.json();
    const rev0 = Number(board.revision) || 0;

    const ops = await page.request.post(
      `/api/projects/${encodeURIComponent(projectId)}/operations`,
      {
        data: {
          expectedRevision: rev0,
          operations: [
            {
              type: 'create_screen',
              name: 'Desktop HQ',
              width: 1440,
              height: 1024,
              x: 500,
              y: 40,
            },
          ],
        },
      },
    );
    expect(ops.ok()).toBeTruthy();
    const opsBody = await ops.json();
    const created = (opsBody.board?.screens || []).find(
      (s) => s.name === 'Desktop HQ',
    );
    expect(created).toBeTruthy();
    expect(created.width).toBe(1440);
    expect(created.height).toBe(1024);
    expect(created.x).toBe(500);

    const rev1 = Number(opsBody.revision);
    const moved = {
      ...opsBody.board,
      screens: opsBody.board.screens.map((s) =>
        s.id === created.id ? { ...s, x: 800, y: 120 } : s,
      ),
    };
    const put = await page.request.put(
      `/api/projects/${encodeURIComponent(projectId)}`,
      {
        data: { board: moved, expectedRevision: rev1 },
      },
    );
    expect(put.ok()).toBeTruthy();
    const after = await put.json();
    const screen = after.board.screens.find((s) => s.id === created.id);
    expect(screen.x).toBe(800);
    expect(screen.y).toBe(120);

    await page.goto(`/file/${projectId}`);
    await expect(page.locator('.canvas-wrap')).toBeVisible();
    await page.getByTitle(/Quadro \(F\)|Novo quadro/).first().click();
    await expect(page.getByRole('dialog', { name: 'Quadro' })).toBeVisible();

    await page.request.post(
      `/api/projects/${encodeURIComponent(projectId)}/trash`,
      { data: {} },
    );
  });
});
