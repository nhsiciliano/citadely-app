import Image, { type ImageProps } from "next/image";

// Business photos live in InsForge storage (parent project and backend branches); these are the hosts
// next.config.ts `images.remotePatterns` allows, so only they can go through the optimizer.
// Keep in sync with remotePatterns.
const STORAGE_HOST = /^[a-z0-9-]+\.us-east\.insforge\.app$/i;

export function isOptimizableImageUrl(src: string) {
  try {
    const url = new URL(src);
    return url.protocol === "https:" && STORAGE_HOST.test(url.hostname) && url.pathname.startsWith("/api/storage/");
  } catch {
    return false;
  }
}

/**
 * next/image for user-provided URLs. Service images can be any URL the owner pastes, and the optimizer
 * rejects hosts that are not allow-listed, so those render as plain <img> (unoptimized) instead of
 * breaking the page.
 */
export function RemoteImage({ src, alt, ...props }: Omit<ImageProps, "unoptimized" | "src" | "alt"> & { src: string; alt: string }) {
  return <Image alt={alt} src={src} unoptimized={!isOptimizableImageUrl(src)} {...props} />;
}
