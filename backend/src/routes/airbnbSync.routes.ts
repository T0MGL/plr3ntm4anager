import { Router } from 'express';
import { z } from 'zod';
import axios from 'axios';
import { requireAuth } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { manualSyncRateLimit } from '../middleware/rate-limit.middleware';
import { supabaseAdmin } from '../config/supabase';
import { env } from '../config/env';
import { logger } from '../config/logger';

const router = Router();

router.use(requireAuth);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const APIFY_BASE = 'https://api.apify.com/v2';
const ACTOR_ID = 'OIYrZy1OpUEgIMYmh'; // tri_angle~airbnb-rooms-urls-scraper

function extractListingId(url: string): string | null {
  const match = url.match(/\/rooms\/(\d{10,})/);
  return match ? match[1] : null;
}

// Strip Airbnb date prefix from description: "Apr 23, 2026 · Entire rental unit · …"
function cleanDescription(raw: string): string {
  return raw.replace(/^[A-Z][a-z]{2}\s+\d{1,2},\s+\d{4}\s+·\s+[^·]+·\s+/u, '').trim();
}

async function discoverHostListings(hostId: string): Promise<string[]> {
  const url = `https://www.airbnb.com/users/show/${hostId}`;
  const { data: html } = await axios.get<string>(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5'
    },
    timeout: 15_000
  });

  const ids = new Set<string>();
  const re = /\/rooms\/(\d{10,})/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    ids.add(m[1]);
  }
  return Array.from(ids);
}

interface ApifyListingResult {
  id: string | number;
  seoTitle?: string;
  description?: string;
  metaDescription?: string;
  coordinates?: { latitude: number; longitude: number };
  personCapacity?: number;
  subDescription?: { items?: string[] };
  images?: { imageUrl: string }[];
  locationSubtitle?: string;
}

async function scrapeListings(listingIds: string[]): Promise<ApifyListingResult[]> {
  if (!env.APIFY_API_KEY) {
    throw new Error('APIFY_API_KEY is not configured');
  }
  const inputUrls = listingIds.map((id) => ({ url: `https://www.airbnb.com/rooms/${id}` }));

  // Start run
  const runResp = await axios.post<{ data: { id: string } }>(
    `${APIFY_BASE}/acts/${ACTOR_ID}/runs`,
    { startUrls: inputUrls, maxConcurrency: 5 },
    {
      params: { token: env.APIFY_API_KEY },
      timeout: 10_000
    }
  );

  const runId = runResp.data.data.id;

  // Poll until finished (max 4 minutes)
  const deadline = Date.now() + 4 * 60 * 1_000;
  let status = 'RUNNING';

  while (status === 'RUNNING' || status === 'READY' || status === 'CREATED') {
    if (Date.now() > deadline) {
      throw new Error(`Apify run ${runId} timed out after 4 minutes`);
    }
    await new Promise((r) => setTimeout(r, 3_000));

    const statusResp = await axios.get<{ data: { status: string } }>(
      `${APIFY_BASE}/actor-runs/${runId}`,
      { params: { token: env.APIFY_API_KEY }, timeout: 5_000 }
    );
    status = statusResp.data.data.status;
  }

  if (status !== 'SUCCEEDED') {
    throw new Error(`Apify run ${runId} ended with status: ${status}`);
  }

  // Fetch dataset
  const datasetResp = await axios.get<{ items: ApifyListingResult[] }>(
    `${APIFY_BASE}/actor-runs/${runId}/dataset/items`,
    { params: { token: env.APIFY_API_KEY, format: 'json' }, timeout: 15_000 }
  );

  return datasetResp.data.items ?? [];
}

