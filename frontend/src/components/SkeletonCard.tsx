import React from "react";

export const SkeletonCard: React.FC = () => (
    <div className="flex flex-col gap-3 p-5 rounded-xl border border-gray-100 bg-white shadow-sm animate-pulse">
        <div className="flex justify-between items-center">
            <div className="h-6 w-28 bg-gray-100 rounded-full" />
            <div className="h-1.5 w-12 bg-gray-100 rounded-full" />
        </div>
        <div className="space-y-2">
            <div className="h-4 bg-gray-100 rounded w-full" />
            <div className="h-4 bg-gray-100 rounded w-3/4" />
        </div>
        <div className="flex justify-between items-center mt-auto">
            <div className="flex gap-2">
                <div className="h-5 w-20 bg-gray-100 rounded-full" />
                <div className="h-5 w-16 bg-gray-100 rounded-full" />
            </div>
            <div className="h-3 w-20 bg-gray-100 rounded" />
        </div>
    </div>
);
