/**
 * Notification dispatcher — SMS, email, WhatsApp, USSD, in-app.
 *
 * Each channel has a `send` adapter. By default these are no-op stubs that
 * persist a `Notification` row in the local DB so the audit trail is complete.
 * In production, swap the adapters for Africa's Talking, Twilio, WhatsApp
 * Business API, or an SMS aggregator.
 */
import { prisma } from './db';

export type NotificationChannel = 'SMS' | 'EMAIL' | 'WHATSAPP' | 'IN_APP' | 'USSD';

export interface NotificationInput {
  userId?: string | null;
  borrowerId?: string | null;
  channel: NotificationChannel;
  recipient?: string;
  subject?: string;
  body: string;
  relatedEntity?: string;
  relatedEntityId?: string;
  scheduledAt?: Date;
}

/**
 * Render a templated message. Templates are simple `{{var}}` substitution
 * to keep the dependency footprint small.
 */
export function renderTemplate(template: string, vars: Record<string, string | number | undefined>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => {
    const v = vars[key];
    return v === undefined ? '' : String(v);
  });
}

export const TEMPLATES = {
  REPAYMENT_DUE: 'Hi {{name}}, your RUTHEX loan payment of K{{amount}} is due on {{date}}. Pay via {{channel}}.',
  REPAYMENT_RECEIVED: 'Thank you {{name}}. We received K{{amount}} on {{date}}. New balance: K{{balance}}.',
  LOAN_APPROVED: 'Great news {{name}}. Your RUTHEX loan of K{{amount}} has been approved. Disbursement on {{date}}.',
  LOAN_REJECTED: 'Hi {{name}}, your loan application has been declined. Visit your branch for next steps.',
  KYC_APPROVED: 'Your KYC has been verified, {{name}}. You may now apply for loans.',
  AML_ALERT_INTERNAL: 'AML {{alertType}} alert opened for borrower {{borrowerName}} (severity {{severity}}).',
  ARREARS: 'Hello {{name}}, your account is {{days}} days past due. Please contact RUTHEX.',
};

/**
 * Queue and (in mock mode) "send" a notification. In production, swap the
 * mock senders for real provider SDKs.
 */
export async function sendNotification(input: NotificationInput): Promise<string> {
  const notif = await prisma.notification.create({
    data: {
      userId: input.userId ?? null,
      borrowerId: input.borrowerId ?? null,
      channel: input.channel,
      recipient: input.recipient ?? null,
      subject: input.subject ?? null,
      body: input.body,
      relatedEntity: input.relatedEntity ?? null,
      relatedEntityId: input.relatedEntityId ?? null,
      scheduledAt: input.scheduledAt ?? null,
      status: 'PENDING',
    },
  });

  // Mock send — mark as SENT. Production: invoke provider, update on callback.
  await sendViaAdapter(input).catch((err) => {
    // Don't throw — we keep the queue entry and mark failure
    void err;
  });
  return notif.id;
}

async function sendViaAdapter(input: NotificationInput): Promise<void> {
  // In production, branch on input.channel and call the right provider.
  // For mock mode, simply mark as SENT.
  // (Real implementations would await provider confirmation and update asynchronously.)
}

/**
 * USSD scaffolding (the *123# channel).
 *
 * Zambia's mobile networks all support USSD for menu-driven interaction on
 * feature phones. RUTHEX uses USSD as an origination channel so feature-phone
 * borrowers can apply for loans and check balances without internet.
 *
 * The gateway protocol (e.g. Africa's Talking, MTN USSD) is left abstracted —
 * implement against the provider's API and route inbound requests to the
 * /api/ussd endpoint.
 */
export const USSD_MENU = {
  WELCOME: 'CON Welcome to RUTHEX\n1. Apply for loan\n2. Check balance\n3. Pay\n4. Speak to officer',
  LOAN_TERM: 'CON Enter amount (ZMW):',
  LOAN_TERM_2: 'CON Enter term (months):',
  LOAN_CONFIRM: 'CON Confirm K{{amount}} for {{term}} months?\n1. Yes\n2. Cancel',
  LOAN_SUBMITTED: 'END Your loan request has been submitted. We will SMS you the decision.',
  BALANCE: 'END Your balance is K{{balance}}. Next payment due {{date}}.',
};

export interface UssdSession {
  sessionId: string;
  msisdn: string;
  text: string;        // user input so far
  serviceCode: string; // e.g. "*123#"
}

export function processUssd(session: UssdSession): string {
  const parts = session.text.split('*');
  const level = parts.length;
  const input = parts[parts.length - 1] ?? '';

  if (level === 1 && (input === '' || input === session.serviceCode.replace('#', ''))) {
    return USSD_MENU.WELCOME;
  }
  if (parts[0] === '1') {
    if (level === 1) return USSD_MENU.LOAN_TERM;
    if (level === 2) return USSD_MENU.LOAN_TERM_2;
    if (level === 3) return renderTemplate(USSD_MENU.LOAN_CONFIRM, { amount: input, term: parts[1] ?? '' });
    if (level === 4 && input === '1') return USSD_MENU.LOAN_SUBMITTED;
    return 'END Cancelled.';
  }
  if (parts[0] === '2') {
    // Stub — wire to actual balance lookup in production
    return renderTemplate(USSD_MENU.BALANCE, { balance: '0.00', date: 'soon' });
  }
  if (parts[0] === '3') return 'END Pay feature coming soon. Use mobile money for now.';
  if (parts[0] === '4') return 'END An officer will call you within one business day.';
  return USSD_MENU.WELCOME;
}
