# Nexo Salas

Aplicación web para reservar salas de reuniones de un coworking en San José, Costa Rica. Usa Next.js, Supabase Auth, PostgreSQL, RLS y Supabase Realtime. La interfaz se limita al flujo necesario: autenticación, salas, reserva, historial y administración.

## Inicio rápido

```bash
npm install
npx supabase login
npx supabase link --project-ref TU_PROJECT_REF
npx supabase db push
npm run db:types
npm run dev
```

Copia `.env.example` como `.env.local` y completa:

```env
NEXT_PUBLIC_SUPABASE_URL=https://TU_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SEED_USER_PASSWORD=
```

La clave de servicio y la contraseña de datos de prueba son exclusivamente para `scripts/seed.ts` y `scripts/concurrencia.ts`; nunca deben llegar al navegador ni al repositorio.

En Supabase Auth debe mantenerse habilitado el registro por correo y deshabilitada la confirmación de correo, según la decisión del proyecto. Después de aplicar migraciones:

```bash
npm run db:seed
npm run test:concurrency
```

Rutas disponibles: `/salas`, `/reservas`, `/admin`, `/admin/acceso`, `/login` y `/registro`. La reserva se completa en un modal dentro de `/salas`.

> Antes de ejecutar la aplicación hay que crear o vincular un proyecto de Supabase, aplicar las migraciones y completar `.env.local`.

## Flujo actual

1. El usuario se registra con nombre completo, correo y contraseña, o inicia sesión.
2. Supabase Auth crea la identidad y un trigger crea su perfil como `miembro`.
3. `/salas` carga ocho salas desde PostgreSQL.
4. Al pulsar `Reservar`, PostgreSQL crea una sesión de selección de cinco minutos.
5. El usuario elige fecha, hora y duración dentro del mismo modal.
6. Una restricción GiST impide cualquier solape, incluso con solicitudes simultáneas.
7. Realtime actualiza los bloques ocupados sin recargar la página.
8. Supabase Cron completa reservas terminadas y expira retenciones cada minuto.

## Guía del proyecto

> Documento de orientación rápida para personas y asistentes de IA que trabajen en este repositorio.
>
> **Importante:** el archivo oficial exigido para la entrega se llama `README.md`. Este archivo inicial deberá renombrarse a `README.md` antes de entregar el proyecto.

## 1. Resumen ejecutivo

Construiremos una aplicación web para que los miembros de un coworking en San José, Costa Rica, puedan reservar salas de reuniones por bloques de tiempo sin cruces ni conflictos. También existirá un panel para administradores, desde el cual se podrán gestionar salas y reservas.

La prioridad no es acumular funcionalidades, sino entregar un núcleo pequeño, seguro, consistente y fácil de explicar durante una defensa en vivo. Toda regla importante debe protegerse en el servidor o en la base de datos; una validación que solo exista en la interfaz se considera inexistente.

### Stack obligatorio

- Next.js con App Router.
- TypeScript en modo estricto.
- Tailwind CSS.
- Supabase: PostgreSQL, Auth y Row Level Security (RLS).
- GitHub y GitHub Actions.
- Despliegue funcional en Vercel.

### Zona horaria del dominio

Toda fecha y hora se interpreta según `America/Costa_Rica` (UTC-6, sin horario de verano). Esta regla debe aplicarse de forma consistente en la interfaz, el servidor, las consultas y las pruebas.

## 2. Usuarios y permisos

### Miembro

Un miembro autenticado podrá:

- Ver las salas activas y su capacidad.
- Consultar la disponibilidad de una sala para un día específico.
- Crear una reserva indicando sala, fecha, hora de inicio y duración.
- Ver sus reservas próximas y pasadas por separado.
- Cancelar una reserva propia cuando lo permita la regla de cancelación.
- Ver cuántas reservas disponibles le quedan en la semana actual.

### Administrador

Un administrador podrá hacer todo lo anterior y además:

- Crear salas con nombre, capacidad y estado.
- Editar salas.
- Desactivar salas sin borrarlas.
- Consultar todas las reservas, con filtros por sala y fecha.
- Cancelar la reserva de cualquier usuario, registrando un motivo.

