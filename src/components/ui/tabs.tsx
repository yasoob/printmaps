import { Tabs as TabsPrimitive } from "@base-ui/react/tabs"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

function Tabs({ className, orientation = "horizontal", ...props }: TabsPrimitive.Root.Props) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      className={cn("group/tabs flex gap-2 data-horizontal:flex-col", className)}
      {...props}
    />
  )
}

/** `default` is the shared studio segmented track (see `.studio-segmented` in primitives.css). */
const tabsListVariants = cva("group/tabs-list", {
  variants: {
    variant: {
      default: "studio-segmented",
      line: "inline-flex w-fit items-center gap-1 bg-transparent text-studio-muted",
    },
  },
  defaultVariants: {
    variant: "default",
  },
})

function TabsList({ className, variant = "default", ...props }: TabsPrimitive.List.Props & VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  )
}

function TabsTrigger({ className, ...props }: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(
        "relative [&_svg]:pointer-events-none [&_svg]:shrink-0",
        "group-data-[variant=line]/tabs-list:inline-flex group-data-[variant=line]/tabs-list:h-control group-data-[variant=line]/tabs-list:items-center group-data-[variant=line]/tabs-list:px-2 group-data-[variant=line]/tabs-list:text-control group-data-[variant=line]/tabs-list:data-active:text-ink-strong",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
  return <TabsPrimitive.Panel data-slot="tabs-content" className={cn("flex-1 outline-none", className)} {...props} />
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
