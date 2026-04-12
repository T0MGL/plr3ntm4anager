type Locale = 'es' | 'en';

const LOGO_URL = 'https://pub-70473ebb629c4efb93b99bf2e83117da.r2.dev/logo/park-lofts-logogold.png';

const COLORS = {
  charcoal: '#2C2926',
  cream: '#F5F2ED',
  gold: '#B5975F',
  white: '#FFFFFF',
  gray: '#6B6560',
  border: '#E8E4DF',
} as const;

function resolveLocale(raw?: string | null): Locale {
  if (!raw) return 'es';
  return raw.startsWith('es') ? 'es' : 'en';
}

const t: Record<string, Record<Locale, string>> = {
  // Shared
  'footer.address': {
    es: 'Asuncion, Paraguay',
    en: 'Asuncion, Paraguay',
  },
  'footer.contact': {
    es: 'reservas@parkloftsparaguay.com | +595 981 587 588',
    en: 'reservas@parkloftsparaguay.com | +595 981 587 588',
  },
  'footer.rights': {
    es: `\u00A9 ${new Date().getFullYear()} Park Lofts. Todos los derechos reservados.`,
    en: `\u00A9 ${new Date().getFullYear()} Park Lofts. All rights reserved.`,
  },

  // Booking request received
  'request.subject': {
    es: 'Solicitud de reserva recibida',
    en: 'Booking request received',
  },
  'request.heading': {
    es: 'Solicitud recibida',
    en: 'Request received',
  },
  'request.body': {
    es: 'Recibimos tu solicitud de reserva y esta pendiente de revision. Te enviaremos un email una vez que sea aprobada.',
    en: 'We received your booking request and it is now pending review. You will receive an email once it has been approved.',
  },
  'request.closing': {
    es: 'Gracias por elegir Park Lofts.',
    en: 'Thank you for choosing Park Lofts.',
  },

  // Booking approved
  'approved.subject': {
    es: 'Reserva aprobada',
    en: 'Booking approved',
  },
  'approved.heading': {
    es: 'Reserva aprobada',
    en: 'Booking approved',
  },
  'approved.body': {
    es: 'Tu reserva ha sido aprobada y tu pago ha sido procesado.',
    en: 'Your booking has been approved and your payment has been processed.',
  },
  'approved.closing': {
    es: 'Esperamos recibirte pronto.',
    en: 'We look forward to hosting you.',
  },

  // Booking rejected
  'rejected.subject': {
    es: 'Actualizacion de reserva',
    en: 'Booking update',
  },
  'rejected.heading': {
    es: 'Actualizacion de reserva',
    en: 'Booking update',
  },
  'rejected.body': {
    es: 'Lamentablemente, no podemos acomodar tu solicitud de reserva.',
    en: 'Unfortunately, we are unable to accommodate your booking request.',
  },
  'rejected.reason': {
    es: 'Motivo',
    en: 'Reason',
  },
  'rejected.closing': {
    es: 'Si tienes alguna consulta, no dudes en contactarnos.',
    en: 'If you have any questions, please do not hesitate to reach out.',
  },

  // Payment confirmed
  'payment.subject': {
    es: 'Pago confirmado',
    en: 'Payment confirmed',
  },
  'payment.heading': {
    es: 'Pago confirmado',
    en: 'Payment confirmed',
  },
  'payment.body': {
    es: 'Tu pago ha sido procesado exitosamente. Aqui estan los detalles de tu reserva:',
    en: 'Your payment has been processed successfully. Here are your reservation details:',
  },
  'payment.unit': {
    es: 'Unidad',
    en: 'Unit',
  },
  'payment.checkIn': {
    es: 'Check-in',
    en: 'Check-in',
  },
  'payment.checkOut': {
    es: 'Check-out',
    en: 'Check-out',
  },
  'payment.total': {
    es: 'Total',
    en: 'Total',
  },
  'payment.closing': {
    es: 'Esperamos recibirte pronto.',
    en: 'We look forward to hosting you.',
  },

  // Payment failed
  'paymentFailed.subject': {
    es: 'Pago no procesado',
    en: 'Payment not processed',
  },
  'paymentFailed.heading': {
    es: 'Pago no procesado',
    en: 'Payment not processed',
  },
  'paymentFailed.body': {
    es: 'Tu pago no pudo ser procesado. Esto puede ocurrir si la tarjeta fue rechazada o la transaccion expiro.',
    en: 'Your payment could not be processed. This can happen if the card was declined or the transaction timed out.',
  },
  'paymentFailed.closing': {
    es: 'Podes intentar nuevamente desde tu link de reserva, o contactanos si necesitas asistencia.',
    en: 'You can try again from your booking link, or contact us if you need assistance.',
  },
};

function get(key: string, locale: Locale): string {
  return t[key]?.[locale] ?? t[key]?.['en'] ?? key;
}

function firstName(fullName: string): string {
  const name = (fullName ?? '').split(' ')[0] || 'guest';
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}

