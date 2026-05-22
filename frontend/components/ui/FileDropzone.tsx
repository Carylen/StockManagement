"use client";

import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import clsx from "clsx";

interface Props {
  onFile: (file: File) => void;
  accept?: string;
  loading?: boolean;
}

export function FileDropzone({ onFile, accept = ".csv,.xlsx,.xls", loading = false }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) onFile(file);
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => !loading && inputRef.current?.click()}
      className={clsx(
        "relative border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all",
        dragging ? "border-primary bg-primary-soft" : "border-primary/40 bg-white hover:bg-primary-soft/30"
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }}
      />
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-coral mx-auto mb-4 flex items-center justify-center">
        <Upload size={28} className="text-ink" />
      </div>
      <p className="text-lg font-bold text-ink mb-1">
        {loading ? "Memproses file…" : "Tarik file CSV/XLSX ke sini"}
      </p>
      <p className="text-sm text-ink-2 mb-4">
        Format: <code className="font-mono bg-surface-alt px-1.5 py-0.5 rounded text-xs">READYNESS_VHS_KPP_AGMR_*.xlsx</code> · Maks 10MB
      </p>
      {!loading && (
        <button
          type="button"
          className="px-5 py-2.5 bg-ink text-white text-sm font-semibold rounded-lg hover:bg-ink/80 transition-colors"
        >
          Pilih file
        </button>
      )}
    </div>
  );
}
