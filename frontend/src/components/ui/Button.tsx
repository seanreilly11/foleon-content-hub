import React from "react";

const VARIANT_STYLES = {
    primary:
        "bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-40 disabled:cursor-not-allowed",
    ghost: "text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed",
    outline:
        "border border-gray-200 text-gray-600 hover:border-gray-300 hover:text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed",
} as const;

const SIZE_STYLES = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2 text-sm",
} as const;

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: keyof typeof VARIANT_STYLES;
    size?: keyof typeof SIZE_STYLES;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    (
        { variant = "ghost", size = "sm", className = "", children, ...props },
        ref,
    ) => (
        <button
            ref={ref}
            className={`
        inline-flex items-center justify-center gap-2 rounded-lg font-medium cursor-pointer
        transition-colors focus-visible:outline-none focus-visible:ring-2
        focus-visible:ring-brand-500 focus-visible:ring-offset-1
        ${VARIANT_STYLES[variant]}
        ${SIZE_STYLES[size]}
        ${className}
      `}
            {...props}
        >
            {children}
        </button>
    ),
);

Button.displayName = "Button";
