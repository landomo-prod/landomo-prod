"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ContactTable } from "@/components/contacts/ContactTable";
import type { Contact } from "@/lib/db/contacts";

interface ContactsPageClientProps {
  contacts: Contact[];
  total: number;
  page: number;
  totalPages: number;
  currentQ?: string;
  currentStatus?: string;
  currentTag?: string;
}

export function ContactsPageClient({
  contacts,
  total,
  page,
  totalPages,
  currentQ,
  currentStatus,
}: ContactsPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(currentQ ?? "");

  function updateParams(updates: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    }
    params.delete("page");
    router.push(`/contacts?${params.toString()}`);
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    updateParams({ q: search || undefined });
  }

  function handleStatusChange(value: string) {
    updateParams({ status: value === "all" ? undefined : value });
  }

  return (
    <>
      <div className="flex items-center gap-3">
        <form onSubmit={handleSearch} className="flex gap-2 flex-1 max-w-sm">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search contacts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <Button type="submit" variant="secondary" size="sm">
            Search
          </Button>
        </form>

        <Select
          value={currentStatus ?? "all"}
          onValueChange={handleStatusChange}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="bounced">Bounced</SelectItem>
            <SelectItem value="unsubscribed">Unsubscribed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="text-sm text-muted-foreground">
        {total} contact{total !== 1 ? "s" : ""}
      </div>

      <ContactTable contacts={contacts} />

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <Button variant="outline" size="sm" disabled={page <= 1} asChild>
            <Link
              href={`/contacts?${new URLSearchParams({
                ...(currentQ ? { q: currentQ } : {}),
                ...(currentStatus ? { status: currentStatus } : {}),
                page: String(page - 1),
              }).toString()}`}
            >
              Previous
            </Link>
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            asChild
          >
            <Link
              href={`/contacts?${new URLSearchParams({
                ...(currentQ ? { q: currentQ } : {}),
                ...(currentStatus ? { status: currentStatus } : {}),
                page: String(page + 1),
              }).toString()}`}
            >
              Next
            </Link>
          </Button>
        </div>
      )}
    </>
  );
}
