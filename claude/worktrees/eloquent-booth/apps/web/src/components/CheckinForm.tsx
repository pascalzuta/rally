import { useMemo, useState } from "react";
import type { Priority } from "@daily-priorities/core";
import { validatePriority } from "@daily-priorities/core";

interface DraftPriority {
  title: string;
  why: string;
  blockers: string;
}

interface CheckinFormProps {
  onCreate: (payload: { confidence: number; priorities: Priority[] }) => void;
}

function toPriority(draft: DraftPriority, index: number): Priority {
  return {
    id: `${Date.now()}-${index}`,
    title: draft.title.trim(),
    why: draft.why.trim(),
    blockers: draft.blockers.trim(),
    status: "pending"
  };
}

export function CheckinForm({ onCreate }: CheckinFormProps) {
  const [confidence, setConfidence] = useState(3);
  const [rows, setRows] = useState<DraftPriority[]>([
    { title: "", why: "", blockers: "" },
    { title: "", why: "", blockers: "" },
    { title: "", why: "", blockers: "" }
  ]);
  const [submitted, setSubmitted] = useState(false);

  const validations = useMemo(
    () =>
      rows.map((row) => {
        const empty = !row.title.trim() && !row.why.trim() && !row.blockers.trim();
        if (empty) {
          return { isValid: false, hints: ["Fill this slot or leave it empty."], score: 0, empty: true };
        }
        return { ...validatePriority({ title: row.title, why: row.why }), empty: false };
      }),
    [rows]
  );

  const activeRows = rows.filter((r) => r.title.trim().length > 0);
  const canSubmit = activeRows.length > 0 && activeRows.length <= 3 && validations.every((v) => v.empty || v.isValid);

  function updateRow(index: number, field: keyof DraftPriority, value: string) {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  }

  function submit() {
    setSubmitted(true);
    if (!canSubmit) return;

    const priorities = rows
      .filter((row) => row.title.trim())
      .map((row, index) => toPriority(row, index));

    onCreate({ confidence, priorities });
  }

  return (
    <section className="card">
      <h3>Morning Check-In</h3>
      <p className="muted">Define 1-3 priorities. Be specific and measurable.</p>

      <div className="confidence-row">
        <label htmlFor="confidence">How confident are you? ({confidence}/5)</label>
        <input
          id="confidence"
          type="range"
          min={1}
          max={5}
          value={confidence}
          onChange={(e) => setConfidence(Number(e.target.value))}
        />
      </div>

      {rows.map((row, index) => {
        const validation = validations[index];
        const showHints = submitted && !validation.empty && !validation.isValid;

        return (
          <article key={index} className="priority-editor">
            <h4>Priority {index + 1}</h4>
            <input
              placeholder="Example: Ship onboarding draft by 2pm"
              value={row.title}
              onChange={(e) => updateRow(index, "title", e.target.value)}
            />
            <input
              placeholder="Why this matters today"
              value={row.why}
              onChange={(e) => updateRow(index, "why", e.target.value)}
            />
            <input
              placeholder="Likely blocker and mitigation"
              value={row.blockers}
              onChange={(e) => updateRow(index, "blockers", e.target.value)}
            />
            {!validation.empty ? <p className="quality">Quality score: {validation.score}/100</p> : null}
            {showHints ? (
              <ul className="hints">
                {validation.hints.map((hint) => (
                  <li key={hint}>{hint}</li>
                ))}
              </ul>
            ) : null}
          </article>
        );
      })}

      <button type="button" className="primary" onClick={submit}>
        Commit Today's Priorities
      </button>
      {!canSubmit && submitted ? (
        <p className="warning">Update your priorities until each active one passes quality checks.</p>
      ) : null}
    </section>
  );
}
