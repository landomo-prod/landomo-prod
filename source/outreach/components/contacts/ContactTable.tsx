"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trash2, Pencil } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Contact } from "@/lib/db/contacts";

interface ContactTableProps {
  contacts: Contact[];
  onDelete?: (id: number) => void;
}

const statusVariant: Record<string, "default" | "secondary" | "destructive"> = {
  active: "default",
  unsubscribed: "secondary",
  bounced: "destructive",
};

export function ContactTable({ contacts, onDelete }: ContactTableProps) {
  const router = useRouter();

  async function handleDelete(id: number) {
    if (!confirm("Delete this contact?")) return;
    const res = await fetch(`/api/contacts/${id}`, { method: "DELETE" });
    if (res.ok) {
      onDelete?.(id);
      router.refresh();
    }
  }

  if (contacts.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No contacts found.
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Company</TableHead>
          <TableHead>Tags</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="w-[100px]">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {contacts.map((contact) => (
          <TableRow key={contact.id}>
            <TableCell className="font-medium">
              <Link
                href={`/contacts/${contact.id}`}
                className="hover:underline"
              >
                {contact.name}
              </Link>
            </TableCell>
            <TableCell>{contact.email}</TableCell>
            <TableCell>{contact.company || "-"}</TableCell>
            <TableCell>
              <div className="flex gap-1 flex-wrap">
                {contact.tags.map((tag) => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                  </Badge>
                ))}
              </div>
            </TableCell>
            <TableCell>
              <Badge variant={statusVariant[contact.status] ?? "secondary"}>
                {contact.status}
              </Badge>
            </TableCell>
            <TableCell>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon-xs" asChild>
                  <Link href={`/contacts/${contact.id}`}>
                    <Pencil />
                  </Link>
                </Button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => handleDelete(contact.id)}
                >
                  <Trash2 className="text-destructive" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
