interface Props {
  theme: "light" | "dark";
  onToggle: () => void;
}

export function ThemeToggle({ theme, onToggle }: Props) {
  return (
    <button className="theme-toggle" onClick={onToggle} title="Toggle light/dark theme">
      {theme === "dark" ? "☀︎ Light" : "☾ Dark"}
    </button>
  );
}
