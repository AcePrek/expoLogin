/**
 * AuthScreen.ui.js
 *
 * ✅ EDIT UI HERE (safe)
 * - All layout, styles, strings, colors live in THIS file.
 * - Do not change auth logic here (that lives in AuthScreen.logic.js).
 */

import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AUTH_STEP, useAuthScreenLogic } from './AuthScreen.logic';

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
    titleTop: 75,
    titleGap: 8,
    sectionTop: 314,
    inputTopGap: 9,
    inputHeight: 64,
    buttonHeight: 64,
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
    title: 32,
    subtitle: 14,
    label: 16,
    input: 18,
    button: 20,
    helper: 14,
  },

  strings: {
    title: '👋🏻 Welcome',
    subtitle: 'Any additional message can come here',
    ctaStart: 'SIGN IN',
    ctaContinue: 'CONTINUE',
    fields: {
      nameLabel: 'Your Name',
      namePlaceholder: 'Anupam',
      emailLabel: 'Email',
      emailPlaceholder: 'abc@gmail.com',
      passwordLabelNew: 'Create Password',
      passwordLabelExisting: 'Password',
      passwordPlaceholder: 'Password',
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
export function AuthScreen({ supabase }) {
  const theme = useMemo(() => getTheme(), []);
  const shadowColor = theme.shadow ?? DESIGN.colors.shadow;
  const insets = useSafeAreaInsets();
  const bottomGap = (insets?.bottom ?? 0) + 16; // requirement: always 16px above keyboard/safe-area
  const {
    step,
    name,
    email,
    password,
    busy,
    errorMessage,
    setName,
    setEmail,
    setPassword,
    emailCheckStatus,
    emailIsValid,
    canContinue,
    primaryButtonLabel,
    goNext,
    goBack,
    reset,
    isNewUser,
    isExistingUser,
  } = useAuthScreenLogic({ supabase });

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.bg }]}>
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {step !== AUTH_STEP.START ? (
          <Pressable onPress={reset} style={[styles.closeButton, { backgroundColor: theme.closeBg }]} accessibilityLabel="Close">
            <Text style={[styles.closeText, { color: theme.text }]}>×</Text>
          </Pressable>
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
                },
              ]}
            >
              <Text style={[styles.primaryButtonText, { color: theme.primaryText }]}>{DESIGN.strings.ctaStart}</Text>
            </Pressable>
            <View style={{ flex: 1 }} />
          </View>
        ) : (
          <>
            <ScrollView
              contentContainerStyle={[
                styles.container,
                {
                  paddingHorizontal: DESIGN.spacing.screenPadding,
                  paddingBottom: DESIGN.spacing.buttonHeight + bottomGap + 16,
                },
              ]}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
              automaticallyAdjustKeyboardInsets
            >
              <View style={{ height: DESIGN.spacing.titleTop }} />
              <Text style={[styles.title, { color: theme.text }]}>{DESIGN.strings.title}</Text>
              <View style={{ height: DESIGN.spacing.titleGap }} />
              <Text style={[styles.subtitle, { color: theme.muted }]}>{DESIGN.strings.subtitle}</Text>

              <View style={{ height: DESIGN.spacing.sectionTop - DESIGN.spacing.titleTop }} />

              {step === AUTH_STEP.EMAIL ? (
                <>
                  <Text style={[styles.label, { color: theme.muted }]}>{DESIGN.strings.fields.emailLabel}</Text>
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
                      value={email}
                      onChangeText={setEmail}
                      placeholder={DESIGN.strings.fields.emailPlaceholder}
                      placeholderTextColor={theme.placeholder}
                      style={[styles.input, { color: theme.text }]}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      textContentType="emailAddress"
                      autoComplete="email"
                      returnKeyType="done"
                    />
                    <View style={styles.adornment}>
                      {emailIsValid ? <RightAdornment theme={theme} emailCheckStatus={emailCheckStatus} /> : null}
                    </View>
                  </View>
                  {errorMessage ? <Text style={[styles.errorText, { color: theme.danger }]}>{errorMessage}</Text> : null}
                </>
              ) : null}

              {step === AUTH_STEP.NAME ? (
                <>
                  <Text style={[styles.label, { color: theme.muted }]}>{DESIGN.strings.fields.nameLabel}</Text>
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
                      value={name}
                      onChangeText={setName}
                      placeholder={DESIGN.strings.fields.namePlaceholder}
                      placeholderTextColor={theme.placeholder}
                      style={[styles.input, { color: theme.text }]}
                      autoCapitalize="words"
                      returnKeyType="done"
                    />
                  </View>
                  {errorMessage ? <Text style={[styles.errorText, { color: theme.danger }]}>{errorMessage}</Text> : null}
                </>
              ) : null}

              {step === AUTH_STEP.PASSWORD ? (
                <>
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
                </>
              ) : null}
            </ScrollView>

            {/* Fixed footer CTA: always stays above keyboard by 16px */}
            <View
              style={[
                styles.footer,
                {
                  paddingHorizontal: DESIGN.spacing.screenPadding,
                  paddingBottom: bottomGap,
                },
              ]}
            >
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
                  },
                ]}
              >
                {busy ? (
                  <ActivityIndicator color={theme.primaryText} />
                ) : (
                  <Text style={[styles.primaryButtonText, { color: theme.primaryText }]}>{primaryButtonLabel}</Text>
                )}
              </Pressable>
            </View>
          </>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingTop: 0,
  },
  startWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 16,
    backgroundColor: 'transparent',
  },
  title: {
    fontSize: DESIGN.font.title,
    fontWeight: '900',
    // Best-effort font mapping (host app should load Figtree)
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
    marginBottom: 14,
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
    // Figma: padding 1.25rem 0 (20px vertical)
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: DESIGN.radius.button,
    borderWidth: 1,
    // Sharp bottom "shadow line" look (cross-platform):
    // - iOS uses shadow props (no blur)
    // - Android gets a crisp bottom border (elevation adds blur)
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 3 },
    elevation: 0,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  primaryButtonText: {
    fontSize: DESIGN.font.button,
    fontWeight: '900',
    letterSpacing: 1,
    fontFamily: 'Figtree-Black',
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
  closeButton: {
    position: 'absolute',
    top: 75,
    right: 16,
    zIndex: 10,
    width: 30,
    height: 30,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontSize: 18,
    fontWeight: '900',
  },
});


