import BookingList from '../components/Bookings/BookingList';

export default function Bookings() {
  return (
    <div className="grid gap-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">Booking Requests</h2>
        <p className="mt-1 text-sm text-slate-500">
          Review incoming reservations, approve valid requests, and reject conflicts.
        </p>
      </div>
      <BookingList />
    </div>
  );
}
