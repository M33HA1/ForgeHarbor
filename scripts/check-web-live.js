// Lifecycle/rendering is orchestrated by scripts/web-live-fixture.py.
// This suite uses real local APIs and never reads the JWT signing key.
async (hostPage, fixture) => {
  if (!fixture || !/^[0-9a-f]{32}$/.test(fixture.runId)) throw new Error('A scoped live fixture configuration is required.');
  const base = 'http://localhost:8088';
  const browser = hostPage.context().browser();
  const context = await browser.newContext({ acceptDownloads: true, serviceWorkers: 'block' });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const password = 'Local-fixture-' + fixture.runId + '-only';
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  let blocked = 0;
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== base || /^\/(phishing|malware)\/v1\//.test(url.pathname)) {
      blocked++;
      return route.fulfill({ status: 418, body: 'Provider/external request blocked in local journey' });
    }
    return route.continue();
  });
  const login = async index => {
    await page.getByLabel('Email', { exact: true }).fill(fixture.emails[index]);
    await page.getByLabel('Password', { exact: true }).fill(password);
    const loginResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/auth/login');
    await page.getByRole('button', { name: 'Login', exact: true }).click();
    assert((await loginResponse).status() === 200, 'Auth login did not succeed.');
    const session = (await context.cookies(base)).find(cookie => cookie.name === 'fh_access');
    assert(session?.httpOnly && session.sameSite === 'Strict', 'Login did not establish an HttpOnly Strict session cookie.');
  };
  const logout = async () => {
    await page.getByRole('button', { name: 'Logout', exact: true }).click();
    assert(await page.evaluate(() => localStorage.getItem('access_token')) === null, 'Logout retained a session.');
    const status = await page.evaluate(async () => (await fetch('/auth/me')).status);
    assert(status === 401, 'Logout did not clear the server-issued browser cookie.');
  };
  try {
    if (fixture.phase === 'create') {
      for (let index = 0; index < 2; index++) {
        await page.goto(base + '/signup');
        await page.getByLabel('Email', { exact: true }).fill(fixture.emails[index]);
        await page.getByLabel('Password', { exact: true }).fill(password);
        await page.getByRole('button', { name: 'Sign Up', exact: true }).click();
        await page.getByRole('status').filter({ hasText: 'Signup successful' }).waitFor();
        await page.waitForURL('**/login');
        if (index === 0) {
          await login(0);
          await page.waitForURL('**/app/dashboard');
          await logout();
        }
      }
      assert(blocked === 0, 'Unexpected external/provider request.');
      return { phase: 'create', verified: ['two real UI signups', 'Auth-issued session', 'default dashboard return', 'logout'] };
    }
    if (fixture.phase !== 'verify') throw new Error('Unknown live journey phase.');
    await page.goto(base + '/app/history');
    await page.waitForURL('**/login');
    await login(0);
    await page.waitForURL('**/app/history');
    await page.getByText(fixture.targets[0], { exact: true }).waitFor();
    assert(await page.getByText(fixture.targets[1], { exact: true }).count() === 0, 'History exposed the other owner fixture.');
    await page.reload();
    await page.getByText(fixture.targets[0], { exact: true }).waitFor();
    const posted = page.waitForResponse(response => new URL(response.url()).pathname === '/reports' && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Generate report', exact: true }).click();
    const response = await posted;
    assert(response.status() === 200, 'Live report creation failed.');
    const report = await response.json();
    assert(report.source === 'stored-scan-v1', 'Live report lacked trusted provenance.');
    await page.getByRole('status').filter({ hasText: 'Report created' }).waitFor();
    const [download] = await Promise.all([
      page.waitForEvent('download'), page.getByRole('button', { name: 'Download Report', exact: true }).click(),
    ]);
    const stream = await download.createReadStream();
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    const artifact = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    assert(artifact._id?.$oid === fixture.scanIds[0] && artifact.result?.malicious === true, 'Downloaded live report did not match stored evidence.');
    await page.reload();
    await page.getByRole('button', { name: 'Download Report', exact: true }).waitFor();
    await page.waitForFunction(async id => {
      const response = await fetch('/notify');
      if (!response.ok) return false;
      const data = await response.json();
      return data.notifications.some(item => item.report_id === id);
    }, report.id, { timeout: 30000 });
    await logout();
    await page.goto(base + '/app/history');
    await page.waitForURL('**/login');
    await login(1);
    await page.waitForURL('**/app/history');
    await page.getByText(fixture.targets[1], { exact: true }).waitFor();
    assert(await page.getByText(fixture.targets[0], { exact: true }).count() === 0, 'Second owner saw the first owner fixture.');
    const statuses = await page.evaluate(async ({ reportId, scanId }) => {
      const headers = { 'Content-Type': 'application/json' };
      const results = await Promise.all([
        fetch('/history/' + scanId, { headers }),
        fetch('/reports/' + reportId, { headers }),
        fetch('/reports/' + reportId + '/download', { headers }),
        fetch('/reports', { method: 'POST', headers, body: JSON.stringify({ scanId }) }),
      ]);
      return results.map(response => response.status);
    }, { reportId: report.id, scanId: fixture.scanIds[0] });
    assert(statuses.every(status => status === 404), 'Live cross-owner scan/report access was not denied.');
    await logout();
    await page.goto(base + '/app/history');
    await page.waitForURL('**/login');
    assert(blocked === 0, 'Unexpected external/provider request.');
    return { phase: 'verify', verified: ['real login return and refresh', 'two-owner History isolation', 'server-generated report and download', 'saved report restoration', 'outbox notification delivery', 'foreign scan/report/create/download denial', 'logout'], providerCalls: 0 };
  } finally {
    await context.close();
  }
}
