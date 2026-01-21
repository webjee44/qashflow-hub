import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, inputMode, ...props }, ref) => {
    // Auto-set inputMode for number types to enable numpad support
    const resolvedInputMode = inputMode ?? (type === "number" ? "decimal" : undefined);
    
    return (
      <input
        type={type}
        inputMode={resolvedInputMode}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-white dark:bg-[hsl(var(--input-background))] px-3 py-2 text-base shadow-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:border-primary/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm transition-colors",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
