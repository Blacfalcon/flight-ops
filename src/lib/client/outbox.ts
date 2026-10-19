'use client';

import { api, isNetworkError } from './api';

// Offline outbox. Flight-line forms are saved on the device when there is no signal and sent in order
// when the connection returns. Each item has a unique id so the server never saves it twice.

export type OutboxType = 'readiness' | 'risk.submit' | 'imsafe' | 'flightplan.save' | 'report.submit' | 'snag.raise' | 'safety.raise';

export type OutboxItem = {
  clientOpId: string;
  type: OutboxType;
  target?: string;
  payload: unknown;
  createdAt: string;
  label: string; // shown to the person while waiting
  lastError?: string;
};

const DB = 'flight-ops-outbox';
const STORE = 'ops';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'clientOpId' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const r = fn(t.objectStore(STORE));
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

export async function listOutbox(): Promise<OutboxItem[]> {
  const items = await tx<OutboxItem[]>('readonly', (s) => s.getAll() as IDBRequest<OutboxItem[]>);
  return items.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

async function put(item: OutboxItem) {
  await tx('readwrite', (s) => s.put(item));
  window.dispatchEvent(new Event('outbox-changed'));
}

async function remove(id: string) {
  await tx('readwrite', (s) => s.delete(id));
  window.dispatchEvent(new Event('outbox-changed'));
}

function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Send now if possible; if the network is down, keep it in the outbox.
 * Server refusals (validation, permissions) are thrown to the form, never queued.
 */
export async function submitOrQueue(
  type: OutboxType,
  target: string | undefined,
  payload: unknown,
  label: string,
  sendNow: () => Promise<unknown>,
): Promise<{ queued: boolean; result?: unknown }> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    await put({ clientOpId: newId(), type, target, payload, createdAt: new Date().toISOString(), label });
    return { queued: true };
  }
  try {
    return { queued: false, result: await sendNow() };
  } catch (err) {
    if (isNetworkError(err)) {
      await put({ clientOpId: newId(), type, target, payload, createdAt: new Date().toISOString(), label });
      return { queued: true };
    }
    throw err;
  }
}

let flushing = false;

/** Send everything waiting. Returns items the server refused, so the person can be told why. */
export async function flushOutbox(): Promise<Array<{ label: string; message: string }>> {
  if (flushing || (typeof navigator !== 'undefined' && !navigator.onLine)) return [];
  flushing = true;
  const refused: Array<{ label: string; message: string }> = [];
  try {
    const items = await listOutbox();
    if (!items.length) return [];
    const res = await api<{ results: Array<{ clientOpId: string; ok: boolean; error?: { code: string; message: string } }> }>('sync', {
      body: { ops: items.map(({ clientOpId, type, target, payload, createdAt }) => ({ clientOpId, type, target, payload, createdAt })) },
    });
    for (const r of res.results) {
      const item = items.find((i) => i.clientOpId === r.clientOpId);
      if (!item) continue;
      if (r.ok) await remove(item.clientOpId);
      else if (r.error?.code === 'server_error') await put({ ...item, lastError: r.error.message });
      else {
        refused.push({ label: item.label, message: r.error?.message ?? 'Refused' });
        await remove(item.clientOpId);
      }
    }
  } catch {
    // Still offline or the server is unreachable; try again later
  } finally {
    flushing = false;
  }
  return refused;
}
