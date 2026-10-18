import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const alertVariants = cva(
  "group/alert relative grid w-full min-w-0 gap-x-2 gap-y-0.5 rounded-control px-3 py-2.5 text-left text-label leading-[1.45] text-ink has-[>svg]:grid-cols-[1rem_minmax(0,1fr)] has-[>[data-slot=alert-action]]:grid-cols-[1rem_minmax(0,1fr)_auto] *:[svg]:row-span-2 *:[svg]:mt-px *:[svg:not([class*='size-'])]:size-4 forced-colors:border forced-colors:border-[CanvasText]",
  {
    variants: {
      variant: {
        default: "bg-field *:[svg]:text-studio-muted",
        info: "bg-info-soft *:[svg]:text-studio-accent",
        warning: "bg-warning-soft *:[svg]:text-warning",
        destructive: "bg-danger-soft *:[svg]:text-danger",
        success: "bg-success-soft *:[svg]:text-success",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Alert({ className, variant, ...props }: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return <div data-slot="alert" role="alert" className={cn(alertVariants({ variant }), className)} {...props} />
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn("col-start-2 font-semibold text-ink-strong [&_a]:underline [&_a]:underline-offset-3", className)}
      {...props}
    />
  )
}

function AlertDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn("col-start-2 text-ink-secondary [overflow-wrap:anywhere] [&_a]:underline [&_a]:underline-offset-3 [&_p]:m-0 [&_p:not(:last-child)]:mb-1.5", className)}
      {...props}
    />
  )
}

function AlertAction({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="alert-action" className={cn("col-start-3 row-span-2 row-start-1 self-center", className)} {...props} />
}

export { Alert, AlertTitle, AlertDescription, AlertAction }
