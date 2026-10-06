import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTheme } from "#/components/ThemeProvider";
import {
  HR_BACKGROUNDS,
  readHrBackgroundIndex,
  writeHrBackgroundIndex,
} from "#/lib/hrBackgrounds";

export function HrBackground() {
  const { resolved } = useTheme();
  const [index, setIndex] = useState(readHrBackgroundIndex);
  const dragStart = useRef<number | null>(null);

  useEffect(() => {
    for (const item of HR_BACKGROUNDS) {
      const image = new Image();
      image.src = item.src;
    }
  }, []);

  if (resolved !== "light") return null;

  const step = (delta: number) => {
    setIndex((current) => {
      const next =
        (current + delta + HR_BACKGROUNDS.length) % HR_BACKGROUNDS.length;
      writeHrBackgroundIndex(next);
      return next;
    });
  };

  const current = HR_BACKGROUNDS[index];

  return (
    <>
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
        {HR_BACKGROUNDS.map((item, itemIndex) => (
          <div
            key={item.id}
            className={`absolute inset-0 bg-cover bg-center transition-opacity duration-700 ease-out ${
              itemIndex === index ? "opacity-100" : "opacity-0"
            }`}
            style={{ backgroundImage: `url(${item.src})` }}
          />
        ))}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.4)_0%,rgba(255,255,255,0.2)_46%,rgba(247,251,248,0.3)_100%)]" />
      </div>

      <div
        className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] left-1/2 z-30 flex -translate-x-1/2 items-center gap-1 rounded-full border border-white/80 bg-white/80 px-1.5 py-1 shadow-lg backdrop-blur-md sm:bottom-5"
        onPointerDown={(event) => {
          dragStart.current = event.clientX;
        }}
        onPointerUp={(event) => {
          if (dragStart.current === null) return;
          const delta = event.clientX - dragStart.current;
          dragStart.current = null;
          if (delta > 48) step(-1);
          else if (delta < -48) step(1);
        }}
        onPointerCancel={() => {
          dragStart.current = null;
        }}
      >
        <button
          type="button"
          aria-label="Предыдущий фон"
          data-hint="Показывает предыдущий фон светлой темы"
          onClick={() => step(-1)}
          className="rounded-full p-1.5 text-gray-500 transition-colors hover:bg-white hover:text-gray-800"
        >
          <ChevronLeft size={16} />
        </button>
        <p className="min-w-16 text-center text-xs font-medium text-gray-700">
          {current.label}
        </p>
        <div className="flex items-center gap-1 px-1" role="tablist" aria-label="Фон">
          {HR_BACKGROUNDS.map((item, itemIndex) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={itemIndex === index}
              aria-label={item.label}
              data-hint={`Ставит фон «${item.label}»`}
              onClick={() => {
                setIndex(itemIndex);
                writeHrBackgroundIndex(itemIndex);
              }}
              className={`h-1.5 rounded-full transition-all ${
                itemIndex === index
                  ? "w-4 bg-gray-700"
                  : "w-1.5 bg-gray-300 hover:bg-gray-400"
              }`}
            />
          ))}
        </div>
        <button
          type="button"
          aria-label="Следующий фон"
          data-hint="Показывает следующий фон светлой темы"
          onClick={() => step(1)}
          className="rounded-full p-1.5 text-gray-500 transition-colors hover:bg-white hover:text-gray-800"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </>
  );
}
