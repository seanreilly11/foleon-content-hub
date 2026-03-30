import React from "react";
import type { Publication } from "../types";
import { getCategoryStyle, STATUS_STYLES } from "../constants";
import { Badge } from "./ui";

interface Props {
    publication: Publication;
    score?: number;
}

export const PublicationCard: React.FC<Props> = ({ publication, score }) => {
    const categoryStyle = getCategoryStyle(publication.category);
    const statusStyle =
        STATUS_STYLES[publication.status] ?? "bg-gray-100 text-gray-500";
    const isDeleted = publication.status === "deleted";

    return (
        <div
            className={`group flex flex-col gap-3 p-5 rounded-xl border bg-white shadow-sm
      transition-all duration-200 hover:shadow-md
      ${isDeleted ? "border-red-100 opacity-75 hover:border-red-200" : "border-gray-100 hover:border-brand-200"}
    `}
        >
            <div className="flex items-center justify-between gap-2">
                <Badge className={categoryStyle}>{publication.category}</Badge>
                {score !== undefined && (
                    <div
                        className="flex items-center gap-1.5 shrink-0"
                        title={`Relevance: ${(score * 100).toFixed(0)}%`}
                    >
                        <div className="w-12 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-brand-500 rounded-full"
                                style={{ width: `${Math.round(score * 100)}%` }}
                            />
                        </div>
                        <span className="text-xs text-gray-400 tabular-nums">
                            {(score * 100).toFixed(0)}%
                        </span>
                    </div>
                )}
            </div>

            <h3
                className={`text-[15px] font-semibold leading-snug line-clamp-2 transition-colors
        ${isDeleted ? "text-gray-500" : "text-gray-900 group-hover:text-brand-600"}
      `}
            >
                {publication.title}
            </h3>

            <div className="flex items-center justify-between mt-auto gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                    <Badge className="bg-gray-100 text-gray-600">
                        {publication.project}
                    </Badge>
                    <Badge className={statusStyle}>{publication.status}</Badge>
                </div>
                <span className="text-xs text-gray-400">
                    {new Date(publication.created_at).toLocaleDateString(
                        "en-US",
                        {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                        },
                    )}
                </span>
            </div>
        </div>
    );
};
