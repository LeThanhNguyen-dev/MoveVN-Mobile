import i18n from "@/i18n";
import type { AuthScreen } from "../utils/validation";

export function getAuthCopy(screen: AuthScreen): { title: string; description: string; action: string } {
  const copy: Record<AuthScreen, { title: string; description: string; action: string }> = {
    login: {
      title: i18n.t("auth:login.title"),
      description: i18n.t("auth:login.description"),
      action: i18n.t("auth:login.submit"),
    },
    register: {
      title: i18n.t("mobile:auth.copy.registerTitle"),
      description: i18n.t("mobile:auth.copy.registerDescription"),
      action: i18n.t("mobile:auth.copy.registerAction"),
    },
    owner: {
      title: i18n.t("auth:ownerRegister.title"),
      description: i18n.t("mobile:auth.copy.ownerDescription"),
      action: i18n.t("auth:ownerRegister.title"),
    },
    forgot: {
      title: i18n.t("auth:forgot.title"),
      description: i18n.t("mobile:auth.copy.forgotDescription"),
      action: i18n.t("auth:forgot.submit"),
    },
    reset: {
      title: i18n.t("auth:reset.title"),
      description: i18n.t("mobile:auth.copy.resetDescription"),
      action: i18n.t("auth:reset.submit"),
    },
    verify: {
      title: i18n.t("auth:verify.title"),
      description: i18n.t("mobile:auth.copy.verifyDescription"),
      action: i18n.t("auth:verify.submit"),
    },
  };
  return copy[screen];
}
