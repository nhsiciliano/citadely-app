import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { AuthShell } from "@/components/ui";

export default function ResetPasswordPage() {
  return (
    <AuthShell
      title="Recuperar acceso"
      subtitle="Solicitá un código por email y definí una nueva contraseña para volver a tu agenda."
      aside={<ResetAside />}
    >
      <ResetPasswordForm />
    </AuthShell>
  );
}

function ResetAside() {
  return (
    <div className="grid gap-5">
      <h2 className="font-display text-3xl font-semibold tracking-[-0.035em]">
        Recuperá el acceso sin perder el ritmo.
      </h2>
      <p className="leading-7 text-white/70">
        Te enviaremos un código temporal al email de tu cuenta para validar el cambio.
      </p>
    </div>
  );
}
