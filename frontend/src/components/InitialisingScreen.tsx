import React from "react";
import { STARTUP_STAGE_LABELS, STARTUP_STAGE_ORDER } from "../constants";

interface Props {
    stage: string;
}

export const InitialisingScreen: React.FC<Props> = ({ stage }) => {
    const label = STARTUP_STAGE_LABELS[stage] ?? "Initialising...";
    const stageIndex = STARTUP_STAGE_ORDER.indexOf(
        stage as (typeof STARTUP_STAGE_ORDER)[number],
    );

    return (
        <div className="min-h-screen bg-surface font-sans flex items-center justify-center">
            <div className="text-center max-w-sm px-6">
                {/* Animated logo */}
                <div className="w-14 h-14 rounded-2xl bg-brand-500 flex items-center justify-center mx-auto mb-6 animate-pulse">
                    <svg
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="white"
                        strokeWidth="2.5"
                    >
                        <path d="M4 6h16M4 10h16M4 14h10" />
                    </svg>
                </div>

                <h1 className="text-xl font-semibold text-gray-900 mb-2">
                    Content Hub
                </h1>
                <p className="text-sm text-gray-500 mb-6">{label}</p>

                {/* Stage progress dots */}
                <div className="flex justify-center gap-2">
                    {STARTUP_STAGE_ORDER.map((s, i) => (
                        <div
                            key={s}
                            className={`w-2 h-2 rounded-full transition-colors duration-300 ${
                                i <= stageIndex ? "bg-brand-500" : "bg-gray-200"
                            }`}
                        />
                    ))}
                </div>

                <p className="text-xs text-gray-400 mt-4">
                    First startup takes ~20s to build the AI search index
                </p>
            </div>
        </div>
    );
};
