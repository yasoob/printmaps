import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"
import { fieldHeightClassName, fieldSurfaceClassName } from "./field-styles"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        fieldSurfaceClassName,
        fieldHeightClassName,
        "w-full min-w-0 px-2 py-0 placeholder:text-studio-muted",
        className
      )}
      {...props}
    />
  )
}

export { Input }
