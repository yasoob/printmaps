import { memo, type InputHTMLAttributes } from "react"

import { cn } from "@/lib/utils"
import { fieldHeightClassName, fieldSurfaceClassName } from "./field-styles"

export type ColorFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type" | "className"> & Readonly<{
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
Field-styled color trigger (same surface as Input/Select): bordered swatch plus uppercase hex value.
The transparent native color input covers the field, so the platform picker opens on click/Enter.
*/
export const ColorField = memo(function ColorField({ value, onChange, label, disabled = false, id, className, ...inputProps }: ColorFieldProps) {
  return (
    <label
      className={cn(
        fieldSurfaceClassName,
        fieldHeightClassName,
        "studio-color-field relative flex w-full min-w-0 cursor-pointer items-center gap-2 pr-2 pl-1.5 has-[:focus-visible]:outline-2 has-[:focus-visible]:-outline-offset-1 has-[:focus-visible]:outline-[var(--studio-focus)] data-[disabled]:cursor-default data-[disabled]:opacity-(--studio-disabled-opacity) data-[disabled]:hover:border-transparent",
        className
      )}
      data-disabled={disabled || undefined}
    >
      <input
        {...inputProps}
        id={id}
        className="studio-color-field-native absolute inset-0 m-0 size-full cursor-[inherit] border-0 p-0 opacity-0 focus-visible:outline-none"
        aria-label={label}
        type="color"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
      <span
        className="studio-color-field-swatch size-5 flex-none rounded-field border border-swatch-border forced-colors:forced-color-adjust-none forced-colors:border-[CanvasText]"
        aria-hidden="true"
        style={{ backgroundColor: value }}
      />
      <span className="studio-color-field-value min-w-0 truncate tabular-nums tracking-[0.01em]" aria-hidden="true">{displayHex(value)}</span>
    </label>
  )
})
