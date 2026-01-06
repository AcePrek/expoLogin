/**
 * Shared auth constants for the auth module.
 * Keep this minimal and stable so adding providers later won't break v1.
 */

export const AUTH_MODE = {
  SIGN_IN: 'signIn',
  SIGN_UP: 'signUp',
};

export const PROVIDERS = {
  EMAIL_PASSWORD: 'emailPassword',
  EMAIL_OTP: 'emailOtp',
  OAUTH_GOOGLE: 'oauthGoogle',
  OAUTH_APPLE: 'oauthApple',
};


