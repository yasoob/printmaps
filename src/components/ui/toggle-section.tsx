import { memo, useId, type ReactNode } from "react"

import { Switch } from "@/app/components/UiControls"
import { cn } from "@/lib/utils"

type ToggleSectionProps = Readonly<{
  title: string
  switchLabel?: string
  checked: boolean
  onCheckedChange: (isChecked: boolean) => void
  disabled?: boolean
  help?: ReactNode
  children?: ReactNode
  className?: string
}>

// Children only render while checked, so fresh children JSX is irrelevant while the section stays off.
function isSameToggleSection(previous: ToggleSectionProps, next: ToggleSectionProps) {
  const keys = new Set([...Object.keys(previous), ...Object.keys(next)]) as Set<keyof ToggleSectionProps>
  for (const key of keys) {
    if (key === "children") continue
    if (!Object.is(previous[key], next[key])) return false
  }
  return (!previous.checked && !next.checked) || Object.is(previous.children, next.children)
}

/**
 * Sub-section heading with a trailing Switch. `switchLabel` names the switch separately from the
 * visible `title`; dependent `children` mount only while the switch is on.
 */
/**
 * Sub-section heading with a trailing Switch. `switchLabel` names the switch separately from the
 * visible `title`; dependent `children` mount only while the switch is on.
 */
export const ToggleSection = memo(function ToggleSection({ title, switchLabel, checked, onCheckedChange, disabled = false, help, children, className }: ToggleSectionProps) {
  const titleId = useId()
  return (
    <section className={cn("studio-toggle-section", className)} aria-labelledby={titleId} data-checked={checked}>
      <div className="studio-toggle-section-header">
        <h4 id={titleId} className="studio-toggle-section-title">{title}</h4>
        {help}
        <Switch
          className="studio-toggle-section-switch"
          label={switchLabel ?? title}
          labelHidden
          isChecked={checked}
          disabled={disabled}
          onCheckedChange={onCheckedChange}
        />
      </div>
      {checked && children && <div className="studio-toggle-section-body">{children}</div>}
    </section>
  )
}, isSameToggleSection)
