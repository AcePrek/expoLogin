import type { ComponentType } from 'react';

export type AuthScreenEmailOptions = {
  password?: boolean;
  otp?: boolean;
  default?: 'password' | 'otp';
};

export type AuthScreenOauthOptions = {
  google?: boolean;
  apple?: boolean;
};

export type AuthScreenOptions = {
  email?: AuthScreenEmailOptions;
  oauth?: AuthScreenOauthOptions;
};

export const AuthScreen: ComponentType<{
  supabase: unknown;
  startAt?: 'start' | 'email';
  onClose?: () => void;
  options?: AuthScreenOptions;
}>;


