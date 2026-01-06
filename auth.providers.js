/**
 * Auth Providers (future-proofing)
 *
 * IMPORTANT:
 * - All Supabase calls live inside provider methods.
 * - The provider is the ONLY thing that knows Supabase method names.
 * - Provider methods THROW on error (logic catches and shows message).
 *
 * Later (v2+), you can add providers here (Google/Apple/OTP/SSO) without changing
 * the UI/logic contract.
 */

import { PROVIDERS } from './auth.types';

function extractSupabaseErrorMessage(error) {
  if (!error) return 'Unknown error';
  if (typeof error === 'string') return error;
  if (typeof error?.message === 'string') return error.message;
  return 'Unknown error';
}

function getSupabaseBaseUrl(supabase) {
  // supabase-js v2 exposes supabaseUrl on the client instance.
  const url = supabase?.supabaseUrl;
  return typeof url === 'string' ? url : null;
}

function explainEdgeFunctionError(error, data) {
  // supabase-js Functions errors often include `context` with HTTP status.
  const status = error?.context?.status;
  const baseUrl = getSupabaseBaseUrl(error?.context?.supabase) || null;

  // If the Edge Function returned a JSON body (even on 5xx), surface it.
  // Our Edge Function intentionally returns *safe* diagnostics (no secrets).
  if (data && typeof data === 'object') {
    const serverError = typeof data?.error === 'string' ? data.error : null;
    const hint = typeof data?.hint === 'string' ? data.hint : null;
    const role = typeof data?.role === 'string' ? data.role : null;
    const config = data?.config && typeof data.config === 'object' ? data.config : null;

    const missing = [];
    if (config) {
      if (config?.hasSB_URL === false) missing.push('SB_URL');
      if (config?.hasSB_SERVICE_ROLE_KEY === false) missing.push('SB_SERVICE_ROLE_KEY');
      if (config?.hasSUPABASE_URL === false) missing.push('SUPABASE_URL');
      if (config?.hasSUPABASE_SERVICE_ROLE_KEY === false) missing.push('SUPABASE_SERVICE_ROLE_KEY');
    }

    if (serverError) {
      let msg = serverError;
      if (role) msg += ` (role: ${role})`;
      if (missing.length) msg += ` (missing: ${missing.join(', ')})`;
      if (hint) msg += ` (${hint})`;
      return msg;
    }
  }

  if (status === 404) {
    return 'Email check service not found. Deploy the Edge Function: is-email-registered.';
  }
  if (status === 401 || status === 403) {
    return 'Email check not authorized. Ensure your anon key is correct and the function is deployed.';
  }
  if (typeof status === 'number' && status >= 500) {
    return 'Email check server error. Ensure Edge Function secrets are set (recommended): SB_URL and SB_SERVICE_ROLE_KEY.';
  }
  const message = extractSupabaseErrorMessage(error);

  // Network / URL issues (common in Expo if env changed without restart, or URL is wrong).
  if (
    message === 'Failed to send a request to the Edge Function' ||
    message === 'Network request failed' ||
    /Failed to send a request/i.test(message)
  ) {
    return [
      'Cannot reach the Edge Function.',
      'Check:',
      '- EXPO_PUBLIC_SUPABASE_URL is exactly `https://<project-ref>.supabase.co` (no spaces, no quotes).',
      '- Restart Expo with `npx expo start -c` after changing env vars.',
      '- Device/simulator has internet access.',
    ].join(' ');
  }

  return message;
}

/**
 * @param {{ supabase: any }} params
 */
export function createAuthProviders({ supabase }) {
  if (!supabase) {
    throw new Error('Supabase client is required (pass supabase={client}).');
  }

  return {
    emailPassword: {
      id: PROVIDERS.EMAIL_PASSWORD,
      label: 'Email',
      enabled: true,

      /**
       * Check whether an email is already registered.
       *
       * IMPORTANT:
       * - This calls a Supabase Edge Function that uses service role server-side.
       * - Do NOT attempt to check this purely client-side (not reliable or safe).
       *
       * Edge function name: is-email-registered
       * Input: { email }
       * Output: { exists: boolean }
       *
       * @param {{ email: string }} params
       * @returns {Promise<boolean>}
       */
      async checkEmailExists({ email }) {
        const { data, error } = await supabase.functions.invoke('is-email-registered', {
          body: { email },
        });

        if (error) {
          throw new Error(explainEdgeFunctionError(error, data));
        }

        if (typeof data?.exists !== 'boolean') {
          throw new Error('Email check failed (invalid response).');
        }

        return data.exists;
      },

      /**
       * Sign in using email + password (v1).
       * @param {{ email: string, password: string }} params
       */
      async signIn({ email, password }) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          throw new Error(extractSupabaseErrorMessage(error));
        }

        return data;
      },

      /**
       * Sign up using email + password (v1).
       * Store name in user metadata for now.
       * @param {{ name: string, email: string, password: string }} params
       */
      async signUp({ name, email, password }) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { name },
          },
        });

        if (error) {
          throw new Error(extractSupabaseErrorMessage(error));
        }

        return data;
      },

      /**
       * Sign out.
       */
      async signOut() {
        const { error } = await supabase.auth.signOut();
        if (error) {
          throw new Error(extractSupabaseErrorMessage(error));
        }
      },

      /**
       * Get current user (no network table; v1 only).
       */
      async getCurrentUser() {
        const { data, error } = await supabase.auth.getUser();
        if (error) {
          throw new Error(extractSupabaseErrorMessage(error));
        }
        return data?.user ?? null;
      },

      /**
       * Subscribe to auth state changes.
       * @param {(payload: { event: any, session: any }) => void} handler
       * @returns {() => void} unsubscribe
       */
      onAuthStateChange(handler) {
        const { data } = supabase.auth.onAuthStateChange((event, session) => {
          handler({ event, session });
        });

        return () => {
          data?.subscription?.unsubscribe?.();
        };
      },
    },

    /**
     * Email OTP (code) auth.
     *
     * - requestOtp: sends a code to user's email
     * - verifyOtp: verifies the code and creates/signs-in user
     * - updateProfile: optional metadata update (e.g., name) after verification
     */
    emailOtp: {
      id: PROVIDERS.EMAIL_OTP,
      label: 'Email OTP',
      enabled: true,

      /**
       * Request an email OTP.
       * @param {{ email: string }} params
       */
      async requestOtp({ email }) {
        const { data, error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            // Create user if this is a new email, so the same endpoint supports sign-up and sign-in.
            shouldCreateUser: true,
          },
        });

        if (error) {
          throw new Error(extractSupabaseErrorMessage(error));
        }

        return data;
      },

      /**
       * Verify an email OTP code.
       * @param {{ email: string, code: string }} params
       */
      async verifyOtp({ email, code }) {
        const { data, error } = await supabase.auth.verifyOtp({
          email,
          token: code,
          type: 'email',
        });

        if (error) {
          throw new Error(extractSupabaseErrorMessage(error));
        }

        return data;
      },

      /**
       * Update the current user's metadata (e.g., name) after OTP verification.
       * @param {{ name: string }} params
       */
      async updateProfile({ name }) {
        const { data, error } = await supabase.auth.updateUser({
          data: { name },
        });

        if (error) {
          throw new Error(extractSupabaseErrorMessage(error));
        }

        return data;
      },
    },
  };
}


