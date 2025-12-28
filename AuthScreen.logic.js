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
import { LayoutAnimation, Platform, UIManager } from 'react-native';
import { createAuthProviders } from './auth.providers';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

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

  // Helper to trigger a slick native animation for any layout-changing state update
  const animateLayout = (duration = 250) => {
    LayoutAnimation.configureNext({
      duration,
      create: { type: 'easeInEaseOut', property: 'opacity' },
      update: { type: 'easeInEaseOut' },
      delete: { type: 'easeInEaseOut', property: 'opacity' },
    });
  };

  const [step, setStep] = useState(AUTH_STEP.START);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Animated state setters
  const setStepWithAnimation = (nextStep) => {
    animateLayout(250); // Sync with iOS keyboard
    setStep(nextStep);
  };

  const setErrorMessageWithAnimation = (msg) => {
    animateLayout(200); // Slightly faster for feedback
    setErrorMessage(msg);
  };

  const setBusyWithAnimation = (isBusy) => {
    animateLayout(200);
    setBusy(isBusy);
  };

  // Email existence check state
  const [emailCheckStatus, setEmailCheckStatus] = useState('idle');
  const [emailExists, setEmailExists] = useState(null);

  // Animated check status setter
  const setEmailCheckStatusWithAnimation = (status) => {
    animateLayout(200);
    setEmailCheckStatus(status);
  };

  const setEmailExistsWithAnimation = (exists) => {
    animateLayout(200);
    setEmailExists(exists);
  };

  const emailCheckRequestId = useRef(0);
  const emailCheckDebounce = useRef(null);

  const isNewUser = emailExists === false;
  const isExistingUser = emailExists === true;

  // Reset check state whenever email changes
  useEffect(() => {
    if (step !== AUTH_STEP.EMAIL) return;
    // Do not show any email-check errors in UI; keep it clean.
    setErrorMessageWithAnimation('');
    setEmailExistsWithAnimation(null);
    setEmailCheckStatusWithAnimation('idle');
  }, [email, step]);

  // Auto-check email when it becomes valid on the EMAIL step (debounced).
  useEffect(() => {
    if (step !== AUTH_STEP.EMAIL) return;

    const normalized = normalizeEmail(email).toLowerCase();
    if (!normalized) {
      setEmailCheckStatusWithAnimation('idle');
      setEmailExistsWithAnimation(null);
      return;
    }

    if (!validateEmailV2(normalized)) {
      setEmailCheckStatusWithAnimation('idle');
      setEmailExistsWithAnimation(null);
      return;
    }

    // Debounce to avoid firing on every keystroke.
    if (emailCheckDebounce.current) {
      clearTimeout(emailCheckDebounce.current);
    }

    emailCheckDebounce.current = setTimeout(async () => {
      const reqId = ++emailCheckRequestId.current;
      setEmailCheckStatusWithAnimation('checking');
      // Keep UI clean: no error surfaced for email-check failures.
      setErrorMessageWithAnimation('');

      const maxAttempts = 4;
      const baseDelayMs = 350;
      let lastError = null;

      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        try {
          const exists = await emailPasswordProvider.checkEmailExists({ email: normalized });
          if (reqId !== emailCheckRequestId.current) return;
          setEmailExistsWithAnimation(Boolean(exists));
          setEmailCheckStatusWithAnimation('ready');
          return;
        } catch (err) {
          lastError = err;
          if (typeof __DEV__ !== 'undefined' && __DEV__) {
            const message = err instanceof Error ? err.message : String(err ?? 'Unknown error');
            // eslint-disable-next-line no-console
            console.warn('[auth-module] Email check failed (retrying silently)', {
              attempt: attempt + 1,
              maxAttempts,
              message,
            });
          }

          // Backoff with small jitter; keep status "checking" so UI just shows spinner.
          const jitter = Math.floor(Math.random() * 120);
          const delay = baseDelayMs * (attempt + 1) + jitter;
          // eslint-disable-next-line no-await-in-loop
          await new Promise((r) => setTimeout(r, delay));

          if (reqId !== emailCheckRequestId.current) return;
          setEmailCheckStatusWithAnimation('checking');
        }
      }

      // Give up silently: keep UI clean. User can retry by editing email (or we can auto-retry on next debounce).
      if (reqId !== emailCheckRequestId.current) return;
      setEmailExistsWithAnimation(null);
      setEmailCheckStatusWithAnimation('idle');
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        const message = lastError instanceof Error ? lastError.message : String(lastError ?? 'Unknown error');
        // eslint-disable-next-line no-console
        console.error('[auth-module] Email check failed (silent) after retries', { message });
      }
    }, 500);

    return () => {
      if (emailCheckDebounce.current) clearTimeout(emailCheckDebounce.current);
    };
  }, [email, emailPasswordProvider, step]);

  const emailIsValid = validateEmailV2(email);
  const passwordIsValid = validatePasswordV1(password);
  const nameIsValid = String(name ?? '').trim().length > 0;

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
    setErrorMessageWithAnimation('');
    setStepWithAnimation(AUTH_STEP.EMAIL);
  }

  function reset() {
    setErrorMessageWithAnimation('');
    setName('');
    setEmail('');
    setPassword('');
    setEmailExistsWithAnimation(null);
    setEmailCheckStatusWithAnimation('idle');
    setStepWithAnimation(AUTH_STEP.START);
  }

  function goBack() {
    setErrorMessageWithAnimation('');
    if (step === AUTH_STEP.PASSWORD) {
      setPassword('');
      setStepWithAnimation(isNewUser ? AUTH_STEP.NAME : AUTH_STEP.EMAIL);
      return;
    }
    if (step === AUTH_STEP.NAME) {
      setName('');
      setStepWithAnimation(AUTH_STEP.EMAIL);
      return;
    }
    if (step === AUTH_STEP.EMAIL) {
      setEmail('');
      setEmailExistsWithAnimation(null);
      setEmailCheckStatusWithAnimation('idle');
      setStepWithAnimation(AUTH_STEP.START);
    }
  }

  /**
   * When user is on PASSWORD step (existing user flow) and taps the email row,
   * we take them back to EMAIL step to edit + re-check existence.
   * This keeps the state machine consistent and preserves the "perfect" transition.
   */
  function beginEditEmail() {
    setErrorMessageWithAnimation('');
    setPassword('');
    setEmailExistsWithAnimation(null);
    setEmailCheckStatusWithAnimation('idle');
    setStepWithAnimation(AUTH_STEP.EMAIL);
  }

  async function goNext() {
    if (busy) return;
    setErrorMessageWithAnimation('');

    if (step === AUTH_STEP.START) {
      start();
      return;
    }

    if (step === AUTH_STEP.EMAIL) {
      if (!emailIsValid) {
        setErrorMessageWithAnimation('Input email correctly');
        return;
      }
      if (emailCheckStatus !== 'ready') {
        setErrorMessageWithAnimation('Checking email…');
        return;
      }
      setStepWithAnimation(isExistingUser ? AUTH_STEP.PASSWORD : AUTH_STEP.NAME);
      return;
    }

    if (step === AUTH_STEP.NAME) {
      if (!nameIsValid) {
        setErrorMessageWithAnimation('Please enter your name');
        return;
      }
      setStepWithAnimation(AUTH_STEP.PASSWORD);
      return;
    }

    if (step === AUTH_STEP.PASSWORD) {
      await submit();
    }
  }

  async function submit() {
    if (busy) return;
    setErrorMessageWithAnimation('');

    if (!passwordIsValid) {
      const msg = 'Atleast 8 digit, for your security’s sake 🤗';
      setErrorMessageWithAnimation(msg);
      return;
    }

    setBusyWithAnimation(true);
    try {
      const normalizedEmail = normalizeEmail(email).toLowerCase();
      const trimmedName = String(name ?? '').trim();

      if (isNewUser) {
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
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong.';
      setErrorMessageWithAnimation(message);
    } finally {
      setBusyWithAnimation(false);
    }
  }

  return {
    step,
    name,
    email,
    password,
    busy,
    errorMessage,
    emailCheckStatus,
    emailExists,
    setName,
    setEmail,
    setPassword,
    isNewUser,
    isExistingUser,
    emailIsValid,
    canContinue,
    primaryButtonLabel,
    start,
    reset,
    goBack,
    beginEditEmail,
    goNext,
    submit
  };
}
