import { Router } from 'express';
import { z } from 'zod';
import { differenceInMinutes } from 'date-fns';
import { supabasePublic } from '../config/supabase';
import { validate } from '../middleware/validate.middleware';
import { dateSchema } from '../utils/validation.utils';
import { getLastSyncAt } from '../services/booking.service';
import { logger } from '../config/logger';
import { syncUnit } from '../services/ical-sync.service';
import { env } from '../config/env';

const router = Router();

router.get('/', async (_req, res) => {
  const { data, error } = await supabasePublic
    .from('units')
    .select(
      'id, name, description, nightly_rate_usd, max_guests, bedrooms, beds, bathrooms, airbnb_listing_url, airbnb_ical_url, image_urls, status, created_at, updated_at, neighborhood, street_address, city, state, country, latitude, longitude, google_maps_url'
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
      'id, name, description, nightly_rate_usd, max_guests, bedrooms, beds, bathrooms, airbnb_listing_url, airbnb_ical_url, image_urls, status, created_at, updated_at, neighborhood, street_address, city, state, country, postal_code, latitude, longitude, google_maps_url'
    )
    .eq('id', unitId)
    .eq('status', 'active')
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      logger.warn('Unit not found', { unitId });
      return res.status(404).json({ error: 'Unit not found' });
    }
    logger.error('Failed to fetch unit', { unitId, message: error.message, code: error.code });
    return res.status(500).json({ error: 'Failed to fetch unit' });
  }

  if (!data) {
    logger.warn('Unit not found', { unitId });
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

    const syncAgeMinutes = lastSync ? differenceInMinutes(new Date(), new Date(lastSync)) : null;
    if (syncAgeMinutes === null || syncAgeMinutes > env.AVAILABILITY_SYNC_TTL_MIN) {
      syncUnit(unitId).catch((err) => {
        logger.warn('Background availability sync failed', {
          unitId,
          message: err instanceof Error ? err.message : String(err)
        });
      });
    }

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
