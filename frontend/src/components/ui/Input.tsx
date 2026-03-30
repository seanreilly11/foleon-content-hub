import React from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    leftSlot?: React.ReactNode;
    rightSlot?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ leftSlot, rightSlot, className = "", ...props }, ref) => (
        <div className="relative w-full">
            {leftSlot && (
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                    {leftSlot}
                </span>
            )}
            <input
                ref={ref}
                className={`
          w-full py-3.5 rounded-xl border border-gray-200 bg-white
          text-gray-900 placeholder-gray-400 text-[15px]
          shadow-sm transition-shadow
          focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent
          ${leftSlot ? "pl-11" : "pl-4"}
          ${rightSlot ? "pr-28" : "pr-4"}
          ${className}
        `}
                {...props}
            />
            {rightSlot && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    {rightSlot}
                </div>
            )}
        </div>
    ),
);

Input.displayName = "Input";
