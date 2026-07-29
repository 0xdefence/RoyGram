"use client";

import { species } from "@/types/types";

export type SpeciesFilter = "all" | species;

interface SpeciesButtonProps {
    selectedFilter: SpeciesFilter;
    onFilterChange: (filter: SpeciesFilter) => void;
}

export function CommentSpeciesFilter(props: SpeciesButtonProps) {

return (
<div className="filter-species">
        <div className="comment-filter-species-title">
    <h4>Click to Filter Through Species</h4>
        </div>
    <div className="species-buttons">
        <div className="filter-all-species"
        onClick={() => props.onFilterChange("all")}
        >
            <p>All</p>
        </div>
        <div 
        className="filter-alien-species"
        onClick={() => props.onFilterChange("alien")}
        >
            <p>👽</p>
        </div>
        <div className="filter-droid-species"
        onClick={() => props.onFilterChange("droid")}
        >
            <p>🤖</p>
        </div>
        <div className="filter-human-species"
        onClick={() => props.onFilterChange("human")}
        >
            <p>🦸</p>
        </div>
</div>
</div>
)
}
