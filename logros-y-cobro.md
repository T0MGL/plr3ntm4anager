# PL Rent Manager: Entrega y liquidación

**Proyecto:** PL Rent Manager
**Cliente:** Park Lofts Paraguay
**Agencia:** Bright Idea
**Fecha:** Abril 2026

---

## Lo que se construyó

Se entregó un sistema de gestión de alquileres a medida, de extremo a extremo. No una plantilla ni un sistema genérico adaptado: una plataforma diseñada específicamente para la operación de Park Lofts, con lógica de negocio propia, integraciones reales, y arquitectura de producción.

**Widget de reservas público:** interfaz para los huéspedes, con búsqueda de unidades, selector de fechas con disponibilidad en tiempo real, detalle de propiedades con fotos y ubicación en mapa, flujo de reserva y pago integrado.

**Dashboard administrativo:** panel interno para el equipo de Park Lofts con gestión completa de reservas, unidades, pagos, sincronización de Airbnb, métricas de negocio, y configuración operativa.

**API backend completa:** motor que conecta ambas interfaces con Airbnb, Bancard, el servicio de email, y la base de datos. Maneja la lógica de negocio crítica: verificación de disponibilidad, enrutamiento de aprobación, procesamiento de pagos, sincronización de calendarios, y notificaciones por email.

**Base de datos de producción:** 20 migraciones aplicadas. Esquema con control de acceso por rol, índices, transacciones explícitas, triggers, y políticas de seguridad que impiden acceso directo desde el frontend a datos sensibles.

---

## Funcionalidades entregadas

**Sincronización con Airbnb:**
Calendarios iCal sincronizados automáticamente cada 15 minutos con staggering por unidad. Detección eficiente de cambios por hash y ETag para no reprocesar datos sin cambios. Clasificación de eventos Airbnb (reservado, no disponible, bloqueado). Preservación de alias de huéspedes entre re-sincronizaciones. Historial completo de sync con logs por unidad.

**Pagos con Bancard VPOS 2.0:**
Integración certificada con el protocolo Bancard VPOS 2.0 con tokens MD5. Cobro directo (Single Buy) y pre-autorización con captura posterior. Webhook de confirmación con validación de firma. Rollback y reversa de transacciones. Límite de intentos por reserva para protección contra bloqueo de tarjetas. Reuso de procesos activos para evitar duplicados.

**Tipo de cambio USD/PYG en tiempo real:**
Fetch diario automatizado del tipo de cambio real de mercado desde dos fuentes externas independientes (open.er-api.com como fuente primaria, floatrates.com como respaldo). El sistema valida que el valor esté dentro de una banda de seguridad antes de guardarlo. Margen configurable desde el dashboard. Snapshot del tipo de cambio exacto por pago para auditoría. Override manual de emergencia. Reemplazó el valor fijo de 7.800 Gs/USD que estaba inflado un 23% sobre el tipo de cambio real.

**Lógica de aprobación dual:**
Enrutamiento automático vs. manual según frescura del sync y disponibilidad de fechas. Sincronización inline al momento de la solicitud para minimizar falsos positivos. Re-verificación de disponibilidad al aprobar manualmente para detectar conflictos de último momento.

**Creación y gestión de unidades:**
Flujo de alta de unidades paso a paso inspirado en Airbnb. Gestión de fotos con carga directa a Supabase Storage. Campos de ubicación con confirmación de dirección. Vinculación con calendario de Airbnb. Feed iCal exportable para importar en otras plataformas. Estado activo/inactivo.

**Dashboard de métricas:**
Ingresos del mes (directos y estimado de Airbnb), comparación con mes anterior, ocupación semanal, próximos check-ins con desglose por canal, reservas pendientes de revisión. Gráficos con selector de rango temporal (7d, 30d, 6m, 12m).

**Gestión de equipo:**
Invitación por email, roles (admin, staff), revocación de acceso, límite de 10 miembros a nivel base de datos.

**Emails transaccionales:**
Confirmación de reserva, reserva en revisión, pago confirmado, rechazo de reserva, rechazo por conflicto de fechas. En español e inglés según el idioma del huésped.

**Automatización operativa:**
4 trabajos automatizados en producción: sync de calendarios Airbnb con distribución inteligente por unidad, fetch diario de tipo de cambio a las 6:00 AM con failover automático, alerta diaria de pre-autorizaciones estancadas, y limpieza de reservas abandonadas cada 30 minutos.

**Panel de monitoreo de sincronización:**
Visualización en tiempo real del estado de cada unidad: última sincronización, resultado (exitoso, sin cambios, fallido, en progreso), eficiencia de consultas, y diferencial de fechas insertadas y eliminadas por ciclo. Se actualiza automáticamente sin recargar la página. Permite lanzar sincronizaciones manuales por unidad o en bloque.

**Monitoreo de errores:**
Sistema de captura de errores activo en los tres componentes (servidor, dashboard y widget).

**Tests:**
Tests unitarios para los servicios críticos de enrutamiento de aprobación y sincronización de alias Airbnb.

---

## Valor generado

Antes de este sistema, Park Lofts no tenía forma de recibir reservas directas. Todas las reservas pasaban por Airbnb, con sus comisiones y sus reglas. No existía canal propio, no había cobro con tarjeta fuera de la plataforma, no había panel de gestión, no había nada.

Este sistema creó ese canal desde cero:

- Park Lofts ahora puede recibir reservas directas con cobro en guaraníes vía tarjeta, sin depender de Airbnb para cada transacción.
- El calendario de disponibilidad se mantiene sincronizado con Airbnb automáticamente, eliminando el riesgo de doble booking entre canales.
- El tipo de cambio se obtiene del mercado diariamente: cada huésped paga el valor real del día, con margen ajustable por el propio equipo desde el dashboard.
- Cada pago registra el tipo de cambio exacto usado, lo que permite reconciliar cualquier cobro con precisión meses después.
- El equipo tiene visibilidad operativa completa: check-ins y check-outs del día, reservas pendientes de atención, ingresos del mes desglosados por canal.
- Agregar una propiedad nueva al sistema toma minutos. La arquitectura no cambia con el volumen.

---

## Estado de entrega

El sistema está en producción.

- Widget de reservas: alojamiento web, deploy automático activo.
- Dashboard administrativo: alojamiento web, deploy automático activo.
- Servidor de aplicaciones: corriendo con los cuatro trabajos automatizados activos.
- Base de datos: 20 migraciones aplicadas, control de acceso habilitado.
- Monitoreo de errores: activo en los tres componentes.
- Dominio del servidor: `api.rent.parkloftsparaguay.com`.

El codebase está en el repositorio de Park Lofts con documentación técnica, guía de deploy, troubleshooting, y setup local completo.

---

## Liquidación

El trabajo está completo y entregado en producción.

Solicitamos la liquidación del pago acordado para cerrar el proyecto.

**Bright Idea**
gaston@thebrightidea.ai
