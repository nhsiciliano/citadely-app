"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Eye, Plus, Trash2 } from "lucide-react";
import type { BlogBlock, BlogBlockKind, BlogPost } from "@/lib/blog";

const API = "/admin-panel/api";
const KIND_LABELS: Record<BlogBlockKind, string> = {
  heading2: "Título H2", heading3: "Subtítulo H3", paragraph: "Párrafo",
  ordered_list: "Lista numerada", unordered_list: "Lista con viñetas", quote: "Cita",
};

async function parseResponse(response: Response) {
  const body = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) throw new Error(body.error ?? "No se pudo completar la acción.");
  return body;
}

function AdminHeader({ onLogout }: { onLogout: () => void }) {
  return <header className="border-b border-[var(--color-line)] bg-[var(--color-navy)] text-white"><div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-5 sm:px-8"><Link className="font-display text-xl font-semibold" href="/admin-panel">Citadely <span className="text-white/50">/ Blog</span></Link><button className="rounded-md px-3 py-2 text-sm font-semibold text-white/75 hover:bg-white/10 hover:text-white" onClick={onLogout} type="button">Cerrar sesión</button></div></header>;
}

function useLogout() {
  const router = useRouter();
  return async () => {
    await fetch(`${API}/session`, { method: "DELETE" });
    router.push("/admin-panel");
    router.refresh();
  };
}

export function AdminLogin() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true); setError("");
    const form = new FormData(event.currentTarget);
    try {
      await parseResponse(await fetch(`${API}/session`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: form.get("username"), password: form.get("password") }),
      }));
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo ingresar.");
    } finally {
      setLoading(false);
    }
  }

  return <main className="grid min-h-screen place-items-center px-5 py-10"><div className="w-full max-w-md border border-[var(--color-line)] bg-white p-7 shadow-[var(--shadow-surface)] sm:p-10"><Link className="font-display text-2xl font-semibold text-[var(--color-navy)]" href="/">Citadely</Link><h1 className="font-display mt-10 text-3xl font-semibold text-[var(--color-navy)]">Panel editorial</h1><p className="mt-2 text-sm text-[var(--color-ink-soft)]">Ingresá para administrar las publicaciones del Blog.</p><form className="mt-8 grid gap-5" onSubmit={submit}><label className="form-label">Usuario<input autoComplete="username" className="form-control" maxLength={80} name="username" required type="text" /></label><label className="form-label">Contraseña<input autoComplete="current-password" className="form-control" name="password" required type="password" /></label>{error ? <p role="alert" className="text-sm font-semibold text-[var(--color-danger)]">{error}</p> : null}<button className="button-primary w-full" disabled={loading} type="submit">{loading ? "Ingresando…" : "Ingresar"}</button></form></div></main>;
}

