export type AnalyticsEvent = string;
export type Props = Record<string, unknown>;
export function track(event: AnalyticsEvent, props: Props = {}): void {
  // MVP shim; replace with real sink later.
  if (typeof console !== "undefined") console.debug("[analytics]", event, props);
}
// lint-ok-195825