### Autenticación y asignación de roles

- Registro con correo electrónico y contraseña mediante Supabase Auth.
- Inicio y cierre de sesión.
- Las rutas privadas no deben abrirse sin sesión, ni siquiera mediante URL directa.
- Cada usuario tendrá el rol `miembro` o `admin`.
- Todo usuario nuevo nace como `miembro`.
- El rol `admin` no se elige durante el registro. Se obtiene desde `/admin/acceso` únicamente después de autenticar la cuenta y validar la clave administrativa en PostgreSQL.
- El rol y los permisos siempre se verifican en el servidor o en la base de datos, nunca a partir de un estado controlado por el cliente.

## 3. Reglas de negocio obligatorias

Estas reglas deben cumplirse aunque alguien omita la interfaz y llame directamente a la API o a Supabase.

| ID | Regla |
|---|---|
| RN-01 | Una sala no puede tener dos reservas activas que se solapen, ni siquiera parcialmente. |
| RN-02 | Las reservas empiezan en bloques de 30 minutos: 07:00, 07:30, 08:00, etc. |
| RN-03 | La duración mínima es 1 hora y la máxima es 3 horas. |
| RN-04 | El coworking opera de 07:00 a 00:00. Ninguna reserva puede empezar antes ni terminar después de la medianoche. |
| RN-05 | No se puede reservar en el pasado ni con menos de 30 minutos de anticipación. |
| RN-06 | Un miembro puede tener como máximo 3 reservas activas por semana. |
| RN-07 | Un miembro puede cancelar una reserva hasta 2 horas antes de su inicio; después ya no puede. |
| RN-08 | Una reserva cancelada libera inmediatamente el bloque horario. |
| RN-09 | No se pueden crear reservas nuevas en una sala desactivada. |
| RN-10 | Toda la lógica temporal usa la zona horaria `America/Costa_Rica`. |

## 4. Decisiones abiertas que el equipo debe tomar

El enunciado deja deliberadamente estos puntos sin una única respuesta. No deben resolverse por suposición silenciosa. Cada decisión debe documentarse en `DECISIONES.md`, justificarse y coincidir con la implementación y las pruebas.

- **D1 - Definición de semana:** decidir si RN-06 usa lunes a domingo, los últimos 7 días u otro criterio; especificar qué ocurre en el límite entre semanas.
- **D2 - Reservas canceladas:** decidir si cuentan para el límite semanal.
- **D3 - Desactivación de una sala:** decidir qué pasa con sus reservas futuras.
- **D4 - Administradores:** decidir si un admin queda sujeto al límite de RN-06 cuando reserva para sí mismo.
- **D5 - Conflicto durante el formulario:** definir qué ve el usuario si otro ocupa el bloque antes de que confirme y cómo se le comunica.

Formato mínimo para cada entrada en `DECISIONES.md`:

```md
## D1 - Título de la decisión
Fecha/hora:
Opciones consideradas:
Decisión:
Por qué:
Qué se sacrifica con esta decisión:
```

También deben registrarse las decisiones técnicas relevantes, no solo D1-D5.

## 5. Casos borde que deben funcionar

1. **Concurrencia:** si dos usuarios reservan simultáneamente la misma sala y el mismo horario, exactamente uno tiene éxito. El otro recibe un error claro.
2. **Intentos de bypass:** con un token válido de miembro deben fallar en el servidor los intentos de:
   - crear una reserva para otro usuario;
   - cancelar la reserva de otro usuario;
   - crear una sala sin ser admin;
   - exceder el límite semanal;
   - reservar de 00:00 a 01:00.
3. **Solape parcial:** si existe una reserva de 09:00 a 11:00, reservar de 10:00 a 12:00 debe fallar y reservar de 08:00 a 09:00 debe funcionar.
4. **Datos basura:** deben rechazarse fechas inválidas, duraciones negativas, `sala_id` inexistentes y campos vacíos.
5. **Estados vacíos:** deben existir mensajes útiles para usuario sin reservas, sala sin disponibilidad y ausencia de salas activas. No mostrar tablas vacías sin explicación.

