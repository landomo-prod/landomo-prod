import { notFound } from "next/navigation";
import { getCampaign, getCampaignContacts, getCampaignStats } from "@/lib/db/campaigns";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatsBar } from "@/components/campaigns/StatsBar";
import { CampaignActions } from "@/components/campaigns/CampaignActions";
import { EmailPreview } from "@/components/campaigns/EmailPreview";

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  running: "bg-green-100 text-green-700",
  paused: "bg-yellow-100 text-yellow-700",
  completed: "bg-blue-100 text-blue-700",
};

const contactStatusColors: Record<string, string> = {
  pending: "bg-gray-100 text-gray-700",
  sent: "bg-green-100 text-green-700",
  opened: "bg-yellow-100 text-yellow-700",
  replied: "bg-purple-100 text-purple-700",
  bounced: "bg-red-100 text-red-700",
  failed: "bg-red-100 text-red-700",
};

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const campaignId = parseInt(id, 10);
  if (isNaN(campaignId)) notFound();

  const campaign = getCampaign(campaignId);
  if (!campaign) notFound();

  const contacts = getCampaignContacts(campaignId);
  const stats = getCampaignStats(campaignId);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{campaign.name}</h1>
            <Badge
              variant="secondary"
              className={statusColors[campaign.status] || ""}
            >
              {campaign.status}
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1">{campaign.subject}</p>
        </div>
        <CampaignActions campaign={campaign} />
      </div>

      <Card>
        <CardContent className="pt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">From</span>
              <p className="font-medium">
                {campaign.from_name} &lt;{campaign.from_email}&gt;
              </p>
            </div>
            {campaign.reply_to && (
              <div>
                <span className="text-muted-foreground">Reply-To</span>
                <p className="font-medium">{campaign.reply_to}</p>
              </div>
            )}
            <div>
              <span className="text-muted-foreground">Delay</span>
              <p className="font-medium">{campaign.delay_ms}ms</p>
            </div>
            <div>
              <span className="text-muted-foreground">Created</span>
              <p className="font-medium">{formatDate(campaign.created_at)}</p>
            </div>
            {campaign.started_at && (
              <div>
                <span className="text-muted-foreground">Started</span>
                <p className="font-medium">{formatDate(campaign.started_at)}</p>
              </div>
            )}
            {campaign.completed_at && (
              <div>
                <span className="text-muted-foreground">Completed</span>
                <p className="font-medium">
                  {formatDate(campaign.completed_at)}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <StatsBar campaignId={campaignId} />

      <EmailPreview campaignId={campaignId} />

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle>Contacts ({contacts.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {contacts.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No contacts assigned to this campaign.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Sent At</TableHead>
                  <TableHead>Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contacts.map((cc) => (
                  <TableRow key={cc.id}>
                    <TableCell className="font-medium">
                      {cc.contact.name}
                    </TableCell>
                    <TableCell>{cc.contact.email}</TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={contactStatusColors[cc.status] || ""}
                      >
                        {cc.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {cc.sent_at ? formatDate(cc.sent_at) : "-"}
                    </TableCell>
                    <TableCell className="max-w-48 truncate text-red-500 text-xs">
                      {cc.error || "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
