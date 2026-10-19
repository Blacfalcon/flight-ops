'use client';

import { IMSAFE_ITEMS, type ImsafeKey } from '@/lib/constants';
import type { Imsafe } from '@/lib/rules/risk';

export function ImsafeToggles({ value, onChange }: { value: Imsafe; onChange: (v: Imsafe) => void }) {
  return (
    <div className="flex flex-col gap-2.5">
      {IMSAFE_ITEMS.map((item) => {
        const yes = value[item.key as ImsafeKey];
        const set = (v: boolean) => onChange({ ...value, [item.key]: v });
        return (
          <div key={item.key} className="flex items-center justify-between gap-3">
            <span className="font-medium">
              {item.label}
              {item.hard && <span className="ml-1 text-[12px] font-normal text-ink-muted">(a yes makes it High)</span>}
            </span>
            <span role="group" aria-label={item.label} className="inline-flex gap-1.5">
              <button
                type="button"
                aria-pressed={!yes}
                onClick={() => set(false)}
                className={`h-10 min-w-14 rounded-lg px-3 font-semibold ${!yes ? 'bg-good-fg text-white' : 'border border-[#C9D3E0] bg-white text-ink'}`}
              >
                No
              </button>
              <button
                type="button"
                aria-pressed={yes}
                onClick={() => set(true)}
                className={`h-10 min-w-14 rounded-lg px-3 font-semibold ${yes ? 'bg-bad-solid text-white' : 'border border-[#C9D3E0] bg-white text-ink'}`}
              >
                Yes
              </button>
            </span>
          </div>
        );
      })}
    </div>
  );
}

export const NO_IMSAFE: Imsafe = { illness: false, medication: false, stress: false, alcohol: false, fatigue: false, eating: false };
