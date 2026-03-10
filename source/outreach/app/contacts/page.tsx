import Link from "next/link";
import { Plus, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { listContacts } from "@/lib/db/contacts";
import { ContactsPageClient } from "./contacts-page-client";

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tag?: string; status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const q = params.q || undefined;
  const tag = params.tag || undefined;
  const status = params.status || undefined;
  const page = params.page ? Number(params.page) : 1;
  const limit = 50;

  const { contacts, total } = listContacts({ q, tag, status, page, limit });
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Contacts</h1>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/contacts/import">
              <Upload className="mr-2 h-4 w-4" />
              Import CSV
            </Link>
          </Button>
          <Button asChild>
            <Link href="/contacts/new">
              <Plus className="mr-2 h-4 w-4" />
              New Contact
            </Link>
          </Button>
        </div>
      </div>

      <ContactsPageClient
        contacts={contacts}
        total={total}
        page={page}
        totalPages={totalPages}
        currentQ={q}
        currentStatus={status}
        currentTag={tag}
      />
    </div>
  );
}
