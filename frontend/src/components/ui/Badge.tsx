import React from 'react';

interface BadgeProps {
  className?: string;
  children: React.ReactNode;
}

// Badge takes className for colour — colours are data-driven from constants maps
// so the component stays unaware of domain concepts like categories or statuses.
export const Badge: React.FC<BadgeProps> = ({ className = '', children }) => (
  <span className={`
    inline-flex items-center px-2.5 py-1 rounded-full
    text-xs font-semibold capitalize
    ${className}
  `}>
    {children}
  </span>
);
