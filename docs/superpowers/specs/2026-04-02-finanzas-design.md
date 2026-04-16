# Finanzas App — Documento de Especificación
**Fecha:** 2026-04-02
**Estado:** Aprobado

---

## 1. Resumen del Proyecto

Aplicación web de finanzas personales con bot de Telegram integrado. Permite registrar gastos e ingresos mediante audio o texto en Telegram, o de forma manual desde la web. Incluye reportes visuales, alertas de tarjetas de crédito y reconciliación de saldos mensuales. Deploy en Vercel.

---

## 2. Stack Tecnológico

| Capa | Tecnología |
|---|---|
| Frontend + Backend | Next.js (App Router) |
| Base de datos | Neon Postgres (serverless, integrado en Vercel) |
| Notificaciones programadas | Vercel Cron Jobs |
| Bot de Telegram | Telegram Bot API (webhook) |
| Transcripción de audio | OpenAI Whisper |
| Extracción de datos | OpenAI GPT |
| Gráficos | Recharts |
| Deploy | Vercel |

---

## 3. Monedas

- Peso uruguayo (UYU)
- Dólar estadounidense (USD)
- Cada transacción registra su moneda explícitamente.

---

## 4. Medios de Pago

| Nombre | Tipo | Banco | Cierre | Vencimiento | Límite alerta | Notas |
|---|---|---|---|---|---|---|
| Itaú crédito Infinite Extension | Crédito | Itaú | — | — | — | Extensión de mamá |
| Itaú PB débito (mamá) | Débito | Itaú | — | — | — | Tarjeta de mamá |
| Itaú PB crédito (mamá) | Crédito | Itaú | — | — | — | Tarjeta de mamá |
| Santander crédito | Crédito | Santander | Día 28 | — | $10.000 UYU | Se paga con Itaú débito |
| Itaú crédito | Crédito | Itaú | Día 3 | Día 16 | $10.000 UYU | Se paga con Itaú débito |
| Itaú débito | Débito | Itaú | — | — | — | Tarjeta principal |
| Amex (mamá) | Crédito | Amex | — | — | — | Tarjeta de mamá |
| Efectivo | Efectivo | — | — | — | — | — |

**Reglas:**
- Las tarjetas de mamá no tienen saldo inicial mensual ni límites configurados.
- Las tarjetas de crédito no participan en la reconciliación mensual.
- El pago de Santander crédito e Itaú crédito se registra como gasto desde Itaú débito.
- Las tarjetas sin `closing_day` configurado son ignoradas silenciosamente por el cron de notificaciones (no se envía alerta).

---

## 5. Categorías

### Gastos
- Alimentación / Supermercado
- Restaurantes / Delivery
- Transporte (nafta, Uber, bus)
- Salud / Farmacia
- Entretenimiento / Salidas
- Ropa / Indumentaria
- Servicios (luz, agua, internet, teléfono)
- Educación
- Viajes / Turismo
- Hogar / Muebles
- Suscripciones (Netflix, Spotify, etc.)
- Stock Vapes
- Pago tarjeta crédito Itaú *(solo débito itau)*
- Pago tarjeta crédito Santander *(solo débito itau)*
- Otros

### Ingresos
- Sueldo
- Freelance
- Venta
- Transferencias
- Puerto
- Mesada
- Otros

Las categorías son editables desde la app (agregar, editar, eliminar).

---

## 6. Bot de Telegram

### Flujo de audio/texto libre
1. Usuario envía audio o mensaje de texto al bot.
2. Si es audio: se transcribe con **OpenAI Whisper**.
3. El texto (original o transcripto) se envía a **OpenAI GPT** para extraer:
   - Tipo: gasto o ingreso
   - Monto
   - Moneda (UYU por defecto si no se especifica)
   - Categoría (la más probable)
   - Tarjeta/medio de pago (si se menciona)
4. El bot responde con un mensaje de confirmación y botones inline:
   > *"¿Confirmo este registro?"*
   > `✅ Confirmar` | `❌ Cancelar`
5. Si confirma → se guarda en la base de datos.
6. Si cancela → no se guarda, el bot lo indica.

### Comandos
| Comando | Descripción |
|---|---|
| `/start` | Mensaje de bienvenida e instrucciones |
| `/comovenimos` | Muestra el total gastado por categoría en el mes actual, seguido (separado por una línea en blanco) del total ingresado por categoría |
| `/tarjetas` | Gasto acumulado del mes por tarjeta |

### Notificaciones automáticas (Vercel Cron — 9:00 AM diario)
- **Cierre de crédito:** Si una tarjeta cierra mañana → notificación por Telegram.
- **Límite superado:** Si el gasto acumulado del mes en Santander crédito o Itaú crédito supera $10.000 UYU → alerta inmediata. La verificación se hace tanto en el cron diario como en tiempo real al confirmar cada transacción del bot (si la transacción es con esa tarjeta).
- **Recordatorio reconciliación:** El día 1 de cada mes el cron envía el mensaje: *"Mes nuevo, ¿anotaste tu reconciliación mensual?"* — solo informativo, no espera respuesta.

