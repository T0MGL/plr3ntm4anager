import { z } from 'zod';
import { api } from '../utils/api';

export const monthlyRevenueSchema = z.object({
  name: z.string(),
  direct: z.number(),
  airbnbEstimate: z.number(),
  occupiedDays: z.number(),
  totalDays: z.number(),
  occupancyRate: z.number()
});

export const unitStatsSchema = z.object({
  unit: z.object({
    id: z.string().uuid(),
    name: z.string(),
    nightlyRate: z.number(),
    status: z.string()
  }),
  monthlyRevenue: z.array(monthlyRevenueSchema),
  totals: z.object({
    revenue: z.number(),
    directRevenue: z.number(),
    airbnbEstimate: z.number(),
    bookings: z.number(),
    nights: z.number(),
    occupiedDays: z.number(),
    availableDays: z.number(),
    occupancyRate: z.number(),
    adr: z.number(),
    revPar: z.number()
  }),
  recentBookings: z.array(
    z.object({
      id: z.string().uuid(),
      guest_name: z.string(),
      check_in_date: z.string(),
      check_out_date: z.string(),
      total_price_usd: z.number(),
      status: z.string(),
      created_at: z.string()
    })
  )
});

export type UnitStats = z.infer<typeof unitStatsSchema>;
export type MonthlyRevenuePoint = z.infer<typeof monthlyRevenueSchema>;

export async function fetchUnitStats(unitId: string): Promise<UnitStats> {
  const { data } = await api.get<unknown>(`/admin/units/${unitId}/stats`);
  return unitStatsSchema.parse(data);
}
