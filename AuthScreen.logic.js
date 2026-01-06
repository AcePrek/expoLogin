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

function validateOtpCodeV1(code) {
  // v1 requirement: 6 digit numeric
  const raw = String(code ?? '').trim();
  return /^\d{6}$/.test(raw);
}

function explainOtpVerifyError(err) {
  const message = err instanceof Error ? err.message : String(err ?? 'Something went wrong.');
  // Supabase commonly returns messages like:
  // - "Token has expired or is invalid"
  // - "Invalid OTP"
  if (/otp/i.test(message) || /token/i.test(message) || /invalid/i.test(message) || /expired/i.test(message)) {
    return 'Wrong code';
  }
  return message;
}

function resolveEmailAuthMode(options) {
  const email = options?.email && typeof options.email === 'object' ? options.email : {};

  // Defaults (v3): OTP is the default auth mode unless a consumer explicitly opts into password.
  const otpEnabled = email.otp !== false;
  const passwordEnabled = email.password === true;

  // If password is enabled and OTP isn't, use password.
  if (passwordEnabled && !otpEnabled) return 'password';

  if (!passwordEnabled && otpEnabled) return 'otp';
  if (passwordEnabled && otpEnabled) {
    return email.default === 'otp' ? 'otp' : 'password';
  }
  // If both are disabled, fall back to OTP (safest/most supported by Supabase for sign-in/up).
  return 'otp';
}

export const AUTH_STEP = {
  START: 'start',
  EMAIL: 'email',
  OTP: 'otp',
  NAME: 'name',
  PASSWORD: 'password',
};

/**
 * @param {{ supabase: any, startAt?: 'start'|'email', options?: any }} params
 */
