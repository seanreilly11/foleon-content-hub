import React from "react";

interface Option {
    value: string;
    label: string;
}

interface Props {
    value: string;
    onChange: (value: string) => void;
    options: Option[];
}

export const SortSelect: React.FC<Props> = ({ value, onChange, options }) => (
    <div className="flex items-center gap-2">
        <span className="text-xs text-gray-400 shrink-0">Sort by</span>
        <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="text-sm text-gray-600 bg-white border border-gray-200 rounded-lg px-2 py-1.5 cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1"
        >
            {options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                    {opt.label}
                </option>
            ))}
        </select>
    </div>
);
