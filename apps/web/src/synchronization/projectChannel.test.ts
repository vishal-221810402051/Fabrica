import { afterEach, describe, expect, it, vi } from "vitest";

import { createProjectChannel, PROJECT_CHANNEL_NAME } from "./projectChannel";

class BroadcastChannelDouble {
  static instances: BroadcastChannelDouble[] = [];
  static postMessages = 0;
  onmessage: ((event: MessageEvent) => void) | null = null;
  readonly name: string;
  closed = false;
  closeCalls = 0;
  throwOnPost = false;

  constructor(name: string) {
    this.name = name;
    BroadcastChannelDouble.instances.push(this);
  }

  postMessage(message: unknown) {
    if (this.closed || this.throwOnPost) {
      throw new DOMException("Channel is closed", "InvalidStateError");
    }
    BroadcastChannelDouble.postMessages += 1;
    for (const instance of BroadcastChannelDouble.instances) {
      if (instance.closed) {
        continue;
      }
      instance.onmessage?.({ data: message } as MessageEvent);
    }
  }

  close() {
    this.closeCalls += 1;
    this.closed = true;
  }
}

describe("project channel", () => {
  afterEach(() => {
    BroadcastChannelDouble.instances = [];
    BroadcastChannelDouble.postMessages = 0;
  });

  it("ignores own messages and receives external revisions", () => {
    vi.stubGlobal("BroadcastChannel", BroadcastChannelDouble);
    const received = vi.fn();
    const first = createProjectChannel(received);
    const second = createProjectChannel(() => undefined);

    first.publish({
      localProjectId: "local_one",
      revision: 1,
      savedAt: "2026-08-05T00:00:00.000Z",
      operation: "saved",
    });
    second.publish({
      localProjectId: "local_one",
      revision: 2,
      savedAt: "2026-08-05T00:00:01.000Z",
      operation: "saved",
    });

    expect(received).toHaveBeenCalledOnce();
    expect(received).toHaveBeenCalledWith(expect.objectContaining({ revision: 2 }));
    expect(BroadcastChannelDouble.instances[0]?.name).toBe(PROJECT_CHANNEL_NAME);
    first.close();
    expect(BroadcastChannelDouble.instances[0]?.closed).toBe(true);
  });

  it("degrades when BroadcastChannel is unavailable", () => {
    vi.stubGlobal("BroadcastChannel", undefined);
    const channel = createProjectChannel(vi.fn());
    expect(() =>
      channel.publish({
        localProjectId: "local",
        revision: 1,
        savedAt: "2026-08-05T00:00:00.000Z",
        operation: "saved",
      }),
    ).not.toThrow();
  });

  it("treats postMessage failures as non-fatal publication failures", () => {
    vi.stubGlobal("BroadcastChannel", BroadcastChannelDouble);
    const channel = createProjectChannel(vi.fn());
    BroadcastChannelDouble.instances[0]!.throwOnPost = true;

    expect(() =>
      channel.publish({
        localProjectId: "local",
        revision: 1,
        savedAt: "2026-08-05T00:00:00.000Z",
        operation: "saved",
      }),
    ).not.toThrow();
  });

  it("allows cleanup to be called twice", () => {
    vi.stubGlobal("BroadcastChannel", BroadcastChannelDouble);
    const channel = createProjectChannel(vi.fn());

    channel.close();
    channel.close();

    expect(BroadcastChannelDouble.instances[0]?.closeCalls).toBe(1);
  });

  it("makes publish after cleanup safe", () => {
    vi.stubGlobal("BroadcastChannel", BroadcastChannelDouble);
    const channel = createProjectChannel(vi.fn());

    channel.close();

    expect(() =>
      channel.publish({
        localProjectId: "local",
        revision: 1,
        savedAt: "2026-08-05T00:00:00.000Z",
        operation: "saved",
      }),
    ).not.toThrow();
    expect(BroadcastChannelDouble.postMessages).toBe(0);
  });

  it("opens a fresh channel for StrictMode-style setup cleanup setup", () => {
    vi.stubGlobal("BroadcastChannel", BroadcastChannelDouble);
    const channel = createProjectChannel(vi.fn());

    channel.close();
    channel.open();
    channel.publish({
      localProjectId: "local",
      revision: 2,
      savedAt: "2026-08-05T00:00:00.000Z",
      operation: "saved",
    });

    expect(BroadcastChannelDouble.instances).toHaveLength(2);
    expect(BroadcastChannelDouble.instances[0]?.closed).toBe(true);
    expect(BroadcastChannelDouble.instances[1]?.closed).toBe(false);
    expect(BroadcastChannelDouble.postMessages).toBe(1);
  });

  it("creates a fresh channel on remount", () => {
    vi.stubGlobal("BroadcastChannel", BroadcastChannelDouble);
    const first = createProjectChannel(vi.fn());
    first.close();

    const second = createProjectChannel(vi.fn());

    expect(second.instanceId).not.toBe(first.instanceId);
    expect(BroadcastChannelDouble.instances).toHaveLength(2);
    expect(BroadcastChannelDouble.instances[1]?.closed).toBe(false);
  });

  it("does not let one controller close another controller's channel", () => {
    vi.stubGlobal("BroadcastChannel", BroadcastChannelDouble);
    const first = createProjectChannel(vi.fn());
    const secondReceived = vi.fn();
    createProjectChannel(secondReceived);

    first.close();
    BroadcastChannelDouble.instances[1]!.postMessage({
      localProjectId: "local",
      revision: 3,
      savedAt: "2026-08-05T00:00:00.000Z",
      operation: "saved",
      senderInstanceId: "external",
    });

    expect(BroadcastChannelDouble.instances[0]?.closed).toBe(true);
    expect(BroadcastChannelDouble.instances[1]?.closed).toBe(false);
    expect(secondReceived).toHaveBeenCalledOnce();
  });
});
