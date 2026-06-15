import { Globe, MessageCircle, Phone, Share2, Footprints, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Channel } from "@/lib/types";

// Neutral chips — the icon shape distinguishes the channel, not a unique hue.
const neutralChip = "text-ink-muted bg-fill";
const channelConfig: Record<Channel, { icon: LucideIcon; color: string; label: string }> = {
  WhatsApp: { icon: MessageCircle, color: neutralChip, label: "WhatsApp" },
  Call: { icon: Phone, color: neutralChip, label: "Call" },
  Web: { icon: Globe, color: neutralChip, label: "Web" },
  "Walk-in": { icon: Footprints, color: neutralChip, label: "Walk-in" },
  Referral: { icon: Share2, color: neutralChip, label: "Referral" }
};

export function ChannelIcon({ channel, className }: { channel: Channel; className?: string }) {
  const config = channelConfig[channel];
  const Icon = config.icon;
  return (
    <span className={cn("flex size-7 items-center justify-center rounded-lg", config.color, className)} title={config.label}>
      <Icon className="size-3.5" />
    </span>
  );
}

export function channelLabel(channel: Channel): string {
  return channelConfig[channel].label;
}
