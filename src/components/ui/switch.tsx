import { Switch as SwitchPrimitive } from "@base-ui/react/switch"

import { cn } from "@/lib/utils"

/** Renders a native button (role="switch") so it is labelable, focusable and natively disableable. */
function Switch({ className, size = "default", ...props }: SwitchPrimitive.Root.Props & { size?: "sm" | "default" }) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      nativeButton
      render={<button type="button" />}
      className={cn(
        "peer group/switch relative inline-flex shrink-0 cursor-pointer items-center rounded-full border border-transparent p-px transition-colors outline-none after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--studio-focus)] data-[size=default]:h-[18px] data-[size=default]:w-8 data-[size=sm]:h-3.5 data-[size=sm]:w-6 data-checked:bg-studio-accent data-unchecked:bg-switch-off data-unchecked:hover:bg-switch-off-hover disabled:cursor-default disabled:opacity-(--studio-disabled-opacity) forced-colors:forced-color-adjust-none forced-colors:border-[CanvasText] forced-colors:data-checked:bg-[Highlight]",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block rounded-full bg-surface transition-transform group-data-[size=default]/switch:size-3.5 group-data-[size=sm]/switch:size-2.5 data-checked:translate-x-3.5 group-data-[size=sm]/switch:data-checked:translate-x-2.5 data-unchecked:translate-x-0 motion-reduce:transition-none forced-colors:bg-[Canvas]"
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
