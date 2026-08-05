export interface ProjectChannelMessage {
  localProjectId: string;
  revision: number;
  senderInstanceId: string;
  savedAt: string;
  operation: "saved" | "deleted";
}

export interface ProjectChannel {
  instanceId: string;
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
      publish: () => undefined,
      close: () => undefined,
    };
  }

  const channel = new BroadcastChannel(PROJECT_CHANNEL_NAME);
  channel.onmessage = (event: MessageEvent<ProjectChannelMessage>) => {
    const message = event.data;
    if (!message || message.senderInstanceId === instanceId) {
      return;
    }
    onExternalMessage(message);
  };

  return {
    instanceId,
    publish: (message) =>
      channel.postMessage({ ...message, senderInstanceId: instanceId }),
    close: () => channel.close(),
  };
}
