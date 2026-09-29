import { Info } from "lucide-react";
import { usePageHints } from "#/components/PageHints";

/** Значок комментариев: включает подсказки у активных элементов страницы. */
export function CommentHeadingIcon() {
  const { enabled, toggle } = usePageHints();

  return (
    <button
      type="button"
      title={enabled ? "Скрыть подсказки" : "Комментарии"}
      aria-label={enabled ? "Скрыть подсказки" : "Комментарии"}
      data-hint={
        enabled
          ? "Скрывает описание страницы и подсказки у элементов"
          : "Показывает описание страницы и подсказки о том, что делает каждый элемент"
      }
      aria-pressed={enabled}
      onClick={toggle}
      className={`inline-flex shrink-0 rounded-full p-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
        enabled
          ? "bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300"
          : "text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
      }`}
    >
      <Info size={16} strokeWidth={2} aria-hidden />
    </button>
  );
}
