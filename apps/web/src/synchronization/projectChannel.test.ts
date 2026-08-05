import { afterEach, describe, expect, it, vi } from "vitest";

import { createProjectChannel, PROJECT_CHANNEL_NAME } from "./projectChannel";

class BroadcastChannelDouble {
  static instances: BroadcastChannelDouble[] = [];
  onmessage: ((event: MessageEvent) => void) | null = null;
  readonly name: string;
  closed = false;

  constructor(name: string) {
    this.name = name;
    BroadcastChannelDouble.instances.push(this);
  }

  postMessage(message: unknown) {
    for (const instance of BroadcastChannelDouble.instances) {
      instance.onmessage?.({ data: message } as MessageEvent);
    }
  }

  close() {
    this.closed = true;
  }
}

describe("project channel", () => {
  afterEach(() => {
    BroadcastChannelDouble.instances = [];
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
});
