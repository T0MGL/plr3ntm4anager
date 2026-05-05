# PL Rent Manager: Funcionamiento del sistema

## Qué es

PL Rent Manager es la plataforma operativa de Park Lofts Paraguay. Centraliza todo el ciclo de una reserva: desde que un potencial huésped ve las unidades disponibles, elige fechas, paga, hasta que el equipo de Park Lofts confirma y gestiona la estadía. Reemplaza el proceso manual de coordinar Airbnb, WhatsApp y planillas por un sistema unificado con datos en tiempo real.

El sistema tiene tres componentes que operan juntos y comparten una sola base de datos:

1. Widget de reservas (sitio público): donde los huéspedes buscan y reservan.
2. Dashboard administrativo: donde el equipo de Park Lofts gestiona todo.
3. API backend: el motor que conecta ambos con Airbnb, Bancard y los sistemas de notificación.

---

## Flujo de una reserva

### 1. El huésped elige la unidad

El widget de reservas muestra todas las unidades activas con fotos, descripción, precio por noche, capacidad, comodidades y ubicación en mapa. El huésped filtra por fechas y cantidad de personas. Las fechas ya ocupadas (por Airbnb o por otras reservas) aparecen bloqueadas en el calendario automaticamente: no se puede seleccionar un rango que incluya fechas no disponibles.

### 2. El sistema verifica disponibilidad en tiempo real

Al momento de confirmar las fechas, el sistema ejecuta una sincronización con el calendario de Airbnb para obtener el estado más actualizado posible antes de procesar el pago. Si Airbnb responde en menos de 8 segundos, la sincronización ocurre en ese instante. Si Airbnb está lento o no responde, el sistema usa la última sincronización registrada y toma la ruta de aprobación manual para proteger contra doble booking.

### 3. El huésped paga por Bancard

El cobro se procesa a través de Bancard VPOS 2.0 (la pasarela de pagos oficial de Paraguay). El monto se calcula en USD y se convierte a guaraníes usando el tipo de cambio del día con un margen operativo configurable. Cada pago registra el tipo de cambio exacto usado, creando un historial de auditoría por transacción.

Existen dos rutas de cobro según el resultado de la verificación de disponibilidad:

- Ruta automática: el calendario de Airbnb está actualizado y las fechas están libres. El cobro se procesa y confirma en el momento. El huésped recibe confirmación por email de inmediato.
- Ruta manual: hay incertidumbre sobre disponibilidad (sync reciente no disponible, posible conflicto). Se hace una pre-autorización en la tarjeta (el dinero queda reservado, no cobrado). El equipo recibe alerta y revisa antes de confirmar. Si se aprueba, se captura el monto. Si se rechaza, la pre-autorización se libera sin costo para el huésped.

### 4. El equipo gestiona desde el dashboard

El panel administrativo muestra todas las reservas en tiempo real con filtros por estado, fecha y unidad. Para cada reserva el equipo puede ver los datos del huésped, las fechas, el monto, el estado del pago, y actuar: aprobar, rechazar, o marcar check-in y check-out. Las acciones generan emails automáticos al huésped en cada paso.

---

## Sincronización con Airbnb (iCal)

Cada unidad tiene un calendario de Airbnb vinculado mediante un feed iCal. El sistema actualiza los bloqueos de fechas de forma automática cada 15 minutos para todas las unidades activas, con staggering inteligente: las unidades se distribuyen en ventanas de tiempo para no hacer todas las llamadas a la vez y reducir la posibilidad de bloqueo por rate limiting.

El proceso de sync es eficiente: si Airbnb confirma que el calendario no cambió (via ETag o hash del contenido), el sistema no reprocesa nada. Solo cuando hay cambios reales se actualizan los bloqueos en la base de datos.

Cuando hay una reserva directa desde el widget, esas fechas se bloquean inmediatamente (sin esperar el siguiente ciclo de sync), para que el calendario de Airbnb las refleje en la próxima exportación.

El dashboard incluye una pantalla de Sync con el historial completo de sincronizaciones: fecha, resultado (exitoso, sin cambios, fallido), cantidad de fechas bloqueadas insertadas y eliminadas por cada ciclo.

---

## Tipo de cambio USD/PYG

Los precios de las unidades se definen en USD. Los cobros a través de Bancard se realizan en guaraníes. El sistema resuelve esta conversión de forma automática y transparente.

**De dónde viene el tipo de cambio:**

Todos los días a las 6:00 AM (hora de Asunción), el sistema consulta el tipo de cambio real de mercado desde dos fuentes externas independientes. Primero consulta open.er-api.com, que provee tasas de cambio oficiales actualizadas. Si esa fuente no responde o devuelve un valor fuera de rango, el sistema cae automáticamente a floatrates.com como respaldo. Antes de guardar cualquier valor, el sistema valida que el número esté dentro de una banda de seguridad (entre 1.000 y 20.000 Gs/USD), rechazando valores que podrían indicar un error en la fuente externa.

Además de la consulta diaria programada, el sistema también consulta la tasa al arrancar, para que un servidor recién desplegado nunca opere con un dato desactualizado. Si ambas fuentes fallan, el sistema usa un valor de respaldo configurado en el servidor y registra una alerta.

Al momento de cada pago, el sistema aplica un margen configurable (por defecto 3%) sobre el tipo de cambio de mercado. Ese margen absorbe la volatilidad cambiaria entre el momento de la reserva y el momento del cobro o liquidación. El margen es editable desde la pantalla de Configuración del dashboard sin necesidad de modificar código.

