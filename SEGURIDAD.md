# Seguridad de Nexo Salas

La fuente de verdad está en PostgreSQL. La interfaz mejora la experiencia, pero ninguna validación crítica depende únicamente del navegador.

## Identidad

- Supabase Auth administra correo, contraseña y sesión.
- El trigger `handle_new_user` crea el perfil con el mismo UUID de `auth.users`.
- Todo usuario nuevo recibe el rol `miembro`; `admin` solo se asigna desde la base de datos.
- Las funciones de reserva obtienen la identidad con `auth.uid()` y nunca aceptan un `user_id` enviado por el cliente.

## RLS y privilegios

RLS está habilitado en todas las tablas públicas.

### `profiles`

- Un miembro solo puede leer su propio perfil.
- Un administrador puede leer perfiles para identificar las reservas del panel administrativo.
- No se concede escritura directa desde el cliente.
- Bloquea la lectura masiva de datos personales y la modificación del rol propio.

### `rooms`

- Los usuarios autenticados pueden leer salas activas.
- Los administradores pueden leer también las inactivas, crear y actualizar salas.
- No existe borrado desde la aplicación; una sala se desactiva.
- Bloquea que un miembro cree, modifique o reactive salas mediante llamadas directas.

### `booking_sessions`

- Un miembro solo puede leer sus propias sesiones de selección.
- La creación y expiración se realiza mediante funciones controladas.
- Bloquea la apropiación o extensión de la sesión de otra persona.

### `reservations`

- Un miembro solo puede leer sus reservas.
- Un administrador puede leer todas.
- No se conceden `insert`, `update` ni `delete` directos a usuarios autenticados.
- Crear, confirmar y cancelar requiere las funciones RPC autorizadas.
- Bloquea suplantación de propietario, cancelación ajena y alteración directa de horarios o estados.

### `room_blocks`

- Solo contiene sala, inicio y fin; nunca identifica al propietario.
- Todos los usuarios autenticados pueden leerla para calcular disponibilidad.
- Solo el trigger de reservas puede modificarla.
- Permite Realtime sin revelar reservas personales.

## Funciones protegidas

- `start_booking_session`: verifica sesión y sala activa; crea cinco minutos según el reloj del servidor.
- `hold_reservation`: valida bloques de 30 minutos, duración, anticipación, horario `07:00–00:00` y sala activa.
- `confirm_reservation`: verifica propiedad, expiración y límite semanal antes de activar.
- `release_booking_session`: expira la sesión y libera el bloque retenido.
- `cancel_my_reservation`: exige propiedad y un mínimo de dos horas antes del inicio.
- `cancel_reservation_as_admin`: exige rol real de administrador y motivo.
- `get_room_blocks`: limpia estados vencidos y devuelve disponibilidad sanitizada.

Todas son `security definer`, fijan `search_path = ''`, validan `auth.uid()` y solo conceden ejecución a `authenticated`.

## Integridad y concurrencia

La restricción de exclusión GiST sobre `room_id` y `tstzrange(starts_at, ends_at, '[)')` impide solapes entre retenciones y reservas activas. Aunque diez solicitudes pasen una validación previa simultáneamente, PostgreSQL permite insertar exactamente una.

Las reservas canceladas, completadas o expiradas dejan de participar en la restricción y el trigger elimina su bloque de disponibilidad.

Supabase Cron llama cada minuto a `cleanup_reservation_state`, por lo que una sesión vencida se libera y una reserva terminada cambia a `completed` incluso si nadie tiene la aplicación abierta. [Supabase Cron](https://supabase.com/docs/guides/cron)

## Claves

- El navegador recibe solamente URL y clave publicable.
- `SUPABASE_SERVICE_ROLE_KEY` se usa únicamente en scripts administrativos locales.
- `.env.local` está ignorado por Git.
- Ninguna clave real debe copiarse al repositorio, documentación o conversación.

## Pruebas pendientes de ejecutar contra el proyecto remoto

- Políticas RLS para `anon`, miembro y administrador.
- Intentos de suplantación y escritura directa.
- Solapes totales y parciales.
- Diez confirmaciones simultáneas con exactamente un éxito.
- Expiración de sesiones y liberación del bloque.
- Límites de horario, duración, anticipación y semana.
