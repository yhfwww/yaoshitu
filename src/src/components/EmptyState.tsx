export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        color: "var(--c-text-muted)",
        padding: 24,
      }}
    >
      <div style={{ fontSize: 15, color: "var(--c-text)" }}>{title}</div>
      {hint && <div style={{ fontSize: 13 }}>{hint}</div>}
      {action && (
        <button className="btn btn-primary" style={{ marginTop: 8 }} onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  );
}
