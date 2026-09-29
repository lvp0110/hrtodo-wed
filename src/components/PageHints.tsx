import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

const HINT_SELECTOR = [
  "button",
  "a[href]",
  "input:not([type='hidden'])",
  "select",
  "textarea",
  "summary",
  "[role='button']",
  "[role='link']",
  "[role='tab']",
  "[role='option']",
  "[role='menuitem']",
  "[role='checkbox']",
  "[role='switch']",
  "[role='radio']",
  "[role='combobox']",
  "[data-hint]",
  "svg[aria-label]",
  ".cursor-pointer",
  ".cursor-copy",
].join(",");

const SHOW_DELAY_MS = 200;

type PageHintsContextValue = {
  enabled: boolean;
  toggle: () => void;
};

const PageHintsContext = createContext<PageHintsContextValue | null>(null);

export function usePageHints() {
  const value = useContext(PageHintsContext);
  if (!value) {
    throw new Error("usePageHints must be used within PageHintsProvider");
  }
  return value;
}

/** Описание функционала страницы. Видно, только пока включён значок комментариев. */
export function PageDescription({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const { enabled } = usePageHints();
  if (!enabled) return null;

  return (
    <p
      className={`rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs leading-5 text-gray-600 shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 ${className}`}
    >
      {children}
    </p>
  );
}

export function PageHintsProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState(false);
  const value = useMemo(
    () => ({ enabled, toggle: () => setEnabled((on) => !on) }),
    [enabled],
  );

  return (
    <PageHintsContext.Provider value={value}>
      {children}
      {enabled && <HintLayer />}
    </PageHintsContext.Provider>
  );
}

type Hint = {
  el: Element;
  text: string;
  x: number;
  y: number;
};

const suspendedTitles = new Set<HTMLElement | SVGElement>();

function suspendTitle(el: Element) {
  if (!(el instanceof HTMLElement || el instanceof SVGElement)) return;
  if (!el.hasAttribute("title")) return;
  el.dataset.hintTitle = el.getAttribute("title") ?? "";
  el.removeAttribute("title");
  suspendedTitles.add(el);
}

function restoreTitle(el: Element) {
  if (!(el instanceof HTMLElement || el instanceof SVGElement)) return;
  if (!suspendedTitles.has(el)) return;
  const title = el.dataset.hintTitle ?? "";
  if (title) el.setAttribute("title", title);
  else el.removeAttribute("title");
  delete el.dataset.hintTitle;
  suspendedTitles.delete(el);
}

function restoreAllTitles() {
  for (const el of [...suspendedTitles]) restoreTitle(el);
}

/** Подсказка — только явно заданный функционал элемента, не его подпись. */
function hintText(el: Element): string | null {
  const explicit = el.getAttribute("data-hint")?.trim();
  return explicit || null;
}

function isControl(el: Element): boolean {
  return el.matches(
    "button, a[href], input, select, textarea, summary, [role='button']",
  );
}

function isInactive(el: Element): boolean {
  if (el.getAttribute("aria-disabled") === "true") return true;
  if (el.closest("[aria-disabled='true']")) return true;
  return Boolean(el.closest(":disabled"));
}

function findHintTarget(
  start: EventTarget | null,
): { el: Element; text: string } | null {
  let node: Element | null = start instanceof Element ? start : null;
  while (node) {
    const el = node.closest(HINT_SELECTOR);
    if (!el || el.closest("[data-hint-layer]")) return null;
    if (isInactive(el)) {
      if (isControl(el)) return null;
      node = el.parentElement;
      continue;
    }
    const text = hintText(el);
    if (text) return { el, text };
    node = el.parentElement;
  }
  return null;
}

function placeTooltip(
  anchor: DOMRect,
  tip: DOMRect,
  cursorX: number,
): { top: number; left: number } {
  const gap = 8;
  const margin = 8;
  let top = anchor.bottom + gap;
  if (top + tip.height > window.innerHeight - margin) {
    top = Math.max(margin, anchor.top - gap - tip.height);
  }
  const preferred = Math.min(Math.max(cursorX, anchor.left), anchor.right);
  let left = preferred - tip.width / 2;
  left = Math.max(margin, Math.min(left, window.innerWidth - tip.width - margin));
  return { top, left };
}

function HintLayer() {
  const [hint, setHint] = useState<Hint | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef(hint);
  hintRef.current = hint;

  useEffect(() => {
    let timer = 0;
    let current: Element | null = null;
    const cursor = { x: 0, y: 0 };

    const hide = () => {
      window.clearTimeout(timer);
      if (current) restoreTitle(current);
      current = null;
      setHint(null);
      setPos(null);
    };

    const show = (target: { el: Element; text: string }) => {
      if (current === target.el) return;
      if (current) restoreTitle(current);
      suspendTitle(target.el);
      current = target.el;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        setPos(null);
        setHint({
          el: target.el,
          text: target.text,
          x: cursor.x,
          y: cursor.y,
        });
      }, SHOW_DELAY_MS);
    };

    const onOver = (event: Event) => {
      if (event instanceof PointerEvent) {
        cursor.x = event.clientX;
        cursor.y = event.clientY;
      }
      const target = findHintTarget(event.target);
      if (!target) {
        if (current || hintRef.current) hide();
        return;
      }
      show(target);
    };

    const onMove = (event: PointerEvent) => {
      cursor.x = event.clientX;
      cursor.y = event.clientY;
    };

    document.addEventListener("pointerover", onOver, true);
    document.addEventListener("pointermove", onMove, true);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("pointerover", onOver, true);
      document.removeEventListener("pointermove", onMove, true);
      if (current) restoreTitle(current);
      restoreAllTitles();
    };
  }, []);

  useLayoutEffect(() => {
    const tip = tipRef.current;
    if (!hint || !tip) return;

    const place = () => {
      if (!hint.el.isConnected) {
        setHint(null);
        setPos(null);
        return;
      }
      const anchor = hint.el.getBoundingClientRect();
      const box = tip.getBoundingClientRect();
      setPos(placeTooltip(anchor, box, hint.x));
    };

    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [hint]);

  if (!hint) return null;

  return createPortal(
    <div
      ref={tipRef}
      data-hint-layer
      role="tooltip"
      style={{
        top: pos?.top ?? 0,
        left: pos?.left ?? 0,
        visibility: pos ? "visible" : "hidden",
      }}
      className="pointer-events-none fixed z-[70] max-w-[280px] rounded-md bg-gray-900 px-2.5 py-1.5 text-xs leading-snug text-white shadow-lg ring-1 ring-black/10 dark:bg-gray-100 dark:text-gray-900 dark:ring-white/10"
    >
      {hint.text}
    </div>,
    document.body,
  );
}
