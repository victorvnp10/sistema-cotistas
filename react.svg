import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, icon, ...props }, ref) => {
    if (icon) {
      return (
        <div className="relative">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
            {icon}
          </span>
          <input
            type={type}
            className={cn(
              "flex h-12 w-full rounded-2xl border border-input bg-white pl-11 pr-4 text-[16px] shadow-none transition-all placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:border-royal focus-visible:ring-4 focus-visible:ring-royal/10 disabled:cursor-not-allowed disabled:opacity-50",
              className
            )}
            ref={ref}
            {...props}
          />
        </div>
      );
    }
    return (
      <input
        type={type}
        className={cn(
          "flex h-12 w-full rounded-2xl border border-input bg-white px-4 text-[16px] shadow-none transition-all placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:border-royal focus-visible:ring-4 focus-visible:ring-royal/10 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
