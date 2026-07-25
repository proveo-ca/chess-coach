import type { PeerMessage, PeerState, PeerTransport, SignalPayload } from "~/types/multiplayer";

abstract class StorybookPeerTransport implements PeerTransport {
  abstract readonly role: "host" | "guest";
  protected messageHandler: ((peerId: string, message: PeerMessage) => void) | undefined;
  protected stateHandler: ((peerId: string, state: PeerState) => void) | undefined;

  onMessage(callback: (peerId: string, message: PeerMessage) => void): void {
    this.messageHandler = callback;
  }

  onPeerStateChange(callback: (peerId: string, state: PeerState) => void): void {
    this.stateHandler = callback;
  }

  send(_peerId: string, _message: PeerMessage): void {}

  broadcast(_message: PeerMessage): void {}

  restartIce(): void {}

  close(): void {}
}

export class HostHubTransport extends StorybookPeerTransport {
  readonly role = "host" as const;

  async createOffer(): Promise<SignalPayload> {
    return { connId: "storybook-host", sdp: "storybook-offer" };
  }

  async acceptAnswer(_answer: SignalPayload): Promise<void> {
    this.stateHandler?.("storybook-guest", "connected");
  }
}

export class GuestLinkTransport extends StorybookPeerTransport {
  readonly role = "guest" as const;

  async createAnswer(_offer: SignalPayload): Promise<SignalPayload> {
    queueMicrotask(() => this.stateHandler?.("host", "connected"));
    return { connId: "storybook-guest", sdp: "storybook-answer" };
  }
}