## 6. Arquitectura esperada

### Principios

- Usar Server Components por defecto.
- Añadir `'use client'` solo cuando sea necesario y lo más abajo posible en el árbol.
- Escribir datos mediante Server Actions o Route Handlers.
- Nunca insertar directamente en Supabase desde un componente cliente sin validación de servidor.
- Validar toda entrada en el servidor mediante un esquema, por ejemplo Zod.
- Mantener la lógica de negocio fuera de los componentes de interfaz.
- Mostrar estados de carga y error con `loading.tsx`, `<Suspense>` u otra solución apropiada.
- La interfaz debe funcionar realmente en un celular de 390 px de ancho.

### Estructura orientativa

La estructura exacta puede variar, pero debe separar interfaz, validación y acceso a datos:

```text
app/
  (auth)/
  (private)/
    salas/
    reservas/
    admin/
  api/                  # Solo si se eligen Route Handlers
components/
lib/
  auth/
  reservations/        # Reglas y casos de uso
  supabase/
  validation/
supabase/
  migrations/
scripts/
  seed.ts
  concurrencia.ts
types/
  database.ts
DECISIONES.md
SEGURIDAD.md
README.md
```

### Flujo seguro para crear una reserva

1. La persona autenticada envía sala, inicio y duración.
2. El servidor obtiene la identidad desde la sesión; nunca acepta un `user_id` confiado desde el cliente.
3. El servidor valida formato, bloques, duración, horario, anticipación, estado de la sala y límite semanal.
4. La base de datos garantiza de manera atómica que no haya solapes, incluso bajo concurrencia.
5. Si otra solicitud ganó la carrera, se devuelve un error de conflicto entendible.
6. La interfaz refresca disponibilidad y reservas del usuario.

> La validación previa en el servidor mejora los mensajes, pero no sustituye la protección atómica de la base de datos.

## 7. Modelo de datos inicial propuesto

Este modelo es una orientación, no una decisión definitiva. Cualquier cambio debe registrarse mediante migraciones versionadas.

### `profiles`

- `id`: UUID, clave primaria y referencia a `auth.users.id`.
- `role`: `miembro | admin`, con `miembro` como valor predeterminado.
- Datos de presentación mínimos que el equipo considere necesarios.
- Marcas de creación y actualización.

### `rooms`

- `id`: UUID, clave primaria.
- `name`: nombre obligatorio.
- `capacity`: entero positivo.
- `is_active`: booleano; desactivar no equivale a borrar.
- Marcas de creación y actualización.

### `reservations`

- `id`: UUID, clave primaria.
- `room_id`: referencia obligatoria a `rooms`.
- `user_id`: referencia obligatoria al propietario de la reserva.
- `starts_at` y `ends_at`: instantes consistentes y comparables.
- `status`: al menos `active | cancelled`.
- `cancelled_at`, `cancelled_by` y `cancellation_reason` cuando aplique.
- Marcas de creación y actualización.

### Integridad de datos

La base debe incluir restricciones para impedir valores incoherentes y una solución atómica para RN-01. La implementación puede usar una función/transacción de PostgreSQL y/o una restricción de exclusión por rango temporal. La elección final debe explicarse en `DECISIONES.md` y ser demostrable con `scripts/concurrencia.ts`.

## 8. Seguridad y RLS

- RLS debe estar activo en **todas** las tablas, sin excepción.
- Deben existir políticas separadas y explícitas para `select`, `insert`, `update` y `delete`, según corresponda.
- Un miembro solo puede actuar sobre los datos permitidos y nunca suplantar a otro usuario.
- Las operaciones administrativas deben comprobar el rol real en el servidor/base de datos.
- `SUPABASE_SERVICE_ROLE_KEY` jamás puede aparecer en código cliente ni en una variable `NEXT_PUBLIC_*`.
- No se debe commitear ningún secreto.
- `.env.local` debe estar en `.gitignore` y sí debe existir un `.env.example` sin credenciales reales.
- `SEGURIDAD.md` debe explicar, en palabras del equipo, cada política RLS y el ataque concreto que bloquea.

