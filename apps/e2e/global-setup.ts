import { chromium } from "@playwright/test";

import { IS_DESKTOP, LLM } from "./target";

// Both targets: the LAN multiplayer specs open a loopback WebRTC DataChannel
// between two browser contexts using host ICE candidates only (iceServers: []).
// Chromium publishes those candidates as mDNS `.local` names, which only
// resolve when the machine has an active multicast-capable network path — in
// practice, Wi-Fi/Ethernet or the Tailscale interface being up. When it isn't
// (e.g. Tailscale service stopped), every LAN spec times out opaquely at the
// first "2/2 players" gate after ~25s each. Probe once here and let the LAN
// spec skip itself with guidance instead (via E2E_RTC_LOOPBACK).
async function probeRtcLoopback(): Promise<void> {
  const browser = await chromium.launch();
  try {
    const host = await (await browser.newContext()).newPage();
    const guest = await (await browser.newContext()).newPage();

    // Mirrors services/peer.ts: non-trickle offer/answer, host candidates only.
    const offer = await host.evaluate(async () => {
      const pc = new RTCPeerConnection({ iceServers: [] });
      (window as any).__pc = pc;
      const dc = pc.createDataChannel("probe");
      (window as any).__open = new Promise<void>((res) => (dc.onopen = () => res()));
      await pc.setLocalDescription(await pc.createOffer());
      await new Promise<void>((res) => {
        if (pc.iceGatheringState === "complete") return res();
        pc.onicegatheringstatechange = () => pc.iceGatheringState === "complete" && res();
      });
      return pc.localDescription!.sdp;
    });

    const answer = await guest.evaluate(async (sdp: string) => {
      const pc = new RTCPeerConnection({ iceServers: [] });
      pc.ondatachannel = () => {};
      await pc.setRemoteDescription({ type: "offer", sdp });
      await pc.setLocalDescription(await pc.createAnswer());
      await new Promise<void>((res) => {
        if (pc.iceGatheringState === "complete") return res();
        pc.onicegatheringstatechange = () => pc.iceGatheringState === "complete" && res();
      });
      return pc.localDescription!.sdp;
    }, offer);

    const opened = await host.evaluate(async (sdp: string) => {
      const pc = (window as any).__pc as RTCPeerConnection;
      await pc.setRemoteDescription({ type: "answer", sdp });
      return Promise.race([
        ((window as any).__open as Promise<void>).then(() => true),
        new Promise<boolean>((res) => setTimeout(() => res(false), 10_000)),
      ]);
    }, answer);

    if (opened) {
      process.env.E2E_RTC_LOOPBACK = "ok";
      console.log("[e2e] WebRTC loopback preflight: DataChannel opened — LAN specs enabled.");
    } else {
      process.env.E2E_RTC_LOOPBACK = "broken";
      console.warn(
        "\n[e2e] WebRTC loopback preflight FAILED: host↔guest DataChannel never opened.\n" +
          "  Chromium's mDNS (.local) ICE candidates aren't resolving on this machine.\n" +
          "  Usual cause: no active local network path — start Tailscale (or connect\n" +
          "  Wi-Fi/Ethernet) and re-run. Skipping lan-multiplayer.spec.ts.\n",
      );
    }
  } finally {
    await browser.close();
  }
}

// Desktop target only: the commentary path (apps/server → /advice, /explain) is
// driven by a locally-run, OpenAI-compatible LLM. Verify it's reachable and the
// model is pulled, then warm it — so a missing model fails fast here with
// actionable guidance instead of surfacing as opaque stream timeouts mid-suite,
// and the first real request doesn't pay the cold-load (which can exceed the
// server's 60s request timeout). No-op for the web targets.
export default async function globalSetup(): Promise<void> {
  await probeRtcLoopback();

  if (!IS_DESKTOP) return;

  const { baseUrl, model, apiKey } = LLM;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

  const hint =
    `\n  Desktop e2e needs a local LLM at ${baseUrl} serving "${model}".\n` +
    `  Start one and pull the model, e.g.:\n` +
    `      ollama serve\n` +
    `      ollama pull ${model}\n` +
    `  Or point the suite elsewhere via LLM_BASE_URL / LLM_COMMENTARY_MODEL.\n`;

  // 1. Reachable.
  let models: Array<{ id?: string }>;
  try {
    const res = await fetch(`${baseUrl}/models`, { headers });
    if (!res.ok) throw new Error(`GET ${baseUrl}/models → ${res.status}`);
    models = ((await res.json()) as { data?: Array<{ id?: string }> }).data ?? [];
  } catch (e) {
    throw new Error(`Local LLM not reachable: ${(e as Error).message}\n${hint}`);
  }

  // 2. Model present. Only enforced when the runtime can enumerate models —
  //    some OpenAI-compatible servers return an empty list, so don't false-fail.
  const available = models.map((m) => m.id).filter(Boolean) as string[];
  if (available.length > 0 && !available.includes(model)) {
    throw new Error(
      `Local LLM is up but model "${model}" is not pulled (have: ${available.join(", ")}).\n${hint}`,
    );
  }
  if (available.length === 0) {
    console.warn(`[e2e] LLM at ${baseUrl} returned no model list; skipping presence check.`);
  }

  // 3. Warm into memory (best-effort; non-fatal — the model is confirmed present).
  try {
    await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 1,
        temperature: 0,
      }),
    });
    console.log(`[e2e] local LLM "${model}" reachable and warmed at ${baseUrl}`);
  } catch (e) {
    console.warn(`[e2e] LLM warmup failed (continuing): ${(e as Error).message}`);
  }
}
