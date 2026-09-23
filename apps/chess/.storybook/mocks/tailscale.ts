import type { TailnetProbeResult } from "~/types/multiplayer";

export const isTailscaleAddress = (ip: string): boolean => ip.startsWith("100.");

export const probeTailnet = async (): Promise<TailnetProbeResult> => ({
  status: "connected",
  address: "100.100.100.100",
});
