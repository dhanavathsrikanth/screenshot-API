"use client";

import { useState } from "react";

export function HistoryThumb({ src, format }: { src: string | null; format: string }) {
  const [failed, setFailed] = useState(false);

  if (!src || format === "pdf" || failed) {
    return <span className="text-[9px] font-bold text-zinc-400 uppercase">{format}</span>;
  }

  return (
    <a href={src} target="_blank" rel="noopener noreferrer" className="block w-full h-full">
      <img
        src={src}
        alt=""
        className="w-full h-full object-cover"
        loading="lazy"
        onError={() => setFailed(true)}
      />
    </a>
  );
}
