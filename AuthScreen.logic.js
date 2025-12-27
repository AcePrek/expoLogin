/**
 * AuthScreen.logic.js (logic only)
 *
 * ✅ DO NOT PUT STYLES OR UI HERE
 * This file manages:
 * - state (step, fields, busy, errors)
 * - async email check (new user vs existing user)
 * - validation
 * - calling the provider (Supabase lives behind providers)
 *
 * UI can be redesigned by editing AuthScreen.ui.js only.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { createAuthProviders } from './auth.providers';

function normalizeEmail(email) {
  return String(email ?? '').trim();
}

function validateEmailV2(email) {
  // Practical validation (better than only "@")
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email));
}

function validatePasswordV1(password) {
  // v1 requirement: minimum length 8
  return String(password ?? '').length >= 8;
}

export const AUTH_STEP = {
  START: 'start',
  EMAIL: 'email',
  NAME: 'name',
  PASSWORD: 'password',
};

/**
 * @param {{ supabase: any }} params
 */
export function useAuthScreenLogic({ supabase }) {
  const providers = useMemo(() => createAuthProviders({ supabase }), [supabase]);
  const emailPasswordProvider = providers.emailPassword;

  const [step, setStep] = useState(AUTH_STEP.START);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Email existence check state
  // - idle: no valid email yet
  // - checking: async in-flight
  // - ready: check complete (shows green check in UI)
  const [emailCheckStatus, setEmailCheckStatus] = useState('idle'); // idle | checking | ready
  const [emailExists, setEmailExists] = useState(null); // boolean | null
  const emailCheckRequestId = useRef(0);
  const emailCheckDebounce = useRef(null);

  const isNewUser = emailExists === false;
  const isExistingUser = emailExists === true;

  // Reset check state whenever email changes
  useEffect(() => {
    if (step !== AUTH_STEP.EMAIL) return;
    setErrorMessage('');
    setEmailExists(null);
    setEmailCheckStatus('idle');
  }, [email, step]);

  // Auto-check email when it becomes valid on the EMAIL step (debounced).
  useEffect(() => {
    if (step !== AUTH_STEP.EMAIL) return;

    const normalized = normalizeEmail(email).toLowerCase();
    if (!normalized) {
      setEmailCheckStatus('idle');
      setEmailExists(null);
      return;
    }

    if (!validateEmailV2(normalized)) {
      // Show error only after user typed something, but do not call server.
      setEmailCheckStatus('idle');
      setEmailExists(null);
      return;
    }

    // Debounce to avoid firing on every keystroke.
    if (emailCheckDebounce.current) {
      clearTimeout(emailCheckDebounce.current);
    }

    emailCheckDebounce.current = setTimeout(async () => {
      const reqId = ++emailCheckRequestId.current;
      setEmailCheckStatus('checking');
      setErrorMessage('');

      try {
        const exists = await emailPasswordProvider.checkEmailExists({ email: normalized });
        // Ignore stale responses.
        if (reqId !== emailCheckRequestId.current) return;
        setEmailExists(Boolean(exists));
        setEmailCheckStatus('ready');
      } catch (err) {
        if (reqId !== emailCheckRequestId.current) return;
        const message = err instanceof Error ? err.message : 'Failed to check email.';
        setEmailExists(null);
        setEmailCheckStatus('idle');
        setErrorMessage(message);
        if (typeof __DEV__ !== 'undefined' && __DEV__) {
          // eslint-disable-next-line no-console
          console.error('[auth-module] Email check failed', { message });
        }
      }
    }, 500);

    return () => {
      if (emailCheckDebounce.current) clearTimeout(emailCheckDebounce.current);
    };
  }, [email, emailPasswordProvider, step]);

  const emailIsValid = validateEmailV2(email);
  const passwordIsValid = validatePasswordV1(password);
  const nameIsValid = String(name ?? '').trim().length > 0;

  // When is the primary button enabled?
  const canContinue = useMemo(() => {
    if (busy) return false;

    if (step === AUTH_STEP.START) return true;
    if (step === AUTH_STEP.EMAIL) return emailIsValid && emailCheckStatus === 'ready';
    if (step === AUTH_STEP.NAME) return nameIsValid;
    if (step === AUTH_STEP.PASSWORD) return passwordIsValid;
    return false;
  }, [busy, emailCheckStatus, emailIsValid, nameIsValid, passwordIsValid, step]);

  const primaryButtonLabel = useMemo(() => {
    if (step === AUTH_STEP.START) return 'SIGN IN';
    return 'CONTINUE';
  }, [step]);

  function start() {
    setErrorMessage('');
    setStep(AUTH_STEP.EMAIL);
  }

  function reset() {
    setErrorMessage('');
    setName('');
    setEmail('');
    setPassword('');
    setEmailExists(null);
    setEmailCheckStatus('idle');
    setStep(AUTH_STEP.START);
  }

  function goBack() {
    setErrorMessage('');
    if (step === AUTH_STEP.PASSWORD) {
      setPassword('');
      setStep(isNewUser ? AUTH_STEP.NAME : AUTH_STEP.EMAIL);
      return;
    }
    if (step === AUTH_STEP.NAME) {
      setName('');
      setStep(AUTH_STEP.EMAIL);
      return;
    }
    if (step === AUTH_STEP.EMAIL) {
      setEmail('');
      setEmailExists(null);
      setEmailCheckStatus('idle');
      setStep(AUTH_STEP.START);
    }
  }

  async function goNext() {
    if (busy) return;
    setErrorMessage('');

    if (step === AUTH_STEP.START) {
      start();
      return;
    }

    if (step === AUTH_STEP.EMAIL) {
      if (!emailIsValid) {
        setErrorMessage('Input email correctly');
        return;
      }
      if (emailCheckStatus !== 'ready') {
        setErrorMessage('Checking email…');
        return;
      }
      setStep(isExistingUser ? AUTH_STEP.PASSWORD : AUTH_STEP.NAME);
      return;
    }

    if (step === AUTH_STEP.NAME) {
      if (!nameIsValid) {
        setErrorMessage('Please enter your name');
        return;
      }
      setStep(AUTH_STEP.PASSWORD);
      return;
    }

    if (step === AUTH_STEP.PASSWORD) {
      await submit();
    }
  }

  async function submit() {
    if (busy) return;
    setErrorMessage('');

    // Password screen validation
    if (!passwordIsValid) {
      const msg = 'Atleast 8 digit, for your security’s sake 🤗';
      setErrorMessage(msg);
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        // eslint-disable-next-line no-console
        console.warn('[auth-module] Password validation failed', { message: msg });
      }
      return;
    }

    setBusy(true);
    try {
      const normalizedEmail = normalizeEmail(email).toLowerCase();
      const trimmedName = String(name ?? '').trim();

      if (isNewUser) {
        if (!trimmedName) {
          setErrorMessage('Please enter your name');
          return;
        }
        await emailPasswordProvider.signUp({
          name: trimmedName,
          email: normalizedEmail,
          password: String(password ?? ''),
        });
      } else {
        await emailPasswordProvider.signIn({
          email: normalizedEmail,
          password: String(password ?? ''),
        });
      }
      // Success: the demo app listens to Supabase auth state changes and will show Logged in ✅
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong.';
      setErrorMessage(message);
      // Dev-only logging (no passwords / no PII)
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        // eslint-disable-next-line no-console
        console.error('[auth-module] Auth submit failed', { step, message });
      }
    } finally {
      setBusy(false);
    }
  }

  return {
    // State
    step,
    name,
    email,
    password,
    busy,
    errorMessage,
    emailCheckStatus,
    emailExists,

    // Setters (UI calls these)
    setName,
    setEmail,
    setPassword,

    // Derived
    isNewUser,
    isExistingUser,
    emailIsValid,
    canContinue,
    primaryButtonLabel,

    // Actions
    start,
    reset,
    goBack,
    goNext,
    submit
  };
}


