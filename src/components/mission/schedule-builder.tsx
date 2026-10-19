'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/client/api';
import { eligibleForSeat, validateCrew, type CrewMember } from '@/lib/rules/pairing';
import { AIRCRAFT_STATUS_LABEL, MISSION_CATEGORIES, MISSION_CATEGORY_LABEL, MISSION_TYPES, ORDER_STATUS_LABEL, PRIORITY_LABEL, SEATS, SEAT_LABEL, type AircraftStatusValue, type MissionCategoryValue, type SeatValue } from '@/lib/constants';
import { Field, FormError, useSubmit } from '../form';
import { formatHours } from '@/lib/hours';

export type Pilot = { id: string; name: string; flightStatus: CrewMember['flightStatus']; pilotCategory: CrewMember['pilotCategory'] };

type Initial = {
  id?: string;
  date: string;
  category: MissionCategoryValue;
  type: string;
  name: string;
  aircraftId: string;
  briefingTime: string;
  takeoffTime: string;
  landingTime: string;
  crew: Partial<Record<SeatValue, string>>;
  order: { taskDescription: string; objectives: string; priority: 'ROUTINE' | 'PRIORITY' | 'IMMEDIATE'; operationalRemarks: string };
  orderNo?: string;
  orderStatus?: string;
};

type ServiceabilityItem = {
  aircraft: { id: string; registration: string; status: string; hoursToNextInspection: string | number };
  check: { status: string } | null;
};

