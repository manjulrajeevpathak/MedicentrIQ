import { RoiWorkspace } from "@/components/roi/roi-workspace";
import { getRoi } from "@/lib/roi";

export default async function RoiPage() {
  const data = await getRoi();
  return <RoiWorkspace data={data} />;
}
