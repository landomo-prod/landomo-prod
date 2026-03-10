import { ContactForm } from "@/components/contacts/ContactForm";

export default function NewContactPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">New Contact</h1>
      <ContactForm />
    </div>
  );
}
