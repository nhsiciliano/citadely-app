// Conectores que no identifican al negocio: "Clínica de la Colón" → "CC", no "CD".
const STOPWORDS = new Set(["de", "del", "la", "las", "el", "los", "y", "e", "&"]);
const HAS_ALPHANUMERIC = /[\p{L}\p{N}]/u;

function firstAlphanumeric(word: string) {
  return Array.from(word).find((char) => HAS_ALPHANUMERIC.test(char)) ?? "";
}

/**
 * Monograma de dos letras para el avatar del negocio: iniciales de las dos primeras palabras
 * significativas o, con una sola palabra, sus dos primeras letras. Nunca devuelve una letra suelta
 * salvo que el nombre entero tenga un único carácter alfanumérico.
 */
export function getBusinessInitials(name: string) {
  const words = name.trim().split(/\s+/).filter((word) => HAS_ALPHANUMERIC.test(word));
  const meaningful = words.filter((word) => !STOPWORDS.has(word.toLocaleLowerCase("es")));
  const source = meaningful.length > 0 ? meaningful : words;

  if (source.length === 0) return "";
  if (source.length === 1) {
    const chars = Array.from(source[0]).filter((char) => HAS_ALPHANUMERIC.test(char));
    return chars.slice(0, 2).join("").toLocaleUpperCase("es");
  }
  return (firstAlphanumeric(source[0]) + firstAlphanumeric(source[1])).toLocaleUpperCase("es");
}
