import React from 'react';

interface FilterButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
}

export const FilterButton = React.forwardRef<HTMLButtonElement, FilterButtonProps>(
  ({ selected = false, className = '', children, ...props }, ref) => (
    <button
      ref={ref}
      className={`
        w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left
        transition-colors cursor-pointer
        ${selected
          ? 'bg-brand-50 text-brand-700 font-medium'
          : 'text-gray-600 hover:bg-gray-100'
        }
        ${className}
      `}
      {...props}
    >
      {children}
    </button>
  )
);

FilterButton.displayName = 'FilterButton';
