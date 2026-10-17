"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getErrorMessage } from "@/lib/auth";
import type { Client } from "@/lib/citadely-db";
import { CLIENT_PAGE_SIZE, searchClients } from "@/lib/clients";

const SEARCH_DEBOUNCE_MS = 300;

/** Paginated, debounced, server-side client search. Replaces loading every client into the workspace. */
export function useClientSearch({ businessId, query, enabled = true }: { businessId: string; query: string; enabled?: boolean }) {
  const [clients, setClients] = useState<Client[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const requestRef = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    const requestId = ++requestRef.current;
    // El primer render no espera: solo el tipeo se retrasa.
    const delay = query.trim() ? SEARCH_DEBOUNCE_MS : 0;
    const timer = setTimeout(async () => {
      setLoading(true);
      const result = await searchClients({ businessId, query });
      if (requestId !== requestRef.current) return;
      setLoading(false);
      if (result.error) {
        setError(getErrorMessage(result.error));
        return;
      }
      setError(null);
      setClients(result.data);
      setTotal(result.total);
    }, delay);
    return () => clearTimeout(timer);
  }, [businessId, query, enabled, reloadKey]);

  const loadMore = useCallback(async () => {
    const requestId = ++requestRef.current;
    setLoading(true);
    const result = await searchClients({ businessId, query, offset: clients.length });
    if (requestId !== requestRef.current) return;
    setLoading(false);
    if (result.error) {
      setError(getErrorMessage(result.error));
      return;
    }
    setClients((current) => {
      const known = new Set(current.map((client) => client.id));
      return [...current, ...result.data.filter((client) => !known.has(client.id))];
    });
    setTotal(result.total);
  }, [businessId, query, clients.length]);

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  const hasMore = total !== null ? clients.length < total : clients.length > 0 && clients.length % CLIENT_PAGE_SIZE === 0;

  return { clients, total, loading, error, hasMore, loadMore, reload };
}
