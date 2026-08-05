import type { RecentProjectSummary } from "../../projects/projectRecord";

interface RecentProjectsProps {
  records: RecentProjectSummary[];
  onOpen: (localProjectId: string) => void;
  onDuplicate: (localProjectId: string) => void;
  onDelete: (localProjectId: string) => void;
}

export function RecentProjects(props: RecentProjectsProps) {
  return (
    <section className="recent-projects" aria-labelledby="recent-projects-title">
      <h2 id="recent-projects-title">Recent local projects</h2>
      {props.records.length === 0 ? (
        <p className="muted">No local projects saved yet.</p>
      ) : (
        <div className="recent-list">
          {props.records.slice(0, 20).map((record) => (
            <article className="recent-row" key={record.localProjectId}>
              <div>
                <strong>{record.projectName}</strong>
                <p>
                  {record.projectId.slice(0, 24)} - schema {record.schemaVersion} -
                  opened {formatDate(record.openedAt)} - saved{" "}
                  {record.locallySavedAt ? formatDate(record.locallySavedAt) : "never"}{" "}
                  - {record.source} - {record.recoveryState}
                </p>
              </div>
              <div className="row-actions">
                <button
                  type="button"
                  onClick={() => props.onOpen(record.localProjectId)}
                >
                  Open
                </button>
                <button
                  type="button"
                  onClick={() => props.onDuplicate(record.localProjectId)}
                >
                  Duplicate
                </button>
                <button
                  type="button"
                  onClick={() => props.onDelete(record.localProjectId)}
                >
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString();
}
