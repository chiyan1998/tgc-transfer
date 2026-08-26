import { MODULES } from "@/lib/modules";
import { ReservedModule } from "@/components/ReservedModule";

export default function NotesPage() {
  return <ReservedModule module={MODULES.find((m) => m.key === "notes")!} />;
}
