import { Router } from 'express';
import { z } from 'zod';
import { supabasePublic } from '../config/supabase';
import { validate } from '../middleware/validate.middleware';
import { dateSchema } from '../utils/validation.utils';
import { getLastSyncAt } from '../services/booking.service';
import { logger } from '../config/logger';

const router = Router();

router.get('/', async (_req, res) => {
  const { data, error } = await supabasePublic
    .from('units')
    .select(
      'id, name, description, nightly_rate_usd, max_guests, bedrooms, beds, airbnb_listing_url, airbnb_ical_url, image_urls, status, created_at, updated_at'
    )
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  if (error) {
    logger.error('Failed to fetch units', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint
    });
    return res.status(500).json({ error: 'Failed to fetch units' });
  }

  return res.json(data ?? []);
});

router.get('/:id', async (req, res) => {
  const unitId = req.params.id;

  const { data, error } = await supabasePublic
    .from('units')
    .select(
      'id, name, description, nightly_rate_usd, max_guests, bedrooms, beds, airbnb_listing_url, airbnb_ical_url, image_urls, status, created_at, updated_at'
    )
    .eq('id', unitId)
    .eq('status', 'active')
    .single();

  if (error || !data) {
    logger.warn('Unit not found', { unitId, error: error?.message });
    return res.status(404).json({ error: 'Unit not found' });
  }

  return res.json(data);
});

const availabilitySchema = z.object({
  query: z.object({
    start_date: dateSchema,
    end_date: dateSchema
  }),
  params: z.object({
    id: z.string().uuid()
  })
});

router.get('/:id/availability', validate(availabilitySchema), async (req, res) => {
  try {
    const unitId = req.params.id;
    const startDate = req.query.start_date as string;
    const endDate = req.query.end_date as string;

    const { data, error } = await supabasePublic
      .from('availability')
      .select('blocked_date')
      .eq('unit_id', unitId)
      .gte('blocked_date', startDate)
      .lt('blocked_date', endDate);

    if (error) {
      logger.error('Failed to fetch availability', {
        unitId,
        error: error.message,
        code: error.code
      });
      return res.status(500).json({ error: 'Failed to fetch availability' });
    }

    const lastSync = await getLastSyncAt(unitId);

    return res.json({
      blocked_dates: (data ?? []).map((row) => row.blocked_date),
      last_sync_at: lastSync
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch availability';
    logger.error('Availability endpoint failed', { message });
    return res.status(500).json({ error: message });
  }
});

export default router;
