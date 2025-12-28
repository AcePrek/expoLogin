## Expo Login Auth Module (Supabase compatible)

A reusable **single-screen Sign in / Sign up** module for **Expo + Supabase**.

This repo is **just the package** (no demo app inside this repo). The intended flow is:
1) You already have an Expo app running.
2) You install this package (from GitHub) into your Expo app.
3) You add Supabase creds to your app’s `.env`.
4) You render `<AuthScreen supabase={client} />`.

## What it supports (v1)
- **Sign in**: email + password
- **Sign up**: name + email + password (name stored in `user_metadata.name`)
- **No** OTP / magic links in v1
- **No** navigation libs required
- UI is editable from **one file**

## Flow (v2)
This package now uses a simple, modern onboarding flow:
- Start screen: single **SIGN IN** button
- Email screen: type email → checks if user exists (spinner → green check) → **CONTINUE**
- If new: ask **Your Name** → ask **Create Password** → sign up
- If existing: ask **Password** → sign in

## Install (from GitHub)

```bash
npm install github:AcePrek/expoLogin
```

## Install name vs import name (important)

- **Install from**: `github:AcePrek/expoLogin`
- **Import from**: `expo-login-auth-module` (this is the `name` in `package.json`)

## Required peer deps (your app already has these)
- `react`
- `react-native`
- `react-native-safe-area-context` (required for safe-area insets used by the UI)

## Safe Area setup (required)

1) Install:

```bash
npx expo install react-native-safe-area-context
```

2) Wrap your app root with `SafeAreaProvider` (example `index.js`):

```js
import React from 'react';
import { registerRootComponent } from 'expo';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import App from './App';

function Root() {
  return (
    <SafeAreaProvider>
      <App />
    </SafeAreaProvider>
  );
}

registerRootComponent(Root);
```

Troubleshooting:
- If you still hit a safe-area error after installing + wrapping, stop Expo and run `npx expo start --clear`. If it still fails, paste the next log/screenshot and I’ll keep going.

## Supabase client setup (in your Expo app)

Install these in your Expo app:

```bash
npm install @supabase/supabase-js @react-native-async-storage/async-storage react-native-url-polyfill
```

Add polyfills in your app entry (usually `index.js` or `App.tsx`):

```js
import 'react-native-url-polyfill/auto';
```

Create the Supabase client **in your app** (do not hardcode keys):

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  {
    auth: {
      storage: AsyncStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  }
);
```

### Env vars

Create `.env` at your Expo app root (same folder as your app’s `package.json`).

This repo includes `ENV.example` you can copy from:

```bash
cp ENV.example .env
```

Set:
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` (**use the `anon public` key that starts with `eyJ...`**; not `sb_publishable_*`)

Restart Expo with cache clear after changing env:

```bash
npx expo start --clear
```

Troubleshooting:
- If you changed `.env` and it still reads old values: stop Expo and run `npx expo start --clear`.

## Email check (required Edge Function)

To decide **new vs existing user**, the module calls a Supabase Edge Function:
- Function name: `is-email-registered`
- Called via: `supabase.functions.invoke('is-email-registered', { body: { email } })`

This must be deployed in your Supabase project (uses service role server-side).
See `supabase/README.md` in this repo for deployment steps.

## Usage

```js
import { AuthScreen } from 'expo-login-auth-module';

export function MyAuthGate() {
  return <AuthScreen supabase={supabase} />;
}
```

## Where to edit UI (important)

✅ All UI + styling is in **one file**:
- `AuthScreen.ui.js`

You can redesign the screen by editing only that file.

## How it works (architecture)

- `AuthScreen.ui.js` – **UI only** (layout + styles + strings)
- `AuthScreen.logic.js` – **logic only** (state + validation + busy/errors + provider calls)
- `auth.providers.js` – **provider layer** (the only place that calls Supabase APIs)
- `auth.types.js` – shared constants

This provider-based architecture makes it easy to add Google/Apple/OTP later without breaking the UI/logic contract.


