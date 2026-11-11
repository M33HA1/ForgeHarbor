// Run with Playwright MCP browser_run_code_unsafe(filename: scripts/check-web-ui.js).
// Uses an isolated browser tab and local API fixtures; no backend/provider writes.
async (hostPage) => {
  const browser = hostPage.context().browser();
  if (!browser) throw new Error('A browser connection is required for an isolated UI fixture context.');
  const context = await browser.newContext({ acceptDownloads: true, serviceWorkers: 'block' });
  const page = await context.newPage();
  const base = 'http://localhost:8088';
  const token = 'local-ui-fixture-token';
  const scanId = 'aaaaaaaaaaaaaaaaaaaaaaaa';
  const savedReport = 'bbbbbbbbbbbbbbbbbbbbbbbb';
  const createdReport = 'cccccccccccccccccccccccc';
  const requests = [], failures = [], passed = [], unexpected = [];
  const errors = [];
  const onError = error => errors.push(error.message);
  page.on('pageerror', onError);
  page.setDefaultTimeout(5000);
  let loginFails = false, profileFails = false, reportFails = false, legacyReportFails = false, malformedScan = false;
  let cleanUrl = false;
  let profileAfterLoginFails = false;
  const row = { _id: scanId, user_id: 'ui-owner', scan_type: 'url', input: 'https://fixture.example.invalid', result: { risk_level: 'high', phishing: true }, created_at: '2026-11-03T00:00:00Z' };
  const handler = async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname;
    if (request.resourceType() === 'document' && request.method() === 'GET') return route.continue();
    if (!/^\/(auth|history|reports|notify|phishing|malware)(\/|$)/.test(path)) {
      if (['fetch', 'xhr', 'document'].includes(request.resourceType()) || request.method() !== 'GET') {
        unexpected.push('Unmocked request: ' + path);
        return route.fulfill({ status: 418, body: 'Unmocked UI request blocked' });
      }
      return route.continue();
    }
    requests.push({ path, method: request.method(), query: url.search, body: request.postData() });
    const reply = (body, status = 200, headers = {}) => route.fulfill({ status, contentType: 'application/json', headers, body: JSON.stringify(body) });
    if (path !== '/auth/login' && path !== '/auth/signup' && path !== '/auth/logout' && path !== '/auth/me' && !path.endsWith('/health') && request.headers().cookie !== 'fh_access=' + token) {
      unexpected.push('Missing fixture session cookie: ' + path);
      return reply({ error: 'UI authorization header missing' }, 401);
    }
    if (path === '/auth/login') {
      await new Promise(resolve => setTimeout(resolve, 150));
      if (loginFails) return reply({ error: 'Invalid credentials' }, 401);
      if (profileAfterLoginFails) profileFails = true;
      await context.addCookies([{ name: 'fh_access', value: token, url: base, httpOnly: true, sameSite: 'Strict' }]);
      return reply({ expires_in: 3600 }, 200, { 'set-cookie': `fh_access=${token}; Path=/; HttpOnly; SameSite=Strict` });
    }
    if (path === '/auth/logout') {
      await context.clearCookies();
      return route.fulfill({ status: 204, headers: { 'set-cookie': 'fh_access=; Max-Age=0; Path=/; HttpOnly; SameSite=Strict' } });
    }
    if (path === '/auth/me') return profileFails || request.headers().cookie !== 'fh_access=' + token ? reply({ error: 'Session verification failed' }, 401) : reply({ user_id: 'ui-owner', email: 'fixture@example.invalid' });
    if (path === '/auth/signup') return reply({ user_id: 'ui-owner' }, 201);
    if (path === '/auth/mfa') return reply({ enabled: false, available: true, recovery_codes_remaining: 0 });
    if (path === '/history') return reply({ items: [row], next_cursor: null });
    if (path === '/reports' && request.method() === 'GET') return reply([{ id: savedReport, scanId }]);
    if (path === '/reports' && request.method() === 'POST') return reportFails ? reply({ error: 'Report generation unavailable' }, 503) : reply({ id: createdReport, scanId, source: 'stored-scan-v1' });
    if (path === `/reports/${savedReport}/download` && legacyReportFails) return reply({ error: 'Legacy report artifact unavailable; generate a new report from stored scan evidence' }, 410);
    if (/^\/reports\/[^/]+\/download$/.test(path)) return route.fulfill({ status: 200, contentType: 'application/json', body: '{"fixture":true}' });
    if (path === '/phishing/v1/url/check') return reply({ status: 'success', result: malformedScan ? {} : { phishing: !cleanUrl, confidence: cleanUrl ? 0 : 0.95, reason: 'Fixture phishing evidence' } });
    if (path === '/malware/v1/file/analyze') return reply({ status: 'success', result: malformedScan ? {} : { malicious: true, vendor_positives: 5, total_vendors: 70, report_url: 'https://example.invalid/report' } });
    if (path === '/notify') return reply({ notifications: [] });
    if (path.endsWith('/health')) return reply({ status: 'ok' });
    unexpected.push(path);
    return reply({ error: 'Unmocked test API' }, 418);
  };
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const check = async (name, fn) => {
    try { await fn(); passed.push(name); }
    catch (error) { failures.push(name + ': ' + error.message.slice(0, 500)); }
  };
  const reset = async signedIn => {
    loginFails = profileFails = reportFails = legacyReportFails = malformedScan = profileAfterLoginFails = false;
    cleanUrl = false;
    // Unload the prior scenario before changing its authentication state.
    // In-flight History/report effects must not inherit the next fixture's cookies.
    await page.goto('about:blank');
    await context.clearCookies();
    await page.goto(base + '/login');
    if (signedIn) {
      await context.addCookies([{ name: 'fh_access', value: token, url: base, httpOnly: true, sameSite: 'Strict' }]);
      await page.reload();
    }
  };
  const fillLogin = async () => {
    await page.getByLabel('Email', { exact: true }).fill('fixture@example.invalid');
    await page.getByLabel('Password', { exact: true }).fill('fixture-password-only');
  };
  await page.route('**/*', handler);
  try {
    await page.setViewportSize({ width: 1280, height: 900 });
    await check('protected login return and pending submission', async () => {
      await reset(false);
      await page.goto(base + '/app/history');
      await page.waitForURL('**/login');
      await fillLogin();
      const button = page.getByRole('button', { name: 'Login', exact: true });
      await button.click();
      assert(await page.getByRole('button', { name: 'Logging in', exact: false }).isDisabled(), 'Login must disable while pending');
      await page.waitForURL('**/app/history');
      await page.getByText(row.input, { exact: true }).waitFor();
    });
    await check('failed login and failed profile clear partial session', async () => {
      await reset(false);
      loginFails = true;
      await fillLogin();
      await page.getByRole('button', { name: 'Login', exact: true }).click();
      await page.getByRole('alert').filter({ hasText: 'Invalid credentials' }).waitFor();
      loginFails = false; profileAfterLoginFails = true;
      await page.getByRole('button', { name: 'Login', exact: true }).click();
      await page.getByRole('alert').filter({ hasText: 'Session verification failed' }).waitFor();
      assert(await page.evaluate(() => localStorage.getItem('access_token')) === null, 'Failed profile persisted an access token');
      assert(!(await context.cookies(base)).some(cookie => cookie.name === 'fh_access'), 'Failed profile retained the HttpOnly session cookie');
    });
    await check('signup labels and success feedback', async () => {
      await reset(false);
      await page.goto(base + '/signup');
      await page.getByText('We check a partial hash against known breaches. Your password itself is never sent.', { exact: true }).waitFor();
      const passwordDescription = (await page.getByLabel('Password', { exact: true }).getAttribute('aria-describedby') || '').split(/\s+/);
      assert(passwordDescription.includes('signup-password-privacy'), 'Password screening disclosure must be associated with the password input');
      await page.getByLabel('Email', { exact: true }).fill('fixture@example.invalid');
      const signupCount = () => requests.filter(request => request.path === '/auth/signup').length;
      const before = signupCount();
      await page.getByLabel('Password', { exact: true }).fill('short');
      await page.getByRole('button', { name: 'Sign Up', exact: true }).click();
      await page.getByRole('alert').filter({ hasText: '15 to 128 characters' }).waitFor();
      assert(signupCount() === before, 'Weak password reached signup API');
      await page.getByLabel('Password', { exact: true }).fill('🛟'.repeat(14));
      await page.getByRole('button', { name: 'Sign Up', exact: true }).click();
      assert(signupCount() === before, 'Unicode password length used UTF-16 code units');
      await page.getByLabel('Password', { exact: true }).fill('fixture-password-only');
      await page.getByRole('button', { name: 'Sign Up', exact: true }).click();
      await page.getByRole('status').filter({ hasText: 'Signup successful' }).waitFor();
      await page.waitForURL('**/login');
    });
    await check('URL threat and malformed-result handling', async () => {
      await reset(true);
      await page.goto(base + '/app/dashboard');
      await page.getByLabel('Enter URL to check:', { exact: true }).fill(row.input);
      await page.getByRole('button', { name: 'Analyze website', exact: true }).click();
      await page.getByRole('heading', { name: 'Threat detected' }).waitFor();
      await page.getByText('95%', { exact: true }).waitFor();
      cleanUrl = true;
      await page.getByRole('button', { name: 'Analyze website', exact: true }).click();
      await page.getByRole('heading', { name: 'No threats detected' }).waitFor();
      await page.getByText('0%', { exact: true }).waitFor();
      malformedScan = true;
      await page.getByRole('button', { name: 'Analyze website', exact: true }).click();
      await page.getByRole('heading', { name: 'Analysis Failed' }).waitFor();
    });
    await check('file threat mapping and removable upload', async () => {
      await reset(true);
      await page.goto(base + '/app/dashboard');
      await page.getByRole('button', { name: 'File Analysis', exact: true }).click();
      await page.getByLabel('Upload file', { exact: true }).setInputFiles({ name: 'fixture.txt', mimeType: 'text/plain', buffer: Buffer.from('local UI fixture') });
      await page.getByRole('button', { name: 'Analyze file', exact: true }).click();
      await page.getByRole('heading', { name: 'Threat detected' }).waitFor();
      await page.getByText('5/70', { exact: true }).waitFor();
      malformedScan = true;
      await page.getByRole('button', { name: 'Analyze file', exact: true }).click();
      await page.getByRole('heading', { name: 'Analysis Failed' }).waitFor();
      await page.getByRole('button', { name: 'Remove file', exact: true }).click();
      assert(await page.getByRole('button', { name: 'Analyze file', exact: true }).isDisabled(), 'Removing file must disable analysis');
    });
    await check('History restores reports, creates by ID, downloads, and shows errors', async () => {
      await reset(true);
      await page.goto(base + '/app/history');
      await page.getByRole('button', { name: 'Download Report', exact: true }).waitFor();
      await page.reload();
      await page.getByRole('button', { name: 'Download Report', exact: true }).waitFor();
      legacyReportFails = true;
      await page.getByRole('button', { name: 'Download Report', exact: true }).click();
      await page.getByRole('status').filter({ hasText: 'Legacy report artifact unavailable; generate a new report from stored scan evidence' }).waitFor();
      legacyReportFails = false;
      await page.getByRole('button', { name: 'Generate report', exact: true }).click();
      await page.getByRole('status').filter({ hasText: 'Report created' }).waitFor();
      const posted = requests.filter(item => item.path === '/reports' && item.method === 'POST').at(-1);
      assert(JSON.stringify(JSON.parse(posted.body)) === JSON.stringify({ scanId }), 'Report creation must send only scan ID');
      const [downloaded] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download Report', exact: true }).click()]);
      assert(downloaded.suggestedFilename() === 'report-' + createdReport + '.json', 'Report download identity changed');
      await page.getByRole('status').filter({ hasText: 'Report download started' }).waitFor();
      reportFails = true;
      await page.getByRole('button', { name: 'Generate report', exact: true }).click();
      await page.getByRole('status').filter({ hasText: 'Report generation unavailable' }).waitFor();
      await Promise.all([
        page.waitForResponse(response => response.url().includes('/history?type=file')),
        page.getByRole('combobox', { name: /^Scan type/ }).selectOption('file'),
      ]);
      await Promise.all([
        page.waitForResponse(response => response.url().includes('type=file') && response.url().includes('risk=high')),
        page.getByRole('combobox', { name: /^Risk level/ }).selectOption('high'),
      ]);
    });
    await check('clear evidence, keyboard submission, active navigation and upload bounds', async () => {
      await reset(true);
      await page.goto(base + '/app/dashboard');
      assert(await page.getByRole('link', {name:'Dashboard',exact:true}).getAttribute('aria-current') === 'page', 'Active page is not identified');
      await page.getByRole('link', {name:'Skip to content'}).focus();
      await page.getByRole('link', {name:'Skip to content'}).press('Enter');
      assert(await page.evaluate(() => document.activeElement?.id === 'main-content'), 'Skip link did not focus main content');
      await page.getByLabel('Enter URL to check:').fill('https://fixture.example.invalid');
      await page.getByLabel('Enter URL to check:').press('Enter');
      await page.getByRole('heading',{name:'Threat detected',exact:true}).waitFor();
      await page.getByText('Not assessed',{exact:true}).waitFor();
      assert(await page.evaluate(() => document.activeElement?.getAttribute('aria-label') === 'Analysis result'), 'Completed result did not receive focus');
      await page.getByRole('button',{name:'File Analysis',exact:true}).click();
      await page.getByLabel('Upload file',{exact:true}).evaluate(input => {
        const transfer = new DataTransfer();
        transfer.items.add(new File([new Uint8Array(32*1024*1024+1)],'oversized-fixture.bin'));
        input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));
      });
      await page.getByRole('alert').filter({hasText:'32 MiB'}).waitFor();
      assert(await page.getByRole('button',{name:'Analyze file',exact:true}).isDisabled(), 'Oversized file can be submitted');
      const previousResult = row.result;
      row.result = {};
      try {
        await page.goto(base + '/app/history');
        await page.getByText('Not assessed',{exact:true}).waitFor();
        assert(await page.getByText('No threats detected',{exact:true}).count()===0,'Missing historical evidence was marked clean');
      } finally { row.result = previousResult; }
    });
    await check('marketing claims and responsive workspace and account pages', async () => {
      await reset(false);
      await page.goto(base + '/');
      await page.getByRole('link', {name:'Create your workspace',exact:true}).waitFor();
      assert(await page.getByText('99.9%', {exact:true}).count()===0, 'Unverified accuracy claim remains');
      await page.getByText('Illustrative data',{exact:true}).waitFor();
      await page.getByRole('button',{name:'No reported threat',exact:true}).click();
      await page.getByRole('heading',{name:'No threats detected',exact:true}).waitFor();
      await page.getByRole('button',{name:'Flagged URL',exact:true}).click();
      await page.getByRole('heading',{name:'Threat detected',exact:true}).waitFor();
      for (const width of [320, 768, 1440]) {
        await page.setViewportSize({width,height:1000});
        for (const path of ['/', '/login', '/signup']) {
          await page.goto(base+path);
          if (path === '/') await page.getByText('Illustrative data',{exact:true}).waitFor();
          else await page.getByLabel('Password',{exact:true}).waitFor();
          assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth), `${path} overflows at ${width}px`);
        }
      }
      await reset(true);
      for (const width of [320, 768, 1440]) {
        await page.setViewportSize({width,height:1000});
        for (const path of ['/app/dashboard', '/app/history', '/app/profile']) {
          await page.goto(base+path);
          await page.getByRole('navigation',{name:'Workspace navigation'}).waitFor();
          assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth), `${path} overflows at ${width}px`);
        }
      }
    });
    await check('unknown page offers a working return path', async () => {
      await reset(false);
      await page.goto(base + '/missing-page');
      await page.getByRole('heading', {name:'Page not found',exact:true}).waitFor();
      await page.getByRole('link', {name:'Return to home',exact:true}).click();
      await page.getByRole('link', {name:'Create your workspace',exact:true}).waitFor();
    });
    await check('mobile navigation names, layout, and logout', async () => {
      await reset(true);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(base + '/app/dashboard');
      await page.getByRole('link', { name: 'Dashboard', exact: true }).waitFor();
      await page.getByRole('link', { name: 'History', exact: true }).waitFor();
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Dashboard overflows mobile viewport');
      await page.getByRole('button', { name: 'Logout', exact: true }).click();
      assert(await page.evaluate(() => localStorage.getItem('access_token')) === null, 'Logout persisted an access token');
      assert(!(await context.cookies(base)).some(cookie => cookie.name === 'fh_access'), 'Logout retained the HttpOnly session cookie');
      await page.goto(base + '/app/history');
      await page.waitForURL('**/login');
    });
    assert(unexpected.length === 0, 'Unexpected API calls: ' + unexpected.join(', '));
    assert(errors.length === 0, 'Uncaught page errors: ' + errors.join(', '));
    if (failures.length) throw new Error(JSON.stringify({ passed, failures }));
    return { passed, backendWrites: 0, providerCalls: 0, scope: 'Built React UI with deterministic local API fixtures' };
  } finally {
    await page.goto('about:blank');
    await context.clearCookies().catch(() => {});
    await page.unroute('**/*', handler);
    page.removeListener('pageerror', onError);
    await context.close();
  }
}
