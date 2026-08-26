import { MODULES } from "@/lib/modules";
import { ReservedModule } from "@/components/ReservedModule";

export default function ProjectsPage() {
  return <ReservedModule module={MODULES.find((m) => m.key === "projects")!} />;
}
