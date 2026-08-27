export function MetricCard({ label, value, description, state }) {
  return (
    <article className="card">
      <div className="card-label">{label}</div>
      <h2>{value}</h2>
      <p>{description}</p>
      <span className="card-state">{state}</span>
    </article>
  );
}