export function useAuthScreenLogic({ supabase, startAt, options }) {
  const providers = useMemo(() => createAuthProviders({ supabase }), [supabase]);
  const emailPasswordProvider = providers.emailPassword;
  const emailOtpProvider = providers.emailOtp;
  const emailAuthMode = useMemo(() => resolveEmailAuthMode(options), [options]);

  // Helper to trigger a slick native animation for any layout-changing state update
  const animateLayout = (duration = 250) => {
    LayoutAnimation.configureNext({
      duration,
      create: { type: 'easeInEaseOut', property: 'opacity' },
      update: { type: 'easeInEaseOut' },
      delete: { type: 'easeInEaseOut', property: 'opacity' },
    });
  };

  const initialStep = startAt === 'email' ? AUTH_STEP.EMAIL : AUTH_STEP.START;
  const [step, setStep] = useState(initialStep);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
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
  const [otpResendSeconds, setOtpResendSeconds] = useState(0);

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
  const shouldCollectName = emailAuthMode === 'password' ? isNewUser : false;

  // OTP resend countdown (30s) for OTP step
  useEffect(() => {
    if (emailAuthMode !== 'otp') return;
    if (step !== AUTH_STEP.OTP) return;
    if (otpResendSeconds <= 0) return;

    const id = setInterval(() => {
      setOtpResendSeconds((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);

    return () => clearInterval(id);
  }, [emailAuthMode, otpResendSeconds, step]);

  // Clear OTP error as user edits code
  useEffect(() => {
    if (emailAuthMode !== 'otp') return;
    if (step !== AUTH_STEP.OTP) return;
    if (!errorMessage) return;
    if (!otpCode) return;
    setErrorMessageWithAnimation('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otpCode]);

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
  }, [email, emailAuthMode, emailPasswordProvider, step]);

  const emailIsValid = validateEmailV2(email);
  const passwordIsValid = validatePasswordV1(password);
  const nameIsValid = String(name ?? '').trim().length > 0;
  const otpIsValid = validateOtpCodeV1(otpCode);

  const canContinue = useMemo(() => {
    if (busy) return false;
    if (step === AUTH_STEP.START) return true;
    if (step === AUTH_STEP.EMAIL) {
      if (emailAuthMode === 'otp') return emailIsValid;
      return emailIsValid && emailCheckStatus === 'ready';
    }
    if (step === AUTH_STEP.OTP) return otpIsValid;
    if (step === AUTH_STEP.NAME) return nameIsValid;
    if (step === AUTH_STEP.PASSWORD) return passwordIsValid;
    return false;
  }, [busy, emailAuthMode, emailCheckStatus, emailIsValid, nameIsValid, otpIsValid, passwordIsValid, step]);

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
    setOtpCode('');
    setOtpResendSeconds(0);
    setEmailExistsWithAnimation(null);
    setEmailCheckStatusWithAnimation('idle');
    setStepWithAnimation(initialStep);
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
      if (emailAuthMode === 'otp') {
        setStepWithAnimation(AUTH_STEP.OTP);
      } else {
        setStepWithAnimation(AUTH_STEP.EMAIL);
      }
      return;
    }
    if (step === AUTH_STEP.OTP) {
      setOtpCode('');
      setOtpResendSeconds(0);
      setStepWithAnimation(AUTH_STEP.EMAIL);
      return;
    }
    if (step === AUTH_STEP.EMAIL) {
      setEmail('');
      setEmailExistsWithAnimation(null);
      setEmailCheckStatusWithAnimation('idle');
      setStepWithAnimation(initialStep);
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
    setOtpCode('');
    setOtpResendSeconds(0);
    setEmailExistsWithAnimation(null);
    setEmailCheckStatusWithAnimation('idle');
    setStepWithAnimation(AUTH_STEP.EMAIL);
  }

  async function resendOtp() {
    if (busy) return;
    if (emailAuthMode !== 'otp') return;
    if (step !== AUTH_STEP.OTP) return;
    if (otpResendSeconds > 0) return;

    setErrorMessageWithAnimation('');
    setBusyWithAnimation(true);
    try {
      const normalizedEmail = normalizeEmail(email).toLowerCase();
      await emailOtpProvider.requestOtp({ email: normalizedEmail });
      setOtpCode('');
      setOtpResendSeconds(30);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong.';
      setErrorMessageWithAnimation(message);
    } finally {
      setBusyWithAnimation(false);
    }
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
      if (emailAuthMode === 'password') {
        if (emailCheckStatus !== 'ready') {
          setErrorMessageWithAnimation('Checking email…');
          return;
        }
        setStepWithAnimation(isExistingUser ? AUTH_STEP.PASSWORD : AUTH_STEP.NAME);
        return;
      }

      // OTP mode: request OTP, then go to code entry.
      setBusyWithAnimation(true);
      try {
        const normalizedEmail = normalizeEmail(email).toLowerCase();
        await emailOtpProvider.requestOtp({ email: normalizedEmail });
        setOtpCode('');
        setOtpResendSeconds(30);
        setStepWithAnimation(AUTH_STEP.OTP);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Something went wrong.';
        setErrorMessageWithAnimation(message);
      } finally {
        setBusyWithAnimation(false);
      }
      return;
    }

    if (step === AUTH_STEP.OTP) {
      if (!otpIsValid) {
        setErrorMessageWithAnimation('Enter 6-digit code');
        return;
      }

      setBusyWithAnimation(true);
      try {
        const normalizedEmail = normalizeEmail(email).toLowerCase();
        const code = String(otpCode ?? '').trim();
        await emailOtpProvider.verifyOtp({ email: normalizedEmail, code });
        // Session is active; host app should react to auth state and close.
      } catch (err) {
        const message = explainOtpVerifyError(err);
        setErrorMessageWithAnimation(message);
      } finally {
        setBusyWithAnimation(false);
      }
      return;
    }

    if (step === AUTH_STEP.NAME) {
      if (!nameIsValid) {
        setErrorMessageWithAnimation('Please enter your name');
        return;
      }
      if (emailAuthMode === 'otp') {
        setBusyWithAnimation(true);
        try {
          const trimmedName = String(name ?? '').trim();
          await emailOtpProvider.updateProfile({ name: trimmedName });
          setOtpNeedsName(false);
          // session is already active; host app should close.
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Something went wrong.';
          setErrorMessageWithAnimation(message);
        } finally {
          setBusyWithAnimation(false);
        }
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
    otpCode,
    busy,
    errorMessage,
    emailCheckStatus,
    emailExists,
    setName,
    setEmail,
    setPassword,
    setOtpCode,
    isNewUser,
    isExistingUser,
    shouldCollectName,
    emailAuthMode,
    otpResendSeconds,
    resendOtp,
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
