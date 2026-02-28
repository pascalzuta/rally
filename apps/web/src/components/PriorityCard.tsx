import type { Priority, PriorityStatus } from "@daily-priorities/core";

interface PriorityCardProps {
  priority: Priority;
  onStatusChange: (id: string, status: PriorityStatus) => void;
}

const STATUS_OPTIONS: PriorityStatus[] = ["pending", "done", "partial", "missed"];

export function PriorityCard({ priority, onStatusChange }: PriorityCardProps) {
  return (
    <article className="card priority-card">
      <header>
        <h4>{priority.title}</h4>
      </header>
      <p>
        <strong>Why:</strong> {priority.why}
      </p>
      <p>
        <strong>Blockers:</strong> {priority.blockers || "None specified"}
      </p>
      <div className="status-row">
        {STATUS_OPTIONS.map((status) => (
          <button
            key={status}
            type="button"
            className={priority.status === status ? "status active" : "status"}
            onClick={() => onStatusChange(priority.id, status)}
          >
            {status}
          </button>
        ))}
      </div>
    </article>
  );
}
