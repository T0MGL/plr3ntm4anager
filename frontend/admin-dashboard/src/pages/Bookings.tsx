import BookingList from '../components/Bookings/BookingList';

export default function Bookings() {
  return (
    <div className="grid gap-8">
      <div>
        <span className="text-[0.625rem] uppercase tracking-[0.25em] text-gold">
          Pipeline
        </span>
        <h2 className="mt-3 font-display text-4xl text-charcoal">Solicitudes de reserva</h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-charcoal-500">
          Revisa los pedidos entrantes, aprueba los validos y bloquea aquellos con conflictos. El indice de riesgo sugiere el nivel de revision necesario antes del check-in.
        </p>
      </div>
      <BookingList />
    </div>
  );
}
