import type { LucideIcon } from "lucide-react"
import { memo, type KeyboardEvent } from "react"

import { cn } from "@/lib/utils"
import { ToggleGroup, ToggleGroupItem } from "./toggle-group"

export type SegmentedControlOption<V extends string> = Readonly<{
  value: V
  label: string
  icon?: LucideIcon
  disabled?: boolean
}>

export type SegmentedControlProps<V extends string> = Readonly<{
  /** Accessible name of the radio group. */
  label: string
  value: V
  options: readonly SegmentedControlOption<V>[]
  onValueChange: (value: V) => void
  disabled?: boolean
  className?: string
}>

const navigationKeys = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"])

type BaseUIKeyboardEvent = KeyboardEvent<HTMLDivElement> & { preventBaseUIHandler?: () => void }

/**
 * Single-choice segmented control built on shadcn ToggleGroup, exposed with radio-group semantics:
 * role="radiogroup"/"radio" + aria-checked, the selected option is the tab stop, and arrow keys and
 * Home/End move selection with focus. Shares the `.studio-segmented` visual with StudioModeTabs.
 */
export const SegmentedControl = memo(function SegmentedControl<V extends string>({
  label, value, options, onValueChange, disabled = false, className,
}: SegmentedControlProps<V>) {
  const enabledIndexes = options.flatMap((option, index) => (option.disabled ? [] : [index]))
  const selectedIndex = options.findIndex((option) => option.value === value)
  const tabStopIndex = enabledIndexes.includes(selectedIndex) ? selectedIndex : enabledIndexes[0]

  const moveSelection = (event: BaseUIKeyboardEvent) => {
    if (!navigationKeys.has(event.key)) return
    // Radio semantics: selection follows focus, so replace ToggleGroup's focus-only roving.
    event.preventBaseUIHandler?.()
    event.preventDefault()
    if (disabled || enabledIndexes.length === 0) return
    const position = Math.max(0, enabledIndexes.indexOf(selectedIndex))
    const step = event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1
    const targetIndex = event.key === "Home"
      ? enabledIndexes[0]!
      : event.key === "End"
        ? enabledIndexes.at(-1)!
        : enabledIndexes[(position + step + enabledIndexes.length) % enabledIndexes.length]!
    const target = options[targetIndex]!
    if (target.value !== value) onValueChange(target.value)
    event.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]')[targetIndex]?.focus()
  }

  return (
    <ToggleGroup
      role="radiogroup"
      aria-label={label}
      aria-disabled={disabled || undefined}
      className={cn("studio-segmented", className)}
      spacing={0}
      value={[value]}
      disabled={disabled}
      onKeyDown={moveSelection}
      onValueChange={(next) => {
        const [nextValue] = next as V[]
        if (nextValue !== undefined && nextValue !== value) onValueChange(nextValue)
      }}
    >
      {options.map(({ value: optionValue, label: optionLabel, icon: Icon, disabled: optionDisabled }, index) => (
        <ToggleGroupItem
          key={optionValue}
          value={optionValue}
          disabled={optionDisabled}
          role="radio"
          aria-checked={optionValue === value}
          aria-pressed={undefined}
          tabIndex={index === tabStopIndex ? 0 : -1}
        >
          {Icon && <Icon aria-hidden="true" size={16} strokeWidth={1.75} />}
          <span className="studio-segmented-label">{optionLabel}</span>
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}) as <V extends string>(props: SegmentedControlProps<V>) => React.JSX.Element
