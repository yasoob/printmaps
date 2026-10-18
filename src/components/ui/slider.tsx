import { Slider as SliderPrimitive } from "@base-ui/react/slider"

import { cn } from "@/lib/utils"

type SliderProps = SliderPrimitive.Root.Props & {
  /** Accessible names for the thumbs, in order. A single string names a single-value slider. */
  thumbLabels?: string | readonly string[]
}

function thumbCount(value: SliderPrimitive.Root.Props["value"], defaultValue: SliderPrimitive.Root.Props["defaultValue"]) {
  if (Array.isArray(value)) return value.length
  if (Array.isArray(defaultValue)) return defaultValue.length
  return 1
}

/** Studio slider: 4px track, 16px thumb with a 44px touch hit area, blue range. Accepts a number or number[]. */
function Slider({ className, defaultValue, value, min = 0, max = 100, thumbLabels, ...props }: SliderProps) {
  const labels = typeof thumbLabels === "string" ? [thumbLabels] : thumbLabels
  return (
    <SliderPrimitive.Root
      className={cn("data-horizontal:w-full data-vertical:h-full", className)}
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      thumbAlignment="edge"
      {...props}
    >
      <SliderPrimitive.Control className="relative flex h-control w-full cursor-pointer touch-none items-center select-none touch:h-touch data-disabled:cursor-default data-disabled:opacity-(--studio-disabled-opacity) data-vertical:h-full data-vertical:min-h-40 data-vertical:w-auto data-vertical:flex-col">
        <SliderPrimitive.Track
          data-slot="slider-track"
          className="relative grow overflow-hidden rounded-full bg-switch-off select-none data-horizontal:h-1 data-horizontal:w-full data-vertical:h-full data-vertical:w-1"
        >
          <SliderPrimitive.Indicator data-slot="slider-range" className="bg-studio-accent select-none data-horizontal:h-full data-vertical:w-full" />
        </SliderPrimitive.Track>
        {Array.from({ length: thumbCount(value, defaultValue) }, (_, index) => (
          <SliderPrimitive.Thumb
            data-slot="slider-thumb"
            key={index}
            aria-label={labels?.[index]}
            className="relative block size-4 shrink-0 rounded-full border border-studio-accent bg-surface transition-[outline-color] select-none after:absolute after:-inset-3.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--studio-focus)] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--studio-focus)] forced-colors:forced-color-adjust-none forced-colors:border-[CanvasText] forced-colors:bg-[Canvas]"
          />
        ))}
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  )
}

export { Slider }