## 9. TypeScript y calidad

- Configurar `strict: true`.
- No usar `any`, `@ts-ignore` ni conversiones forzadas para silenciar el compilador.
- Generar los tipos desde Supabase en `types/database.ts`; no escribirlos manualmente.
- Estos comandos deben terminar correctamente:

```bash
npx tsc --noEmit
npx eslint .
npm run build
```

## 10. Git y CI

- Proteger la rama `main`; no hacer commits directos en ella.
- Usar `dev` como rama base de trabajo.
- Crear ramas de funcionalidad desde `dev`, por ejemplo `feat/reservas` o `fix/rls-salas`.
- Todo cambio llega a `main` mediante Pull Request.
- Se requieren al menos 4 Pull Requests.
- Se requieren al menos 15 commits pequeños y descriptivos con formato convencional (`feat:`, `fix:`, `chore:`, `refactor:`, etc.).
- El historial debe mostrar progreso incremental; evitar un único commit gigante.
- GitHub Actions debe ejecutar en cada PR hacia `dev` y `main`:
  - `npx tsc --noEmit`;
  - `npx eslint .`;
  - `npm run build`.
- Un PR con el pipeline en rojo no se fusiona.

## 11. Prioridad de implementación

### P0 - Imprescindible para entregar

- Autenticación completa.
- RLS activo y políticas seguras.
- Crear reservas sin solapes, incluso bajo concurrencia.
- Ver las reservas propias.
- CI en verde.

### P1 - Importante

- Cancelar reservas.
- Aplicar y mostrar el límite semanal.
- Panel de administración.
- Vista de disponibilidad.

### P2 - Solo si sobra tiempo

- Actualizaciones en tiempo real.
- Notificaciones.
- Filtros avanzados.
- Animaciones.

## 12. Plan de trabajo recomendado

1. Inicializar Next.js, TypeScript estricto, Tailwind y variables de entorno de ejemplo.
2. Configurar ramas, protección de `main` y CI desde el comienzo.
3. Diseñar el modelo, escribir migraciones y generar tipos desde Supabase.
4. Implementar Auth, creación automática del perfil y protección de rutas.
5. Activar RLS y crear políticas mínimas seguras antes de construir pantallas sensibles.
6. Implementar la operación atómica de reserva y sus reglas del lado servidor/base de datos.
7. Crear salas, disponibilidad, formulario de reserva y listado de reservas propias.
8. Implementar cancelación y límite semanal según las decisiones documentadas.
9. Construir el panel de administración.
10. Añadir estados de carga, error y vacío; revisar 390 px.
11. Crear datos de prueba, prueba de concurrencia y pruebas de bypass/reglas.
12. Completar documentación, desplegar en Vercel y ensayar la defensa.

## 13. Entregables obligatorios

En la raíz del repositorio deben existir:

1. `README.md` con:
   - pasos reales y probados para levantar el proyecto desde cero;
   - descripción o diagrama del modelo de datos;
   - qué funciona y qué quedó fuera por tiempo;
   - enlace al despliegue en Vercel;
   - salida de la prueba de concurrencia, cuyo resultado esperado es 1 éxito.
2. `DECISIONES.md` con D1-D5 y las decisiones técnicas relevantes.
3. `SEGURIDAD.md` con la explicación de las políticas RLS y los ataques que bloquean.
4. `scripts/seed.ts`, que cree al menos 3 salas, 2 miembros, 1 admin y 10 reservas repartidas.
5. `scripts/concurrencia.ts`, que dispare 10 solicitudes simultáneas al mismo bloque y muestre cuántas tuvieron éxito; debe resultar exactamente 1.
6. Despliegue funcional en Vercel.
7. Migraciones versionadas dentro de `supabase/migrations/`.

## 14. Pruebas mínimas antes de entregar