function parseSubDescription(items: string[]): { guests: number; bedrooms: number; beds: number } {
  const result = { guests: 2, bedrooms: 1, beds: 1 };
  for (const item of items) {
    const lower = item.toLowerCase();
    const num = parseInt(item, 10);
    if (!isNaN(num)) {
      if (lower.includes('guest')) result.guests = num;
      else if (lower.includes('bedroom')) result.bedrooms = num;
      else if (lower.includes('bed') && !lower.includes('bedroom')) result.beds = num;
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// GET /api/admin/settings
// Read all settings rows (key/value pairs)
// ---------------------------------------------------------------------------
router.get('/settings', async (_req, res) => {
  const { data, error } = await supabaseAdmin
    .from('settings')
    .select('key, value, updated_at')
    .order('key', { ascending: true });

  if (error) {
    logger.error('Failed to fetch settings', { error: error.message });
    return res.status(500).json({ error: 'Failed to fetch settings' });
  }

  return res.json(data ?? []);
});

// ---------------------------------------------------------------------------
// PATCH /api/admin/settings
// Upsert one or more settings. Body: { key: string, value: string }[]
// ---------------------------------------------------------------------------
const patchSettingsSchema = z.object({
  body: z.array(
    z.object({
      key: z.string().min(1).max(200),
      value: z.string().max(2000)
    })
  )
});

router.patch('/settings', validate(patchSettingsSchema), async (req, res) => {
  const rows = req.body as { key: string; value: string }[];

  const { error } = await supabaseAdmin
    .from('settings')
    .upsert(rows.map((r) => ({ key: r.key, value: r.value })), { onConflict: 'key' });

  if (error) {
    logger.error('Failed to update settings', { error: error.message });
    return res.status(500).json({ error: 'Failed to update settings' });
  }

  return res.json({ success: true });
});

// ---------------------------------------------------------------------------
// POST /api/admin/units/sync-airbnb
// Phase 1: discover + diff + scrape new listings. Returns preview.
// ---------------------------------------------------------------------------
router.post('/units/sync-airbnb', manualSyncRateLimit, async (_req, res) => {
  // Read host ID from settings table
  const { data: settingRow, error: settingError } = await supabaseAdmin
    .from('settings')
    .select('value')
    .eq('key', 'airbnb_host_id')
    .single();

  if (settingError || !settingRow) {
    logger.error('sync-airbnb: airbnb_host_id setting not found', { error: settingError?.message });
    return res.status(500).json({ error: 'Airbnb host ID not configured. Go to Settings to set it.' });
  }

  const hostId = settingRow.value.trim();

  // Discover all listing IDs from the host profile page
  let allHostIds: string[];
  try {
    allHostIds = await discoverHostListings(hostId);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Discovery failed';
    logger.error('sync-airbnb: discovery failed', { hostId, error: msg });
    return res.status(502).json({ error: `Failed to fetch Airbnb host page: ${msg}` });
  }

  if (allHostIds.length === 0) {
    return res.json({ alreadyImported: [], newListings: [] });
  }

  // Fetch currently imported listing IDs from the DB
  const { data: existingUnits, error: unitsError } = await supabaseAdmin
    .from('units')
    .select('id, name, airbnb_listing_url, image_urls, nightly_rate_usd');

  if (unitsError) {
    logger.error('sync-airbnb: failed to fetch existing units', { error: unitsError.message });
    return res.status(500).json({ error: 'Failed to query existing units' });
  }

  const importedIds = new Set<string>();
  const importedByListingId = new Map<string, (typeof existingUnits)[number]>();

  for (const unit of existingUnits ?? []) {
    if (unit.airbnb_listing_url) {
      const id = extractListingId(unit.airbnb_listing_url);
      if (id) {
        importedIds.add(id);
        importedByListingId.set(id, unit);
      }
    }
  }

  const alreadyImported = allHostIds
    .filter((id) => importedIds.has(id))
    .map((id) => {
      const unit = importedByListingId.get(id);
      return {
        listingId: id,
        airbnbUrl: `https://www.airbnb.com/rooms/${id}`,
        unitId: unit?.id ?? null,
        name: unit?.name ?? null,
        thumbnail: (unit?.image_urls as string[] | null)?.[0] ?? null,
        nightlyRate: unit?.nightly_rate_usd ?? null
      };
    });

  const newIds = allHostIds.filter((id) => !importedIds.has(id));

  if (newIds.length === 0) {
    return res.json({ alreadyImported, newListings: [] });
  }

  // Scrape new listings via Apify
  let scraped: ApifyListingResult[];
  try {
    scraped = await scrapeListings(newIds);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Scrape failed';
    logger.error('sync-airbnb: Apify scrape failed', { error: msg });
    return res.status(502).json({ error: `Apify scrape failed: ${msg}` });
  }

  const newListings = scraped.map((item) => {
    const rawId = String(item.id);
    const rawDesc = item.description?.trim() || item.metaDescription?.trim() || '';
    const description = cleanDescription(rawDesc);
    const parsed = parseSubDescription(item.subDescription?.items ?? []);
    const images = (item.images ?? []).slice(0, 20).map((img) => img.imageUrl);

    return {
      listingId: rawId,
      airbnbUrl: `https://www.airbnb.com/rooms/${rawId}`,
      name: item.seoTitle ?? `Airbnb listing ${rawId}`,
      description,
      thumbnail: images[0] ?? null,
      images,
      maxGuests: item.personCapacity ?? parsed.guests,
      bedrooms: parsed.bedrooms,
      beds: parsed.beds,
      latitude: item.coordinates?.latitude ?? null,
      longitude: item.coordinates?.longitude ?? null,
      locationSubtitle: item.locationSubtitle ?? null,
      // iCalUrl and nightlyRate: user must supply
      airbnbIcalUrl: '',
      nightlyRate: null as number | null
    };
  });

  logger.info('sync-airbnb: preview ready', {
    hostId,
    discovered: allHostIds.length,
    alreadyImported: alreadyImported.length,
    newListings: newListings.length
  });

  return res.json({ alreadyImported, newListings });
});

// ---------------------------------------------------------------------------
// POST /api/admin/units/sync-airbnb/confirm
// Phase 2: insert confirmed listings into DB with ON CONFLICT idempotency.
// ---------------------------------------------------------------------------
const confirmListingSchema = z.object({
  listingId: z.string().min(1),
  name: z.string().min(2),
  description: z.string().max(5000).optional(),
  images: z.array(z.string().url()).min(1),
  maxGuests: z.number().int().positive(),
  bedrooms: z.number().int().positive(),
  beds: z.number().int().positive(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  locationSubtitle: z.string().nullable(),
  airbnbIcalUrl: z.string().url('iCal URL is required and must be a valid URL'),
  nightlyRate: z.number().positive('Nightly rate is required')
});

const confirmSchema = z.object({
  body: z.object({
    listings: z.array(confirmListingSchema).min(1)
  })
});

router.post('/units/sync-airbnb/confirm', validate(confirmSchema), async (req, res) => {
  const { listings } = req.body as { listings: z.infer<typeof confirmListingSchema>[] };

  const rows = listings.map((listing) => {
    const lat = listing.latitude !== null ? Number(listing.latitude.toFixed(7)) : null;
    const lng = listing.longitude !== null ? Number(listing.longitude.toFixed(7)) : null;

    return {
      name: listing.name,
      description: listing.description ?? null,
      nightly_rate_usd: listing.nightlyRate,
      max_guests: listing.maxGuests,
      bedrooms: listing.bedrooms,
      beds: listing.beds,
      airbnb_listing_url: `https://www.airbnb.com/rooms/${listing.listingId}`,
      airbnb_ical_url: listing.airbnbIcalUrl,
      image_urls: listing.images,
      status: 'active',
      // Placeholder address: Airbnb privacy fuzzes coordinates so we cannot
      // derive an exact street address from the scrape.
      street_address: `Airbnb listing ${listing.listingId}`,
      city: listing.locationSubtitle?.split(',')[0]?.trim() ?? null,
      country: listing.locationSubtitle?.split(',').at(-1)?.trim() ?? null,
      latitude: lat,
      longitude: lng,
      google_maps_url:
        lat !== null && lng !== null
          ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
          : null
    };
  });

  const { data, error } = await supabaseAdmin
    .from('units')
    .upsert(rows, { onConflict: 'airbnb_ical_url', ignoreDuplicates: false })
    .select('id, name, airbnb_listing_url');

  if (error) {
    logger.error('sync-airbnb/confirm: insert failed', { error: error.message, details: error.details });
    return res.status(500).json({ error: error.message ?? 'Failed to insert units' });
  }

  logger.info('sync-airbnb/confirm: units inserted', { count: (data ?? []).length });

  return res.json({ inserted: data ?? [] });
});

export default router;
