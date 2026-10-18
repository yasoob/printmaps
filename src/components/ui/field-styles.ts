/**
 * One field surface for every text-like control (Input, InputGroup, Select trigger, ColorField):
 * borderless field fill, hairline on hover, 32px desktop / 44px touch, 13px text.
 */
export const fieldSurfaceClassName =
  "rounded-field border border-transparent bg-field text-control text-ink transition-colors outline-none hover:border-line-hover aria-invalid:border-danger data-[invalid]:border-danger disabled:cursor-default disabled:opacity-(--studio-disabled-opacity) data-disabled:cursor-default data-disabled:opacity-(--studio-disabled-opacity)"

export const fieldHeightClassName = "h-control touch:h-touch"

/** Floating surfaces (select popup, popover, help): raised surface, hairline border, soft elevation. */
export const floatingSurfaceClassName =
  "rounded-control border border-line-strong bg-popover text-popover-foreground shadow-[0_4px_12px_color-mix(in_srgb,var(--studio-text)_10%,transparent)] outline-none"