- Registro, login, logout y bloqueo de rutas privadas.
- Usuario nuevo con rol `miembro`.
- Miembro sin acceso a acciones de admin, incluso llamando directamente al servidor.
- Creación válida de una reserva.
- Rechazo de solape total y parcial.
- Exactamente 1 éxito en 10 solicitudes simultáneas al mismo bloque.
- Rechazo de bloques fuera de múltiplos de 30 minutos.
- Duraciones menor a 1 hora y mayor a 3 horas rechazadas.
- Horario fuera de 07:00-00:00 rechazado.
- Pasado y menos de 30 minutos de anticipación rechazados.
- Límite semanal aplicado según D1, D2 y D4.
- Cancelación propia permitida o rechazada según la ventana de 2 horas.
- Cancelación que vuelve a liberar el bloque.
- Sala desactivada sin nuevas reservas y con comportamiento futuro coherente con D3.
- Datos basura rechazados.
- Estados vacíos claros.
- Diseño usable a 390 px.
- Type check, lint y build en verde.

## 15. Defensa en vivo

La evaluación incluye 30 minutos:

- **15 minutos de explicación:** habrá que abrir archivos concretos y explicar qué hacen, por qué se eligió esa solución y qué alternativa se descartó.
- **15 minutos de modificación:** habrá que cambiar una regla, agregar un campo, ajustar una política RLS o corregir un caso borde sobre el propio código.

Por ello, cada contribución debe ser entendible, pequeña y coherente. Quien implemente algo debe dejar la estructura y las decisiones lo bastante claras para que otro integrante pueda modificarlo sin improvisar.

## 16. Criterios de evaluación

| Criterio | Peso | Enfoque |
|---|---:|---|
| Integridad de datos | 25% | RN-01, RN-06 y comportamiento bajo concurrencia. |
| Seguridad y RLS | 20% | Los cinco intentos de bypass. |
| Defensa en vivo | 20% | Comprensión real de lo entregado. |
| TypeScript y arquitectura | 15% | Tipado honesto, carpetas claras y lógica fuera de la UI. |
| Git y CI | 10% | Historial incremental, PRs y pipeline verde. |
| Frontend | 10% | Carga, error, vacío, responsive y usabilidad. |

## 17. Condiciones de descalificación

- Hacer commits directos a `main`.
- Commitear secretos, claves o tokens.
- Dejar cualquier tabla sin RLS.
- Entregar un único commit gigante sin historial incremental.
- No incluir `README.md` o `DECISIONES.md`.

## 18. Reglas para cualquier IA que trabaje en el repositorio

Antes de modificar código:

1. Leer este archivo, `DECISIONES.md`, `SEGURIDAD.md`, las migraciones y el código relacionado.
2. Identificar qué reglas RN, decisiones D y casos borde afecta el cambio.
3. No inventar una respuesta para una decisión abierta: proponerla o documentarla antes de implementarla.
4. No debilitar RLS ni mover una regla crítica únicamente al cliente.
5. No introducir secretos, `any`, `@ts-ignore` o atajos que rompan las restricciones del reto.

Después de modificar código:

1. Añadir o actualizar pruebas relevantes.
2. Ejecutar type check, lint y build.
3. Verificar las reglas de negocio afectadas tanto por la vía normal como intentando omitir la interfaz.
4. Actualizar migraciones, tipos generados y documentación cuando corresponda.
5. Resumir qué cambió, qué se validó y qué riesgo queda pendiente.

## 19. Estado actual

- [x] Enunciado revisado y alcance documentado.
- [x] Proyecto Next.js inicializado.
- [ ] Supabase remoto conectado.
- [x] Modelo y migraciones creados.
- [x] Decisiones D1-D5 acordadas.
- [ ] Autenticación implementada.
- [x] RLS y políticas escritas; pendientes de aplicar y probar en Supabase.
- [x] Reservas y protección contra solapes implementadas en migración; pendientes de prueba remota.
- [x] Panel de miembro implementado.
- [x] Panel de admin implementado.
- [x] Scripts de datos y concurrencia implementados; pendientes de ejecución remota.
- [ ] CI configurado y verde.
- [ ] Documentación final completada.
- [ ] Despliegue en Vercel verificado.

---

Fuente de requisitos: documento del reto técnico “Sistema de reservas de salas”. Las secciones marcadas como propuestas u orientativas no son requisitos textuales del enunciado y deben validarse mediante decisiones del equipo.
