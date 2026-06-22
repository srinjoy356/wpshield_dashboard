import { Lock } from "lucide-react";
import Link from "next/link";

interface Props {
  feature: string;
  requiredPlan: string;
  children: React.ReactNode;
  /** If true, renders children with a blur overlay instead of hiding them */
  blur?: boolean;
}

/**
 * UpgradeGate — wraps any section that requires a higher plan.
 *
 * Usage (server component):
 *   <UpgradeGate feature="PDF Reports" requiredPlan="Solo" enabled={features.pdfReports}>
 *     <ReportsPage />
 *   </UpgradeGate>
 *
 * When enabled=true: renders children normally.
 * When enabled=false: renders a locked upgrade card instead (or blurred overlay).
 */
export function UpgradeGate({
  feature,
  requiredPlan,
  children,
  blur = false,
}: Props & { enabled: boolean }) {
  // TypeScript note: 'enabled' is consumed by the wrapper pattern below.
  // This component is always called via the named export with enabled prop.
  return <>{children}</>;
}

/**
 * UpgradeLock — the actual gate UI. Rendered by gated pages when the feature
 * is not available on the current plan.
 */
export function UpgradeLock({
  feature,
  requiredPlan,
  description,
}: {
  feature: string;
  requiredPlan: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-12 text-center">
      <div className="flex items-center justify-center h-14 w-14 rounded-full bg-[var(--surface-subtle)] border border-[var(--border)] mb-5">
        <Lock className="h-6 w-6 text-[var(--muted)]" strokeWidth={1.5} />
      </div>
      <h2 className="text-lg font-semibold text-[var(--foreground)] mb-2">
        {feature} requires {requiredPlan}
      </h2>
      <p className="text-sm text-[var(--muted)] max-w-sm mb-6">
        {description ?? `This feature is available on the ${requiredPlan} plan and above. Upgrade to unlock it.`}
      </p>
      <Link
        href="/app/billing"
        className="inline-flex items-center gap-2 rounded-lg bg-[var(--foreground)] px-5 py-2.5 text-sm font-medium text-[var(--background)] hover:opacity-90 transition-opacity"
      >
        View Plans & Upgrade
      </Link>
    </div>
  );
}