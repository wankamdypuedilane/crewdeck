"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { hasSupabaseEnv } from "@/lib/supabase/env";

/**
 * Re-renders the board when a teammate changes a task. Realtime only says
 * "something changed": the server re-reads the board, with RLS, as usual.
 */
export function useBoardRealtime(boardId: string) {
  const router = useRouter();

  useEffect(() => {
    if (!hasSupabaseEnv) return;
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | undefined;

    const channel = supabase
      .channel(`board:${boardId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks", filter: `board_id=eq.${boardId}` },
        () => {
          // Several changes often arrive together (a move, a rebalance): refresh once.
          clearTimeout(timer);
          timer = setTimeout(() => router.refresh(), 250);
        },
      )
      .subscribe();

    return () => {
      clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [boardId, router]);
}
