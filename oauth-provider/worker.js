/**
 * Decap CMS GitHub OAuth Provider (Cloudflare Worker)
 *
 * Required env vars:
 * - GITHUB_CLIENT_ID
 * - GITHUB_CLIENT_SECRET
 * Optional:
 * - DEFAULT_SCOPE (default: public_repo)
 */

function html(body, extraHeaders) {
  const headers = new Headers(extraHeaders);
  if (!headers.has('content-type')) headers.set('content-type', 'text/html; charset=utf-8');
  if (!headers.has('cache-control')) headers.set('cache-control', 'no-store');
  if (!headers.has('x-content-type-options')) headers.set('x-content-type-options', 'nosniff');
  return new Response(body, { headers });
}

function callbackPage({ script, title = 'OAuth', message = 'Processing…', details = '' }) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
  </head>
  <body>
    <p>${message}</p>
    ${details ? `<pre style="white-space:pre-wrap;word-break:break-word;">${details}</pre>` : ''}
    <script>${script}</script>
  </body>
</html>`;
}

function postToOpenerAndMaybeClose(message) {
  return `(function(){
    try {
      if (window.opener && window.opener.postMessage) {
        window.opener.postMessage(${JSON.stringify(message)}, '*');
        setTimeout(function(){ window.close(); }, 50);
        return;
      }
    } catch (e) {}
    // No opener: keep window open so the user can read the error.
  })();`;
}

function authHandshakePage({ provider, authorizeUrl }) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>OAuth</title>
  </head>
  <body>
    <p>Redirecting to provider…</p>
    <script>
      (function () {
        var provider = ${JSON.stringify(provider)};
        var authorizeUrl = ${JSON.stringify(authorizeUrl)};
        var started = false;

        function start() {
          if (started) return;
          started = true;
          window.location.assign(authorizeUrl);
        }

        // Handshake with Decap CMS popup flow.
        window.addEventListener(
          'message',
          function (e) {
            if (e && e.data === 'authorizing:' + provider) {
              start();
            }
          },
          false
        );

        try {
          if (window.opener && window.opener.postMessage) {
            window.opener.postMessage('authorizing:' + provider, '*');
          } else {
            start();
          }
        } catch (e) {
          start();
        }

        // Fallback: proceed even if opener messages are blocked.
        setTimeout(start, 800);
      })();
    </script>
  </body>
</html>`;
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

      const provider = url.searchParams.get('provider') || 'github';
      if (provider !== 'github') return json({ error: 'Unsupported provider' }, 400);

      const state = randomState();
      const scope = url.searchParams.get('scope') || env.DEFAULT_SCOPE || 'public_repo';

      const baseUrl = `${url.origin}`;
      const redirectUri = `${baseUrl}/callback`;

      const authorize = new URL('https://github.com/login/oauth/authorize');
      authorize.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
      authorize.searchParams.set('redirect_uri', redirectUri);
      authorize.searchParams.set('scope', scope);
      authorize.searchParams.set('state', state);

      const headers = new Headers();
      setCookie(headers, 'decap_oauth_state', state);
      return html(
        authHandshakePage({ provider, authorizeUrl: authorize.toString() }),
        headers
      );
    }

    if (pathname === '/callback') {
      if (!env.GITHUB_CLIENT_ID) return json({ error: 'Missing GITHUB_CLIENT_ID' }, 500);
      if (!env.GITHUB_CLIENT_SECRET) return json({ error: 'Missing GITHUB_CLIENT_SECRET' }, 500);

      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      const oauthError = url.searchParams.get('error');
      const oauthErrorDescription = url.searchParams.get('error_description');
      const expected = getCookie(request, 'decap_oauth_state');

      const headers = new Headers();
      clearCookie(headers, 'decap_oauth_state');

      if (!code) {
        const msg = oauthErrorDescription
          ? `${oauthError || 'oauth_error'}: ${oauthErrorDescription}`
          : oauthError || 'Missing code';
        const providerMsg = providerMessageError(msg);
        return html(
          callbackPage({
            title: 'OAuth error',
            message: 'OAuth failed (no code returned).',
            details: msg,
            script: postToOpenerAndMaybeClose(providerMsg),
          }),
          headers
        );
      }

      if (!state || !expected || state !== expected) {
        const msg = 'Invalid state (CSRF check failed). Please retry.';
        const providerMsg = providerMessageError(msg);
        return html(
          callbackPage({
            title: 'OAuth error',
            message: 'Invalid state.',
            details: msg,
            script: postToOpenerAndMaybeClose(providerMsg),
          }),
          headers
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
        const providerMsg = providerMessageError(msg);
        return html(
          callbackPage({
            title: 'OAuth error',
            message: 'Token exchange failed.',
            details: msg,
            script: postToOpenerAndMaybeClose(providerMsg),
          }),
          headers
        );
      }

      const token = tokenJson.access_token;
      const providerMsg = providerMessageSuccess(token);
      return html(
        callbackPage({
          title: 'OAuth success',
          message: 'Authentication complete. You can close this window.',
          script: postToOpenerAndMaybeClose(providerMsg),
        }),
        headers
      );
    }

    return json({ error: 'Not found' }, 404);
  },
};
