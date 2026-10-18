import { memo } from "react"

import { cn } from "@/lib/utils"

export type ColorFieldProps = Readonly<{
  value: string
  onChange: (value: string) => void
  /**
  Accessible name for the color input.
  */
  label: string
  disabled?: boolean
  id?: string
  className?: string
}>

function displayHex(value: string) {
  return value.trim().toUpperCase()
}

/**
Compact field-fill color control: swatch plus hex value, opening the platform color picker.
*/
export const ColorField = memo(function ColorField({ value, onChange, label, disabled = false, id, className }: ColorFieldProps) {
  return (
    <label className={cn("studio-color-field", className)} data-disabled={disabled || undefined}>
      <input
        id={id}
        className="studio-color-field-native"
        aria-label={label}
        type="color"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
      <span className="studio-color-field-swatch" aria-hidden="true" style={{ backgroundColor: value }} />
      <span className="studio-color-field-value" aria-hidden="true">{displayHex(value)}</span>
    </label>
  )
})
