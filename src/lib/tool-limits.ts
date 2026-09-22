/**
 * Free guest tools on the public site are limited to a flat daily budget
 * (per browser and per IP). No per-minute burst cap: the daily ceiling is the
 * only limit guests see, so the demo's "N of 10 captures left today" is
 * always accurate.
 */
export const TOOL_GUEST_DAILY_LIMIT = 10;
