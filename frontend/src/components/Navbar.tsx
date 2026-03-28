import React from 'react';

export const Navbar: React.FC = () => (
  <header className="border-b border-gray-100 bg-white sticky top-0 z-10 shadow-sm">
    <div className="max-w-7xl mx-auto px-6 h-16 flex items-center">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
            <path d="M4 6h16M4 10h16M4 14h10" />
          </svg>
        </div>
        <span className="text-lg font-semibold text-gray-900">Content Hub</span>
      </div>
    </div>
  </header>
);
