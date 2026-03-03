import type { SVGProps } from "react";

export const COLUMN_ICON_OPTIONS = [
  "diamond-solid",
  "circle-solid",
  "circle-outline",
  "circle-dashed",
  "triangle-solid",
  "ring",
] as const;

export type ColumnIconKey = (typeof COLUMN_ICON_OPTIONS)[number];

export function ColumnIcon({
  icon,
  ...props
}: SVGProps<SVGSVGElement> & { icon: string }) {
  switch (icon) {
    case "diamond-solid":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
          <path d="M12 4 20 12 12 20 4 12Z" />
        </svg>
      );
    case "circle-solid":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
          <circle cx="12" cy="12" r="7" />
        </svg>
      );
    case "circle-outline":
      return (
        <svg viewBox="0 0 24 24" fill="none" {...props}>
          <circle cx="12" cy="12" r="6.5" stroke="currentColor" strokeWidth="2" />
        </svg>
      );
    case "circle-dashed":
      return (
        <svg viewBox="0 0 24 24" fill="none" {...props}>
          <circle
            cx="12"
            cy="12"
            r="6.5"
            stroke="currentColor"
            strokeWidth="2"
            strokeDasharray="3.2 2.4"
            strokeLinecap="round"
          />
        </svg>
      );
    case "triangle-solid":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
          <path d="M12 5 19 18H5Z" />
        </svg>
      );
    case "ring":
    default:
      return (
        <svg viewBox="0 0 24 24" fill="none" {...props}>
          <circle cx="12" cy="12" r="6.5" stroke="currentColor" strokeWidth="2" />
          <circle cx="12" cy="12" r="2.25" fill="currentColor" />
        </svg>
      );
  }
}
