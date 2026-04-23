import { z } from 'zod';
import { api } from '../utils/api';

export const bookingNoteSchema = z.object({
  id: z.string().uuid(),
  booking_id: z.string().uuid(),
  content: z.string(),
  created_at: z.string(),
  author: z
    .object({
      id: z.string().uuid(),
      name: z.string(),
      email: z.string().email()
    })
    .nullable()
});

export type BookingNote = z.infer<typeof bookingNoteSchema>;

export async function listBookingNotes(bookingId: string): Promise<BookingNote[]> {
  const { data } = await api.get<unknown>(`/admin/bookings/${bookingId}/notes`);
  return z.array(bookingNoteSchema).parse(data);
}

export async function createBookingNote(bookingId: string, content: string): Promise<BookingNote> {
  const { data } = await api.post<unknown>(`/admin/bookings/${bookingId}/notes`, { content });
  return bookingNoteSchema.parse(data);
}
