import { useEffect, useRef, useState } from "react";
import type { Place } from "../types";
import { searchPlaces } from "../services/geocoding";

interface Props {
  placeholder: string;
  value: Place | null;
  onChange: (place: Place | null) => void;
}

export function PlaceSearchInput({ placeholder, value, onChange }: Props) {
  const [text, setText] = useState(value?.label ?? "");
  const [suggestions, setSuggestions] = useState<Place[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setText(value?.label ?? "");
  }, [value]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function handleInput(newText: string) {
    setText(newText);
    onChange(null);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (newText.trim().length < 3) {
      setSuggestions([]);
      setOpen(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const results = await searchPlaces(newText);
        setSuggestions(results);
        setOpen(true);
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 400);
  }

  function selectPlace(place: Place) {
    onChange(place);
    setText(place.label);
    setOpen(false);
    setSuggestions([]);
  }

  return (
    <div className="place-search" ref={containerRef}>
      <input
        type="text"
        placeholder={placeholder}
        value={text}
        onChange={(e) => handleInput(e.target.value)}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
      />
      {loading && <div className="place-search-status">Searching…</div>}
      {open && suggestions.length > 0 && (
        <ul className="place-search-suggestions">
          {suggestions.map((s, i) => (
            <li key={i} onClick={() => selectPlace(s)}>
              {s.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
