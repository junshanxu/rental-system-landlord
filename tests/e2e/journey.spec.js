import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const action = (page, name) => page.locator(`[data-action="${name}"]`);
async function resetAccount(page) {
  await page.evaluate(async () => {
    const session = await (await fetch('/api/session')).json();
    const response = await fetch('/api/verification/reset', { method: 'POST', headers: { 'X-CSRF-Token': session.csrf } });
    if (!response.ok) throw new Error('Test account reset failed');
  });
}
async function login(page) {
  await page.goto('/'); await page.getByLabel('密码', { exact: true }).fill('browser-test-only-123');
  await page.getByRole('button', { name: '登录并继续' }).click();
  await expect(page.locator('.topbar')).toBeVisible();
  // Reset via the same account action used by the product, so verification tests are independent.
  await resetAccount(page); await page.reload();
  await expect(page.locator('.home-hero')).toBeVisible();
}
async function examples(page) {
  for (const side of ['front', 'back', 'property']) {
    await page.locator(`[data-action="id-example"][data-side="${side}"]`).click();
    await expect(page.locator(`label[for="id-${side}"] img`)).toBeVisible();
    await expect(action(page, 'id-check')).toBeEnabled();
  }
}
async function identity(page) {
  if ((await page.locator('.account-link').textContent()).includes('已通过')) return;
  await action(page, 'account').first().click(); await examples(page);
  await action(page, 'id-check').click(); await expect(page.locator('#verification-status')).toContainText('已通过');
  await action(page, 'home').first().click();
}
async function draft(page, room = '客厅') {
  await identity(page); await action(page, 'new').first().click();
  await page.getByLabel('房屋名称', { exact: true }).fill(`测试公寓 ${Date.now()}`);
  await page.getByLabel('房间名称', { exact: true }).fill(room);
  await page.getByRole('button', { name: '创建并开始' }).click();
  await expect(action(page, 'open-camera')).toBeVisible();
}
async function camera(page) {
  await action(page, 'open-camera').click(); await expect(action(page, 'take-photo')).toBeEnabled();
  await expect(page.locator('#tip-text')).not.toBeEmpty();
}
async function photo(page, count) {
  await action(page, 'take-photo').click(); await expect(page.locator('#save-status')).toContainText(`已保存 ${count} 份`);
}

test('user center: three required documents, failed mock, local previews and persisted passed badge outside main steps', async ({ page }) => {
  const posted = [];
  page.on('request', req => { if (req.method() === 'POST') posted.push({ url: req.url(), body: req.postData() }); });
  await login(page); await expect(page.locator('#id-front')).toHaveCount(0); await expect(page.locator('.stepper')).toHaveCount(0);
  await expect(page.locator('.verification-gate')).toContainText('房产证'); await expect(action(page, 'new')).toHaveCount(0);
  await action(page, 'account').first().click(); await expect(page.locator('.stepper')).toHaveCount(0);
  await expect(page.locator('input[type=file]')).toHaveCount(3);
  for (const side of ['front', 'back']) {
    await page.locator(`[data-action="id-example"][data-side="${side}"]`).click();
    await expect(page.locator(`label[for="id-${side}"] img`)).toBeVisible();
    await expect(action(page, 'id-check')).toBeEnabled();
  }
  await action(page, 'id-check').click(); await expect(page.locator('#toast')).toContainText('房产证');
  await expect(page.locator('#verification-status')).toContainText('未核验');
  await page.locator('[data-action="id-example"][data-side="property"]').click();
  await expect(page.locator('label[for="id-property"] img')).toBeVisible();
  await page.locator('#id-scenario').selectOption('property'); await expect(action(page, 'id-check')).toBeEnabled();
  await action(page, 'id-check').click(); await expect(page.locator('#id-feedback')).toContainText('房产证信息页模拟不完整');
  await expect(page.locator('#verification-status')).toContainText('未通过');
  await page.locator('#id-front').setInputFiles({ name: 'broken.png', mimeType: 'image/png', buffer: Buffer.from('not-a-picture') });
  await expect(page.locator('#toast')).toContainText('图片无法读取');
  await expect(page.locator('#verification-status')).toContainText('未核验');
  await page.locator('[data-action="id-example"][data-side="front"]').click();
  await expect(page.locator('label[for="id-front"] img')).toBeVisible();
  await page.locator('#id-scenario').selectOption('pass'); await expect(action(page, 'id-check')).toBeEnabled();
  await mkdir('test-results/screens', { recursive: true }); await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'test-results/screens/account-desktop.png', fullPage: true });
  await action(page, 'id-check').click(); await expect(page.locator('#verification-status')).toContainText('已通过');
  await expect(page.locator('.verified-documents > div')).toHaveCount(3); await expect(page.locator('input[type=file]')).toHaveCount(0);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'test-results/screens/account-passed-desktop.png', fullPage: true });
  await page.reload(); await expect(page.locator('.home-hero')).toBeVisible(); await expect(page.locator('.account-link')).toContainText('已通过');
  await expect(action(page, 'new').first()).toBeVisible();
  await action(page, 'account').first().click(); await expect(page.locator('#verification-status')).toContainText('已通过');
  const calls = posted.filter(req => req.url.endsWith('/verification/mock'));
  expect(calls).toHaveLength(2);
  for (const call of calls) expect(JSON.parse(call.body).documents).toEqual({ front: true, back: true, property: true });
  expect(posted.some(req => req.body?.includes('data:image'))).toBe(false);
});

