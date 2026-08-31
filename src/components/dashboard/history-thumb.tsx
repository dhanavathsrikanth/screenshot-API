"use client";

import { useState } from "react";

export function HistoryThumb({ src, format, onOpen }: { src: string | null; format: string; onOpen?: () => void }) {
  const [failed, setFailed] = useState(false);

  if (!src || format === "pdf" || failed) {
    return <span className="text-[9px] font-bold text-[var(--dim)] uppercase">{format}</span>;
  }

  // Used as a button so clicking the thumbnail opens the in-app preview popup
  // instead of a new browser tab.
  return (
    <button
      type="button"
      onClick={onOpen}
      title="Preview screenshot"
      className="block w-full h-full cursor-pointer"
    >
      <img
        src={src}
        alt=""
        className="w-full h-full object-cover"
        loading="lazy"
        onError={() => setFailed(true)}
      />
    </button>
  );
}
