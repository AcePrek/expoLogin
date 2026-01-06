/**
 * AuthScreen.ui.js
 *
 * ✅ EDIT UI HERE (safe)
 * - All layout, styles, strings, colors live in THIS file.
 * - Do not change auth logic here (that lives in AuthScreen.logic.js).
 */

import React, { useContext, useEffect, useMemo, useRef } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { AUTH_STEP, useAuthScreenLogic } from './AuthScreen.logic';

let didWarnMissingSafeAreaProvider = false;

/**
 * =========================
 * ✅ DESIGN CONTROLS (EDIT)
 * =========================
 *
 * Change theme colors here
 * Change spacing here
 * Change button style here
 * Change input style here
 *
 * (Optional) set darkMode=true to preview alternate palette.
 */
const DESIGN = {
  darkMode: false,

  colors: {
    bg: '#FFFFFF',
    // Figma uses #1A003F with varying alpha for muted text
    text: '#1A003F',
    muted: 'rgba(26,0,63,0.5)',
    placeholder: 'rgba(26,0,63,0.3)',
    border: '#0077FF',
    borderMuted: '#E7E3EC',
    primary: '#0077FF',
    primaryText: '#FFFFFF',
    danger: '#DC2626',
    success: '#24C26A',
    disabled: '#BADAFF',
    closeBg: '#F5F5F5',
    // Figma button shadow (sharp, under the button)
    shadow: '#0047D5',
  },

  spacing: {
    screenPadding: 16,
    titleTop: 20,
    titleGap: 8,
    // inputTopGap: distance between label and input box
    inputTopGap: 8,
    inputHeight: 54,
    buttonHeight: 54,
    // Figma: 22.5625rem ≈ 361px (keep button centered on large screens)
    buttonMaxWidth: 361,
    buttonTopGap: 16,
    inputHPad: 18,
  },

  radius: {
    input: 12,
    button: 16,
    close: 40,
  },

  font: {
    title: 24,
    subtitle: 14,
    label: 16,
    input: 18,
    button: 18,
    helper: 14,
  },

  strings: {
    titleWelcome: 'Get started',
    titleWelcomeBack: 'Welcome Back 👋🏻',
    ctaStart: 'SIGN IN',
    ctaContinue: 'CONTINUE',
    fields: {
      nameLabel: 'Your Name',
      namePlaceholder: 'Name Here',
      emailLabel: 'Email',
      emailPlaceholder: 'abc@gmail.com',
      otpLabel: 'Enter verification code',
      otpPlaceholder: '------',
      passwordLabelNew: 'Create Password',
      passwordLabelExisting: 'Password',
      passwordPlaceholder: 'Password',
      changeEmail: 'Change Email?',
      resend: 'Resend?',
    },
    hints: {
      passwordMin: 'Atleast 8 digit, for your security’s sake 🤗',
    },
    errors: {
      emailInvalid: 'Input email correctly',
    },
  },
};

function getTheme() {
  if (!DESIGN.darkMode) return DESIGN.colors;
  return {
    bg: '#0B1220',
    card: '#111827',
    text: '#F9FAFB',
    muted: '#94A3B8',
    border: '#60A5FA',
    borderMuted: '#243041',
    primary: '#60A5FA',
    primaryText: '#0B1220',
    danger: '#F87171',
    success: '#34D399',
    disabled: '#1E3A8A',
    shadow: '#000000',
  };
}

function RightAdornment({ theme, emailCheckStatus }) {
  if (emailCheckStatus === 'checking') {
    return <ActivityIndicator size="small" color={theme.muted} />;
  }
  if (emailCheckStatus === 'ready') {
    return (
      <View style={[styles.checkWrap, { backgroundColor: theme.success }]}>
        <Text style={styles.checkText}>✓</Text>
      </View>
    );
  }
  return null;
}

/**
 * Public API: <AuthScreen supabase={supabaseClient} />
 */
