import { useState } from "react";
import { CalendarDays, Check } from "lucide-react";
import { getSlotOccupancy, type Appointment, type ServiceAvailabilitySlot } from "@/lib/citadely-db";
import { monthDays, type DateTimes, type MonthOption } from "@/lib/service-availability";
import { toDateKey, toTimeKey, zonedTimeToUtc } from "@/lib/time";

/** Month calendar + time/capacity list that edits the {day: {time: capacity}} draft of a service. */
export function AvailabilityEditor({
  appointments,
  availabilitySlots,
  dateTimes,
  editingServiceId,
  onChange,
  onError,
  onMonthChange,
  options,
  selectedMonth,
  timeZone,
}: {
  appointments: Appointment[];
  availabilitySlots: ServiceAvailabilitySlot[];
  dateTimes: DateTimes;
  editingServiceId: string | null;
  onChange: (next: DateTimes | ((current: DateTimes) => DateTimes)) => void;
  onError: (message: string | null) => void;
  onMonthChange: (month: string) => void;
  options: MonthOption[];
  selectedMonth: string;
  timeZone: string;
}) {
  const [selectedDate, setSelectedDate] = useState("");
  const [draftTime, setDraftTime] = useState("");
  const todayKey = toDateKey(new Date(), timeZone);

  function addTime() {
    if (!selectedDate || !draftTime) {
      onError("Elegí un día y una hora para preparar la disponibilidad.");
      return;
    }
    if (zonedTimeToUtc(selectedDate, draftTime, timeZone).getTime() <= Date.now()) {
      onError("Ese horario ya pasó. Elegí un horario futuro.");
      return;
    }
    onError(null);
    onChange((current) => ({ ...current, [selectedDate]: { ...(current[selectedDate] ?? {}), [draftTime]: current[selectedDate]?.[draftTime] ?? 1 } }));
    setDraftTime("");
  }

  function removeTime(day: string, time: string) {
    onChange((current) => {
      const next = { ...current };
      const remaining = { ...(next[day] ?? {}) };
      delete remaining[time];
      if (Object.keys(remaining).length) next[day] = remaining;
      else delete next[day];
      return next;
    });
  }

  function changeCapacity(day: string, time: string, value: number) {
    onChange((current) => ({
      ...current,
      [day]: { ...(current[day] ?? {}), [time]: value },
    }));
  }

  return (
    <section className="grid gap-4">
      <div className="flex items-center gap-2 border-b border-line pb-3"><CalendarDays aria-hidden="true" className="text-primary" size={18} /><h3 className="font-semibold">Disponibilidad mensual</h3></div>
      <label className="form-label">Mes<select className="form-control capitalize" onChange={(event) => { onMonthChange(event.target.value); setSelectedDate(""); }} value={selectedMonth}>{options.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}</select></label>
      <div className="calendar-month">
        {['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map((day) => <span className="calendar-weekday" key={day}>{day}</span>)}
        {monthDays(selectedMonth).map((day) => day.blank ? <span key={day.key} /> : (
          <button aria-pressed={selectedDate === day.key} disabled={day.key < todayKey} title={day.key < todayKey ? "Este día ya pasó" : undefined} className={selectedDate === day.key ? "is-selected" : Object.keys(dateTimes[day.key] ?? {}).length ? "has-slots" : ""} key={day.key} onClick={() => setSelectedDate(day.key)} type="button"><strong>{day.day}</strong><small>{day.weekday}</small>{Object.keys(dateTimes[day.key] ?? {}).length ? <span><Check aria-hidden="true" size={11} />{Object.keys(dateTimes[day.key]).length}</span> : null}</button>
        ))}
      </div>
      <div className="border border-line bg-surface-subtle p-4">
        <p className="text-sm font-semibold">{selectedDate ? `Horarios para ${selectedDate}` : "Elegí un día del calendario"}</p>
        <div className="mt-3 flex gap-2"><label className="sr-only" htmlFor="service-time">Hora</label><input className="form-control" disabled={!selectedDate} id="service-time" onChange={(event) => setDraftTime(event.target.value)} type="time" value={draftTime} /><button className="button-secondary" disabled={!selectedDate || !draftTime} onClick={addTime} type="button">Agregar</button></div>
        <div className="mt-3 grid gap-2">{selectedDate && !Object.keys(dateTimes[selectedDate] ?? {}).length ? <span className="text-sm text-ink-muted">Sin horarios para este día.</span> : null}{Object.entries(dateTimes[selectedDate] ?? {}).sort(([left], [right]) => left.localeCompare(right)).map(([time, capacity]) => {
          const existing = availabilitySlots.find((slot) => editingServiceId && slot.service_id === editingServiceId && toDateKey(slot.starts_at, timeZone) === selectedDate && toTimeKey(slot.starts_at, timeZone) === time);
          const booked = existing ? getSlotOccupancy(existing, appointments).booked : 0;
          return <div className="flex flex-wrap items-center gap-3 border-b border-line py-2 last:border-0" key={time}>
            <span className="min-w-16 font-mono text-sm font-semibold">{time}</span>
            <label className="flex items-center gap-2 text-sm" htmlFor={`capacity-${selectedDate}-${time}`}>Cupo
              <input className="form-control w-24 tabular-nums" id={`capacity-${selectedDate}-${time}`} max={1000} min={Math.max(1, booked)} onChange={(event) => changeCapacity(selectedDate, time, Number(event.target.value))} required type="number" value={capacity} />
            </label>
            {booked > 0 ? <span className="text-xs text-ink-soft">{booked} {booked === 1 ? "reserva" : "reservas"}</span> : null}
            <button aria-label={`Quitar horario ${time}`} className="button-secondary ml-auto" disabled={booked > 0} onClick={() => removeTime(selectedDate, time)} type="button">Quitar</button>
          </div>;
        })}</div>
      </div>
    </section>
  );
}
