// Stytch client singleton for Connected Apps consent flow.
//
// The client is null when VITE_STYTCH_PUBLIC_TOKEN is unset (dev environments
// without Stytch configured). main.tsx skips the StytchProvider wrapper in
// that case so the rest of the app boots normally.

import { createStytchClient } from "@stytch/react";

const PUBLIC_TOKEN = import.meta.env.VITE_STYTCH_PUBLIC_TOKEN as
  | string
  | undefined;

export const stytchClient = PUBLIC_TOKEN
  ? createStytchClient(PUBLIC_TOKEN)
  : null;

// ID of the Trusted Auth Token profile configured in the Stytch dashboard
// (U4 in phase-2-implementation.md). The profile validates incoming Supabase
// JWTs and maps `sub` onto a Stytch user attribute named `supabase_uid`.
export const STYTCH_TRUSTED_TOKEN_PROFILE_ID = import.meta.env
  .VITE_STYTCH_TRUSTED_TOKEN_PROFILE_ID as string | undefined;
