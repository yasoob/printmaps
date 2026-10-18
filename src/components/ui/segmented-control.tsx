import { Radio } from "@base-ui/react/radio"
import { RadioGroup } from "@base-ui/react/radio-group"
import type { LucideIcon } from "lucide-react"
import { memo, type KeyboardEvent } from "react"

import { cn } from "@/lib/utils"

export type SegmentedControlOption<V extends string> = Readonly<{
  value: V
  label: string
  icon?: LucideIcon
  disabled?: boolean
}>

export type SegmentedControlProps<V extends string> = Readonly<{
  /**
  Accessible name of the radio group.
  */
  label: string
  value: V
  options: readonly SegmentedControlOption<V>[]
  onValueChange: (value: V) => void
  disabled?: boolean
  className?: string
}>

/**
 * Single-choice segmented control with radio-group semantics and roving arrow-key focus.
 * Shares the `.studio-segmented` visual with StudioModeTabs (tab semantics) and legacy `.segmented`.
 */
export const SegmentedControl = memo(function SegmentedControl<V extends string>({
  label, value, options, onValueChange, disabled = false, className,
}: SegmentedControlProps<V>) {
  // Base UI's radio group roves with arrows only; Home/End select the first/last enabled option.
  const selectEdge = (event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled || (event.key !== "Home" && event.key !== "End")) return
    const enabled = options.map((option, index) => ({ option, index })).filter(({ option }) => !option.disabled)
    const target = event.key === "Home" ? enabled[0] : enabled.at(-1)
    if (!target) return
    event.preventDefault()
    if (target.option.value !== value) onValueChange(target.option.value)
    event.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]')[target.index]?.focus()
  }
  return (
    <RadioGroup
      aria-label={label}
      onKeyDown={selectEdge}
      className={cn("studio-segmented", className)}
      value={value}
      disabled={disabled}
      onValueChange={(next) => {
        if (next !== value) onValueChange(next as V)
      }}
    >
      {options.map(({ value: optionValue, label: optionLabel, icon: Icon, disabled: optionDisabled }) => (
        <Radio.Root
          key={optionValue}
          value={optionValue}
          disabled={optionDisabled}
          nativeButton
          render={<button type="button" />}
        >
          {Icon && <Icon aria-hidden="true" size={16} strokeWidth={1.75} />}
          <span className="studio-segmented-label">{optionLabel}</span>
        </Radio.Root>
      ))}
    </RadioGroup>
  )
}) as <V extends string>(props: SegmentedControlProps<V>) => React.JSX.Element
