import { env } from "./env.ts";

export type FeatureFlag =
  | "EXAM_AI_ANALYSIS"
  | "NUTRICAO_EMAILS"
  | "REQUIRE_MFA_PRESCRIBERS"
  | "ASAAS_NFSE";

const FLAG_KEYS: Record<FeatureFlag, keyof typeof env> = {
  EXAM_AI_ANALYSIS: "FF_EXAM_AI_ANALYSIS",
  NUTRICAO_EMAILS: "FF_NUTRICAO_EMAILS",
  // When true, medicoProcedure rejects prescribers who have not configured 2FA.
  // Enable only after all medico/admin users have TOTP set up.
  REQUIRE_MFA_PRESCRIBERS: "FF_REQUIRE_MFA_PRESCRIBERS",
  ASAAS_NFSE: "FF_ASAAS_NFSE",
};

export function isEnabled(flag: FeatureFlag): boolean {
  return env[FLAG_KEYS[flag]] === true;
}
