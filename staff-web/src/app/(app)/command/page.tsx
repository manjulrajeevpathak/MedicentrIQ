import { CommandCenter } from "@/components/command/command-center";
import { getAnalytics } from "@/lib/analytics";

export default async function CommandPage() {
  const data = await getAnalytics();
  return <CommandCenter data={data} />;
}
