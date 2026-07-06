"use client";

import { useRef, useState } from "react";
import useSWR from "swr";
import { MessageCircle, Trash2, Send, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api";
import type { PlanLineNote } from "@/lib/types";

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "baru saja";
  if (diff < 3600) return `${Math.floor(diff / 60)} mnt lalu`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} jam lalu`;
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

interface Props {
  lineId: string;
  currentUserId: string | null;
  isAdmin: boolean;
  canWrite: boolean;
}

/** Inline append-only note thread for a single plan line. */
export function LineNotesThread({ lineId, currentUserId, isAdmin, canWrite }: Props) {
  const t = useTranslations("planNotes");
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  const { data: notes, mutate } = useSWR<PlanLineNote[]>(
    `/scheduled-plans/lines/${lineId}/notes`,
    (u: string) => api.get<PlanLineNote[]>(u),
  );

  const handleSubmit = async () => {
    const body = draft.trim();
    if (!body || submitting) return;
    setSubmitting(true);
    try {
      await api.post(`/scheduled-plans/lines/${lineId}/notes`, { body });
      setDraft("");
      mutate();
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (noteId: string) => {
    setDeletingId(noteId);
    try {
      await api.delete(`/scheduled-plans/notes/${noteId}`);
      mutate();
    } finally {
      setDeletingId(null);
    }
  };

  const charsLeft = 500 - draft.length;

  return (
    <div className="mt-2 space-y-2">
      {/* Note thread */}
      {(notes ?? []).length === 0 ? (
        <p className="text-[11px] text-ink-3 italic">{t("empty")}</p>
      ) : (
        <div className="space-y-2">
          {(notes ?? []).map((note) => {
            const isOwn = note.created_by === currentUserId;
            const canDelete = isOwn || isAdmin;
            return (
              <div key={note.id} className="flex gap-2 items-start group">
                <div className="flex-1 bg-bg rounded-xl px-3 py-2 border border-border text-[12px]">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="font-semibold text-ink-2">
                      {note.created_by_name ?? t("unknownUser")}
                    </span>
                    <span className="text-ink-3 text-[10px]">{timeAgo(note.created_at)}</span>
                  </div>
                  <p className="text-ink whitespace-pre-wrap">{note.body}</p>
                </div>
                {canDelete && (
                  <button
                    onClick={() => handleDelete(note.id)}
                    disabled={deletingId === note.id}
                    className="opacity-0 group-hover:opacity-100 mt-1 p-1 rounded text-ink-3 hover:text-warning transition-all"
                    title={t("delete")}
                  >
                    {deletingId === note.id
                      ? <Loader2 size={12} className="animate-spin" />
                      : <Trash2 size={12} />}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Input */}
      {canWrite && (
        <div className="flex gap-2 items-end pt-1">
          <div className="flex-1 relative">
            <textarea
              ref={textRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value.slice(0, 500))}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
              }}
              placeholder={t("placeholder")}
              rows={2}
              className="w-full px-3 py-2 text-[12px] border border-border rounded-xl bg-bg resize-none focus:outline-none focus:border-kpp"
            />
            <span className={`absolute bottom-2 right-2 text-[10px] ${charsLeft < 50 ? "text-warning" : "text-ink-3"}`}>
              {charsLeft}
            </span>
          </div>
          <button
            onClick={handleSubmit}
            disabled={!draft.trim() || submitting}
            className="p-2.5 rounded-xl bg-kpp text-white disabled:opacity-40 hover:brightness-110 transition-all flex-shrink-0"
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          </button>
        </div>
      )}
    </div>
  );
}

/** Badge showing note count, shown inline on the line row. */
export function NotesBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-kpp-soft text-kpp">
      <MessageCircle size={9} />
      {count}
    </span>
  );
}
