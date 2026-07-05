import { IntegrationsPanel } from "@/components/admin/integrations-panel";
import { fetchChannels } from "@/lib/users-api";
import type { ChannelStatus } from "@/lib/users-types";

export const dynamic = "force-dynamic";

export default async function ChannelsPage() {
  const channelsResult = await fetchChannels();
  const channels: ChannelStatus = channelsResult.ok
    ? channelsResult.data
    : {
        ultramsg: { configured: false, enabled: false, instanceId: null, tokenTail: null },
        aisensy: { configured: false, enabled: false, apiKeyTail: null },
        telephony: { configured: false, enabled: false, provider: null, callerId: null, apiKeyTail: null },
        whatsappCloud: {
          configured: false,
          enabled: false,
          phoneNumberId: null,
          wabaId: null,
          accessTokenTail: null,
          appSecretTail: null,
          verifyToken: null,
          webhookPath: ""
        }
      };

  // Public gateway origin for the Meta webhook callback URL (read server-side).
  const gatewayBase = process.env.NEXT_PUBLIC_GATEWAY_URL || "https://<your-gateway-host>";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-ink">Channels</h1>
        <p className="text-sm text-ink-muted">
          WhatsApp &amp; telephony credentials for this hospital.
        </p>
      </div>
      <IntegrationsPanel channels={channels} gatewayBase={gatewayBase} />
    </div>
  );
}
