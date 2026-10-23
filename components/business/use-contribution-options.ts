"use client";

import { useEffect, useState } from "react";
import { insforge } from "@/lib/insforge";
import type { ContributionOption } from "@/lib/contributions";

const OPTION_COLUMNS = "code,label,amount_cents,currency,sort_order";

export type ContributionOptionsState =
  | { status: "loading" }
  | { status: "ready"; options: ContributionOption[] }
  | { status: "error" };

/** Suggested amounts from contribution_options. RLS only returns the active ones. */
export function useContributionOptions() {
  const [state, setState] = useState<ContributionOptionsState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    void insforge.database
      .from("contribution_options")
      .select(OPTION_COLUMNS)
      .order("sort_order", { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return;
        setState(error ? { status: "error" } : { status: "ready", options: (data ?? []) as ContributionOption[] });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
