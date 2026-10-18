import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { Loader2 } from "lucide-react"
import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

export type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive" | "link"
export type ButtonSize = "sm" | "default" | "icon" | "icon-sm"

type LegacyButtonVariant = "default" | "outline"
type LegacyButtonSize = "xs" | "lg" | "icon-xs" | "icon-lg"

const legacyVariants: Record<LegacyButtonVariant, ButtonVariant> = { default: "primary", outline: "secondary" }
const legacySizes: Record<LegacyButtonSize, ButtonSize> = { xs: "sm", lg: "default", "icon-xs": "icon-sm", "icon-lg": "icon" }

function resolveVariant(variant: ButtonVariant | LegacyButtonVariant): ButtonVariant {
  return legacyVariants[variant as LegacyButtonVariant] ?? (variant as ButtonVariant)
}

function resolveSize(size: ButtonSize | LegacyButtonSize): ButtonSize {
  return legacySizes[size as LegacyButtonSize] ?? (size as ButtonSize)
}

/**
Class name and data attributes for rendering the shared button look on another element.
*/
function buttonVariants({
  variant = "primary",
  size = "default",
  className,
}: { variant?: ButtonVariant | LegacyButtonVariant; size?: ButtonSize | LegacyButtonSize; className?: string } = {}) {
  return {
    className: cn("studio-button", className),
    "data-variant": resolveVariant(variant),
    "data-size": resolveSize(size),
  } as const
}

type ButtonProps = Omit<ButtonPrimitive.Props, "className"> & {
  className?: string
  variant?: ButtonVariant | LegacyButtonVariant
  size?: ButtonSize | LegacyButtonSize
  /**
  Shows a spinner, disables activation and announces the pending state.
  */
  busy?: boolean
  children?: ReactNode
}

function Button({ className, variant = "primary", size = "default", busy = false, disabled, children, ...props }: ButtonProps) {
  return (
    <ButtonPrimitive
      data-slot="button"
      {...buttonVariants({ variant, size, className })}
      aria-busy={busy || undefined}
      disabled={disabled || busy}
      {...props}
    >
      {busy && <Loader2 aria-hidden="true" className="studio-button-spinner" size={16} strokeWidth={1.75} />}
      {children}
    </ButtonPrimitive>
  )
}

export { Button }
