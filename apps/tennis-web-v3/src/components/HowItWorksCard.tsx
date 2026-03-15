import { useState } from "react";

export default function HowItWorksCard({ onDismiss }: { onDismiss: () => void }) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss();
  };

  return (
    <section className="how-it-works-card">
      <div className="hiw-header">
        <h2 className="section-title">How Rally Works</h2>
        <button className="hiw-dismiss" onClick={handleDismiss} aria-label="Dismiss">
          &times;
        </button>
      </div>

      <div className="hiw-timeline-mini">
        <div className="hiw-step">
          <div className="hiw-step-icon hiw-step-icon--join">1</div>
          <div className="hiw-step-text">
            <strong>Join</strong>
            <span>Sign up for a monthly tournament in your area</span>
          </div>
        </div>
        <div className="hiw-step-connector" />
        <div className="hiw-step">
          <div className="hiw-step-icon hiw-step-icon--play">2</div>
          <div className="hiw-step-text">
            <strong>Play</strong>
            <span>We auto-schedule ~5 matches from your availability</span>
          </div>
        </div>
        <div className="hiw-step-connector" />
        <div className="hiw-step">
          <div className="hiw-step-icon hiw-step-icon--compete">3</div>
          <div className="hiw-step-text">
            <strong>Compete</strong>
            <span>Top 4 advance to finals — win the championship</span>
          </div>
        </div>
      </div>

      <div className="hiw-footer">
        <span className="hiw-duration">~30 days per season</span>
      </div>
    </section>
  );
}
