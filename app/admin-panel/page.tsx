import { AdminDashboard, AdminLogin } from "@/components/admin/blog-admin";
import { hasAdminSession } from "@/lib/blog-admin-auth";
import { BLOG_POST_COLUMNS, type BlogPost } from "@/lib/blog";
import { insforgeAdmin } from "@/lib/insforge-admin";

export default async function AdminPage() {
  if (!(await hasAdminSession())) return <AdminLogin />;
  if (!insforgeAdmin) return <p className="p-8">Panel no configurado.</p>;
  const { data, error } = await insforgeAdmin.database.from("blog_posts")
    .select(BLOG_POST_COLUMNS).order("updated_at", { ascending: false }).limit(100);
  if (error) throw error;
  return <AdminDashboard initialPosts={(data ?? []) as BlogPost[]} />;
}
