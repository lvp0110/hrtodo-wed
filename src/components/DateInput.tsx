import { useEffect, useRef, useState } from "react";
import { Calendar } from "lucide-react";
import { isoToDisplay, parseManualDate, sanitizeDateTyping } from "#/lib/manualDate";

type DateInputProps = {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  name?: string;
  id?: string;
  disabled?: boolean;
  className?: string;
  title?: string;
  "data-hint"?: string;
};

export function DateInput({
  value,
  onChange,
  onBlur,
  name,
  id,
  disabled = false,
  className = "",
  title,
  "data-hint": dataHint,
}: DateInputProps) {
  const textRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(() => isoToDisplay(value));

  useEffect(() => {
    if (textRef.current && document.activeElement === textRef.current) return;
    setText(isoToDisplay(value));
  }, [value]);

  function commitText(next: string) {
    if (next.trim() === "") {
      setText("");
      onChange("");
      return;
    }
    const iso = parseManualDate(next);
    if (iso) {
      setText(isoToDisplay(iso));
      onChange(iso);
      return;
    }
    setText(isoToDisplay(value));
  }

  function handleTextChange(raw: string) {
    const next = sanitizeDateTyping(raw);
    setText(next);
    if (next.trim() === "") {
      onChange("");
      return;
    }
    const iso = parseManualDate(next);
    if (iso) onChange(iso);
  }

  function handleBlur() {
    commitText(text);
    onBlur?.();
  }

  function openCalendar() {
    const picker = pickerRef.current;
    if (!picker || disabled) return;
    try {
      picker.showPicker();
    } catch {
      // Календарь открывается только из пользовательского клика.
    }
  }

  return (
    <div
      className={`relative flex items-center gap-2 focus-within:border-transparent focus-within:outline-none focus-within:ring-2 focus-within:ring-blue-500 ${className}`}
    >
      <input
        ref={textRef}
        id={id}
        name={name}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        disabled={disabled}
        placeholder="ДД.ММ.ГГГГ"
        title={title}
        data-hint={dataHint}
        value={text}
        onChange={(event) => handleTextChange(event.target.value)}
        onBlur={handleBlur}
        className="min-w-0 flex-1 bg-transparent text-inherit outline-none placeholder:text-gray-400"
      />
      <button
        type="button"
        disabled={disabled}
        aria-label="Открыть календарь"
        onMouseDown={(event) => event.preventDefault()}
        onClick={openCalendar}
        className="shrink-0 text-gray-400 hover:text-gray-600 disabled:cursor-not-allowed dark:hover:text-gray-200"
      >
        <Calendar size={16} />
      </button>
      <input
        ref={pickerRef}
        type="date"
        tabIndex={-1}
        aria-hidden="true"
        disabled={disabled}
        value={/^\d{4}-\d{2}-\d{2}$/.test(value) ? value : ""}
        onChange={(event) => {
          onChange(event.target.value);
          setText(isoToDisplay(event.target.value));
        }}
        className="pointer-events-none absolute size-px opacity-0"
      />
    </div>
  );
}
