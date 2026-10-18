"use client"

import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox"
import { CheckIcon } from "lucide-react"

import { cn } from "@/lib/utils"

/**
Renders a native button (role="checkbox") so it is labelable, focusable and natively disableable.
*/
function Checkbox({ className, ...props }: CheckboxPrimitive.Root.Props) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      nativeButton
      render={<button type="button" />}
      className={cn(
        "peer relative flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-[4px] border border-control-border bg-surface text-on-accent transition-colors outline-none after:absolute after:-inset-x-3 after:-inset-y-2 hover:border-studio-muted focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-[color:var(--studio-focus)] disabled:cursor-default disabled:opacity-(--studio-disabled-opacity) data-checked:border-studio-accent data-checked:bg-studio-accent data-indeterminate:border-studio-accent data-indeterminate:bg-studio-accent forced-colors:forced-color-adjust-none forced-colors:border-[CanvasText] forced-colors:data-checked:bg-[Highlight]",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator data-slot="checkbox-indicator" className="grid place-content-center text-current transition-none">
        <CheckIcon aria-hidden="true" size={12} strokeWidth={2.5} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
