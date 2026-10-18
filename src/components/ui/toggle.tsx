"use client"

import { Toggle as TogglePrimitive } from "@base-ui/react/toggle"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const toggleVariants = cva(
  "group/toggle inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-control font-medium whitespace-nowrap text-studio-muted transition-colors outline-none hover:text-ink focus-visible:outline-2 focus-visible:outline-[var(--studio-focus)] disabled:cursor-default disabled:opacity-(--studio-disabled-opacity) data-pressed:bg-field data-pressed:text-ink-strong [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        outline: "border border-line-strong bg-transparent",
      },
      size: {
        default: "h-control min-w-8 px-2.5 text-control touch:h-touch touch:min-w-touch",
        sm: "h-7 min-w-7 px-2 text-label touch:h-touch touch:min-w-touch",
        lg: "h-9 min-w-9 px-3 text-control touch:h-touch touch:min-w-touch",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Toggle({
  className,
  variant = "default",
  size = "default",
  ...props
}: TogglePrimitive.Props & VariantProps<typeof toggleVariants>) {
  return <TogglePrimitive data-slot="toggle" className={cn(toggleVariants({ variant, size, className }))} {...props} />
}

export { Toggle, toggleVariants }
