import { notFound } from "next/navigation";
import { getContact } from "@/lib/db/contacts";
import { ContactForm } from "@/components/contacts/ContactForm";

export default async function EditContactPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const contact = getContact(Number(id));

  if (!contact) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Edit Contact</h1>
      <ContactForm contact={contact} />
    </div>
  );
}