test('reverification revokes access; leaving clears certificate previews and a failed request never marks passed', async ({ page }) => {
  await login(page); await identity(page); await action(page, 'account').first().click();
  await action(page, 'id-reset').click(); await expect(page.locator('#verification-status')).toContainText('未核验');
  await expect(page.locator('#id-property')).toHaveCount(1);
  await examples(page); await action(page, 'home').first().click(); await expect(action(page, 'new')).toHaveCount(0);
  await action(page, 'account').first().click(); await expect(page.locator('.upload-zone img')).toHaveCount(0);
  await examples(page);
  await page.locator('[data-action="id-remove"][data-side="property"]').click(); await expect(page.locator('label[for="id-property"] img')).toHaveCount(0);
  await action(page, 'id-check').click(); await expect(page.locator('#toast')).toContainText('补齐');
  await page.locator('[data-action="id-example"][data-side="property"]').click(); await expect(action(page, 'id-check')).toBeEnabled();
  await page.route('**/api/verification/mock', route => route.abort('failed'));
  await action(page, 'id-check').click(); await expect(action(page, 'id-check')).toBeEnabled();
  await expect(page.locator('#verification-status')).toContainText('未核验'); await expect(page.locator('.verification-approved')).toHaveCount(0);
  await page.unroute('**/api/verification/mock'); await action(page, 'id-check').click();
  await expect(page.locator('#verification-status')).toContainText('已通过');
});

test('revoked verification during a capture retains the unsaved image until reverified', async ({ page }) => {
  await login(page); await draft(page, '重新核验恢复测试'); await camera(page);
  let reset = false;
  await page.route('**/api/drafts/*/media', async route => {
    if (!reset) { reset = true; await resetAccount(page); }
    await route.continue();
  });
  await action(page, 'take-photo').click();
  await expect(page.locator('#verification-status')).toContainText('未核验');
  await expect(page.locator('.notice.warning')).toContainText('尚未保存');
  await expect(page.locator('#camera-video')).toHaveCount(0);
  await examples(page); await action(page, 'id-check').click(); await expect(action(page, 'resume-pending')).toBeVisible();
  await action(page, 'resume-pending').click(); await expect(page.locator('#save-status')).toContainText('已保存 1 份');
  await expect(page.locator('#capture-strip .thumb')).toHaveCount(1);
});

test('real camera API journey: photos, independent checks, video, drafts, review and report', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await login(page); await draft(page); await expect(page.locator('.step')).toHaveCount(3); await expect(page.locator('.stepper')).not.toContainText('核验'); await expect(page.locator('input[type=file]')).toHaveCount(0); await camera(page);
  await photo(page, 1); await page.locator('#capture-purpose').selectOption('check'); await photo(page, 2);
  await action(page, 'record').click(); await expect(action(page, 'pause')).toBeVisible();
  await expect(page.locator('#record-time')).toContainText('00:01');
  await action(page, 'pause').click(); await expect(page.locator('#record-time')).toContainText('已暂停');
  await action(page, 'pause').click(); await action(page, 'record').click();
  await expect(page.locator('#save-status')).toContainText('已保存 3 份');
  await page.screenshot({ path: 'test-results/screens/capture-desktop.png', fullPage: true });
  await action(page, 'save-exit').click(); await expect(page.locator('.draft-card').first()).toContainText('3 份素材');
  await page.reload(); await action(page, 'resume').first().click(); await expect(page.locator('#capture-strip .thumb')).toHaveCount(3);
  await action(page, 'finish-capture').click(); await expect(page.locator('.media-card')).toHaveCount(3);
  await page.locator('#media-filter').selectOption('video-frame'); expect(await page.locator('.media-card').count()).toBeGreaterThanOrEqual(1);
  await page.locator('#media-filter').selectOption('all'); await action(page, 'run-review').click();
  await expect(page.locator('.review-summary')).toContainText('基础检查已完成');
  await page.screenshot({ path: 'test-results/screens/review-desktop.png', fullPage: true });
  await action(page, 'capture').first().click(); await camera(page); await photo(page, 4);
  await action(page, 'finish-capture').click(); await expect(page.locator('.notice.warning')).toContainText('旧检查结果已失效');
  await expect(action(page, 'confirm-review')).toBeDisabled(); await action(page, 'run-review').click();
  await page.locator('#manual-confirm').check(); await action(page, 'confirm-review').click();
  await expect(action(page, 'create-job')).toBeDisabled(); await expect(page.locator('.reconstruction-empty')).toContainText('采集已保存');
  const downloading = page.waitForEvent('download'); await page.getByRole('link', { name: '下载采集报告' }).click();
  const download = await downloading; expect(download.suggestedFilename()).toMatch(/^capture-.*\.json$/);
  await action(page, 'logout').click(); await expect(page.locator('#login-form')).toBeVisible();
  await page.getByLabel('密码', { exact: true }).fill('browser-test-only-123'); await page.getByRole('button', { name: '登录并继续' }).click();
  await expect(page.locator('.draft-card').first()).toContainText('4 份素材'); expect(errors).toEqual([]);
});

