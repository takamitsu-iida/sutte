/**
 * Decap CMS GitHub OAuth Provider (Cloudflare Worker)
 *
 * Required env vars:
 * - GITHUB_CLIENT_ID
 * - GITHUB_CLIENT_SECRET
 * Optional:
 * - DEFAULT_SCOPE (default: public_repo)
 */

function html(body) {
  return new Response(body, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

function randomState() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function getCookie(request, name) {
  const cookie = request.headers.get('cookie') || '';
  const parts = cookie.split(/;\s*/g);
  for (const part of parts) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const k = part.slice(0, idx);
    const v = part.slice(idx + 1);
    if (k === name) return v;
  }
  return null;
}

function setCookie(headers, name, value) {
  // Lax: allows redirect-based flow.
  headers.append(
    'set-cookie',
    `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=300`
  );
}

function clearCookie(headers, name) {
  headers.append(
    'set-cookie',
    `${name}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`
  );
}

function providerMessageSuccess(token) {
  const payload = JSON.stringify({ token });
  return (
    'authorization:github:success:' +
    payload.replaceAll('\\', '\\\\').replaceAll("'", "\\'")
  );
}

function providerMessageError(message) {
  const payload = JSON.stringify({ message });
  return (
    'authorization:github:error:' +
    payload.replaceAll('\\', '\\\\').replaceAll("'", "\\'")
  );
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const pathname = url.pathname.replace(/\/+$/, '') || '/';

    if (pathname === '/') {
      return json({
        ok: true,
        name: 'decap-github-oauth-provider',
        endpoints: ['/auth', '/callback'],
      });
    }

    if (pathname === '/auth') {
      if (!env.GITHUB_CLIENT_ID) return json({ error: 'Missing GITHUB_CLIENT_ID' }, 500);
      if (!env.GITHUB_CLIENT_SECRET) return json({ error: 'Missing GITHUB_CLIENT_SECRET' }, 500);

      const state = randomState();
      const scope = url.searchParams.get('scope') || env.DEFAULT_SCOPE || 'public_repo';

      const baseUrl = `${url.origin}`;
      const redirectUri = `${baseUrl}/callback`;

      const authorize = new URL('https://github.com/login/oauth/authorize');
      authorize.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
      authorize.searchParams.set('redirect_uri', redirectUri);
      authorize.searchParams.set('scope', scope);
      authorize.searchParams.set('state', state);

      const headers = new Headers({ location: authorize.toString() });
      setCookie(headers, 'decap_oauth_state', state);
      return new Response(null, { status: 302, headers });
    }

    if (pathname === '/callback') {
      if (!env.GITHUB_CLIENT_ID) return json({ error: 'Missing GITHUB_CLIENT_ID' }, 500);
      if (!env.GITHUB_CLIENT_SECRET) return json({ error: 'Missing GITHUB_CLIENT_SECRET' }, 500);

      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      const expected = getCookie(request, 'decap_oauth_state');

      const headers = new Headers();
      clearCookie(headers, 'decap_oauth_state');

      if (!code) {
        return html(
          `<script>window.opener&&window.opener.postMessage('${providerMessageError('Missing code')}', '*');window.close();</script>`
        );
      }

      if (!state || !expected || state !== expected) {
        return html(
          `<script>window.opener&&window.opener.postMessage('${providerMessageError('Invalid state')}', '*');window.close();</script>`
        );
      }

      const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          'user-agent': 'decap-cms-oauth-provider',
        },
        body: JSON.stringify({
          client_id: env.GITHUB_CLIENT_ID,
          client_secret: env.GITHUB_CLIENT_SECRET,
          code,
        }),
      });

      const tokenJson = await tokenRes.json().catch(() => ({}));
      if (!tokenRes.ok || !tokenJson.access_token) {
        const msg = tokenJson.error_description || tokenJson.error || 'Token exchange failed';
        return html(
          `<script>window.opener&&window.opener.postMessage('${providerMessageError(msg)}', '*');window.close();</script>`
        );
      }

      const token = tokenJson.access_token;
      return new Response(
        `<!doctype html><meta charset="utf-8" />
<script>
  (function () {
    var msg = '${providerMessageSuccess(token)}';
    if (window.opener && window.opener.postMessage) {
      window.opener.postMessage(msg, '*');
    }
    window.close();
  })();
</script>`,
        { headers }
      );
    }

    return json({ error: 'Not found' }, 404);
  },
};
