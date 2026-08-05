import { useEffect, useState } from "react";

import { checkServiceHealth, type ServiceStatus } from "./health";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000";
const cadBaseUrl = import.meta.env.VITE_CAD_BASE_URL ?? "http://127.0.0.1:8001";

const initialStatuses: ServiceStatus[] = [
  { name: "API", baseUrl: apiBaseUrl, state: "checking" },
  { name: "CAD service", baseUrl: cadBaseUrl, state: "checking" },
];

export function App() {
  const [statuses, setStatuses] = useState<ServiceStatus[]>(initialStatuses);

  useEffect(() => {
    let cancelled = false;

    async function refreshHealth() {
      const results = await Promise.all([
        checkServiceHealth("API", apiBaseUrl),
        checkServiceHealth("CAD service", cadBaseUrl),
      ]);

      if (!cancelled) {
        setStatuses(results);
      }
    }

    void refreshHealth();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="app-shell">
      <section className="status-panel" aria-labelledby="status-title">
        <p className="eyebrow">Phase 2 foundation</p>
        <h1 id="status-title">Fabricgamma development environment</h1>
        <p className="summary">
          The web foundation is operational. Product design tools, engineering
          calculations, GPT integration, and production CAD remain deferred.
        </p>

        <div className="service-grid" aria-label="Service health">
          {statuses.map((status) => (
            <article className="service-card" key={status.name}>
              <div>
                <h2>{status.name}</h2>
                <p>{status.baseUrl}</p>
              </div>
              <span className={`badge badge-${status.state}`}>{status.state}</span>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
