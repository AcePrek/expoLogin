import type { ComponentType } from 'react';

export const AuthScreen: ComponentType<{
  supabase: unknown;
  startAt?: 'start' | 'email';
  onClose?: () => void;
}>;


