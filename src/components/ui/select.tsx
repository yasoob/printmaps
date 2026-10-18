import * as React from "react"
import { Select as SelectPrimitive } from "@base-ui/react/select"
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { fieldSurfaceClassName, floatingSurfaceClassName } from "./field-styles"

const Select = SelectPrimitive.Root

function SelectGroup({ className, ...props }: SelectPrimitive.Group.Props) {
  return <SelectPrimitive.Group data-slot="select-group" className={cn("scroll-my-1 py-0.5", className)} {...props} />
}

function SelectValue({ className, ...props }: SelectPrimitive.Value.Props) {
  return (
    <SelectPrimitive.Value
      data-slot="select-value"
      className={cn("min-w-0 flex-1 truncate text-left", className)}
      {...props}
    />
  )
}

function SelectTrigger({
  className,
  size = "default",
  children,
  ...props
}: SelectPrimitive.Trigger.Props & { size?: "sm" | "default" }) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      data-size={size}
      className={cn(
        fieldSurfaceClassName,
        "flex w-full min-w-0 cursor-pointer items-center justify-between gap-1.5 py-0 pr-2 pl-2 whitespace-nowrap select-none data-placeholder:text-studio-muted data-popup-open:border-line-hover data-[size=default]:h-control touch:data-[size=default]:h-touch data-[size=sm]:h-7 touch:data-[size=sm]:h-touch [&_svg]:pointer-events-none [&_svg]:shrink-0",
        className
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon
        render={<ChevronDownIcon aria-hidden="true" size={16} strokeWidth={1.75} className="text-studio-muted" />}
      />
    </SelectPrimitive.Trigger>
  )
}

function SelectContent({
  className,
  children,
  side = "bottom",
  sideOffset = 4,
  align = "start",
  alignOffset = 0,
  alignItemWithTrigger = false,
  ...props
}: SelectPrimitive.Popup.Props &
  Pick<SelectPrimitive.Positioner.Props, "align" | "alignOffset" | "side" | "sideOffset" | "alignItemWithTrigger">) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        alignOffset={alignOffset}
        alignItemWithTrigger={alignItemWithTrigger}
        collisionPadding={8}
        className="isolate z-[120]"
      >
        <SelectPrimitive.Popup
          data-slot="select-content"
          data-align-trigger={alignItemWithTrigger}
          className={cn(
            floatingSurfaceClassName,
            "relative isolate max-h-(--available-height) w-(--anchor-width) min-w-36 origin-(--transform-origin) overflow-x-hidden overflow-y-auto p-1 duration-100 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 motion-reduce:animate-none",
            className
          )}
          {...props}
        >
          <SelectScrollUpButton />
          <SelectPrimitive.List>{children}</SelectPrimitive.List>
          <SelectScrollDownButton />
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  )
}

function SelectLabel({ className, ...props }: SelectPrimitive.GroupLabel.Props) {
  return (
    <SelectPrimitive.GroupLabel
      data-slot="select-label"
      className={cn("px-2 pt-1.5 pb-1 text-label font-semibold text-ink-strong", className)}
      {...props}
    />
  )
}

// Static, so open items re-rendering on highlight do not hand the indicator fresh elements.
const selectItemIndicator = <span className="pointer-events-none absolute right-2 flex size-4 items-center justify-center text-studio-accent" />
const selectItemCheck = <CheckIcon aria-hidden="true" size={16} strokeWidth={1.75} />

function SelectItem({ className, children, ...props }: SelectPrimitive.Item.Props) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        "relative flex min-h-8 w-full cursor-default items-center gap-2 rounded-field py-1 pr-8 pl-2 text-control text-ink outline-hidden select-none touch:min-h-touch data-highlighted:bg-field data-highlighted:text-ink-strong data-selected:font-medium data-selected:text-ink-strong data-disabled:pointer-events-none data-disabled:opacity-(--studio-disabled-opacity) [&_svg]:pointer-events-none [&_svg]:shrink-0",
        className
      )}
      {...props}
    >
      <SelectPrimitive.ItemText className="flex min-w-0 flex-1 gap-2 truncate">{children}</SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator render={selectItemIndicator}>{selectItemCheck}</SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  )
}

function SelectSeparator({ className, ...props }: SelectPrimitive.Separator.Props) {
  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      className={cn("pointer-events-none -mx-1 my-1 h-px bg-line", className)}
      {...props}
    />
  )
}

