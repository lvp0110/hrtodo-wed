import { Info } from "lucide-react";

/** Значок комментариев: «i» в кружке рядом с заголовком раздела. */
export function CommentHeadingIcon() {
  return (
    <button
      type="button"
      title="Комментарии"
      aria-label="Комментарии"
      className="inline-flex shrink-0 rounded-full text-gray-400 transition-colors hover:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-gray-500 dark:hover:text-gray-300"
    >
      <Info size={16} strokeWidth={2} aria-hidden />
    </button>
  );
}
