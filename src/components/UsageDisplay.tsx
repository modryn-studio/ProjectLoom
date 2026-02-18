'use client';

import React, { useMemo, useState } from 'react';

import { colors, spacing, effects, typography } from '@/lib/design-tokens';
import { formatUsd, getUsageTotals, type UsageRange, useUsageStore } from '@/stores/usage-store';
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';

const selectStyles: React.CSSProperties = {
  width: '100%',
  padding: `${spacing[2]} ${spacing[3]}`,
  backgroundColor: colors.bg.inset,
  border: `1px solid ${colors.border.default}`,
  borderRadius: effects.border.radius.default,
  color: colors.fg.primary,
  fontSize: typography.sizes.sm,
  fontFamily: typography.fonts.body,
  cursor: 'pointer',
  outline: 'none',
};

const labelStyles: React.CSSProperties = {
  fontSize: typography.sizes.sm,
  color: colors.fg.secondary,
  marginBottom: spacing[1],
  fontFamily: typography.fonts.body,
};

const USAGE_RANGE_OPTIONS: Array<{ id: UsageRange; label: string }> = [
  { id: 'this_month', label: 'This Month' },
  { id: 'last_month', label: 'Last Month' },
  { id: 'year_to_date', label: 'Year to Date' },
  { id: 'all_time', label: 'All Time' },
];

export function UsageDisplay() {
  const [usageRange, setUsageRange] = useState<UsageRange>('this_month');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const usageRecords = useUsageStore((s) => s.records);
  const clearUsage = useUsageStore((s) => s.clearAll);

  const usageTotals = useMemo(() => getUsageTotals(usageRecords, usageRange), [usageRecords, usageRange]);

  return (
    <div>
      <div style={{ marginBottom: spacing[3] }}>
        <label style={labelStyles}>Time range</label>
        <select
          value={usageRange}
          onChange={(e) => setUsageRange(e.target.value as UsageRange)}
          style={selectStyles}
        >
          {USAGE_RANGE_OPTIONS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div style={{ display: 'grid', gap: spacing[2], marginBottom: spacing[3] }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: typography.sizes.sm, color: colors.fg.secondary, fontFamily: typography.fonts.body }}>
            Claude (Anthropic)
            {usageTotals.byProvider.anthropic.recordCount > 0 && (
              <span style={{ fontSize: typography.sizes.xs, opacity: 0.6, marginLeft: spacing[1] }}>
                ({usageTotals.byProvider.anthropic.recordCount})
              </span>
            )}
          </span>
          <span style={{ fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold, fontFamily: typography.fonts.code }}>
            {formatUsd(usageTotals.byProvider.anthropic.costUsd)}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: typography.sizes.sm, color: colors.fg.secondary, fontFamily: typography.fonts.body }}>
            GPT (OpenAI)
            {usageTotals.byProvider.openai.recordCount > 0 && (
              <span style={{ fontSize: typography.sizes.xs, opacity: 0.6, marginLeft: spacing[1] }}>
                ({usageTotals.byProvider.openai.recordCount})
              </span>
            )}
          </span>
          <span style={{ fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold, fontFamily: typography.fonts.code }}>
            {formatUsd(usageTotals.byProvider.openai.costUsd)}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: typography.sizes.sm, color: colors.fg.secondary, fontFamily: typography.fonts.body }}>
            Sonar (Perplexity)
            {usageTotals.byProvider.perplexity.recordCount > 0 && (
              <span style={{ fontSize: typography.sizes.xs, opacity: 0.6, marginLeft: spacing[1] }}>
                ({usageTotals.byProvider.perplexity.recordCount})
              </span>
            )}
          </span>
          <span style={{ fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold, fontFamily: typography.fonts.code }}>
            {formatUsd(usageTotals.byProvider.perplexity.costUsd)}
          </span>
        </div>
        <div style={{ borderTop: `1px solid ${colors.border.default}`, paddingTop: spacing[2], display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold, color: colors.fg.primary, fontFamily: typography.fonts.body }}>
            Total
            {usageTotals.recordCount > 0 && (
              <span style={{ fontSize: typography.sizes.xs, fontWeight: typography.weights.normal, opacity: 0.6, marginLeft: spacing[1] }}>
                ({usageTotals.recordCount} requests)
              </span>
            )}
          </span>
          <span style={{ fontSize: typography.sizes.base, fontWeight: typography.weights.bold, fontFamily: typography.fonts.code }}>
            {formatUsd(usageTotals.totalCostUsd)}
          </span>
        </div>
      </div>

      {/* Pricing disclaimer */}
      {usageTotals.recordCount > 0 && (
        <div style={{
          padding: spacing[2],
          backgroundColor: colors.bg.inset,
          borderRadius: effects.border.radius.default,
          border: `1px solid ${colors.border.default}`,
          marginBottom: spacing[3],
        }}>
          <p style={{
            fontSize: typography.sizes.xs,
            color: colors.fg.tertiary,
            margin: 0,
            fontFamily: typography.fonts.body,
          }}>
            💡 Estimated costs based on token usage. Actual charges may vary. Check your Perplexity dashboard for exact billing.
          </p>
        </div>
      )}

      <AlertDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <AlertDialogTrigger asChild>
          <button
            type="button"
            disabled={usageTotals.recordCount === 0}
            style={{
              padding: `${spacing[2]} ${spacing[3]}`,
              backgroundColor: 'transparent',
              border: `1px solid ${colors.border.default}`,
              borderRadius: effects.border.radius.default,
              color: usageTotals.recordCount === 0 ? colors.fg.tertiary : colors.fg.secondary,
              fontSize: typography.sizes.sm,
              fontFamily: typography.fonts.body,
              cursor: usageTotals.recordCount === 0 ? 'not-allowed' : 'pointer',
              opacity: usageTotals.recordCount === 0 ? 0.6 : 1,
            }}
          >
            Clear All History
          </button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear all usage history?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                clearUsage();
                setIsDialogOpen(false);
              }}
            >
              Clear History
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default UsageDisplay;
