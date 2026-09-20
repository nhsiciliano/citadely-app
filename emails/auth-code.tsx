import { CitadelyEmail } from "./citadely-email";

export function AuthCodeEmail({
  kind,
  code,
  brandAssetUrl,
}: {
  kind: "verification" | "password-reset";
  code: string;
  brandAssetUrl: string;
}) {
  const isVerification = kind === "verification";

  return (
    <CitadelyEmail
      brandAssetUrl={brandAssetUrl}
      iconAssetUrl="https://www.citadely.com.ar/email-icon-verification.png"
      details={[{
        label: "Código de 6 dígitos",
        value: code,
      }]}
      eyebrow={isVerification ? "Verificación de cuenta" : "Seguridad de la cuenta"}
      intro={isVerification
        ? "Ingresá este código en Citadely para verificar tu email. El código vence en 15 minutos y puede usarse una sola vez."
        : "Ingresá este código en Citadely para continuar con el cambio de contraseña. El código vence en 15 minutos. Si no lo solicitaste, podés ignorar este mensaje."}
      note={isVerification
        ? "Nunca compartas este código. Citadely no te lo pedirá por teléfono ni por mensaje."
        : "Por seguridad, elegí una contraseña nueva que no uses en otros servicios."}
      preview={isVerification ? `Tu código de verificación es ${code}` : `Tu código para recuperar la contraseña es ${code}`}
      statusLabel={isVerification ? "Código de verificación" : "Recuperación de contraseña"}
      title={isVerification ? "Confirmá tu email" : "Restablecé tu contraseña"}
    />
  );
}
