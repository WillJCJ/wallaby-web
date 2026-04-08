const jsonResponse = (payload, init = {}) => {
  const headers = new Headers(init.headers || {});
  headers.set('content-type', 'application/json; charset=utf-8');

  return new Response(JSON.stringify(payload), {
    ...init,
    headers,
  });
};

const handlePrivateDetails = (request, env) => {
  if (request.method !== 'GET') {
    return jsonResponse({ error: 'Method Not Allowed' }, { status: 405 });
  }

  const email = request.headers.get('CF-Access-Authenticated-User-Email');

  // This header is injected by Cloudflare Access for authenticated users.
  if (!email) {
    return jsonResponse({ error: 'Unauthorized' }, { status: 401 });
  }

  return jsonResponse(
    {
      address: env.EVENT_ADDRESS || '62 West Wallaby Street, Wigan, Lancashire, WA11 4BY',
      gateCode: env.GATE_CODE || '1234',
      viewer: email,
    },
    {
      headers: {
        'cache-control': 'private, no-store',
      },
    }
  );
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/private/details') {
      return handlePrivateDetails(request, env);
    }

    return env.ASSETS.fetch(request);
  },
};
