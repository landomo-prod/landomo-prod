import { Resend } from "resend";

let resendClient: Resend | null = null;

function getResend(): Resend {
  if (!resendClient) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error("RESEND_API_KEY not set");
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

export async function sendEmail(params: {
  fromName: string;
  fromEmail: string;
  replyTo?: string;
  to: string;
  subject: string;
  html: string;
  campaignId: number;
}): Promise<string> {
  const resend = getResend();
  const { data, error } = await resend.emails.send({
    from: `${params.fromName} <${params.fromEmail}>`,
    to: params.to,
    replyTo: params.replyTo || undefined,
    subject: params.subject,
    html: params.html,
    tags: [{ name: "campaign_id", value: String(params.campaignId) }],
  });

  if (error) throw new Error(error.message);
  return data!.id;
}
