export const PASSWORD_REQUIREMENTS =
  "Mínimo 6 caracteres, una mayúscula, una minúscula y un número.";

export const PASSWORD_PATTERN = "(?=.*\\p{Ll})(?=.*\\p{Lu})(?=.*[0-9]).{6,}";

export function getPasswordValidationError(password: string) {
  if (password.length < 6) return "La contraseña debe tener al menos 6 caracteres.";
  if (!/\p{Lu}/u.test(password)) return "La contraseña debe incluir al menos una mayúscula.";
  if (!/\p{Ll}/u.test(password)) return "La contraseña debe incluir al menos una minúscula.";
  if (!/[0-9]/.test(password)) return "La contraseña debe incluir al menos un número.";
  return null;
}
