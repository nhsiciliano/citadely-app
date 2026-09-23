import { redirect, notFound } from "next/navigation";
import { AdminEditor } from "@/components/admin/blog-admin";
import { getAdminPost, getBlogBlocks } from "@/lib/blog";
import { hasAdminSession } from "@/lib/blog-admin-auth";

type Params = { params: Promise<{ id: string }> };

export default async function AdminEditorPage({ params }: Params) {
  if (!(await hasAdminSession())) redirect("/admin-panel");
  const post = await getAdminPost((await params).id);
  if (!post) notFound();
  const blocks = await getBlogBlocks(post.id, true);
  return <AdminEditor initialPost={post} initialBlocks={blocks} />;
}
