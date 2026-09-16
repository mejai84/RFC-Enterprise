import { ProjectsWorkspace } from "@/modules/inventory/presentation/projects-workspace";
import { requireAuthenticatedUser } from "@/core/auth/server";

export const metadata = {
  title: "Centro de Costos por Obra y Proyecto | RFC Enterprise",
  description: "Consulta de materiales e insumos gastados, herramientas en custodia y requisiciones por obra.",
};

export default async function ProjectsPage() {
  const user = await requireAuthenticatedUser();
  const responsibleName = user?.user_metadata?.display_name || user?.email || "Usuario autenticado";
  return <ProjectsWorkspace responsibleName={responsibleName} />;
}
