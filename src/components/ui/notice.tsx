import { CircleAlert, CircleCheck, Info, TriangleAlert, type LucideIcon } from "lucide-react"
import type { ComponentProps, ReactNode } from "react"

import { cn } from "@/lib/utils"
import { Alert, AlertAction, AlertDescription, AlertTitle } from "./alert"

export type NoticeTone = "info" | "warning" | "error" | "success"

const toneIcons: Record<NoticeTone, LucideIcon> = {
  info: Info,
  warning: TriangleAlert,
  error: CircleAlert,
  success: CircleCheck,
}

const toneVariants = { info: "info", warning: "warning", error: "destructive", success: "success" } as const

export type NoticeProps = Omit<ComponentProps<"div">, "title"> & {
  tone: NoticeTone
  title?: ReactNode
  /**
  Optional trailing action, typically a small ghost or secondary Button.
  */
  action?: ReactNode
}

/**
Soft tinted inline status message on shadcn Alert. Errors announce assertively; other tones politely.
*/
export function Notice({ tone, title, action, children, className, role, ...props }: NoticeProps) {
  const Icon = toneIcons[tone]
  return (
    <Alert
      variant={toneVariants[tone]}
      className={cn("studio-notice", className)}
      data-tone={tone}
      role={role ?? (tone === "error" ? "alert" : "status")}
      {...props}
    >
      <Icon className="studio-notice-icon" aria-hidden="true" size={16} strokeWidth={1.75} />
      {title && <AlertTitle className="studio-notice-title">{title}</AlertTitle>}
      {children && <AlertDescription className="studio-notice-body">{children}</AlertDescription>}
      {action && <AlertAction className="studio-notice-action">{action}</AlertAction>}
    </Alert>
  )
}
