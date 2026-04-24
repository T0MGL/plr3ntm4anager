type Locale = 'es' | 'en';

const LOGO_URL = 'https://pub-70473ebb629c4efb93b99bf2e83117da.r2.dev/logo/park-lofts-logogold.png';

const ADMIN_DASHBOARD_URL = 'https://admin.parkloftsparaguay.com';

const HTML_ESCAPE: Record<string, string> = {
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
};

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => HTML_ESCAPE[ch]!);
}

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
    es: 'Asunción, Paraguay',
    en: 'Asunción, Paraguay',
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
    es: 'Recibimos tu solicitud de reserva y está pendiente de revisión. Te enviaremos un correo una vez que sea aprobada.',
    en: 'We received your booking request and it is now pending review. You will receive an email once it has been approved.',
  },
  'request.closing': {
    es: 'Gracias por elegir Park Lofts.',
    en: 'Thank you for choosing Park Lofts.',
  },

  // Booking approved (legacy path, kept for backward compatibility)
  'approved.subject': {
    es: 'Reserva aprobada',
    en: 'Booking approved',
  },
  'approved.heading': {
    es: 'Reserva aprobada',
    en: 'Booking approved',
  },
  'approved.body': {
    es: 'Tu reserva fue aprobada y tu pago fue procesado.',
    en: 'Your booking has been approved and your payment has been processed.',
  },
  'approved.closing': {
    es: 'Esperamos recibirte pronto.',
    en: 'We look forward to hosting you.',
  },

  // Booking rejected (manual rejection by admin, generic)
  'rejected.subject': {
    es: 'Actualización de reserva',
    en: 'Booking update',
  },
  'rejected.heading': {
    es: 'Actualización de reserva',
    en: 'Booking update',
  },
  'rejected.body': {
    es: 'Lamentablemente no podemos confirmar tu solicitud de reserva.',
    en: 'Unfortunately we are unable to confirm your booking request.',
  },
  'rejected.reason': {
    es: 'Motivo',
    en: 'Reason',
  },
  'rejected.refundPreauth': {
    es: 'Liberamos la retención en tu tarjeta. No se realizó ningún cobro. Según tu banco, la retención puede tardar entre 1 y 7 días hábiles en desaparecer del extracto.',
    en: 'We released the hold on your card. No charge was made. Depending on your bank, the hold may take 1 to 7 business days to disappear from your statement.',
  },
  'rejected.refundCaptured': {
    es: 'Revertimos el cobro. El reintegro aparece en tu tarjeta en un plazo estimado de 5 a 10 días hábiles, según el tiempo de procesamiento de tu banco.',
    en: 'We have reversed the charge. The refund will appear on your card within an estimated 5 to 10 business days, depending on your bank\'s processing time.',
  },
  'rejected.closing': {
    es: 'Si tenés alguna consulta, no dudes en escribirnos.',
    en: 'If you have any questions, please do not hesitate to reach out.',
  },

  // Conflict rejection (explicit refund language to prevent panic)
  'conflict.subject': {
    es: 'No pudimos confirmar tu reserva',
    en: 'We could not confirm your booking',
  },
  'conflict.heading': {
    es: 'No pudimos confirmar tu reserva',
    en: 'We could not confirm your booking',
  },
  'conflict.body': {
    es: 'Tu solicitud llegó casi al mismo tiempo que otra reserva para las mismas fechas y, lamentablemente, no pudimos confirmarla.',
    en: 'Your request arrived at nearly the same time as another booking for the same dates, and unfortunately we were unable to confirm yours.',
  },
  // Used when the booking was on the auto path and the charge had already
  // been captured before the conflict was detected. Rollback here is a real
  // refund back to the card (5 to 10 business days typical).
  'conflict.refundCaptured': {
    es: 'Revertimos el cobro. El reintegro aparece en tu tarjeta en un plazo estimado de 5 a 10 días hábiles, según el tiempo de procesamiento de tu banco.',
    en: 'We have reversed the charge. The refund will appear on your card within an estimated 5 to 10 business days, depending on your bank\'s processing time.',
  },
  // Used when the booking was on the manual path and only a preauthorization
  // was placed. Rollback here releases the hold; no money ever moved, so the
  // "refund" language would be wrong and alarming.
  'conflict.refundPreauth': {
    es: 'Liberamos la retención en tu tarjeta. No se realizó ningún cobro. Según tu banco, la retención puede tardar entre 1 y 7 días hábiles en desaparecer del extracto.',
    en: 'We released the hold on your card. No charge was made. Depending on your bank, the hold may take 1 to 7 business days to disappear from your statement.',
  },
  'conflict.nextSteps': {
    es: 'Si querés, podemos ayudarte a encontrar otras fechas o unidades disponibles. Respondé a este correo y te asistimos de inmediato.',
    en: 'If you would like, we can help you find other dates or available units. Reply to this email and we will assist you right away.',
  },
  'conflict.closing': {
    es: 'Gracias por tu paciencia.',
    en: 'Thank you for your patience.',
  },

  // Under review (manual path, preauthorization placed)
  'underReview.subject': {
    es: 'Estamos verificando tu reserva',
    en: 'We are verifying your booking',
  },
  'underReview.heading': {
    es: 'Estamos verificando tu reserva',
    en: 'We are verifying your booking',
  },
  'underReview.body': {
    es: 'Tu tarjeta tiene una autorización temporal por el monto de la reserva mientras confirmamos la disponibilidad. No se realizó un cobro todavía.',
    en: 'Your card has a temporary authorization for the amount of the booking while we confirm availability. No charge has been completed yet.',
  },
  'underReview.timeline': {
    es: 'Normalmente confirmamos dentro de las próximas horas. Te avisamos por correo apenas esté resuelto.',
    en: 'We usually confirm within the next few hours. We will email you as soon as it is resolved.',
  },
  'underReview.ifConflict': {
    es: 'Si por algún motivo no podemos confirmar las fechas, liberamos la autorización y no se te cobra nada.',
    en: 'If for any reason we cannot confirm the dates, we release the authorization and nothing is charged.',
  },
  'underReview.closing': {
    es: 'Gracias por confiar en Park Lofts.',
    en: 'Thank you for trusting Park Lofts.',
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
    es: 'Tu pago fue procesado con éxito. Estos son los detalles de tu reserva:',
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
  'payment.reference': {
    es: 'Referencia',
    en: 'Reference',
  },
  'payment.nights': {
    es: 'Noches',
    en: 'Nights',
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
    es: 'Tu pago no pudo ser procesado. Esto puede ocurrir si la tarjeta fue rechazada o la transacción expiró.',
    en: 'Your payment could not be processed. This can happen if the card was declined or the transaction timed out.',
  },
  'paymentFailed.closing': {
    es: 'Podés intentar nuevamente desde tu link de reserva, o escribinos si necesitás asistencia.',
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

function infoBlock(text: string, accent: string = COLORS.gold): string {
  return `<div style="margin:16px 0 20px;padding:14px 18px;background-color:${COLORS.cream};border-left:3px solid ${accent};font-size:14px;line-height:1.6;color:${COLORS.charcoal};">${text}</div>`;
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

// Public API

export function bookingRequestEmail(params: {
  guestName: string;
  bookingId: string;
  locale?: string | null;
}): { subject: string; html: string } {
  const locale = resolveLocale(params.locale);
  const reference = params.bookingId.slice(0, 8).toUpperCase();
  const refLabel = locale === 'es' ? 'Tu número de referencia' : 'Your reference number';
  const subject = get('request.subject', locale);
  const html = wrap(locale, [
    heading(get('request.heading', locale)),
    greeting(params.guestName, locale),
    paragraph(get('request.body', locale)),
    `<div style="margin:16px 0 20px;padding:16px 20px;background-color:${COLORS.cream};border-left:3px solid ${COLORS.gold};">
      <span style="font-size:12px;color:${COLORS.gray};text-transform:uppercase;letter-spacing:0.1em;">${refLabel}</span>
      <div style="margin-top:4px;font-family:monospace;font-size:18px;font-weight:600;letter-spacing:0.08em;color:${COLORS.charcoal};">${reference}</div>
    </div>`,
    closing(get('request.closing', locale)),
  ].join(''));
  return { subject, html };
}

export function bookingApprovedEmail(params: {
  guestName: string;
  bookingId: string;
  locale?: string | null;
}): { subject: string; html: string } {
  const locale = resolveLocale(params.locale);
  const reference = params.bookingId.slice(0, 8).toUpperCase();
  const refLabel = locale === 'es' ? 'Tu número de referencia' : 'Your reference number';
  const subject = get('approved.subject', locale);
  const html = wrap(locale, [
    heading(get('approved.heading', locale)),
    greeting(params.guestName, locale),
    paragraph(get('approved.body', locale)),
    `<div style="margin:16px 0 20px;padding:16px 20px;background-color:${COLORS.cream};border-left:3px solid ${COLORS.gold};">
      <span style="font-size:12px;color:${COLORS.gray};text-transform:uppercase;letter-spacing:0.1em;">${refLabel}</span>
      <div style="margin-top:4px;font-family:monospace;font-size:18px;font-weight:600;letter-spacing:0.08em;color:${COLORS.charcoal};">${reference}</div>
    </div>`,
    closing(get('approved.closing', locale)),
  ].join(''));
  return { subject, html };
}

export function bookingRejectedEmail(params: {
  guestName: string;
  reason: string;
  bookingId: string;
  locale?: string | null;
  // When the rejected booking had a payment on file, pass its status so the
  // email tells the guest exactly what to expect on their statement.
  //   'completed'     -> captured charge reversed, refund in 5 to 10 days.
  //   'preauthorized' -> hold released, no charge was ever made.
  //   undefined       -> no payment or unknown, skip the refund block.
  paymentType?: 'preauthorized' | 'completed' | null;
}): { subject: string; html: string } {
  const locale = resolveLocale(params.locale);
  const reference = params.bookingId.slice(0, 8).toUpperCase();
  const refLabel = locale === 'es' ? 'Referencia' : 'Reference';
  const subject = get('rejected.subject', locale);

  const refundKey =
    params.paymentType === 'completed'
      ? 'rejected.refundCaptured'
      : params.paymentType === 'preauthorized'
        ? 'rejected.refundPreauth'
        : null;

  const html = wrap(locale, [
    heading(get('rejected.heading', locale)),
    greeting(params.guestName, locale),
    paragraph(get('rejected.body', locale)),
    paragraph(`<strong>${get('rejected.reason', locale)}:</strong> ${params.reason}`),
    refundKey ? infoBlock(get(refundKey, locale)) : '',
    `<div style="margin:16px 0 20px;padding:16px 20px;background-color:${COLORS.cream};border-left:3px solid ${COLORS.gold};">
      <span style="font-size:12px;color:${COLORS.gray};text-transform:uppercase;letter-spacing:0.1em;">${refLabel}</span>
      <div style="margin-top:4px;font-family:monospace;font-size:18px;font-weight:600;letter-spacing:0.08em;color:${COLORS.charcoal};">${reference}</div>
    </div>`,
    closing(get('rejected.closing', locale)),
  ].join(''));
  return { subject, html };
}

export function bookingUnderReviewEmail(params: {
  guestName: string;
  bookingId: string;
  locale?: string | null;
}): { subject: string; html: string } {
  const locale = resolveLocale(params.locale);
  const reference = params.bookingId.slice(0, 8).toUpperCase();
  const refLabel = locale === 'es' ? 'Referencia' : 'Reference';
  const subject = get('underReview.subject', locale);
  const html = wrap(locale, [
    heading(get('underReview.heading', locale)),
    greeting(params.guestName, locale),
    paragraph(get('underReview.body', locale)),
    paragraph(get('underReview.timeline', locale)),
    infoBlock(get('underReview.ifConflict', locale)),
    `<div style="margin:16px 0 20px;padding:16px 20px;background-color:${COLORS.cream};border-left:3px solid ${COLORS.gold};">
      <span style="font-size:12px;color:${COLORS.gray};text-transform:uppercase;letter-spacing:0.1em;">${refLabel}</span>
      <div style="margin-top:4px;font-family:monospace;font-size:18px;font-weight:600;letter-spacing:0.08em;color:${COLORS.charcoal};">${reference}</div>
    </div>`,
    closing(get('underReview.closing', locale)),
  ].join(''));
  return { subject, html };
}

export function bookingConflictRejectionEmail(params: {
  guestName: string;
  bookingId: string;
  locale?: string | null;
  // Drives which refund paragraph the guest sees:
  //   'completed'     -> captured charge reversed, refund in 5 to 10 days.
  //   'preauthorized' -> hold released, no charge was ever made.
  //   null/undefined  -> no active payment to describe, skip the block.
  // In normal approval-recheck flow this is always set (auto=completed or
  // manual=preauthorized). It may be null only if the payment row was
  // already Failed/Refunded before recheck, in which case talking about a
  // refund would be misleading.
  paymentType?: 'preauthorized' | 'completed' | null;
}): { subject: string; html: string } {
  const locale = resolveLocale(params.locale);
  const reference = params.bookingId.slice(0, 8).toUpperCase();
  const refLabel = locale === 'es' ? 'Referencia' : 'Reference';
  const subject = get('conflict.subject', locale);
  const refundKey =
    params.paymentType === 'preauthorized'
      ? 'conflict.refundPreauth'
      : params.paymentType === 'completed'
        ? 'conflict.refundCaptured'
        : null;
  const html = wrap(locale, [
    heading(get('conflict.heading', locale)),
    greeting(params.guestName, locale),
    paragraph(get('conflict.body', locale)),
    refundKey ? infoBlock(get(refundKey, locale)) : '',
    paragraph(get('conflict.nextSteps', locale)),
    `<div style="margin:16px 0 20px;padding:16px 20px;background-color:${COLORS.cream};border-left:3px solid ${COLORS.gold};">
      <span style="font-size:12px;color:${COLORS.gray};text-transform:uppercase;letter-spacing:0.1em;">${refLabel}</span>
      <div style="margin-top:4px;font-family:monospace;font-size:18px;font-weight:600;letter-spacing:0.08em;color:${COLORS.charcoal};">${reference}</div>
    </div>`,
    closing(get('conflict.closing', locale)),
  ].join(''));
  return { subject, html };
}

export function paymentConfirmedEmail(params: {
  guestName: string;
  unitName: string;
  checkIn: string;
  checkOut: string;
  totalUsd: number;
  nights: number;
  bookingId: string;
  locale?: string | null;
}): { subject: string; html: string } {
  const locale = resolveLocale(params.locale);
  const reference = params.bookingId.slice(0, 8).toUpperCase();
  const subject = get('payment.subject', locale);
  const html = wrap(locale, [
    heading(get('payment.heading', locale)),
    greeting(params.guestName, locale),
    paragraph(get('payment.body', locale)),
    `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:8px 0 16px;">`,
    detailRow(get('payment.reference', locale), `<span style="font-family:monospace;letter-spacing:0.05em;">${reference}</span>`),
    detailRow(get('payment.unit', locale), params.unitName),
    detailRow(get('payment.checkIn', locale), params.checkIn),
    detailRow(get('payment.checkOut', locale), params.checkOut),
    detailRow(get('payment.nights', locale), String(params.nights)),
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

export function adminInviteEmail(params: {
  name: string;
  email: string;
  tempPassword: string;
}): { subject: string; html: string } {
  const safeName = escapeHtml(params.name);
  const safeEmail = escapeHtml(params.email);
  const safePassword = escapeHtml(params.tempPassword);

  const html = wrap('es', [
    heading('Tu acceso al panel de administración'),
    `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${COLORS.charcoal};">Hola ${safeName},</p>`,
    paragraph('Se creó tu cuenta con acceso al panel de administración de Park Lofts. Ingresá con las credenciales de abajo y cambiá tu contraseña en el primer inicio de sesión.'),
    `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:16px 0 20px;background-color:${COLORS.cream};border-left:3px solid ${COLORS.gold};">
      <tr><td style="padding:18px 20px;">
        ${detailRow('Email', `<span style="font-family:monospace;letter-spacing:0.04em;">${safeEmail}</span>`)}
        ${detailRow('Contraseña', `<span style="font-family:monospace;letter-spacing:0.08em;font-size:15px;font-weight:600;color:${COLORS.charcoal};">${safePassword}</span>`, true)}
      </td></tr>
    </table>`,
    `<p style="margin:20px 0 24px;">
      <a href="${ADMIN_DASHBOARD_URL}/login" style="display:inline-block;padding:13px 24px;background-color:${COLORS.charcoal};color:${COLORS.cream};text-decoration:none;border-radius:6px;font-size:14px;font-weight:600;letter-spacing:0.02em;">Acceder al panel</a>
    </p>`,
    closing('Cambiá tu contraseña apenas ingreses por primera vez.'),
  ].join(''));

  return { subject: 'Tu acceso al panel Park Lofts', html };
}

export function adminPasswordResetEmail(params: {
  name: string;
  resetUrl: string;
}): { subject: string; html: string } {
  const safeName = escapeHtml(params.name);
  const safeUrl = escapeHtml(params.resetUrl);

  const html = wrap('es', [
    heading('Recuperá tu contraseña'),
    `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${COLORS.charcoal};">Hola ${safeName},</p>`,
    paragraph('Recibimos una solicitud para crear una nueva contraseña en tu cuenta del panel de administración.'),
    infoBlock('El enlace es válido por 1 hora. Si no fuiste vos, podés ignorar este correo.'),
    `<p style="margin:20px 0 24px;">
      <a href="${safeUrl}" style="display:inline-block;padding:13px 24px;background-color:${COLORS.charcoal};color:${COLORS.cream};text-decoration:none;border-radius:6px;font-size:14px;font-weight:600;letter-spacing:0.02em;">Crear nueva contraseña</a>
    </p>`,
    closing('Tu contraseña actual sigue funcionando hasta que completes el cambio.'),
  ].join(''));

  return { subject: 'Recuperación de contraseña - Park Lofts Admin', html };
}

export function stuckPreauthInternalAlertEmail(params: {
  bookings: Array<{
    bookingId: string;
    guestName: string;
    unitName: string;
    checkIn: string;
    checkOut: string;
    createdAt: string;
    ageDays: number;
  }>;
  thresholdDays: number;
  dashboardUrl: string;
}): { subject: string; html: string } {
  const count = params.bookings.length;
  const subject = `[Park Lofts] ${count} preautorización(es) sin resolver > ${params.thresholdDays} días`;

  const rows = params.bookings
    .map(
      (b) => `<tr>
        <td style="padding:8px 10px;border-bottom:1px solid ${COLORS.border};font-family:monospace;font-size:12px;color:${COLORS.charcoal};">${b.bookingId.slice(0, 8).toUpperCase()}</td>
        <td style="padding:8px 10px;border-bottom:1px solid ${COLORS.border};font-size:13px;color:${COLORS.charcoal};">${b.unitName}</td>
        <td style="padding:8px 10px;border-bottom:1px solid ${COLORS.border};font-size:13px;color:${COLORS.charcoal};">${b.guestName}</td>
        <td style="padding:8px 10px;border-bottom:1px solid ${COLORS.border};font-size:13px;color:${COLORS.charcoal};">${b.checkIn} → ${b.checkOut}</td>
        <td style="padding:8px 10px;border-bottom:1px solid ${COLORS.border};font-size:13px;text-align:right;color:${COLORS.charcoal};">${b.ageDays}d</td>
      </tr>`
    )
    .join('');

  const html = wrap('es', [
    heading('Preautorizaciones sin resolver'),
    paragraph(
      `Hay ${count} reserva(s) en el flujo manual con una preautorización pendiente por más de ${params.thresholdDays} días. Revisá el dashboard y resolvé (aprobar o rechazar) antes de que la autorización expire en el banco emisor.`
    ),
    `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:8px 0 16px;border-collapse:collapse;">
      <thead>
        <tr>
          <th style="text-align:left;padding:8px 10px;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:${COLORS.gray};border-bottom:2px solid ${COLORS.border};">Ref</th>
          <th style="text-align:left;padding:8px 10px;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:${COLORS.gray};border-bottom:2px solid ${COLORS.border};">Unidad</th>
          <th style="text-align:left;padding:8px 10px;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:${COLORS.gray};border-bottom:2px solid ${COLORS.border};">Huésped</th>
          <th style="text-align:left;padding:8px 10px;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:${COLORS.gray};border-bottom:2px solid ${COLORS.border};">Fechas</th>
          <th style="text-align:right;padding:8px 10px;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:${COLORS.gray};border-bottom:2px solid ${COLORS.border};">Antigüedad</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`,
    `<p style="margin:24px 0 0;"><a href="${params.dashboardUrl}" style="display:inline-block;padding:12px 20px;background-color:${COLORS.charcoal};color:${COLORS.cream};text-decoration:none;border-radius:6px;font-size:14px;font-weight:600;">Abrir dashboard</a></p>`,
  ].join(''));

  return { subject, html };
}