export function AdminDashboard({ initialPosts }: { initialPosts: BlogPost[] }) {
  const router = useRouter();
  const logout = useLogout();
  const [posts, setPosts] = useState(initialPosts);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  async function create() {
    setBusy(true); setError("");
    try {
      const body = await parseResponse(await fetch(`${API}/blog-posts`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: newTitle.trim() }),
      })) as { post: BlogPost };
      router.push(`/admin-panel/posts/${body.post.id}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo crear el borrador.");
      setBusy(false);
    }
  }

  async function remove(post: BlogPost) {
    if (!window.confirm(`¿Eliminar definitivamente “${post.title || "Sin título"}”? Esta acción no se puede deshacer.`)) return;
    setBusy(true); setError("");
    try {
      await parseResponse(await fetch(`${API}/blog-posts/${post.id}`, { method: "DELETE" }));
      setPosts((current) => current.filter((item) => item.id !== post.id));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo eliminar.");
    } finally {
      setBusy(false);
    }
  }

  return <><AdminHeader onLogout={logout} /><main className="mx-auto max-w-6xl px-5 py-10 sm:px-8"><div className="flex flex-wrap items-end justify-between gap-5 border-b border-[var(--color-line)] pb-7"><div><p className="text-sm font-semibold text-[var(--color-primary)]">Contenido</p><h1 className="font-display mt-2 text-4xl font-semibold text-[var(--color-navy)]">Publicaciones</h1><p className="mt-2 text-[var(--color-ink-soft)]">Creá y publicá novedades para quienes usan Citadely.</p></div><button aria-expanded={creating} className="button-primary" disabled={busy} onClick={() => setCreating((value) => !value)} type="button"><Plus aria-hidden="true" size={17} />Nueva publicación</button></div>{creating ? <form className="mt-6 flex flex-wrap items-end gap-3 border border-[var(--color-line)] bg-white p-5" onSubmit={(event) => { event.preventDefault(); void create(); }}><label className="form-label min-w-64 flex-1">Título de la nueva publicación<input autoFocus className="form-control" maxLength={180} onChange={(event) => setNewTitle(event.target.value)} required type="text" value={newTitle} /></label><button className="button-primary" disabled={busy || !newTitle.trim()} type="submit">Crear borrador</button></form> : null}{error ? <p role="alert" className="mt-5 text-sm text-[var(--color-danger)]">{error}</p> : null}{posts.length === 0 ? <div className="border-b border-[var(--color-line)] py-24 text-center"><h2 className="font-display text-2xl font-semibold text-[var(--color-navy)]">Todavía no hay publicaciones.</h2><p className="mt-2 text-[var(--color-ink-soft)]">Empezá con un borrador y publicalo cuando esté listo.</p></div> : <div className="divide-y divide-[var(--color-line)]">{posts.map((post) => <article className="grid gap-4 py-6 sm:grid-cols-[1fr_auto] sm:items-center" key={post.id}><div><span className={`text-xs font-bold uppercase tracking-[0.1em] ${post.status === "published" ? "text-[var(--color-success)]" : "text-[var(--color-warning)]"}`}>{post.status === "published" ? "Publicado" : "Borrador"}</span><h2 className="mt-2 font-display text-xl font-semibold text-[var(--color-navy)]">{post.title || "Sin título"}</h2><p className="mt-1 text-xs text-[var(--color-ink-muted)]">/{post.slug}</p></div><div className="flex flex-wrap items-center gap-2"><Link className="button-secondary" href={`/admin-panel/posts/${post.id}`}>Editar<ArrowRight aria-hidden="true" size={15} /></Link><Link aria-label={`Vista previa de ${post.title || "Sin título"}`} className="icon-button" href={`/admin-panel/posts/${post.id}/preview`}><Eye aria-hidden="true" size={17} /></Link><button aria-label={`Eliminar ${post.title || "Sin título"}`} className="icon-button text-[var(--color-danger)]" disabled={busy} onClick={() => remove(post)} type="button"><Trash2 aria-hidden="true" size={17} /></button></div></article>)}</div>}</main></>;
}

export function AdminEditor({ initialPost, initialBlocks }: { initialPost: BlogPost; initialBlocks: BlogBlock[] }) {
  const router = useRouter();
  const logout = useLogout();
  const [post, setPost] = useState(initialPost);
  const [title, setTitle] = useState(initialPost.title);
  const [coverAlt, setCoverAlt] = useState(initialPost.cover_alt);
  const [blocks, setBlocks] = useState<BlogBlock[]>(initialBlocks);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function changeBlock(index: number, patch: Partial<BlogBlock>) {
    setBlocks((current) => current.map((block, target) => target === index ? { ...block, ...patch } : block));
  }
  function moveBlock(index: number, direction: -1 | 1) {
    const next = index + direction;
    if (next < 0 || next >= blocks.length) return;
    setBlocks((current) => { const copy = [...current]; [copy[index], copy[next]] = [copy[next], copy[index]]; return copy; });
  }

  async function upload(file: File | undefined) {
    if (!file) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const form = new FormData();
      form.append("postId", post.id); form.append("image", file);
      const body = await parseResponse(await fetch(`${API}/blog-images`, { method: "POST", body: form })) as { url: string; key: string };
      setPost((current) => ({ ...current, cover_url: body.url, cover_key: body.key }));
      setMessage("Portada cargada. Guardá la publicación para conservar el texto alternativo.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo subir la portada.");
    } finally { setBusy(false); }
  }

  async function save(publish: boolean) {
    setBusy(true); setError(""); setMessage("");
    try {
      await parseResponse(await fetch(`${API}/blog-posts/${post.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, coverAlt, blocks: blocks.map(({ kind, content }) => ({ kind, content })), publish }),
      }));
      setPost((current) => ({ ...current, title, cover_alt: coverAlt, status: publish ? "published" : "draft" }));
      setMessage(publish ? "Publicación visible en el Blog." : "Borrador guardado.");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo guardar.");
    } finally { setBusy(false); }
  }

  return <><AdminHeader onLogout={logout} /><main className="mx-auto max-w-4xl px-5 py-10 sm:px-8"><Link className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-primary)]" href="/admin-panel"><ArrowLeft aria-hidden="true" size={16} />Publicaciones</Link><div className="mt-6 flex flex-wrap items-end justify-between gap-4 border-b border-[var(--color-line)] pb-7"><div><span className={`text-xs font-bold uppercase tracking-[0.1em] ${post.status === "published" ? "text-[var(--color-success)]" : "text-[var(--color-warning)]"}`}>{post.status === "published" ? "Publicado" : "Borrador"}</span><h1 className="font-display mt-2 text-3xl font-semibold text-[var(--color-navy)]">Editar publicación</h1><p className="mt-2 text-xs text-[var(--color-ink-muted)]">URL permanente: /blog/{post.slug}</p></div><Link className="button-secondary" href={`/admin-panel/posts/${post.id}/preview`} target="_blank"><Eye aria-hidden="true" size={17} />Vista previa guardada</Link></div>
    {error ? <p role="alert" className="mt-5 text-sm font-semibold text-[var(--color-danger)]">{error}</p> : null}{message ? <p role="status" className="mt-5 text-sm font-semibold text-[var(--color-success)]">{message}</p> : null}
    <div className="mt-8 grid gap-8"><section className="border border-[var(--color-line)] bg-white p-5 sm:p-7"><h2 className="font-display text-xl font-semibold text-[var(--color-navy)]">Identidad de la publicación</h2><div className="mt-6 grid gap-5"><label className="form-label">Título<input className="form-control" maxLength={180} onChange={(event) => setTitle(event.target.value)} placeholder="Nueva mejora para tu agenda" type="text" value={title} /></label><label className="form-label">Portada<input accept="image/jpeg,image/png,image/webp" className="mt-2 block w-full text-sm" disabled={busy} onChange={(event) => upload(event.target.files?.[0])} type="file" /><span className="text-xs font-normal text-[var(--color-ink-muted)]">JPG, PNG o WebP · hasta 4 MB · máximo 1600 × 900 px</span></label>{post.cover_url ? <div className="relative aspect-[16/9] overflow-hidden bg-[var(--color-primary-soft)]"><Image alt={coverAlt || "Vista previa de portada"} className="object-cover" fill sizes="(max-width: 896px) 100vw, 800px" src={post.cover_url} unoptimized /></div> : null}<label className="form-label">Descripción de la imagen<input className="form-control" maxLength={240} onChange={(event) => setCoverAlt(event.target.value)} placeholder="Describí la portada para lectores y buscadores" type="text" value={coverAlt} /></label></div></section>
    <section className="border border-[var(--color-line)] bg-white p-5 sm:p-7"><div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="font-display text-xl font-semibold text-[var(--color-navy)]">Contenido</h2><p className="mt-1 text-sm text-[var(--color-ink-soft)]">Ordená los bloques para construir el artículo.</p></div><button className="button-secondary" onClick={() => setBlocks((current) => [...current, { position: current.length, kind: "paragraph", content: "" }])} type="button"><Plus aria-hidden="true" size={16} />Agregar bloque</button></div><div className="mt-6 grid gap-4">{blocks.length === 0 ? <p className="border border-dashed border-[var(--color-line)] p-8 text-center text-sm text-[var(--color-ink-muted)]">Agregá un bloque para empezar.</p> : blocks.map((block, index) => <fieldset className="border border-[var(--color-line)] p-4" key={block.id ?? index}><legend className="px-1 text-xs font-semibold text-[var(--color-ink-muted)]">Bloque {index + 1}</legend><div className="flex flex-wrap items-center gap-2"><select aria-label={`Tipo de bloque ${index + 1}`} className="form-input min-w-44 flex-1" onChange={(event) => changeBlock(index, { kind: event.target.value as BlogBlockKind })} value={block.kind}>{Object.entries(KIND_LABELS).map(([kind, label]) => <option key={kind} value={kind}>{label}</option>)}</select><button aria-label={`Subir bloque ${index + 1}`} className="icon-button" disabled={index === 0} onClick={() => moveBlock(index, -1)} type="button"><ArrowUp aria-hidden="true" size={16} /></button><button aria-label={`Bajar bloque ${index + 1}`} className="icon-button" disabled={index === blocks.length - 1} onClick={() => moveBlock(index, 1)} type="button"><ArrowDown aria-hidden="true" size={16} /></button><button aria-label={`Eliminar bloque ${index + 1}`} className="icon-button text-[var(--color-danger)]" onClick={() => setBlocks((current) => current.filter((_, target) => target !== index))} type="button"><Trash2 aria-hidden="true" size={16} /></button></div><label className="mt-4 block text-sm font-semibold">Texto<textarea className="form-input mt-2 min-h-32 w-full py-3" maxLength={10000} onChange={(event) => changeBlock(index, { content: event.target.value })} placeholder={block.kind.includes("list") ? "Un elemento por línea" : "Escribí el contenido del bloque"} value={block.content} /></label></fieldset>)}</div></section></div>
    <div className="sticky bottom-0 mt-8 flex flex-wrap items-center justify-end gap-3 border-t border-[var(--color-line)] bg-[var(--color-canvas)] py-4"><button className="button-secondary" disabled={busy} onClick={() => save(post.status === "published")} type="button">{busy ? "Guardando…" : "Guardar cambios"}</button>{post.status === "published" ? <button className="button-secondary" disabled={busy} onClick={() => save(false)} type="button">Retirar publicación</button> : <button className="button-primary" disabled={busy} onClick={() => save(true)} type="button">Publicar<ArrowRight aria-hidden="true" size={16} /></button>}</div>
  </main></>;
}
