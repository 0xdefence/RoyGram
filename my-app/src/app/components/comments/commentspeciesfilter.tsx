"use client";

import { species } from "@/types/types";

export type SpeciesFilter = "all" | species;

interface SpeciesButtonProps {
    selectedFilter: SpeciesFilter;
    onFilterChange: (filter: SpeciesFilter) => void;
}

export function CommentSpeciesFilter() {

return (
<div className="filter-species">
        <h4>Click to Filter Through Species</h4>
    <div className="buttons">
        <div className="filter-all-species">
        <p>All</p>
    </div>
    <div className="filter-alien-species">
        <p>👽</p>
    </div>
    <div className="filter-droid-species">
        <p>🤖</p>
    </div>
    <div className="filter-human-species">
        <p>🦸</p>
    </div>
</div>
</div>)}