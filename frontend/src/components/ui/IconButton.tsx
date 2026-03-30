import React from "react";

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    "aria-label": string; // required — icon-only buttons must have accessible labels
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
    ({ className = "", children, ...props }, ref) => (
        <button
            ref={ref}
            className={`
        inline-flex items-center justify-center rounded-lg p-1.5
        text-gray-400 hover:text-gray-600 hover:bg-gray-100 cursor-pointer
        disabled:opacity-30 disabled:cursor-not-allowed
        transition-colors focus-visible:outline-none focus-visible:ring-2
        focus-visible:ring-brand-500 focus-visible:ring-offset-1
        ${className}
      `}
            {...props}
        >
            {children}
        </button>
    ),
);

IconButton.displayName = "IconButton";
