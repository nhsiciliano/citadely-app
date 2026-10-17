"use client";

import { useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { PASSWORD_PATTERN, PASSWORD_REQUIREMENTS } from "@/lib/password";

export function PasswordField({
  autoComplete,
  label = "Contraseña",
  name = "password",
  placeholder,
  requireStrongPassword = false,
}: {
  autoComplete: "current-password" | "new-password";
  label?: string;
  name?: string;
  placeholder?: string;
  requireStrongPassword?: boolean;
}) {
  const inputId = useId();
  const requirementsId = `${inputId}-requirements`;
  const [visible, setVisible] = useState(false);

  return (
    <div className="grid gap-2">
      <label className="form-label" htmlFor={inputId}>{label}</label>
      <div className="relative">
        <input
          aria-describedby={requireStrongPassword ? requirementsId : undefined}
          autoComplete={autoComplete}
          className="form-control pr-14"
          id={inputId}
          minLength={requireStrongPassword ? 8 : undefined}
          name={name}
          pattern={requireStrongPassword ? PASSWORD_PATTERN : undefined}
          placeholder={placeholder}
          required
          title={requireStrongPassword ? PASSWORD_REQUIREMENTS : undefined}
          type={visible ? "text" : "password"}
        />
        <button
          aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
          aria-pressed={visible}
          className="absolute inset-y-0 right-1 flex min-h-11 min-w-11 items-center justify-center text-ink-muted transition-colors hover:text-primary"
          onClick={() => setVisible((current) => !current)}
          type="button"
        >
          {visible ? <EyeOff aria-hidden="true" size={20} /> : <Eye aria-hidden="true" size={20} />}
        </button>
      </div>
      {requireStrongPassword ? (
        <p className="text-xs leading-5 text-ink-muted" id={requirementsId}>
          {PASSWORD_REQUIREMENTS}
        </p>
      ) : null}
    </div>
  );
}
