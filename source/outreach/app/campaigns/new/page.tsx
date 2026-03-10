"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { renderTemplate } from "@/lib/utils";

interface Contact {
  id: number;
  name: string;
  email: string;
  company: string | null;
  status: string;
}

const sampleVars = { name: "Jan Novak", company: "Developer s.r.o." };

export default function NewCampaignPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [fromEmail, setFromEmail] = useState(
    process.env.NEXT_PUBLIC_DEFAULT_FROM_EMAIL || ""
  );
  const [fromName, setFromName] = useState("Landomo");
  const [replyTo, setReplyTo] = useState("");
  const [delayMs, setDelayMs] = useState(3000);
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");

  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState("");
  const [loadingContacts, setLoadingContacts] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/contacts?limit=1000");
        const data = await res.json();
        setContacts(data.contacts || []);
      } finally {
        setLoadingContacts(false);
      }
    }
    load();
  }, []);

  const insertVariable = useCallback(
    (field: "subject" | "body", variable: string) => {
      const tag = `{{${variable}}}`;
      if (field === "subject") {
        const el = subjectRef.current;
        if (el) {
          const start = el.selectionStart ?? subject.length;
          const end = el.selectionEnd ?? subject.length;
          const next = subject.slice(0, start) + tag + subject.slice(end);
          setSubject(next);
          requestAnimationFrame(() => {
            el.focus();
            el.setSelectionRange(start + tag.length, start + tag.length);
          });
        }
      } else {
        const el = bodyRef.current;
        if (el) {
          const start = el.selectionStart ?? bodyHtml.length;
          const end = el.selectionEnd ?? bodyHtml.length;
          const next = bodyHtml.slice(0, start) + tag + bodyHtml.slice(end);
          setBodyHtml(next);
          requestAnimationFrame(() => {
            el.focus();
            el.setSelectionRange(start + tag.length, start + tag.length);
          });
        }
      }
    },
    [subject, bodyHtml]
  );

  const filteredContacts = contacts.filter((c) => {
    if (c.status !== "active") return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      (c.company && c.company.toLowerCase().includes(q))
    );
  });

  const toggleContact = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === filteredContacts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredContacts.map((c) => c.id)));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !subject || !bodyHtml || !fromEmail) return;

    setSaving(true);
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          subject,
          body_html: bodyHtml,
          from_email: fromEmail,
          from_name: fromName || undefined,
          reply_to: replyTo || undefined,
          delay_ms: delayMs,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Failed to create campaign");
        return;
      }

      const campaign = await res.json();

      if (selectedIds.size > 0) {
        await fetch(`/api/campaigns/${campaign.id}/contacts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contactIds: Array.from(selectedIds) }),
        });
      }

      router.push(`/campaigns/${campaign.id}`);
    } finally {
      setSaving(false);
    }
  };

  const VariableButtons = ({ field }: { field: "subject" | "body" }) => (
    <div className="flex gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-6 text-xs px-2"
        onClick={() => insertVariable(field, "name")}
      >
        {"{{name}}"}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-6 text-xs px-2"
        onClick={() => insertVariable(field, "company")}
      >
        {"{{company}}"}
      </Button>
    </div>
  );

  return (
    <div className="max-w-4xl space-y-6">
      <h1 className="text-2xl font-bold">New Campaign</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Campaign Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Campaign Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Czech Agents March 2026"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fromEmail">From Email *</Label>
                <Input
                  id="fromEmail"
                  type="email"
                  value={fromEmail}
                  onChange={(e) => setFromEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fromName">From Name</Label>
                <Input
                  id="fromName"
                  value={fromName}
                  onChange={(e) => setFromName(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="replyTo">Reply-To</Label>
                <Input
                  id="replyTo"
                  type="email"
                  value={replyTo}
                  onChange={(e) => setReplyTo(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="delayMs">Delay Between Emails (ms)</Label>
                <Input
                  id="delayMs"
                  type="number"
                  min={0}
                  step={500}
                  value={delayMs}
                  onChange={(e) => setDelayMs(Number(e.target.value))}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Email Content</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="subject">Subject *</Label>
                <VariableButtons field="subject" />
              </div>
              <Input
                ref={subjectRef}
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Partnership opportunity for {{company}}"
                required
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="body">Body HTML *</Label>
                <VariableButtons field="body" />
              </div>
              <Textarea
                ref={bodyRef}
                id="body"
                value={bodyHtml}
                onChange={(e) => setBodyHtml(e.target.value)}
                placeholder="<p>Hello {{name}},</p>"
                rows={10}
                className="font-mono text-sm"
                required
              />
            </div>

            <Separator />

            <div className="space-y-2">
              <Label>Preview</Label>
              <div className="rounded-md border p-4 bg-white">
                <p className="text-sm font-medium mb-2">
                  Subject: {renderTemplate(subject, sampleVars)}
                </p>
                <Separator className="my-2" />
                <div
                  className="prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{
                    __html: renderTemplate(bodyHtml, sampleVars),
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              Select Contacts ({selectedIds.size} selected)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="Search contacts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            {loadingContacts ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Loading contacts...
              </p>
            ) : filteredContacts.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No contacts found.
              </p>
            ) : (
              <>
                <div className="flex items-center gap-2 py-1">
                  <Checkbox
                    checked={
                      filteredContacts.length > 0 &&
                      selectedIds.size === filteredContacts.length
                    }
                    onCheckedChange={toggleAll}
                  />
                  <span className="text-sm text-muted-foreground">
                    Select all ({filteredContacts.length})
                  </span>
                </div>
                <div className="max-h-64 overflow-y-auto border rounded-md divide-y">
                  {filteredContacts.map((contact) => (
                    <label
                      key={contact.id}
                      className="flex items-center gap-3 px-3 py-2 hover:bg-muted/50 cursor-pointer"
                    >
                      <Checkbox
                        checked={selectedIds.has(contact.id)}
                        onCheckedChange={() => toggleContact(contact.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {contact.name}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {contact.email}
                          {contact.company && ` - ${contact.company}`}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button type="submit" disabled={saving}>
            {saving ? "Creating..." : "Create Campaign"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/campaigns")}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