test('interrupted upload preserves capture and retry does not duplicate an accepted save', async ({ page }) => {
  await login(page); await draft(page, '卧室'); await camera(page);
  let intercepted = false;
  await page.route('**/api/drafts/*/media', async route => {
    if (!intercepted) { intercepted = true; await route.fetch(); await route.abort('failed'); } else await route.continue();
  });
  await action(page, 'take-photo').click(); await expect(page.locator('#pending-warning')).toBeVisible();
  await expect(page.locator('#save-status')).toContainText('保存未完成');
  await action(page, 'save-exit').click(); await expect(page.locator('#camera-video')).toBeVisible();
  await action(page, 'retry-save').click(); await expect(page.locator('#save-status')).toContainText('已保存 1 份');
  await action(page, 'finish-capture').click(); await expect(page.locator('.media-card')).toHaveCount(1);
});

test('camera permission failure stays actionable without a gallery fallback', async ({ page }) => {
  await page.addInitScript(() => { navigator.mediaDevices.getUserMedia = async () => { throw new DOMException('Denied by test', 'NotAllowedError'); }; });
  await login(page); await draft(page); await action(page, 'open-camera').click();
  await expect(page.locator('#camera-error')).toContainText('相机权限未开启');
  await expect(action(page, 'take-photo')).toBeDisabled(); await expect(page.locator('input[type=file]')).toHaveCount(0);
});

test('expired session prompts re-login and preserves the unsaved capture for its owner', async ({ page }) => {
  await login(page); await draft(page, '过期会话测试'); await camera(page);
  let failOnce = true;
  await page.route('**/api/drafts/*/media', async route => {
    if (failOnce) { failOnce = false; await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: '测试登录已过期' }) }); }
    else await route.continue();
  });
  await action(page, 'take-photo').click(); await expect(page.locator('#login-form')).toBeVisible();
  await expect(page.locator('#login-error')).toContainText('登录已过期');
  await page.getByLabel('密码', { exact: true }).fill('browser-test-only-123'); await page.getByRole('button', { name: '登录并继续' }).click();
  await expect(page.locator('#save-status')).toContainText('已保存 1 份'); await expect(page.locator('#capture-strip .thumb')).toHaveCount(1);
});

test('mobile layout is contained and capture remains usable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await login(page);
  await action(page, 'account').first().click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: 'test-results/screens/account-mobile.png', fullPage: true });
  await identity(page);
  await page.screenshot({ path: 'test-results/screens/home-mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await draft(page); await camera(page); await photo(page, 1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: 'test-results/screens/capture-mobile.png', fullPage: true });
});

test('existing real SPZ sample loads and remains separate from user captures', async ({ page }) => {
  test.setTimeout(90_000);
  await login(page); await identity(page); await action(page, 'sample').first().click();
  await expect(page.locator('#viewer-status')).toContainText('模型已加载', { timeout: 60_000 });
  await expect(page.locator('#model-viewer canvas')).toBeVisible();
  await expect(page.locator('.notice.warning')).toContainText('不是本次拍摄');
  await page.screenshot({ path: 'test-results/screens/sample-desktop.png', fullPage: true });
  await action(page, 'reset-view').click(); await action(page, 'home').first().click();
  await expect(page.locator('#model-viewer canvas')).toHaveCount(0);
});

test('old reconstruction does not block a new version; current pending task cannot be resubmitted', async ({ page }) => {
  let current = false;
  await page.route('**/api/config', async route => {
    const response = await route.fetch(); await route.fulfill({ response, json: { ...await response.json(), reconstruction: true } });
  });
  await page.route('**/api/drafts/*/confirm', async route => {
    const response = await route.fetch(), draft = await response.json();
    draft.jobs = [{ id: 'test-job', revision: current ? draft.revision : draft.revision - 1, state: current ? 'SUBMITTING' : 'SUCCEEDED', message: '测试任务状态', created: Date.now(), result: { spz: '/api/sample/model.spz' } }];
    await route.fulfill({ response, json: draft });
  });
  await login(page); await draft(page); await camera(page); await photo(page, 1);
  await action(page, 'finish-capture').click(); await action(page, 'run-review').click();
  await page.locator('#manual-confirm').check(); await action(page, 'confirm-review').click();
  await expect(action(page, 'create-job')).toBeEnabled(); await expect(page.locator('#model-viewer')).toHaveCount(0);
  current = true; await action(page, 'review').click(); await page.locator('#manual-confirm').check(); await action(page, 'confirm-review').click();
  await expect(action(page, 'create-job')).toBeDisabled(); await expect(page.locator('.reconstruction-empty h2')).toHaveText('正在上传与提交');
});
