import { MODULES } from "@/lib/modules";
import { ReservedModule } from "@/components/ReservedModule";

export default function FundingPage() {
  return <ReservedModule module={MODULES.find((m) => m.key === "funding")!} />;
}
