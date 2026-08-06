export interface ProjectChannelMessage {
  localProjectId: string;
  revision: number;
  senderInstanceId: string;
  savedAt: string;
  operation: "saved" | "deleted";
}

export interface ProjectChannel {
  instanceId: string;
  open: () => void;
  publish: (message: Omit<ProjectChannelMessage, "senderInstanceId">) => void;
  close: () => void;
}

export const PROJECT_CHANNEL_NAME = "fabricgamma-projects";

export function createProjectChannel(
  onExternalMessage: (message: ProjectChannelMessage) => void,
): ProjectChannel {
  const instanceId =
    globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;

  if (typeof globalThis.BroadcastChannel !== "function") {
    return {
      instanceId,
      open: () => undefined,
      publish: () => undefined,
      close: () => undefined,
    };
  }

  let channel: BroadcastChannel | null = null;

  const open = () => {
    if (channel) {
      return;
    }
    channel = new BroadcastChannel(PROJECT_CHANNEL_NAME);
    channel.onmessage = (event: MessageEvent<ProjectChannelMessage>) => {
      const message = event.data;
      if (!message || message.senderInstanceId === instanceId) {
        return;
      }
      onExternalMessage(message);
    };
  };

  open();

  return {
    instanceId,
    open,
    publish: (message) => {
      if (!channel) {
        return;
      }
      try {
        channel.postMessage({ ...message, senderInstanceId: instanceId });
      } catch {
        // IndexedDB persistence is authoritative; cross-tab publication is best-effort.
      }
    },
    close: () => {
      if (!channel) {
        return;
      }
      channel.close();
      channel = null;
    },
  };
}
