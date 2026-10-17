import { AuthCodeEmail } from "./auth-code";

export default function AuthPasswordResetEmail() {
  return (
    <AuthCodeEmail
      brandAssetUrl="https://www.citadely.com.ar/citadely-email-mark.png"
      code="{{ token }}"
      kind="password-reset"
    />
  );
}