function wrap(locale: Locale, content: string): string {
  return `<!DOCTYPE html>
<html lang="${locale}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:${COLORS.cream};font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:${COLORS.cream};">
<tr><td align="center" style="padding:40px 16px;">
<table role="presentation" cellpadding="0" cellspacing="0" width="560" style="max-width:560px;width:100%;">

<!-- HEADER -->
<tr><td align="center" style="padding:32px 0 24px;background-color:${COLORS.charcoal};border-radius:8px 8px 0 0;">
  <img src="${LOGO_URL}" alt="Park Lofts" width="48" height="48" style="display:block;width:48px;height:48px;margin:0 auto 12px;" />
  <span style="font-family:Georgia,'Times New Roman',serif;font-size:20px;color:${COLORS.cream};letter-spacing:0.02em;">Park Lofts</span>
  <span style="display:block;margin-top:4px;font-size:10px;letter-spacing:0.3em;color:${COLORS.gold};text-transform:uppercase;">Rent</span>
</td></tr>

<!-- GOLD ACCENT LINE -->
<tr><td style="height:3px;background-color:${COLORS.gold};font-size:0;line-height:0;">&nbsp;</td></tr>

<!-- BODY -->
<tr><td style="background-color:${COLORS.white};padding:36px 32px 32px;">
${content}
</td></tr>

<!-- FOOTER -->
<tr><td style="background-color:${COLORS.cream};padding:24px 32px;border-top:1px solid ${COLORS.border};border-radius:0 0 8px 8px;">
  <p style="margin:0 0 6px;font-size:12px;color:${COLORS.gray};text-align:center;">${get('footer.contact', locale)}</p>
  <p style="margin:0 0 6px;font-size:12px;color:${COLORS.gray};text-align:center;">${get('footer.address', locale)}</p>
  <p style="margin:0;font-size:11px;color:${COLORS.gray};text-align:center;opacity:0.7;">${get('footer.rights', locale)}</p>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

function heading(text: string): string {
  return `<h2 style="margin:0 0 20px;font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:400;color:${COLORS.charcoal};">${text}</h2>`;
}

function greeting(name: string, locale: Locale): string {
  const hi = locale === 'es' ? 'Hola' : 'Hi';
  return `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${COLORS.charcoal};">${hi} ${firstName(name)},</p>`;
}

function paragraph(text: string): string {
  return `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${COLORS.charcoal};">${text}</p>`;
}

function closing(text: string): string {
  return `<p style="margin:16px 0 0;font-size:15px;line-height:1.6;color:${COLORS.gray};">${text}</p>`;
}

function detailRow(label: string, value: string, isLast = false): string {
  const border = isLast ? '' : `border-bottom:1px solid ${COLORS.border};`;
  return `<tr>
    <td style="padding:12px 0;${border}font-size:14px;color:${COLORS.gray};">${label}</td>
    <td style="padding:12px 0;${border}text-align:right;font-weight:500;font-size:14px;color:${COLORS.charcoal};">${value}</td>
  </tr>`;
}

// ─── PUBLIC API ──────────────────────────────────────────────────────────

export function bookingRequestEmail(params: {
  guestName: string;
  locale?: string | null;
}): { subject: string; html: string } {
  const locale = resolveLocale(params.locale);
  const subject = get('request.subject', locale);
  const html = wrap(locale, [
    heading(get('request.heading', locale)),
    greeting(params.guestName, locale),
    paragraph(get('request.body', locale)),
    closing(get('request.closing', locale)),
  ].join(''));
  return { subject, html };
}

export function bookingApprovedEmail(params: {
  guestName: string;
  locale?: string | null;
}): { subject: string; html: string } {
  const locale = resolveLocale(params.locale);
  const subject = get('approved.subject', locale);
  const html = wrap(locale, [
    heading(get('approved.heading', locale)),
    greeting(params.guestName, locale),
    paragraph(get('approved.body', locale)),
    closing(get('approved.closing', locale)),
  ].join(''));
  return { subject, html };
}

export function bookingRejectedEmail(params: {
  guestName: string;
  reason: string;
  locale?: string | null;
}): { subject: string; html: string } {
  const locale = resolveLocale(params.locale);
  const subject = get('rejected.subject', locale);
  const html = wrap(locale, [
    heading(get('rejected.heading', locale)),
    greeting(params.guestName, locale),
    paragraph(get('rejected.body', locale)),
    paragraph(`<strong>${get('rejected.reason', locale)}:</strong> ${params.reason}`),
    closing(get('rejected.closing', locale)),
  ].join(''));
  return { subject, html };
}

export function paymentConfirmedEmail(params: {
  guestName: string;
  unitName: string;
  checkIn: string;
  checkOut: string;
  totalUsd: number;
  locale?: string | null;
}): { subject: string; html: string } {
  const locale = resolveLocale(params.locale);
  const subject = get('payment.subject', locale);
  const html = wrap(locale, [
    heading(get('payment.heading', locale)),
    greeting(params.guestName, locale),
    paragraph(get('payment.body', locale)),
    `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:8px 0 16px;">`,
    detailRow(get('payment.unit', locale), params.unitName),
    detailRow(get('payment.checkIn', locale), params.checkIn),
    detailRow(get('payment.checkOut', locale), params.checkOut),
    detailRow(get('payment.total', locale), `$${params.totalUsd.toFixed(2)} USD`, true),
    `</table>`,
    closing(get('payment.closing', locale)),
  ].join(''));
  return { subject, html };
}

export function paymentFailedEmail(params: {
  guestName: string;
  locale?: string | null;
}): { subject: string; html: string } {
  const locale = resolveLocale(params.locale);
  const subject = get('paymentFailed.subject', locale);
  const html = wrap(locale, [
    heading(get('paymentFailed.heading', locale)),
    greeting(params.guestName, locale),
    paragraph(get('paymentFailed.body', locale)),
    closing(get('paymentFailed.closing', locale)),
  ].join(''));
  return { subject, html };
}
