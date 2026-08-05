export type ServiceState = "checking" | "healthy" | "unreachable";

export interface ServiceStatus {
  name: string;
  baseUrl: string;
  state: ServiceState;
  version?: string;
}

interface HealthPayload {
  status?: string;
  version?: string;
}

export async function checkServiceHealth(
  name: string,
  baseUrl: string,
): Promise<ServiceStatus> {
  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/health`, {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      return { name, baseUrl, state: "unreachable" };
    }

    const payload = (await response.json()) as HealthPayload;

    return {
      name,
      baseUrl,
      state: payload.status === "ok" ? "healthy" : "unreachable",
      version: payload.version,
    };
  } catch {
    return { name, baseUrl, state: "unreachable" };
  }
}
