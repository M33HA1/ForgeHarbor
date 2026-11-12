// Run against isolated Go/Rust Auth fixtures on loopback ports 8180/8181 and
// the loopback test gateway on 8088 (Web upstream 8182). Uses real Auth endpoints; returns no secrets.
// Never point the Auth fixture at a shared database. Its data is disposable.
async (hostPage) => {
  const browser = hostPage.context().browser();
  const context = await browser.newContext({ serviceWorkers: 'block' });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const base = 'http://localhost:8088';
  const run = Date.now().toString(36) + Math.random().toString(36).slice(2);
  const email = 'mfa-browser-' + run + '@example.invalid';
  const password = 'Synthetic-fixture-' + run + '-only!';
  const passed = [], errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const assert = (value, message) => { if (!value) throw new Error(message); };
  // Local traffic uses a real HTTP gateway; only external browser requests are intercepted.
  await page.route(url => url.origin !== base, route => route.abort('blockedbyclient'));
  const login = async () => {
    await page.goto(base + '/login');
    await page.getByLabel('Email', { exact: true }).fill(email);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Login', exact: true }).click();
  };
  const logout = async () => { await page.getByRole('button', {name:'Logout',exact:true}).click(); await page.getByRole('heading',{name:'Login',exact:true}).waitFor(); };
  const api = async (path, body) => page.evaluate(async ({path,body}) => {
    const r = await fetch(path, { method: body ? 'POST' : 'GET', headers: {'Content-Type':'application/json'}, ...(body && {body:JSON.stringify(body)}) });
    return {status:r.status, data:await r.json().catch(()=>null)};
  }, {path,body});
  try {
    await page.goto(base + '/signup');
    await page.getByLabel('Email', {exact:true}).fill(email);
    await page.getByLabel('Password', {exact:true}).fill(password);
    await page.getByRole('button', {name:'Sign Up',exact:true}).click();
    await page.waitForURL('**/login');
    await login(); await page.waitForURL('**/app/dashboard');
    const oldCookies = await context.cookies(base);
    await page.goto(base + '/app/profile');
    const settings = page.getByRole('region', {name:'Two-step verification'});
    await settings.getByText('Not enabled',{exact:true}).waitFor();
    await settings.getByLabel('Current password').fill('incorrect-fixture-password');
    await settings.getByRole('button',{name:'Set up authenticator'}).click();
    await settings.getByRole('alert').filter({hasText:'Password confirmation failed'}).waitFor();
    await settings.getByLabel('Current password').fill(password);
    await settings.getByRole('button',{name:'Set up authenticator'}).click();
    await settings.getByAltText('Authenticator enrollment QR code').waitFor();
    assert((await settings.getByAltText('Authenticator enrollment QR code').getAttribute('src')).startsWith('data:image/png;'), 'QR was not generated locally');
    const seed = await settings.getByLabel('Authenticator setup key').textContent();
    // Calculate RFC 6238 in browser memory. The seed/code never leave this test.
    const authenticatorCode = await page.evaluate(async secret => {
      const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';let bits='';for(const ch of secret)bits+=alphabet.indexOf(ch).toString(2).padStart(5,'0');
      const bytes=new Uint8Array(Math.floor(bits.length/8));for(let i=0;i<bytes.length;i++)bytes[i]=parseInt(bits.slice(i*8,i*8+8),2);
      const key=await crypto.subtle.importKey('raw',bytes,{name:'HMAC',hash:'SHA-1'},false,['sign']);
      const msg=new Uint8Array(8);new DataView(msg.buffer).setBigUint64(0,BigInt(Math.floor(Date.now()/30000)));
      const hash=new Uint8Array(await crypto.subtle.sign('HMAC',key,msg)),offset=hash[19]&15;
      return String(((hash[offset]&127)*16777216+hash[offset+1]*65536+hash[offset+2]*256+hash[offset+3])%1000000).padStart(6,'0');
    }, seed);
    await settings.getByLabel('Authenticator code',{exact:true}).fill(authenticatorCode);
    await settings.getByRole('button',{name:'Verify and enable'}).click();
    await settings.getByRole('heading',{name:'Save your recovery codes'}).waitFor();
    const codes = await settings.getByRole('list',{name:'Recovery codes'}).getByRole('listitem').allTextContents();
    assert(codes.length===10, 'Recovery codes missing');
    await settings.getByRole('button',{name:'I have saved my recovery codes'}).click();
    assert(await settings.getByRole('list',{name:'Recovery codes'}).count()===0, 'Codes retained after dismissal');
    passed.push('Password-confirmed enrollment, local QR and one-time recovery display');
    const signed = await context.cookies(base);
    await context.clearCookies();await context.addCookies(oldCookies);
    assert((await api('/auth/me')).status===401,'Old password-only session still valid');
    assert((await api('/__mfa_rollback/me')).status===401,'Rollback accepted old password-only session');
    assert((await api('/__mfa_rollback/login',{email,password})).status===503,'Rollback bypassed MFA');
    await context.clearCookies();await context.addCookies(signed);
    passed.push('Enrollment invalidates old sessions; legacy rollback cannot bypass MFA');
    await logout();await login();
    await page.getByRole('heading',{name:'Two-step verification'}).waitFor();
    assert((await api('/auth/me')).status===401, 'Password login granted access');
    assert((await context.cookies(base)).every(cookie=>cookie.name!=='fh_access'||!cookie.value),'Pending login has access cookie');
    await page.getByLabel('Authenticator code',{exact:true}).fill('000000');
    await page.getByRole('button',{name:'Verify and sign in'}).click();
    await page.getByRole('alert').filter({hasText:'invalid'}).waitFor();
    await page.getByRole('button',{name:'Use a recovery code'}).click();
    await page.getByLabel('Recovery code',{exact:true}).fill(codes[0]);
    await page.getByRole('button',{name:'Verify and sign in'}).click();
    await page.waitForURL(/\/app\/(dashboard|profile)$/);
    passed.push('Password-only denial, invalid code rejection and recovery sign-in');
    await logout();await login();await page.getByRole('heading',{name:'Two-step verification'}).waitFor();
    await page.getByRole('button',{name:'Use a recovery code'}).click();
    await page.getByLabel('Recovery code',{exact:true}).fill(codes[0]);
    await page.getByRole('button',{name:'Verify and sign in'}).click();
    await page.getByRole('alert').filter({hasText:'invalid'}).waitFor();
    await page.getByLabel('Recovery code',{exact:true}).fill(codes[1]);
    await page.getByRole('button',{name:'Verify and sign in'}).click();await page.waitForURL(/\/app\/(dashboard|profile)$/);
    passed.push('Consumed recovery code rejected on a new login');
    await page.goto(base+'/app/profile');
    await settings.getByText('Enabled · 8 recovery codes remaining',{exact:true}).waitFor();
    await settings.getByLabel('Current password').fill(password);
    await settings.getByLabel('Authenticator or recovery code').fill(codes[2]);
    await settings.getByRole('button',{name:'Turn off two-step verification'}).click();
    await settings.getByText('Not enabled',{exact:true}).waitFor();
    await logout();await login();await page.waitForURL(/\/app\/(dashboard|profile)$/);
    passed.push('Password and second-factor disable, then ordinary login');
    assert(await page.evaluate(()=>localStorage.length===0 && sessionStorage.length===0),'Authentication data persisted in Web storage');
    assert(errors.length===0,'Browser runtime errors');
    return {passed, runtimeErrors:errors.length};
  } finally {
    // Drain any external-request abort handlers before closing the disposable context.
    await page.unrouteAll({ behavior: 'wait' });
    await context.close();
  }
}
