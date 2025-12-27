## Supabase Edge Function: `is-email-registered`

This package’s v2 UI flow needs a reliable **“is this email already registered?”** check.
Client-side Supabase can’t safely do this without a backend, so we use a Supabase Edge Function.

### What it does
- Input: `{ "email": "user@example.com" }`
- Output: `{ "exists": true }` or `{ "exists": false }`

### Files
- `supabase/functions/is-email-registered/index.ts`

### Deploy (using Supabase CLI)

1) Install and login:

```bash
brew install supabase/tap/supabase
supabase login
```

2) Link to your project (run inside your app’s repo that includes this function):

```bash
supabase link --project-ref YOUR_PROJECT_REF
```

3) Set function secrets:

```bash
supabase secrets set --project-ref YOUR_PROJECT_REF SB_URL=\"https://YOUR_PROJECT.supabase.co\"
supabase secrets set --project-ref YOUR_PROJECT_REF SB_SERVICE_ROLE_KEY=\"YOUR_SERVICE_ROLE_KEY\"
```

4) Deploy:

```bash
supabase functions deploy is-email-registered
```

### Security notes
- `SUPABASE_SERVICE_ROLE_KEY` must **never** be shipped to the Expo app.
- Keep it only in Edge Function secrets.