---

## 7. App Web

### Autenticación
Sin autenticación por ahora. Uso personal.

### Diseño
- **Mobile-first**, responsive en PC.
- En mobile: navegación en barra inferior (bottom nav).
- En PC: sidebar o barra superior; las tarjetas se muestran en fila horizontal seleccionable.

### Pantallas

#### Dashboard (🏠)
- Balance total del mes (UYU y USD por separado).
- Cards de tarjetas: deslizables en mobile, fila horizontal en PC. Al seleccionar una tarjeta se filtran las transacciones.
- Lista de últimas transacciones con monto, categoría, tarjeta y fecha.
- Indicador de mes actual.

#### Nueva Transacción (➕)
Formulario manual:
- Tipo: Gasto / Ingreso
- Monto + moneda (UYU / USD)
- Categoría (selector)
- Tarjeta / medio de pago (selector)
- Fecha (por defecto: hoy)
- Descripción/nota (opcional)

#### Reportes (📊)
Selector de mes en la parte superior (navegación hacia atrás/adelante por mes). Todos los gráficos y tablas reflejan el mes seleccionado. Incluye:
- **Pie chart** de gastos por categoría
- **Gráfico de barras** gastos vs ingresos mes a mes (últimos 6 meses, independiente del selector de mes)
- **Línea** de evolución del saldo a lo largo del mes seleccionado
- **Resumen por tarjeta**: cuánto se gastó con cada medio de pago en el mes seleccionado
- **Top 5 categorías** de mayor gasto del mes seleccionado

#### Tarjetas (💳)
- Lista de todas las tarjetas con su configuración.
- Acciones: editar fecha de cierre/vencimiento, editar límite, activar/desactivar.
- Botón para agregar nueva tarjeta.

---

## 8. Reconciliación Mensual

Al inicio de cada mes, la app muestra automáticamente una pantalla de reconciliación en el dashboard (cuando el usuario abre la app por primera vez en el mes nuevo). También es accesible manualmente desde la sección Tarjetas. Aplica para cada **tarjeta de débito** y **efectivo** (excluye mamá y créditos):
1. La app muestra el saldo calculado: `saldo anterior + ingresos - gastos`.
2. El usuario ingresa el saldo real actual.
3. Si hay diferencia, se muestra:
   > *"Esperado: $45.200 / Ingresaste: $44.800 → diferencia: -$400"*
   > `✅ Usar mi monto ($44.800)` | `❌ Cancelar`
4. Si confirma: el mes arranca con el monto ingresado como base.
5. Si cancela: no se actualiza el saldo.
6. Siempre se inserta un registro en `monthly_balances` con el campo `status`:
   - `confirmed`: el usuario aceptó su monto — `opening_balance` queda con el valor ingresado.
   - `cancelled`: el usuario canceló — `opening_balance` queda con el valor calculado esperado.
   La diferencia queda guardada en ambos casos para el historial.

---

## 9. Modelo de Datos

```sql
cards
  id, name, type (credito|debito|efectivo),
  bank, closing_day, due_day, limit_amount,
  currency, is_active, linked_payment_card_id,
  is_owners (true = mía, false = mamá)

categories
  id, name, type (gasto|ingreso), emoji, color, is_active

transactions
  id, amount, currency, type (gasto|ingreso),
  category_id, card_id, description,
  source (manual|telegram), date, created_at

monthly_balances
  id, card_id, month, year,
  expected_balance, opening_balance,
  difference, status (confirmed|cancelled), recorded_at
  -- Siempre en UYU. Todas las tarjetas débito/efectivo reconciliadas son UYU.

notifications_log
  id, type (cierre|limite), card_id,
  sent_at, message
```

---

## 10. Estructura de Carpetas (Next.js)

```
/app
  /                    → Dashboard
  /transacciones/nueva → Nueva transacción
  /reportes            → Reportes mensuales
  /tarjetas            → Gestión de tarjetas
  /api/bot             → Webhook Telegram
  /api/cron            → Job diario notificaciones
  /api/transactions    → CRUD transacciones
  /api/cards           → CRUD tarjetas
  /api/categories      → CRUD categorías
  /api/balances        → Saldos mensuales
/components
/lib
  /db.ts               → Conexión Neon Postgres
  /openai.ts           → Whisper + GPT
  /telegram.ts         → Envío de mensajes
/prisma
  schema.prisma
```

---

## 11. Variables de Entorno Necesarias

```env
DATABASE_URL=           # Neon Postgres connection string
TELEGRAM_BOT_TOKEN=     # Token del bot de Telegram
TELEGRAM_CHAT_ID=       # Tu chat ID personal
OPENAI_API_KEY=         # OpenAI API key
CRON_SECRET=            # Secret para proteger el endpoint de cron
```

---

## 12. Seguridad del Bot

El bot ignora silenciosamente cualquier mensaje que no provenga del `TELEGRAM_CHAT_ID` configurado. No responde a usuarios desconocidos.
