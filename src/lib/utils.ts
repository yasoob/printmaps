import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

// Studio theme keys from src/theme.css, so `text-control` (size) and `text-ink` (color) never collapse.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ["control", "label", "meta"],
      radius: ["field", "control"],
      spacing: ["control", "touch", "topbar", "panel-left", "panel-right"],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