Cada pago registra el tipo de cambio efectivo exacto usado para esa transacción. Esto permite reconciliar cualquier cobro meses después con precisión exacta.

El panel de Configuración muestra el tipo de cambio vigente, su edad (cuándo fue obtenido por última vez), la fuente de origen, y permite al operador forzar una actualización manual o ingresar un valor de emergencia si las fuentes externas están caídas.

Este sistema reemplazó un valor fijo de 7.800 Gs/USD que estaba un 23% por encima del tipo de cambio real de mercado (aproximadamente 6.315 Gs/USD en abril 2026), lo que sobrecobraba a cada huésped en esa proporción.

---

## Módulos del dashboard administrativo

### Inicio (Dashboard)

Vista general del negocio con métricas en tiempo real: unidades activas, próximos check-ins (directos y de Airbnb), ingresos del mes (reservas directas más estimación de Airbnb), y reservas pendientes de revisión. Incluye gráficos de ingresos con selector de rango (7 días, 30 días, 6 meses, 12 meses) y gráfico de ocupación semanal. El desglose de ingresos distingue entre reservas directas cobradas por la plataforma y noches de Airbnb (estimadas a partir del calendario sincronizado).

### Reservas

Lista completa de reservas con filtros por estado y búsqueda. Cada reserva muestra datos del huésped, unidad, fechas, monto y estado del pago. Desde aquí el equipo aprueba o rechaza reservas manuales, registra notas internas, y marca check-in y check-out. Las reservas con pago pendiente de captura muestran alertas visuales. El panel de Ops encima de la lista muestra un resumen operativo del día: quién llega, quién sale, qué unidades están libres.

### Unidades

Lista de todas las propiedades con sus datos, fotos, precios y estado. Desde aquí se crean nuevas unidades con un flujo paso a paso (tipo de propiedad, ubicación, fotos, descripción, precios, configuración de Airbnb), se editan las existentes, y se gestiona la vinculación con los calendarios de Airbnb. Cada unidad tiene un feed iCal exportable para importar en Airbnb o cualquier otra plataforma.

**Importación directa desde Airbnb:**
Desde esta misma pantalla, el equipo puede detectar e importar propiedades directamente desde el perfil de Airbnb del host. El proceso tiene dos fases:

1. El sistema escanea el perfil de Airbnb configurado y detecta todos los listings del host. Compara contra las unidades ya importadas y muestra una vista previa con dos grupos: las que ya están en el sistema (marcadas como importadas) y las que son nuevas. Para cada nueva propiedad se obtienen automáticamente nombre, descripción, fotos, capacidad, habitaciones, camas y coordenadas.

2. El equipo revisa la vista previa, completa los dos campos que Airbnb no expone públicamente (el enlace iCal privado de esa propiedad y el precio por noche en USD), y confirma la importación. El sistema inserta las unidades en la base de datos y las deja activas de inmediato, con sincronización de calendario habilitada desde el primer ciclo.

### Pagos

Historial completo de transacciones Bancard con detalle de monto en USD y guaraníes, tipo de cambio usado, estado, y código de autorización. Exportable a Excel y PDF.

### Sync

Panel de monitoreo en tiempo real del estado de sincronización con Airbnb. Muestra cada unidad activa con su estado actual, cuándo fue el último sync, y el resultado (exitoso, sin cambios, fallido, en progreso, o nunca sincronizado). Los contadores del encabezado dan un resumen inmediato del estado global del sistema.

Cada unidad muestra además información de eficiencia: qué porcentaje de las últimas consultas devolvieron una respuesta de "sin cambios" desde Airbnb (evitando reprocesamiento innecesario), y cuántas fechas se insertaron o eliminaron en el último ciclo con cambios reales.

El panel se actualiza automáticamente cada vez que el sistema procesa un sync, sin necesidad de recargar la página. También permite lanzar una sincronización manual de todas las unidades o de una unidad específica desde el mismo panel.

### Configuración

Gestión de tipo de cambio (con historial, margen ajustable, y override manual), administración del equipo (invitar colaboradores, asignar roles, revocar acceso), e información del sistema.

---

## Infraestructura y deploy

El sistema corre sobre tres servicios de producción:

- Frontend del widget de reservas y dashboard: alojamiento web con deploy automático al hacer cambios en el repositorio. No requiere intervención manual.
- Servidor de aplicaciones (API): deploy automático desde el mismo repositorio.
- Base de datos: PostgreSQL con control de acceso por rol habilitado en todas las tablas, autenticación, y almacenamiento para las fotos de unidades.

La base de datos tiene 20 migraciones de producción aplicadas con esquema versionado, índices en todos los campos de búsqueda frecuente, transacciones explícitas en todas las operaciones críticas, y políticas de seguridad que impiden acceso directo desde el frontend a datos sensibles.

El servidor corre cuatro trabajos automatizados:

- Sync de calendarios Airbnb: cada pocos minutos, con distribución inteligente por unidad para no sobrecargar el sistema.
- Fetch de tipo de cambio: todos los días a las 6:00 AM hora Asunción, con fuente primaria y secundaria de respaldo.
- Alerta de pre-autorizaciones estancadas: diaria a las 9:00 AM, notifica si hay pre-autorizaciones sin capturar desde hace más de 5 días.
- Limpieza de reservas abandonadas: cada 30 minutos, libera las fechas bloqueadas por reservas que nunca completaron el pago.

El sistema tiene monitoreo de errores activo en los tres componentes (widget, dashboard y servidor).
