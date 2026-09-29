import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "#/components/ThemeProvider";
import type { ThemeMode } from "#/lib/theme";

const OPTIONS: {
  mode: ThemeMode;
  label: string;
  hint: string;
  Icon: typeof Sun;
}[] = [
  {
    mode: "auto",
    label: "Авто",
    hint: "Тема следует за оформлением системы",
    Icon: Monitor,
  },
  {
    mode: "light",
    label: "Светлая",
    hint: "Всегда включает светлую тему",
    Icon: Sun,
  },
  {
    mode: "dark",
    label: "Тёмная",
    hint: "Всегда включает тёмную тему",
    Icon: Moon,
  },
];

function menuPosition(
  rect: DOMRect,
  layout: "sidebar" | "bottom",
): { top?: number; bottom?: number; left: number } {
  const width = 148;
  if (layout === "bottom") {
    return {
      bottom: window.innerHeight - rect.top + 8,
      left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
    };
  }
  const height = 116;
  return {
    top: Math.max(8, Math.min(rect.bottom - height, window.innerHeight - height - 8)),
    left: rect.right + 8,
  };
}

export function ThemeSwitch({
  collapsed,
  layout = "sidebar",
}: {
  collapsed: boolean;
  layout?: "sidebar" | "bottom";
}) {
  const { mode, setMode } = useTheme();
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const current = OPTIONS.find((option) => option.mode === mode) ?? OPTIONS[0];
  const isBottom = layout === "bottom";

  useEffect(() => {
    if (!open) return;

    function onPointer(event: PointerEvent) {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    }

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function choose(next: ThemeMode) {
    setMode(next);
    setOpen(false);
  }

  if (!collapsed && !isBottom) {
    return (
      <div className="px-3 pb-3">
        <p className="mb-1.5 text-xs font-medium text-gray-400 dark:text-gray-500">
          Тема
        </p>
        <div
          role="radiogroup"
          aria-label="Тема"
          className="grid grid-cols-3 gap-0.5 rounded-lg bg-gray-100 p-0.5 dark:bg-gray-800"
        >
          {OPTIONS.map((option) => {
            const active = option.mode === mode;
            return (
              <button
                key={option.mode}
                type="button"
                role="radio"
                aria-checked={active}
                data-hint={option.hint}
                onClick={() => setMode(option.mode)}
                className={`rounded-md px-1 py-1 text-[11px] font-medium transition-colors ${
                  active
                    ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-gray-100"
                    : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-100"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const Icon = current.Icon;
  const position = anchor ? menuPosition(anchor, layout) : null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        title={`Тема: ${current.label}`}
        aria-label={`Тема: ${current.label}`}
        aria-haspopup="menu"
        aria-expanded={open}
        data-hint="Открывает выбор темы: автоматически, светлая или тёмная"
        onClick={() => {
          const rect = buttonRef.current?.getBoundingClientRect() ?? null;
          setAnchor(rect);
          setOpen((value) => !value);
        }}
        className={
          isBottom
            ? "flex shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg px-2 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
            : "mb-1 flex w-full items-center justify-center rounded-lg py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
        }
      >
        <span className="flex h-5 w-5 shrink-0 items-center justify-center">
          <Icon size={16} />
        </span>
        {isBottom && <span className="text-[10px] leading-tight">Тема</span>}
      </button>
      {open &&
        position &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-label="Тема"
            style={{ position: "fixed", zIndex: 50, ...position }}
            className="w-36 overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-900"
          >
            {OPTIONS.map((option) => {
              const active = option.mode === mode;
              const OptionIcon = option.Icon;
              return (
                <button
                  key={option.mode}
                  type="button"
                  role="menuitemradio"
                  aria-checked={active}
                  data-hint={option.hint}
                  onClick={() => choose(option.mode)}
                  className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm ${
                    active
                      ? "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300"
                      : "text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
                  }`}
                >
                  <OptionIcon size={14} />
                  {option.label}
                </button>
              );
            })}
          </div>,
          document.body,
        )}
    </>
  );
}
