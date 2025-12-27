// Supabase Edge Function: is-email-registered
//
// Purpose:
// - Client-side Supabase cannot reliably check if an email is registered.
// - This function uses the service role key (server-side only) to check.
//
// Input:  { "email": "user@example.com" }
// Output: { "exists": true }
//
// IMPORTANT:
// - Never expose SUPABASE_SERVICE_ROLE_KEY in the client app.
// - Configure these secrets for the function environment:
//   - SB_URL
//   - SB_SERVICE_ROLE_KEY

// NOTE:
// We intentionally avoid importing `@supabase/supabase-js` inside Edge Functions here.
// In some environments, remote module resolution can fail at runtime and return opaque
// "Internal Server Error" before the handler runs. Using plain fetch is more reliable.

function json(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...(init.headers ?? {}),
    },
  });
}

function isValidEmail(email: string) {
  // Simple, practical email validation for v1 (not RFC-perfect).
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function decodeJwtPayload(jwt: string): Record<string, unknown> | null {
  // Best-effort decode of JWT payload for diagnostics (NO signature verification).
  // This is safe as long as we never echo back the token itself.
  try {
    const parts = jwt.split('.');
    if (parts.length < 2) return null;
    const payloadB64Url = parts[1];
    const payloadB64 = payloadB64Url.replace(/-/g, '+').replace(/_/g, '/');
    const padded = payloadB64 + '='.repeat((4 - (payloadB64.length % 4)) % 4);
    const jsonStr = atob(padded);
    return JSON.parse(jsonStr) as Record<string, unknown>;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  const { email } = (await req.json().catch(() => ({}))) as { email?: string };
  const normalizedEmail = String(email ?? '').trim().toLowerCase();

  if (!normalizedEmail || !isValidEmail(normalizedEmail)) {
    return json({ error: 'Invalid email' }, { status: 400 });
  }

  // Support both env conventions to avoid "rename loops":
  // - Recommended: SB_URL + SB_SERVICE_ROLE_KEY (works well with Supabase CLI)
  // - Legacy: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
  const supabaseUrl = Deno.env.get('SB_URL') ?? Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SB_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    return json(
      {
        error: 'Missing server configuration',
        // Safe diagnostics: only booleans, no secrets.
        config: {
          hasSB_URL: Boolean(Deno.env.get('SB_URL')),
          hasSB_SERVICE_ROLE_KEY: Boolean(Deno.env.get('SB_SERVICE_ROLE_KEY')),
          hasSUPABASE_URL: Boolean(Deno.env.get('SUPABASE_URL')),
          hasSUPABASE_SERVICE_ROLE_KEY: Boolean(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')),
        },
      },
      { status: 500 },
    );
  }

  // Helpful diagnostic: ensure the key is truly a service-role JWT.
  // Many users accidentally paste publishable/anon keys instead.
  const payload = decodeJwtPayload(serviceRoleKey);
  const role = typeof payload?.role === 'string' ? payload.role : null;
  if (role && role !== 'service_role') {
    return json(
      {
        error: 'Invalid service role key',
        hint: 'Your function secret must be the *service_role* key from Supabase Dashboard → Project Settings → API.',
        role,
      },
      { status: 500 },
    );
  }

  // Uses the Auth Admin REST API to check if user exists for the email.
  //
  // IMPORTANT:
  // GoTrue versions differ in supported query params. Some ignore `email=...` and return
  // the first page of users. Therefore we MUST only return `exists: true` when we find
  // an exact email match in the response payload.
  //
  // We try a narrow search query first; if the backend ignores it, we still scan the
  // returned users for an exact match.
  const adminUrl = `${supabaseUrl}/auth/v1/admin/users?search=${encodeURIComponent(
    normalizedEmail,
  )}&per_page=50`;

  try {
    const res = await fetch(adminUrl, {
      method: 'GET',
      headers: {
        authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
        accept: 'application/json',
      },
    });

    // If the endpoint returns 404 for "not found", treat as not registered.
    if (res.status === 404) {
      return json({ exists: false }, { status: 200 });
    }

    const text = await res.text();
    const payload = (() => {
      try {
        return JSON.parse(text) as any;
      } catch {
        return null;
      }
    })();

    if (!res.ok) {
      // Do not leak sensitive internal details.
      return json(
        {
          error: 'Failed to check email',
          status: res.status,
        },
        { status: 500 },
      );
    }

    // Handle common response shapes:
    // - { user: {...} }
    // - { users: [...] }
    // - [ ...users ]
    const users = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.users)
        ? payload.users
        : payload?.user
          ? [payload.user]
          : [];

    const exists = users.some((u) => {
      const uEmail = String(u?.email ?? '').trim().toLowerCase();
      return uEmail === normalizedEmail;
    });

    return json({ exists }, { status: 200 });
  } catch {
    return json({ error: 'Failed to check email' }, { status: 500 });
  }
});


