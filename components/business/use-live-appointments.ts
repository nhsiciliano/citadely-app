"use client";

import { useEffect, useRef } from "react";
import type { Appointment } from "@/lib/citadely-db";
import { ensureFreshSession, insforge } from "@/lib/insforge";
import { loadRange } from "@/lib/workspace-data";

const REFRESH_DEBOUNCE_MS = 400;
const POLL_INTERVAL_MS = 60_000;

/**
 * Keeps the appointment list current while the dashboard is open.
 *
 * Primary path: InsForge Realtime channel `business:<id>`; the `appointments_changed` event (published by a
 * trigger on public.appointments, no personal data in the payload) triggers a debounced reload of the loaded
 * window. Fallback: if the socket cannot connect or drops, the list is polled every 60 s while the tab is
 * visible, and it is reloaded again when the tab comes back or the socket reconnects.
 */
export function useLiveAppointments({
  businessId,
  historyStart,
  onAppointments,
}: {
  businessId: string;
  historyStart: string;
  onAppointments: (appointments: Appointment[]) => void;
}) {
  const historyStartRef = useRef(historyStart);
  const onAppointmentsRef = useRef(onAppointments);
  useEffect(() => {
    historyStartRef.current = historyStart;
    onAppointmentsRef.current = onAppointments;
  });

  useEffect(() => {
    const channel = `business:${businessId}`;
    let cancelled = false;
    let connected = false;
    let debounce: ReturnType<typeof setTimeout> | undefined;

    const reload = () => {
      clearTimeout(debounce);
      debounce = setTimeout(async () => {
        try {
          const rows = await loadRange<Appointment>(insforge, "appointments", businessId, historyStartRef.current);
          if (!cancelled) onAppointmentsRef.current(rows);
        } catch (error) {
          // Best effort: the next event, poll or manual refresh will try again.
          console.warn("No se pudo actualizar los turnos en vivo", error instanceof Error ? error.message : error);
        }
      }, REFRESH_DEBOUNCE_MS);
    };

    const onChange = () => reload();
    const onConnect = () => {
      connected = true;
      reload(); // Events published while the socket was down are gone: reload once.
    };
    const onDisconnect = () => {
      connected = false;
    };
    const onVisible = () => {
      if (document.visibilityState === "visible" && !connected) reload();
    };

    insforge.realtime.on("appointments_changed", onChange);
    insforge.realtime.on("connect", onConnect);
    insforge.realtime.on("disconnect", onDisconnect);
    insforge.realtime.on("connect_error", onDisconnect);
    document.addEventListener("visibilitychange", onVisible);
    const poll = setInterval(() => {
      if (document.visibilityState === "visible" && !connected) reload();
    }, POLL_INTERVAL_MS);

    void (async () => {
      try {
        if (!(await ensureFreshSession()) || cancelled) return;
        await insforge.realtime.connect();
        const response = await insforge.realtime.subscribe(channel);
        connected = response.ok && !cancelled;
      } catch {
        connected = false; // The polling fallback covers it.
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(debounce);
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
      insforge.realtime.off("appointments_changed", onChange);
      insforge.realtime.off("connect", onConnect);
      insforge.realtime.off("disconnect", onDisconnect);
      insforge.realtime.off("connect_error", onDisconnect);
      insforge.realtime.unsubscribe(channel);
    };
  }, [businessId]);
}
