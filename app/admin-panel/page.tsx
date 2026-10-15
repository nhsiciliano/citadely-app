import { AdminDashboard, AdminLogin } from "@/components/admin/blog-admin";
import { hasAdminSession } from "@/lib/blog-admin-auth";
import { ADMIN_POSTS_PAGE_SIZE, BLOG_POST_COLUMNS, type BlogPost } from "@/lib/blog";
import { insforgeAdmin } from "@/lib/insforge-admin";

export default async function AdminPage() {
  if (!(await hasAdminSession())) return <AdminLogin />;
  if (!insforgeAdmin) return <p className="p-8">Panel no configurado.</p>;
  const pageSize = ADMIN_POSTS_PAGE_SIZE;
  const { data, error } = await insforgeAdmin.database.from("blog_posts")
    .select(BLOG_POST_COLUMNS).order("updated_at", { ascending: false }).range(0, pageSize);
  if (error) throw error;
  const rows = (data ?? []) as BlogPost[];
  return <AdminDashboard hasMoreInitially={rows.length > pageSize} initialPosts={rows.slice(0, pageSize)} />;
}
