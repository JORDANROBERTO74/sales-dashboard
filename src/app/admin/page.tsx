import { redirect } from "next/navigation";

/**
 * No hay UI en /admin; el panel vive en /admin/dashboard.
 * Evita 404 cuando alguien abre /admin o el login devuelve redirectTo=/admin.
 */
export default function AdminIndexPage() {
  redirect("/admin/dashboard");
}
