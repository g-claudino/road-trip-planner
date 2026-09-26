interface Props {
  onDismiss: () => void;
}

export function StorageDisclaimer({ onDismiss }: Props) {
  return (
    <div className="storage-disclaimer" role="note">
      <p>
        This app saves a few things locally in your browser (using{" "}
        <code>localStorage</code>, a technology similar to cookies) — your theme choice,
        passport selections, cost-estimate settings, and any favorite trips you save. Nothing is
        sent to a server or shared; clearing your browser data removes it.
      </p>
      <button className="storage-disclaimer-btn" onClick={onDismiss}>
        Got it
      </button>
    </div>
  );
}
