'use client';

/**
 * Usage Store
 * 
 * Tracks AI usage records and persists them in localStorage.
 * Used for the usage dashboard in Settings.
 * 
 * @version 1.0.0
 */

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { nanoid } from 'nanoid';

import { STORAGE_KEYS } from '@/lib/storage';
import { calculateCost } from '@/lib/vercel-ai-integration';

// =============================================================================
// TYPES
// =============================================================================

export type UsageProvider = 'anthropic' | 'openai';
export type UsageSource = 'chat' | 'agent' | 'summarize' | 'embeddings';

export type UsageRange = 'this_month' | 'last_month' | 'year_to_date' | 'all_time';

export interface UsageRecord {
  id: string;
  provider: UsageProvider;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd: number;
  createdAt: number;
  conversationId?: string;
  source?: UsageSource;
}

export interface UsageInput {
  provider: UsageProvider;
  model: string;
  inputTokens: number;
  outputTokens: number;
  conversationId?: string;
  source?: UsageSource;
  createdAt?: number;
}

export interface UsageTotals {
  totalCostUsd: number;
  totalTokens: number;
  recordCount: number;
  byProvider: Record<UsageProvider, {
    costUsd: number;
    totalTokens: number;
    recordCount: number;
  }>;
}

interface UsageState {
  records: UsageRecord[];
  addUsage: (input: UsageInput) => void;
  clearAll: () => void;
}

// =============================================================================
// HELPERS
// =============================================================================

export function formatUsd(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function getUsageRangeBounds(range: UsageRange, now = new Date()): { start: number | null; end: number | null } {
  const year = now.getFullYear();
  const month = now.getMonth();

  switch (range) {
    case 'this_month':
      return { start: new Date(year, month, 1).getTime(), end: now.getTime() };
    case 'last_month': {
      const start = new Date(year, month - 1, 1).getTime();
      const end = new Date(year, month, 1).getTime();
      return { start, end };
    }
    case 'year_to_date':
      return { start: new Date(year, 0, 1).getTime(), end: now.getTime() };
    case 'all_time':
    default:
      return { start: null, end: null };
  }
}

export function filterUsageRecords(records: UsageRecord[], range: UsageRange, now = new Date()): UsageRecord[] {
  const { start, end } = getUsageRangeBounds(range, now);

  if (start === null && end === null) return records;

  return records.filter((record) => {
    if (start !== null && record.createdAt < start) return false;
    if (end !== null && record.createdAt >= end) return false;
    return true;
  });
}

export function getUsageTotals(records: UsageRecord[], range: UsageRange, now = new Date()): UsageTotals {
  const filtered = filterUsageRecords(records, range, now);

  const totals: UsageTotals = {
    totalCostUsd: 0,
    totalTokens: 0,
    recordCount: filtered.length,
    byProvider: {
      anthropic: { costUsd: 0, totalTokens: 0, recordCount: 0 },
      openai: { costUsd: 0, totalTokens: 0, recordCount: 0 },
    },
  };

  for (const record of filtered) {
    totals.totalCostUsd += record.costUsd;
    totals.totalTokens += record.totalTokens;
    totals.byProvider[record.provider].costUsd += record.costUsd;
    totals.byProvider[record.provider].totalTokens += record.totalTokens;
    totals.byProvider[record.provider].recordCount += 1;
  }

  return totals;
}

// =============================================================================
// STORE
// =============================================================================

export const useUsageStore = create<UsageState>()(
  persist(
    (set) => ({
      records: [],
      addUsage: (input) => {
        const totalTokens = input.inputTokens + input.outputTokens;
        if (totalTokens <= 0) return;

        const record: UsageRecord = {
          id: nanoid(10),
          provider: input.provider,
          model: input.model,
          inputTokens: input.inputTokens,
          outputTokens: input.outputTokens,
          totalTokens,
          costUsd: calculateCost(input.model, input.inputTokens, input.outputTokens),
          createdAt: input.createdAt ?? Date.now(),
          conversationId: input.conversationId,
          source: input.source,
        };

        set((state) => ({
          records: [record, ...state.records],
        }));
      },
      clearAll: () => set({ records: [] }),
    }),
    {
      name: STORAGE_KEYS.USAGE,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ records: state.records }),
    }
  )
);

export default useUsageStore;
