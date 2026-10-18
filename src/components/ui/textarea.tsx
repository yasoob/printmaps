import * as React from "react"

import { cn } from "@/lib/utils"
import { fieldSurfaceClassName } from "./field-styles"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(fieldSurfaceClassName, "flex field-sizing-content min-h-16 w-full resize-none px-2 py-1.5 leading-[1.45] placeholder:text-studio-muted", className)}
      {...props}
    />
  )
}

export { Textarea }
