"use client";

import { Badge } from "@/components/ui/badge";

interface TagFilterProps {
  tags: string[];
  selected: string | null;
  onSelect: (tag: string | null) => void;
}

export function TagFilter({ tags, selected, onSelect }: TagFilterProps) {
  if (tags.length === 0) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-sm text-muted-foreground">Tags:</span>
      <Badge
        variant={selected === null ? "default" : "outline"}
        className="cursor-pointer"
        onClick={() => onSelect(null)}
      >
        All
      </Badge>
      {tags.map((tag) => (
        <Badge
          key={tag}
          variant={selected === tag ? "default" : "outline"}
          className="cursor-pointer"
          onClick={() => onSelect(selected === tag ? null : tag)}
        >
          {tag}
        </Badge>
      ))}
    </div>
  );
}
