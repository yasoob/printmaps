import * as React from "react"

import { cn } from "@/lib/utils"

function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      data-slot="label"
      className={cn(
        "flex items-center gap-2 text-label leading-snug text-ink-secondary select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-(--studio-disabled-opacity) peer-disabled:cursor-default peer-disabled:opacity-(--studio-disabled-opacity)",
        className
      )}
      {...props}
    />
  )
}

export { Label }
