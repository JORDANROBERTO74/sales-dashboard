"use client"

import * as React from "react"
import { Eye, EyeOff } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type PasswordInputProps = React.ComponentProps<typeof Input> & {
  showToggle?: boolean
  showLabel?: string
  hideLabel?: string
}

const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  (
    {
      className,
      showToggle = true,
      showLabel = "Mostrar contraseña",
      hideLabel = "Ocultar contraseña",
      disabled,
      ...props
    },
    ref
  ) => {
    const [isVisible, setIsVisible] = React.useState(false)

    return (
      <div className="relative">
        <Input
          ref={ref}
          {...props}
          type={isVisible ? "text" : "password"}
          disabled={disabled}
          className={cn(showToggle && "pr-10", className)}
        />
        {showToggle && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label={isVisible ? hideLabel : showLabel}
            aria-pressed={isVisible}
            onPointerDown={(event) => event.preventDefault()}
            onClick={() => setIsVisible((current) => !current)}
            disabled={disabled}
          >
            {isVisible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </Button>
        )}
      </div>
    )
  }
)

PasswordInput.displayName = "PasswordInput"

export { PasswordInput }
