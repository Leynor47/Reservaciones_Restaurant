# Decisiones de Nexo Salas

Este documento registra las decisiones abiertas del proyecto y cualquier cambio deliberado respecto de la guía inicial.

## D1 - Definición de semana

Fecha/hora: 2026-09-26, America/Costa_Rica.

Opciones consideradas: semana calendario de lunes a domingo; últimos siete días; semana iniciada el domingo.

Decisión: el límite semanal se calcula desde el lunes a las 00:00 hasta el domingo a las 23:59:59, usando siempre `America/Costa_Rica`.

Por qué: coincide con la interpretación habitual de semana laboral y es sencilla de explicar y probar.

Qué se sacrifica con esta decisión: al iniciar un lunes, un miembro puede volver a disponer de su cupo aunque haya reservado tres veces el domingo anterior.

## D2 - Reservas canceladas y límite semanal

Fecha/hora: 2026-09-26, America/Costa_Rica.

Opciones consideradas: contar todas las reservas creadas; contar solo reservas activas.

Decisión: las reservas canceladas no cuentan para el máximo semanal de tres reservas.

Por qué: una cancelación válida libera el espacio y no debe consumir cupo futuro.

Qué se sacrifica con esta decisión: requiere excluir explícitamente estados cancelados en todas las comprobaciones del límite.

## D3 - Desactivación de una sala

Fecha/hora: 2026-09-26, America/Costa_Rica.

Opciones consideradas: cancelar automáticamente reservas futuras; conservarlas; impedir desactivar si existen reservas.

Decisión: una sala desactivada no acepta reservas nuevas, pero conserva sus reservas futuras. Un administrador decide si las cancela individualmente y debe registrar el motivo.

Por qué: evita cancelaciones silenciosas y mantiene un historial auditable.

Qué se sacrifica con esta decisión: el administrador debe revisar y resolver manualmente las reservas afectadas.

## D4 - Límite para administradores

Fecha/hora: 2026-09-26, America/Costa_Rica.

Opciones consideradas: administradores sin límite; administradores sujetos al mismo límite al reservar para sí mismos.

Decisión: un administrador que reserva para sí mismo está sujeto al límite semanal de tres reservas activas.

Por qué: mantiene reglas uniformes y evita privilegios difíciles de justificar.

Qué se sacrifica con esta decisión: un administrador no puede usar su rol para realizar reservas operativas ilimitadas desde su cuenta personal.

## D5 - Retención temporal y conflictos al confirmar

Fecha/hora: 2026-09-26, America/Costa_Rica.

Opciones consideradas: resolver el conflicto únicamente al confirmar; retener el bloque durante el formulario; retención indefinida.

Decisión: al pulsar `Reservar` se crea en PostgreSQL una sesión de selección de cinco minutos y la interfaz muestra su contador. Cuando el usuario elige fecha, hora y duración, el bloque concreto queda retenido durante el tiempo restante de esa sesión. Al vencer, la sesión y cualquier bloque retenido se marcan como expirados. Si la retención venció o fue invalidada al confirmar, se muestra un mensaje claro y se actualiza la disponibilidad.

Por qué: reduce carreras frustrantes sin permitir que un formulario abandonado bloquee una sala por tiempo indefinido.

Qué se sacrifica con esta decisión: aumenta la complejidad de base de datos, limpieza de retenciones expiradas y pruebas de concurrencia. El contador del navegador es informativo; nunca será la fuente de verdad.

## DT-01 - Horario operativo

Fecha/hora: 2026-09-26, America/Costa_Rica.

Opciones consideradas: horario original de 07:00 a 21:00; horario de 07:00 a 12:00; horario ampliado de 07:00 a 00:00.

Decisión: el coworking opera de 07:00 a 00:00. Ninguna reserva puede iniciar antes de las 07:00 ni terminar después de la medianoche que cierra el día operativo.

Por qué: decisión expresa del propietario del proyecto para representar su operación real.

Qué se sacrifica con esta decisión: se modifica RN-04 de la guía inicial. README, validaciones, base de datos y pruebas deberán usar el nuevo horario de forma consistente.

## DT-02 - Identidad y sistema visual

Fecha/hora: 2026-09-26, America/Costa_Rica.

Opciones consideradas: Calma profesional; Tecnología serena; Editorial premium; Costa Rica contemporánea.

Decisión: nombre `Nexo Salas`, dirección Costa Rica contemporánea y formato horario de 24 horas. Las salas no usan fotografías ni ilustraciones; cada tarjeta contiene únicamente nombre, capacidad, estado y acción de reserva.

Por qué: aporta identidad local sin sacrificar claridad operativa.

Qué se sacrifica con esta decisión: no se implementará modo oscuro ni contenido visual decorativo en la primera versión.

## DT-03 - Cantidad y capacidad inicial de salas

Fecha/hora: 2026-09-26, America/Costa_Rica.

Opciones consideradas: tres salas; ocho salas con nombres descriptivos; ocho salas numeradas.

Decisión: se crean ocho salas: Sala 1–3 con capacidad 4, Sala 4–6 con capacidad 8 y Sala 7–8 con capacidad 12.

Por qué: corresponde a la distribución real indicada para el proyecto y mantiene los datos simples.

Qué se sacrifica con esta decisión: los nombres no describen ubicación o equipamiento; podrán editarse desde administración.

## DT-04 - Acceso administrativo desde la aplicación

Fecha/hora: 2026-09-28, America/Costa_Rica.

Opciones consideradas: asignación manual en Supabase; botón público con clave en el cliente; formulario público con validación segura en PostgreSQL.

Decisión: `/admin/acceso` solicita las credenciales normales de la cuenta y una clave administrativa compartida. PostgreSQL compara únicamente su hash, limita los intentos y asigna el rol a la identidad obtenida mediante `auth.uid()`.

Por qué: permite administrar el acceso desde la app sin exponer la clave en el navegador ni confiar en un rol enviado por el cliente.

Qué se sacrifica con esta decisión: una clave compartida sigue siendo menos segura y menos auditable que invitaciones individuales; deberá rotarse si se divulga.
