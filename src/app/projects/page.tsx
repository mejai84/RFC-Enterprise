import { ProjectsWorkspace } from "@/modules/inventory/presentation/projects-workspace";

export const metadata = {
  title: "Centro de Costos por Obra y Proyecto | RFC Enterprise",
  description: "Consulta de materiales e insumos gastados, herramientas en custodia y requisiciones por obra.",
};

export default function ProjectsPage() {
  return <ProjectsWorkspace />;
}
