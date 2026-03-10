import { RequestHandler } from 'express';
import { config } from '../config';
import { getSupabaseAdmin } from '../supabase-client';

interface TelegramUpdate {
  message?: {
    chat: { id: number };
    from?: { id: number; first_name?: string; username?: string };
    text?: string;
  };
}

export function createTelegramWebhookHandler(): RequestHandler {
  return async (req, res) => {
    const secret = req.headers['x-telegram-bot-api-secret-token'];
    if (secret !== config.telegram.webhookSecret) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const update = req.body as TelegramUpdate;
    const message = update.message;

    if (!message || !message.text) {
      res.sendStatus(200);
      return;
    }

    const chatId = message.chat.id;
    const text = message.text.trim();

    if (text === '/start') {
      await sendReply(chatId, [
        'Welcome to Landomo notifications!',
        '',
        `Your chat ID is: <b>${chatId}</b>`,
        '',
        'To receive notifications:',
        '1. Go to your Landomo account settings',
        '2. Add Telegram as a notification channel',
        '3. Enter this chat ID when prompted',
        '4. Send the verification code you receive back here',
      ].join('\n'));
      res.sendStatus(200);
      return;
    }

    // Check if it looks like a verification code (6 digits)
    const codeMatch = text.match(/^\d{6}$/);
    if (codeMatch) {
      await handleVerification(chatId, text);
      res.sendStatus(200);
      return;
    }

    await sendReply(chatId, 'Send /start for instructions, or paste your 6-digit verification code.');
    res.sendStatus(200);
  };
}

async function handleVerification(chatId: number, code: string): Promise<void> {
  const supabase = getSupabaseAdmin();

  // Find a pending verification for this chat_id with matching code
  const { data: channels, error } = await supabase
    .from('user_channels')
    .select('id, user_id')
    .eq('channel_type', 'telegram')
    .eq('verification_code', code)
    .eq('verified', false)
    .filter('config->>chat_id', 'eq', String(chatId));

  if (error || !channels || channels.length === 0) {
    await sendReply(chatId, 'Invalid or expired verification code. Please try again from your Landomo settings.');
    return;
  }

  const channel = channels[0];

  const { error: updateError } = await supabase
    .from('user_channels')
    .update({ verified: true, verification_code: null, verified_at: new Date().toISOString() })
    .eq('id', channel.id);

  if (updateError) {
    await sendReply(chatId, 'Verification failed due to a server error. Please try again later.');
    return;
  }

  await sendReply(chatId, 'Verification successful! You will now receive Landomo notifications here.');
}

async function sendReply(chatId: number, text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
      }),
    });
  } catch (err) {
    const { logger } = require('../logger');
    logger.error({ err: (err as Error).message, chat_id: chatId }, 'failed to send telegram reply');
  }
}
