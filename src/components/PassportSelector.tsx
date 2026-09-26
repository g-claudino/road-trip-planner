import { useRef, useState, useEffect } from "react";
import { NATIONALITIES } from "../data/borderRequirements";

interface Props {
  selected: string[];
  onChange: (codes: string[]) => void;
}

export function PassportSelector({ selected, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const filtered = NATIONALITIES.filter((n) =>
    n.name.toLowerCase().includes(query.toLowerCase()),
  );

  function toggle(code: string) {
    if (selected.includes(code)) {
      onChange(selected.filter((c) => c !== code));
    } else {
      onChange([...selected, code]);
    }
  }

  return (
    <div className="passport-selector" ref={containerRef}>
      <button className="passport-selector-trigger" onClick={() => setOpen((o) => !o)}>
        {selected.length === 0
          ? "Select your passport(s)"
          : selected.map((c) => NATIONALITIES.find((n) => n.code === c)?.name).join(", ")}
        <span className="chevron">▾</span>
      </button>

      {open && (
        <div className="passport-selector-dropdown">
          <input
            type="text"
            placeholder="Search country…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          <ul>
            {filtered.map((n) => (
              <li key={n.code}>
                <label>
                  <input
                    type="checkbox"
                    checked={selected.includes(n.code)}
                    onChange={() => toggle(n.code)}
                  />
                  {n.name}
                </label>
              </li>
            ))}
            {filtered.length === 0 && <li className="no-match">No matching country</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