export function AuthScreen({ supabase, startAt = 'start', onClose, options }) {
  const theme = useMemo(() => getTheme(), []);
  const shadowColor = theme.shadow ?? DESIGN.colors.shadow;
  const insets = useContext(SafeAreaInsetsContext);

  // Focus refs for inputs (keeping keyboard open by switching focus instead of unmounting)
  const emailRef = useRef(null);
  const otpRef = useRef(null);
  const nameRef = useRef(null);
  const passwordRef = useRef(null);

  if (!insets && typeof __DEV__ !== 'undefined' && __DEV__ && !didWarnMissingSafeAreaProvider) {
    didWarnMissingSafeAreaProvider = true;
    // eslint-disable-next-line no-console
    console.warn(
      '[expo-login-auth-module] Missing <SafeAreaProvider /> at app root. Wrap your app with SafeAreaProvider from react-native-safe-area-context to enable safe-area insets.'
    );
  }
  const bottomGap = (insets?.bottom ?? 0) + 16; // requirement: always 16px above keyboard/safe-area
  const {
    step,
    name,
    email,
    password,
    otpCode,
    busy,
    errorMessage,
    setName,
    setEmail,
    setPassword,
    setOtpCode,
    emailCheckStatus,
    emailIsValid,
    canContinue,
    primaryButtonLabel,
    goNext,
    goBack,
    reset,
    beginEditEmail,
    isNewUser,
    isExistingUser,
    shouldCollectName,
    emailAuthMode,
    otpResendSeconds,
    resendOtp,
  } = useAuthScreenLogic({ supabase, startAt, options });

  const headerTitle = isExistingUser ? DESIGN.strings.titleWelcomeBack : DESIGN.strings.titleWelcome;
  const showNameField = Boolean(shouldCollectName) && (step === AUTH_STEP.NAME || step === AUTH_STEP.PASSWORD);
  const hideNameFieldVisually = step === AUTH_STEP.PASSWORD;
  const showOtpField = emailAuthMode === 'otp' && step === AUTH_STEP.OTP;
  const canResendOtp = emailAuthMode === 'otp' && step === AUTH_STEP.OTP && otpResendSeconds === 0 && !busy;

  const resendLabel = useMemo(() => {
    if (otpResendSeconds > 0) return `RESEND IN 0:${String(otpResendSeconds).padStart(2, '0')}`;
    return DESIGN.strings.fields.resend.toUpperCase();
  }, [otpResendSeconds]);

  // 1. Focus logic (Keyboard lift is handled automatically by KeyboardAvoidingView)
  useEffect(() => {
    // Small delay to allow the LayoutAnimation from the logic layer to start,
    // then switch focus to the correct input.
    const timer = setTimeout(() => {
      if (step === AUTH_STEP.EMAIL) emailRef.current?.focus();
      if (step === AUTH_STEP.OTP) otpRef.current?.focus();
      if (step === AUTH_STEP.NAME) nameRef.current?.focus();
      if (step === AUTH_STEP.PASSWORD) passwordRef.current?.focus();
    }, 40);
    return () => clearTimeout(timer);
  }, [step]);

  return (
    <View style={[styles.screen, { backgroundColor: theme.bg }]}>
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        {step !== AUTH_STEP.START ? (
          <View style={[styles.headerRow, { marginTop: DESIGN.spacing.titleTop }]}>
            <Text style={[styles.title, { color: theme.text }]}>{headerTitle}</Text>
            <Pressable
              onPress={typeof onClose === 'function' ? onClose : reset}
              style={[styles.closeButtonInline, { backgroundColor: theme.closeBg }]}
              accessibilityLabel="Close"
            >
              <Text style={[styles.closeText, { color: theme.text }]}>×</Text>
            </Pressable>
          </View>
        ) : null}

        {step === AUTH_STEP.START ? (
          <View style={[styles.startWrap, { paddingHorizontal: DESIGN.spacing.screenPadding, paddingBottom: bottomGap }]}>
            <View style={{ flex: 1 }} />
            <Pressable
              onPress={goNext}
              style={({ pressed }) => [
                styles.primaryButton,
                {
                  backgroundColor: theme.primary,
                  borderColor: 'rgba(0,229,255,0.3)',
                  shadowColor: theme.shadow ?? shadowColor,
                  borderBottomColor: theme.shadow ?? shadowColor,
                  opacity: pressed ? 0.9 : 1,
                  // "Sink" effect when pressed
                  transform: [{ translateY: pressed ? 1.5 : 0 }],
                  borderBottomWidth: pressed ? 1 : 3,
                  shadowOffset: { width: 0, height: pressed ? 0.5 : 2 },
                },
              ]}
            >
              <Text style={[styles.primaryButtonText, { color: theme.primaryText }]}>
                {DESIGN.strings.ctaStart.toUpperCase()}
              </Text>
            </Pressable>
            <View style={{ flex: 1 }} />
          </View>
        ) : (
          <ScrollView
            style={styles.flex1}
            contentContainerStyle={[
              styles.container,
              {
                paddingHorizontal: DESIGN.spacing.screenPadding,
                paddingBottom: bottomGap,
              },
            ]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="none"
          >
            <View style={{ height: 20 }} />

            {/* Main Input Area (staying at the top) */}
            <View style={styles.mainInputArea}>
              {step === AUTH_STEP.EMAIL || (step === AUTH_STEP.PASSWORD && isExistingUser) ? (
                <View style={styles.emailRow}>
                  <Text style={[styles.label, { color: theme.muted }]}>{DESIGN.strings.fields.emailLabel}</Text>
                  <View style={{ height: DESIGN.spacing.inputTopGap }} />

                  <View
                    style={[
                      styles.inputWrap,
                      {
                        borderColor:
                          step === AUTH_STEP.PASSWORD
                            ? (theme.borderMuted ?? '#E7E3EC')
                            : errorMessage
                              ? theme.danger
                              : theme.border,
                      },
                    ]}
                  >
                    <TextInput
                      ref={emailRef}
                      value={email}
                      onChangeText={setEmail}
                      onFocus={step === AUTH_STEP.PASSWORD ? beginEditEmail : undefined}
                      placeholder={DESIGN.strings.fields.emailPlaceholder}
                      placeholderTextColor={theme.placeholder}
                      style={[styles.input, { color: theme.text }]}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      textContentType="emailAddress"
                      autoComplete="email"
                      returnKeyType="done"
                      editable={step === AUTH_STEP.EMAIL}
                    />
                    <View style={styles.adornment}>
                      {step === AUTH_STEP.EMAIL ? (emailIsValid ? <RightAdornment theme={theme} emailCheckStatus={emailCheckStatus} /> : null) : null}
                    </View>
                  </View>

                  {step === AUTH_STEP.EMAIL && errorMessage ? (
                    <Text style={[styles.errorText, { color: theme.danger }]}>{errorMessage}</Text>
                  ) : null}
                </View>
              ) : null}

              {/* OTP field */}
              {showOtpField ? (
                <View style={styles.fieldGap16}>
                  <Text style={[styles.label, { color: theme.muted }]}>{DESIGN.strings.fields.otpLabel}</Text>
                  <View style={{ height: DESIGN.spacing.inputTopGap }} />

                  <View
                    style={[
                      styles.inputWrap,
                      { borderColor: errorMessage ? theme.danger : theme.border },
                    ]}
                  >
                    <TextInput
                      ref={otpRef}
                      value={otpCode}
                      onChangeText={(t) => setOtpCode(String(t ?? '').replace(/[^\d]/g, '').slice(0, 6))}
                      placeholder={DESIGN.strings.fields.otpPlaceholder}
                      placeholderTextColor={theme.placeholder}
                      style={[styles.input, styles.otpInput, { color: theme.text }]}
                      keyboardType="number-pad"
                      autoCapitalize="none"
                      autoCorrect={false}
                      textContentType="oneTimeCode"
                      autoComplete="one-time-code"
                      maxLength={6}
                      /* Explicitly null to avoid showing the native "Done" bar on some iOS versions */
                      inputAccessoryViewID={null}
                    />
                  </View>

                  {/* Help links below the input */}
                  <View style={styles.otpFooter}>
                    <Text style={[styles.otpHelpText, { color: theme.muted }]}>
                      Sent to {email}{' '}
                      <Text
                        onPress={beginEditEmail}
                        style={[styles.linkTextInline, { color: theme.primary }]}
                      >
                        {DESIGN.strings.fields.changeEmail}
                      </Text>
                    </Text>

                    <Pressable
                      onPress={resendOtp}
                      disabled={!canResendOtp}
                      style={{ marginTop: 12 }}
                      hitSlop={8}
                    >
                      <Text
                        style={[
                          styles.linkTextInline,
                          {
                            color: canResendOtp ? theme.primary : theme.muted,
                            opacity: canResendOtp ? 1 : 0.5,
                          },
                        ]}
                      >
                        {resendLabel}
                      </Text>
                    </Pressable>
                  </View>

                  {errorMessage ? (
                    <Text style={[styles.errorText, { color: theme.danger }]}>{errorMessage}</Text>
                  ) : null}
                </View>
              ) : null}

              {/* Name field (for new users) */}
              {showNameField && !isExistingUser ? (
                <View
                  style={[
                    emailAuthMode === 'password' ? styles.emailRow : styles.fieldGap16,
                    hideNameFieldVisually ? styles.hiddenFieldWrap : undefined
                  ]}
                  pointerEvents={hideNameFieldVisually ? 'none' : 'auto'}
                >
                  {step === AUTH_STEP.NAME ? (
                    <>
                      <Text style={[styles.label, { color: theme.muted }]}>{DESIGN.strings.fields.nameLabel}</Text>
                      <View style={{ height: DESIGN.spacing.inputTopGap }} />
                    </>
                  ) : null}

                  <View
                    style={[
                      styles.inputWrap,
                      hideNameFieldVisually
                        ? { borderColor: 'transparent', backgroundColor: 'transparent' }
                        : { borderColor: errorMessage ? theme.danger : theme.border },
                    ]}
                  >
                    <TextInput
                      ref={nameRef}
                      value={name}
                      onChangeText={setName}
                      placeholder={DESIGN.strings.fields.namePlaceholder}
                      placeholderTextColor={theme.placeholder}
                      style={[styles.input, { color: theme.text }]}
                      autoCapitalize="words"
                      returnKeyType="done"
                    />
                  </View>

                  {step === AUTH_STEP.NAME && errorMessage ? (
                    <Text style={[styles.errorText, { color: theme.danger }]}>{errorMessage}</Text>
                  ) : null}
                </View>
              ) : null}

              {/* Password field */}
              {step === AUTH_STEP.PASSWORD ? (
                <View style={isExistingUser ? styles.fieldGap16 : styles.emailRow}>
                  <Text style={[styles.label, { color: theme.muted }]}>
                    {isNewUser ? DESIGN.strings.fields.passwordLabelNew : DESIGN.strings.fields.passwordLabelExisting}
                  </Text>
                  <View style={{ height: DESIGN.spacing.inputTopGap }} />
                  <View
                    style={[
                      styles.inputWrap,
                      {
                        borderColor: errorMessage ? theme.danger : theme.border,
                      },
                    ]}
                  >
                    <TextInput
                      ref={passwordRef}
                      value={password}
                      onChangeText={setPassword}
                      placeholder={DESIGN.strings.fields.passwordPlaceholder}
                      placeholderTextColor={theme.placeholder}
                      style={[styles.input, { color: theme.text }]}
                      secureTextEntry
                      autoCapitalize="none"
                      autoCorrect={false}
                      textContentType={isExistingUser ? 'password' : 'newPassword'}
                      returnKeyType="done"
                    />
                  </View>
                  <Text style={[styles.hint, { color: theme.muted }]}>{DESIGN.strings.hints.passwordMin}</Text>
                  {errorMessage ? <Text style={[styles.errorText, { color: theme.danger }]}>{errorMessage}</Text> : null}
                </View>
              ) : null}
            </View>

            {/* Flexible spacer to push rest of input area/CTA to bottom */}
            <View style={styles.flex1} />

            <View style={styles.inputCluster}>
              <View style={{ height: DESIGN.spacing.buttonTopGap }} />

              <Pressable
                disabled={!canContinue}
                onPress={goNext}
                style={({ pressed }) => [
                  styles.primaryButton,
                  {
                    backgroundColor: canContinue ? theme.primary : theme.disabled,
                    borderColor: canContinue ? 'rgba(0,229,255,0.3)' : 'transparent',
                    shadowColor: canContinue ? (theme.shadow ?? shadowColor) : 'transparent',
                    borderBottomColor: canContinue ? (theme.shadow ?? shadowColor) : 'transparent',
                    opacity: pressed ? 0.95 : 1,
                    // "Sink" effect when pressed
                    transform: [{ translateY: canContinue && pressed ? 1.5 : 0 }],
                    borderBottomWidth: canContinue && pressed ? 1 : 3,
                    shadowOffset: { width: 0, height: canContinue && pressed ? 0.5 : 2 },
                  },
                ]}
              >
                {busy ? (
                  <ActivityIndicator color={theme.primaryText} />
                ) : (
                  <Text style={[styles.primaryButtonText, { color: theme.primaryText }]}>
                    {primaryButtonLabel.toUpperCase()}
                  </Text>
                )}
              </Pressable>
            </View>
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  flex1: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    paddingTop: 0,
  },
  startWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  inputCluster: {
    width: '100%',
    paddingBottom: 24,
  },
  mainInputArea: {
    width: '100%',
  },
  emailRow: {
    width: '100%',
  },
  labelRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  linkText: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'Figtree-Bold',
  },
  linkTextInline: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'Figtree-Bold',
    textDecorationLine: 'none',
  },
  otpInput: {
    fontSize: 24,
    textAlign: 'left',
    fontWeight: '700',
  },
  otpFooter: {
    marginTop: 16,
  },
  otpHelpText: {
    fontSize: 14,
    fontFamily: 'Figtree-Medium',
  },
  fieldGap16: {
    marginTop: 16,
  },
  emailContainer: {
    width: '100%',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: DESIGN.spacing.screenPadding,
  },
  hiddenFieldWrap: {
    height: 0,
    opacity: 0,
    overflow: 'hidden',
  },
  title: {
    fontSize: DESIGN.font.title,
    fontWeight: '900',
    fontFamily: 'Figtree-ExtraBold',
  },
  subtitle: {
    fontSize: DESIGN.font.subtitle,
    fontStyle: 'italic',
    marginTop: 10,
    fontFamily: 'Figtree-Italic',
  },
  label: {
    fontSize: DESIGN.font.label,
    fontFamily: 'Figtree-Medium',
  },
  inputWrap: {
    height: DESIGN.spacing.inputHeight,
    borderWidth: 2,
    borderRadius: DESIGN.radius.input,
    paddingHorizontal: DESIGN.spacing.inputHPad,
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    fontSize: DESIGN.font.input,
    fontWeight: '500',
    fontFamily: 'Figtree-Medium',
  },
  adornment: {
    width: 40,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  hint: {
    marginTop: 14,
    fontSize: DESIGN.font.helper,
    opacity: 0.4,
    fontFamily: 'Figtree-Medium',
  },
  errorText: {
    marginTop: 14,
    fontSize: DESIGN.font.helper,
    fontWeight: '700',
    fontFamily: 'Figtree-Medium',
  },
  primaryButton: {
    height: DESIGN.spacing.buttonHeight,
    width: '100%',
    maxWidth: DESIGN.spacing.buttonMaxWidth,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: DESIGN.radius.button,
    borderWidth: 1,
    // Ensure the bottom border is visible as a distinct "shadow" line
    borderBottomWidth: 3, 
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 2 },
    elevation: 0,
  },
  primaryButtonText: {
    fontSize: DESIGN.font.button,
    fontWeight: '700',
    fontFamily: 'Figtree-Bold',
  },
  checkWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkText: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  closeButtonInline: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontSize: 20,
    fontWeight: '400',
    marginTop: -2, // Optical centering for the '×' symbol
  },
});


