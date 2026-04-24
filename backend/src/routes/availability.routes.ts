import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireStaffOrAdmin } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { supabaseAdmin } from '../config/supabase';
import { logger } from '../config/logger';

const router = Router();

// Every endpoint here requires an authenticated admin_users session.
// requireStaffOrAdmin lets both role='staff' and role='admin' through, which
// is intentional: alias editing is a day-to-day operational action and
// forcing role='admin' would add friction without adding safety. If the
// policy ever tightens, swap requireStaffOrAdmin for requireAdmin on the
// specific route (do not apply at router level, some future endpoints may
// need different gates).
router.use(requireAuth);

// Raw validation only: types and length bound. The trim-and-coerce-empty-to-null
// step runs in the handler below because the shared validate middleware
// (middleware/validate.middleware.ts) discards the parsed output.
const patchAvailabilitySchema = z.object({
  params: z.object({
    id: z.string().uuid()
  }),
  body: z.object({
    guest_alias: z
      .union([z.string().max(120, 'guest_alias must be at most 120 characters'), z.null()])
  })
});

// Apply the trim + empty-to-null coercion the schema cannot express through
// the current validate middleware. Returns the normalised value.
function normaliseAlias(raw: string | null): string | null {
  if (raw === null) return null;
  const trimmed = raw.trim();
  return trimmed.length === 0 ? null : trimmed;
}

/**
 * PATCH /api/admin/availability/:id
 *
 * Edits the human alias for an Airbnb reservation. Alias is stamped on
 * every availability row in the same reservation range so the calendar
 * renders the label consistently across every night of the stay.
 *
 * Semantics:
 *   - Target row must be source='airbnb'. Widget rows already have the
 *     real booking_requests.guest_name; manual rows have no guest. A 422
 *     is returned in those cases so the UI can surface "Alias is only
 *     available for Airbnb reservations" instead of a generic 400.
 *   - If the target row has external_ref set (normal case after iCal
 *     classification), the UPDATE covers every airbnb row with the same
 *     (unit_id, external_ref). One reservation, one alias, many nights.
 *   - If external_ref is NULL (a rare classification miss), only the
 *     target row is updated.
 *   - The response echoes the target row post-update so the client can
 *     reconcile without a follow-up GET.
 *
 * Concurrency: a re-sync running in parallel with an alias edit could
 * race the DELETE inside sync_availability. snapshotGuestAliases in
 * ical-sync.service.ts mitigates this by capturing aliases just before
 * the RPC and reapplying them just after. The window where both can lose
 * is small (milliseconds) and the consequence is degraded UX (alias
 * reverts to previous value until the admin re-types), not data loss.
 */
router.patch(
  '/availability/:id',
  requireStaffOrAdmin,
  validate(patchAvailabilitySchema),
  async (req, res) => {
    const availabilityId = req.params.id;
    const { guest_alias: rawAlias } = req.body as { guest_alias: string | null };
    const guestAlias = normaliseAlias(rawAlias);

    // Load the target row first. We need source + external_ref + unit_id to
    // decide the scope of the UPDATE and to reject widget/manual rows.
    const { data: target, error: targetError } = await supabaseAdmin
      .from('availability')
      .select('id, unit_id, blocked_date, source, external_kind, external_ref, guest_last4, guest_alias')
      .eq('id', availabilityId)
      .maybeSingle();

    if (targetError) {
      logger.error('PATCH /availability: target load failed', {
        availabilityId,
        error: targetError.message
      });
      return res.status(500).json({ error: 'Failed to load availability row' });
    }

    if (!target) {
      return res.status(404).json({ error: 'Availability row not found' });
    }

    if (target.source !== 'airbnb') {
      // 422 signals "valid shape, wrong state" so the UI can distinguish
      // this from a body validation error. Widget rows have guest_name in
      // booking_requests already; manual holds are operator-owned and do
      // not need a guest alias.
      return res.status(422).json({
        error: 'Alias is only available for Airbnb reservations'
      });
    }

    // Range stamp: if external_ref exists, update every night of the
    // reservation so the calendar is consistent. If external_ref is null
    // (classification miss), update just the target row. Either way the
    // UPDATE filters source='airbnb' so a future schema where external_ref
    // might appear on other sources cannot leak aliases sideways.
    let updateQuery = supabaseAdmin
      .from('availability')
      .update({ guest_alias: guestAlias })
      .eq('unit_id', target.unit_id)
      .eq('source', 'airbnb');

    if (target.external_ref) {
      updateQuery = updateQuery.eq('external_ref', target.external_ref);
    } else {
      updateQuery = updateQuery.eq('id', availabilityId);
    }

    const { error: updateError } = await updateQuery;

    if (updateError) {
      logger.error('PATCH /availability: update failed', {
        availabilityId,
        unitId: target.unit_id,
        externalRef: target.external_ref,
        error: updateError.message
      });
      return res.status(500).json({ error: 'Failed to update guest alias' });
    }

    logger.info('availability alias updated', {
      availabilityId,
      unitId: target.unit_id,
      externalRef: target.external_ref,
      adminUserId: res.locals.adminUserId,
      adminRole: res.locals.adminRole,
      clearedAlias: guestAlias === null
    });

    // Return the target row with the new alias applied so the client can
    // reconcile state without a follow-up GET.
    return res.json({
      ...target,
      guest_alias: guestAlias
    });
  }
);

export default router;