export function ScheduleBuilder({ initial, pilots, canOperational }: { initial: Initial; pilots: Pilot[]; canOperational: boolean }) {
  const s = useSubmit();
  const [v, setV] = useState<Initial>(initial);
  const [fleet, setFleet] = useState<ServiceabilityItem[] | null>(null);
  const set = <K extends keyof Initial>(k: K, val: Initial[K]) => setV((x) => ({ ...x, [k]: val }));
  const setOrder = (k: keyof Initial['order'], val: string) => setV((x) => ({ ...x, order: { ...x.order, [k]: val } as Initial['order'] }));
  const setCategory = (c: MissionCategoryValue) => setV((x) => ({ ...x, category: c, type: MISSION_TYPES[c].some((t) => t.code === x.type) ? x.type : '' }));
  const setSeat = (seat: SeatValue, userId: string) => setV((x) => ({ ...x, crew: { ...x.crew, [seat]: userId || undefined } }));

  useEffect(() => {
    let live = true;
    setFleet(null);
    api<{ items: ServiceabilityItem[] }>(`serviceability/${v.date}`)
      .then((r) => live && setFleet(r.items))
      .catch(() => live && setFleet([]));
    return () => {
      live = false;
    };
  }, [v.date]);

  const crew: CrewMember[] = useMemo(
    () =>
      (Object.entries(v.crew) as Array<[SeatValue, string | undefined]>)
        .filter(([, id]) => !!id)
        .map(([seat, id]) => {
          const p = pilots.find((x) => x.id === id)!;
          return { seat, userId: id!, flightStatus: p?.flightStatus ?? 'NONE', pilotCategory: p?.pilotCategory ?? 'NIL', name: p?.name };
        }),
    [v.crew, pilots],
  );
  const crewErrors = validateCrew(crew);
  const crewErr = (field: string) => crewErrors.find((e) => e.field === field)?.message ?? s.fields[field];

  const timeErrors: Record<string, string> = {};
  if (v.briefingTime && v.takeoffTime && v.briefingTime >= v.takeoffTime) timeErrors.briefingTime = 'Briefing must be before take-off.';
  if (v.takeoffTime && v.landingTime && v.takeoffTime >= v.landingTime) timeErrors.landingTime = 'Landing must be after take-off.';

  const selected = fleet?.find((f) => f.aircraft.id === v.aircraftId);
  const plannedHours = v.takeoffTime && v.landingTime ? (toMin(v.landingTime) - toMin(v.takeoffTime)) / 60 : 0;
  const aircraftOk = !!selected && selected.check?.status === 'SERVICEABLE' && selected.aircraft.status === 'SERVICEABLE';
  const hoursOk = !!selected && Number(selected.aircraft.hoursToNextInspection) >= plannedHours;
  const canSave = !crewErrors.length && !Object.keys(timeErrors).length && !!v.aircraftId && !!v.type && !!v.name.trim() && !!v.order.taskDescription.trim() && !!v.order.objectives.trim();

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const crewList = crew.map((c) => ({ seat: c.seat, userId: c.userId }));
    const body = {
      date: v.date,
      category: v.category,
      type: v.type,
      name: v.name,
      aircraftId: v.aircraftId,
      briefingTime: v.briefingTime,
      takeoffTime: v.takeoffTime,
      landingTime: v.landingTime,
      crew: crewList,
      order: { ...v.order, operationalRemarks: v.order.operationalRemarks.trim() || undefined },
    };
    const res = await s.run(() => (v.id ? api<{ id: string }>(`missions/${v.id}`, { method: 'PATCH', body }) : api<{ id: string }>('missions', { body })));
    if (res) window.location.href = `/schedule?date=${v.date}`;
  }

  const categories = MISSION_CATEGORIES.filter((c) => canOperational || c === 'TRAINING');
  const types = MISSION_TYPES[v.category];

  return (
    <div className="flex flex-wrap items-start gap-6">
      <form onSubmit={save} className="card flex min-w-0 flex-[2_1_560px] flex-col gap-6 px-6 pb-6 pt-5">
        <FormError error={s.error} />
        <fieldset className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
          <legend className="mb-3 text-base font-semibold">Mission</legend>
          <Field id="date" label="Date" error={s.fields.date}>
            <input id="date" type="date" className="input" value={v.date} onChange={(e) => set('date', e.target.value)} required />
          </Field>
          <Field id="category" label="Category" error={s.fields.category}>
            <select id="category" className="input" value={v.category} onChange={(e) => setCategory(e.target.value as MissionCategoryValue)}>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {MISSION_CATEGORY_LABEL[c]}
                </option>
              ))}
            </select>
          </Field>
          <Field id="type" label="Mission type" error={s.fields.type}>
            <select id="type" className="input" value={v.type} onChange={(e) => set('type', e.target.value)} required>
              <option value="">Choose a {MISSION_CATEGORY_LABEL[v.category].toLowerCase()} type</option>
              {types.map((t) => (
                <option key={t.code} value={t.code}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>
          <Field id="name" label="Mission name" error={s.fields.name} hint="A short name, for example “Local area familiarisation”.">
            <input id="name" className="input" value={v.name} onChange={(e) => set('name', e.target.value)} required />
          </Field>
          <Field id="aircraftId" label="Aircraft" error={s.fields.aircraftId ?? (selected && !aircraftOk ? 'Not confirmed serviceable for this date; the mission will wait for engineering.' : selected && !hoursOk ? 'Not enough hours left before inspection for this sortie.' : undefined)}>
            <select id="aircraftId" className={`input ${selected && (!aircraftOk || !hoursOk) ? 'input-error' : ''}`} value={v.aircraftId} onChange={(e) => set('aircraftId', e.target.value)} required>
              <option value="">{fleet === null ? 'Loading…' : 'Choose an aircraft'}</option>
              {(fleet ?? []).map(({ aircraft: a, check }) => {
                const confirmed = check?.status === 'SERVICEABLE' && a.status === 'SERVICEABLE';
                const label = confirmed
                  ? `${a.registration} · Serviceable · ${formatHours(a.hoursToNextInspection)} to insp.`
                  : `${a.registration} · ${check ? AIRCRAFT_STATUS_LABEL[check.status as AircraftStatusValue] : 'Not confirmed'}`;
                const blocked = a.status !== 'SERVICEABLE' || (check != null && check.status !== 'SERVICEABLE');
                return (
                  <option key={a.id} value={a.id} disabled={blocked}>
                    {label}
                  </option>
                );
              })}
            </select>
          </Field>
        </fieldset>

        <fieldset className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
          <legend className="mb-1 text-base font-semibold">Crew</legend>
          <p className="col-span-full text-[13px] text-ink-muted">Each list only shows people whose flight status and pilot category fit that seat. Leave unused seats as “— none —”.</p>
          {SEATS.map((seat) => {
            const err = crewErr(`crew.${seat}`);
            const taken = new Set(Object.entries(v.crew).filter(([k, id]) => k !== seat && id).map(([, id]) => id));
            return (
              <Field key={seat} id={`seat-${seat}`} label={SEAT_LABEL[seat]} error={err}>
                <select id={`seat-${seat}`} className={`input ${err ? 'input-error' : ''}`} value={v.crew[seat] ?? ''} onChange={(e) => setSeat(seat, e.target.value)}>
                  <option value="">— none —</option>
                  {pilots
                    .filter((p) => eligibleForSeat(seat, p) && !taken.has(p.id))
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                </select>
              </Field>
            );
          })}
          {crewErrors.some((e) => e.field === 'crew') && <p className="field-error col-span-full">{crewErrors.find((e) => e.field === 'crew')!.message}</p>}
        </fieldset>

        <fieldset className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-4">
          <legend className="mb-3 text-base font-semibold">Times (local)</legend>
          <Field id="briefingTime" label="Briefing" error={timeErrors.briefingTime ?? s.fields.briefingAt}>
            <input id="briefingTime" type="time" className="input" value={v.briefingTime} onChange={(e) => set('briefingTime', e.target.value)} required />
          </Field>
          <Field id="takeoffTime" label="Take-off" error={s.fields.takeoffAt}>
            <input id="takeoffTime" type="time" className="input" value={v.takeoffTime} onChange={(e) => set('takeoffTime', e.target.value)} required />
          </Field>
          <Field id="landingTime" label="Landing" error={timeErrors.landingTime ?? s.fields.landingAt}>
            <input id="landingTime" type="time" className="input" value={v.landingTime} onChange={(e) => set('landingTime', e.target.value)} required />
          </Field>
        </fieldset>

        <fieldset className="flex flex-col gap-4">
          <legend className="mb-1 text-base font-semibold">
            Mission order{v.orderNo ? ` ${v.orderNo}` : ''}
            {v.orderStatus && <span className="ml-2 align-middle text-[13px] font-normal text-ink-muted">({ORDER_STATUS_LABEL[v.orderStatus]})</span>}
          </legend>
          <p className="text-[13px] text-ink-muted">
            Saving sends the order to CO Flying Wing and the Commander; either one can approve it. The Operations Officer publishes the sortie after approval. Changing an approved order, or the sortie’s aircraft, times or crew, sends it back for approval.
          </p>
          <Field id="taskDescription" label="Task" error={s.fields['order.taskDescription']}>
            <textarea id="taskDescription" rows={3} className="textarea" value={v.order.taskDescription} onChange={(e) => setOrder('taskDescription', e.target.value)} required />
          </Field>
          <Field id="objectives" label="Objectives" error={s.fields['order.objectives']}>
            <textarea id="objectives" rows={3} className="textarea" value={v.order.objectives} onChange={(e) => setOrder('objectives', e.target.value)} required />
          </Field>
          <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
            <Field id="priority" label="Priority">
              <select id="priority" className="input" value={v.order.priority} onChange={(e) => setOrder('priority', e.target.value)}>
                {(['ROUTINE', 'PRIORITY', 'IMMEDIATE'] as const).map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_LABEL[p]}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="operationalRemarks" label="Operational remarks (optional)" error={s.fields['order.operationalRemarks']}>
              <input id="operationalRemarks" className="input" value={v.order.operationalRemarks} onChange={(e) => setOrder('operationalRemarks', e.target.value)} />
            </Field>
          </div>
        </fieldset>

        <div className="flex flex-wrap justify-end gap-2.5">
          <a href={`/schedule?date=${v.date}`} className="btn-secondary">
            Cancel
          </a>
          <button className="btn-primary" disabled={!canSave || s.busy}>
            {s.busy ? 'Saving…' : v.id ? 'Save changes' : 'Schedule and send order for approval'}
          </button>
        </div>
      </form>

      <aside aria-label="Checks" className="flex min-w-0 flex-[1_1_300px] flex-col gap-4">
        <div className="card flex flex-col gap-3 p-5">
          <h2>Checks</h2>
          <Check ok={aircraftOk} text={selected ? (aircraftOk ? `${selected.aircraft.registration} confirmed serviceable` : `${selected.aircraft.registration} not confirmed serviceable`) : 'Choose an aircraft'} />
          <Check ok={!!selected && hoursOk} text={selected ? `${formatHours(selected.aircraft.hoursToNextInspection)} to inspection; sortie ${plannedHours > 0 ? formatHours(plannedHours) : '—'}` : 'Hours to inspection'} />
          <Check ok={!crewErrors.length} text={crewErrors.length ? crewErrors[0].message : 'Crew pairing valid'} />
          <Check ok={!Object.keys(timeErrors).length} text={Object.values(timeErrors)[0] ?? 'Times in order'} />
          <p className="text-[12px] text-ink-muted">Overlaps with other missions are checked when you save.</p>
        </div>
        <div className="card flex flex-col gap-2 p-5 text-[13px]">
          <h2 className="mb-1">Pairing rules</h2>
          <div>Trainee Pilot → must fly with an Instructor Pilot.</div>
          <div>Co-Pilot → must fly with an Instructor Pilot or a Captain.</div>
        </div>
      </aside>
    </div>
  );
}

function toMin(t: string) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function Check({ ok, text }: { ok: boolean; text: string }) {
  return (
    <div className="flex items-start gap-2.5 text-[13px]">
      <span aria-hidden="true" className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[12px] font-bold ${ok ? 'bg-good-bg text-good-fg' : 'bg-bad-bg text-bad-fg'}`}>
        {ok ? '✓' : '!'}
      </span>
      <span className={ok ? '' : 'text-bad-fg'}>{text}</span>
    </div>
  );
}
