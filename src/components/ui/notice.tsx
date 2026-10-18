import { CircleAlert, CircleCheck, Info, TriangleAlert, type LucideIcon } from "lucide-react"
import type { ComponentProps, ReactNode } from "react"

import { cn } from "@/lib/utils"

export type NoticeTone = "info" | "warning" | "error" | "success"

const toneIcons: Record<NoticeTone, LucideIcon> = {
  info: Info,
  warning: TriangleAlert,
  error: CircleAlert,
  success: CircleCheck,
}

export type NoticeProps = Omit<ComponentProps<"div">, "title"> & {
  tone: NoticeTone
  title?: ReactNode
  /**
  Optional trailing action, typically a small ghost or secondary Button.
  */
  action?: ReactNode
}

/**
Soft tinted inline status message. Errors announce assertively; other tones politely.
*/
export function Notice({ tone, title, action, children, className, role, ...props }: NoticeProps) {
  const Icon = toneIcons[tone]
  return (
    <div
      className={cn("studio-notice", className)}
      data-tone={tone}
      role={role ?? (tone === "error" ? "alert" : "status")}
      {...props}
    >
      <Icon className="studio-notice-icon" aria-hidden="true" size={16} strokeWidth={1.75} />
      <div className="studio-notice-content">
        {title && <p className="studio-notice-title">{title}</p>}
        {children && <div className="studio-notice-body">{children}</div>}
      </div>
      {action && <div className="studio-notice-action">{action}</div>}
    </div>
  )
}
