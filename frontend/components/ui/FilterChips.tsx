"use client";

import clsx from "clsx";

interface Chip {
  value: string;
  label: string;
  count?: number;
}

interface Props {
  chips: Chip[];
  selected: string;
  onSelect: (value: string) => void;
  className?: string;
}

export function FilterChips({ chips, selected, onSelect, className }: Props) {
  return (
    <div
      className={clsx(
        "flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1",
        className
      )}
    >
      {chips.map((chip) => {
        const isSelected = selected === chip.value;
        return (
          <button
            key={chip.value}
            onClick={() => onSelect(chip.value)}
            className={clsx(
              "flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap",
              isSelected
                ? "bg-ink text-white shadow-sm"
                : "bg-surface border border-[rgba(27,24,20,0.1)] text-ink-2 hover:border-ink/30 hover:text-ink"
            )}
          >
            {chip.label}
            {chip.count !== undefined && (
              <span
                className={clsx(
                  "text-[10px] font-bold rounded-full px-1.5 min-w-[18px] text-center leading-none py-0.5",
                  isSelected ? "bg-white/20 text-white" : "bg-[#F5EFE1] text-ink-2"
                )}
              >
                {chip.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