function SelectScrollUpButton({ className, ...props }: React.ComponentProps<typeof SelectPrimitive.ScrollUpArrow>) {
  return (
    <SelectPrimitive.ScrollUpArrow
      data-slot="select-scroll-up-button"
      className={cn("top-0 z-10 flex w-full cursor-default items-center justify-center bg-popover py-1 text-studio-muted", className)}
      {...props}
    >
      <ChevronUpIcon aria-hidden="true" size={16} strokeWidth={1.75} />
    </SelectPrimitive.ScrollUpArrow>
  )
}

function SelectScrollDownButton({ className, ...props }: React.ComponentProps<typeof SelectPrimitive.ScrollDownArrow>) {
  return (
    <SelectPrimitive.ScrollDownArrow
      data-slot="select-scroll-down-button"
      className={cn("bottom-0 z-10 flex w-full cursor-default items-center justify-center bg-popover py-1 text-studio-muted", className)}
      {...props}
    >
      <ChevronDownIcon aria-hidden="true" size={16} strokeWidth={1.75} />
    </SelectPrimitive.ScrollDownArrow>
  )
}

export type SimpleSelectOption<V extends string> = Readonly<{ value: V; label: string; disabled?: boolean }>
export type SimpleSelectGroup<V extends string> = Readonly<{ label: string; options: readonly SimpleSelectOption<V>[] }>

export type SimpleSelectProps<V extends string> = Readonly<{
  /**
  Accessible name of the trigger (combobox).
  */
  label: string
  value: V
  options: readonly SimpleSelectOption<V>[] | readonly SimpleSelectGroup<V>[]
  onValueChange: (value: V) => void
  disabled?: boolean
  id?: string
  className?: string
  placeholder?: string
  size?: "sm" | "default"
  "aria-describedby"?: string
  "aria-invalid"?: boolean
}>

function isGrouped<V extends string>(
  options: readonly SimpleSelectOption<V>[] | readonly SimpleSelectGroup<V>[]
): options is readonly SimpleSelectGroup<V>[] {
  return options.length > 0 && "options" in options[0]!
}

function renderOption<V extends string>(option: SimpleSelectOption<V>) {
  return <SelectItem key={option.value} value={option.value} disabled={option.disabled}>{option.label}</SelectItem>
}

/**
 * Convenience select for plain option lists. The trigger has role="combobox", is named by `label`,
 * shows the selected option's label and exposes the raw value as `data-value` for assertions.
 * Keep `options` referentially stable (module constants or useMemo) so the memo holds.
 */
const SimpleSelect = React.memo(function SimpleSelect<V extends string>({
  label, value, options, onValueChange, disabled = false, id, className, placeholder, size = "default",
  "aria-describedby": ariaDescribedBy, "aria-invalid": ariaInvalid,
}: SimpleSelectProps<V>) {
  const items = React.useMemo(() => {
    const flat = isGrouped(options) ? options.flatMap((group) => group.options) : options
    return flat.map(({ value: itemValue, label: itemLabel }) => ({ value: itemValue, label: itemLabel }))
  }, [options])
  // The popup content only depends on the options; a value change must not re-render it while closed.
  const content = React.useMemo(() => (
    <SelectContent>
      {isGrouped(options)
        ? options.map((group, index) => (
            <React.Fragment key={group.label}>
              {index > 0 && <SelectSeparator />}
              <SelectGroup>
                <SelectLabel>{group.label}</SelectLabel>
                {group.options.map((option) => renderOption(option))}
              </SelectGroup>
            </React.Fragment>
          ))
        : options.map((option) => renderOption(option))}
    </SelectContent>
  ), [options])
  return (
    <Select
      items={items}
      value={value}
      disabled={disabled}
      onValueChange={(next) => {
        if (next !== null && next !== value) onValueChange(next as V)
      }}
    >
      <SelectTrigger
        id={id}
        size={size}
        className={className}
        aria-label={label}
        aria-describedby={ariaDescribedBy}
        aria-invalid={ariaInvalid || undefined}
        data-value={value}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      {content}
    </Select>
  )
}) as <V extends string>(props: SimpleSelectProps<V>) => React.JSX.Element

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
  SimpleSelect,
}
