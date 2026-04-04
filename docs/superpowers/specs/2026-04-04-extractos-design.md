# Spec: Importación de Extractos Bancarios

**Fecha:** 2026-04-04
**Estado:** Aprobado

## Resumen

Nueva sección en la app de finanzas para subir extractos bancarios en PDF. El sistema extrae el texto del PDF, lo procesa con GPT-4o-mini y guarda las transacciones automáticamente en la base de datos con categoría y tarjeta asignadas.

---

## Decisiones de diseño

- **Banco soportado:** Solo Itaú por ahora
- **Guardado:** Automático, sin revisión previa
- **Duplicados:** Detectados y omitidos (criterio: mismo cardId + date ±1 día + amount)
- **Tarjeta:** El usuario selecciona manualmente la tarjeta al subir el extracto
- **Procesamiento PDF:** `pdf-parse` (extracción de texto) + GPT-4o-mini (parsing + categorización)
- **type de transacción:** Siempre `gasto` — el prompt excluye explícitamente ingresos; el campo se hardcodea en el insert

---

## Flujo de usuario

1. Usuario navega a `/extractos` desde el menú (📄 Extractos)
2. Selecciona la tarjeta correspondiente al extracto (dropdown)
3. Sube el archivo PDF (máximo 10MB)
4. El sistema procesa y muestra un resumen: ✅ X guardadas, ⏭ Y duplicadas ignoradas
5. En caso de error, se muestra el mensaje descriptivo

---

## Arquitectura

### Archivos nuevos

**`app/extractos/page.tsx`**
Server component simple que renderiza `ExtractosClient`.

**`app/extractos/ExtractosClient.tsx`**
Componente cliente con:
- Dropdown de selección de tarjeta (fetch a `/api/cards`)
- Input de archivo PDF
- Botón "Procesar extracto"
- Estado de carga con feedback visual
- Sección de resultado: número de transacciones guardadas y número de duplicadas omitidas (no se muestra el detalle de cada una)

**`app/api/extractos/route.ts`**
Endpoint `POST` con `export const dynamic = 'force-dynamic'`, recibe `multipart/form-data` con:
- `cardId`: string
- `file`: PDF

Lógica:
1. Parsear multipart con `request.formData()`
2. Validar que `cardId` existe en DB (`prisma.card.findUnique`) → 400 si no existe
3. Validar tamaño del archivo (≤ 10MB) → 400 si supera el límite
4. Extraer texto del PDF con `pdf-parse`
5. Si no hay texto extraíble → 400 "PDF sin texto extraíble"
6. Fetch de categorías activas de tipo `gasto` desde DB para incluir en el prompt
7. Llamada a GPT-4o-mini con el texto y las categorías
8. Parsear JSON de respuesta:
   - Si falla el parse: intentar una segunda llamada con instrucción explícita de responder solo JSON
   - Si falla de nuevo → 500 "No se pudo procesar el extracto"
9. Validar cada transacción del resultado GPT:
   - Descartar si `amount <= 0`
   - Sanitizar `currency`: si no es `'UYU'` ni `'USD'`, forzar a `'UYU'`
   - Validar `categoryId` contra el Set de IDs de categorías fetcheadas; si no existe, reemplazar con el ID de la categoría "Otros" (obtenido del fetch previo)
   - Buscar duplicado en DB (cardId + date ±1 día + amount exacto)
   - Si no existe → insertar con `type: 'gasto'`, `source: 'extracto'`, `description` pasado directamente
10. Retornar `{ saved: number, skipped: number }`

**Forma del error response** (para que el cliente pueda mostrar el mensaje):
```json
{ "error": "mensaje descriptivo" }
```
El cliente lee `data.error` para mostrarlo al usuario.

### Archivos modificados

**`prisma/schema.prisma`**
Agregar `extracto` al enum `Source`:
```prisma
enum Source {
  manual
  telegram
  extracto
}
```
Requiere migración: `prisma migrate dev --name add-extracto-source`

**`next.config.ts`**
Agregar configuración para que `pdf-parse` no sea bundleado por webpack:
```ts
serverExternalPackages: ['pdf-parse']
```

**`components/BottomNav.tsx`**
El menú mobile actualmente tiene 4 ítems. Para evitar overflow en pantallas angostas, reemplazar el ícono+label de "Nueva" con un ícono más compacto o reducir padding. Agregar ítem: `{ href: '/extractos', icon: '📄', label: 'Extractos' }`.
> Nota: con 5 ítems en `flex justify-around`, cada ítem tendrá ~64px en un iPhone SE (320px). Es ajustado pero funcional con labels cortos. Si hay problemas visuales, se puede remover el label de algún ítem.

**`app/layout.tsx`**
Agregar el mismo ítem al sidebar desktop (sin restricción de espacio).

---

## Formato del extracto Itaú

El PDF del extracto Itaú tiene una tabla de transacciones con las siguientes columnas:
```
Fecha | Tarjeta | Detalle | Importe origen | Importe $ | Importe U$S
```
- **Fecha:** formato `DD MM YY` (ej: `02 03 26` = 2 de marzo de 2026)
- **Importe $:** monto en pesos uruguayos, usa coma como separador decimal (ej: `3.675,00`)
- **Importe U$S:** monto en dólares, usa coma como separador decimal (ej: `10,00`)
- Si una fila tiene valor en "Importe $" → `currency: "UYU"`
- Si una fila tiene valor en "Importe U$S" → `currency: "USD"`

**Filas a EXCLUIR (no son gastos del usuario):**
- `SALDO DEL ESTADO DE CUENTA ANTERIOR`
- `PAGOS`
- `SALDO CONTADO`
- `INTERESES COMPENSATORIOS`
- `INTERESES MORATORIOS`
- `SEGURO DE VIDA SOBRE SALDO`
- `UD. HA GENERADO X MILLAS`
- `CUENTA ADHERIDA A...`

## Prompt a GPT

```
Eres un asistente que extrae transacciones de extractos bancarios del banco Itaú Uruguay.

El extracto tiene una tabla con columnas: Fecha | Tarjeta | Detalle | Importe origen | Importe $ | Importe U$S

Formato de fecha en el extracto: DD MM YY (ejemplo: "02 03 26" = 2 de marzo de 2026)
Los montos usan coma como separador decimal (ejemplo: "3.675,00" = 3675.00)
Si la fila tiene valor en "Importe $" la moneda es UYU; si tiene valor en "Importe U$S" la moneda es USD.

Extrae SOLO las filas que representan gastos reales del usuario y devuelve un JSON array con este formato exacto:
[
  {
    "date": "YYYY-MM-DD",
    "amount": 1234.56,
    "currency": "UYU",
    "description": "descripción de la transacción",
    "categoryId": "<id de la categoría más apropiada>"
  }
]

EXCLUIR completamente estas filas (no son gastos):
- PAGOS (pagos realizados a la tarjeta)
- SALDO DEL ESTADO DE CUENTA ANTERIOR
- SALDO CONTADO
- INTERESES COMPENSATORIOS
- INTERESES MORATORIOS
- SEGURO DE VIDA SOBRE SALDO
- Cualquier fila de resumen, millas, o texto informativo

Reglas adicionales:
- amount: número positivo mayor a 0, sin comas (usar punto decimal)
- categoryId: elegir el más apropiado de esta lista:
  <lista de categorías con formato "id: nombre">
- Si no hay categoría clara, usar el categoryId de "Otros"
- Responde SOLO con el JSON array, sin texto adicional, sin markdown, sin explicaciones

Texto del extracto:
<texto extraído del PDF>
```

**Llamada de retry** (si el parse JSON de la primera respuesta falla):
Una segunda llamada independiente a OpenAI con un único mensaje `system` que contiene solo el texto de la respuesta anterior y la instrucción de corregir el formato:
```
messages: [
  {
    role: 'system',
    content: 'Responde ÚNICAMENTE con un JSON array válido, sin texto, sin markdown, sin explicaciones. El formato debe ser exactamente: [{"date":"YYYY-MM-DD","amount":0.0,"currency":"UYU","description":"...","categoryId":"..."}]. Si no hay transacciones, responde: []'
  },
  {
    role: 'user',
    content: <respuesta cruda de la primera llamada>
  }
]
```
Si este segundo parse también falla → retornar 500.

---

## Detección de duplicados

Query:
```ts
await prisma.transaction.findFirst({
  where: {
    cardId,
    amount: tx.amount,
    date: {
      gte: new Date(txDate.getTime() - 86400000), // -1 día
      lte: new Date(txDate.getTime() + 86400000), // +1 día
    },
  },
})
```
Si encuentra match → omitir, contar como `skipped`.

---

## Manejo de errores

| Caso | Respuesta |
|---|---|
| cardId no existe en DB | 400 "Tarjeta no encontrada" |
| Archivo mayor a 10MB | 400 "El archivo no puede superar 10MB" |
| PDF sin texto extraíble | 400 "Este PDF no tiene texto extraíble. Asegurate de subir un PDF digital, no escaneado." |
| GPT no devuelve JSON válido tras retry | 500 "No se pudo procesar el extracto. Intentá de nuevo." |

---

## Dependencias a instalar

```bash
npm install pdf-parse
npm install --save-dev @types/pdf-parse
```

---

## Configuración de Next.js

Agregar en `next.config.ts` a nivel raíz del objeto de configuración (NO bajo `experimental` — esta opción es top-level en Next.js 15+):
```ts
const nextConfig: NextConfig = {
  serverExternalPackages: ['pdf-parse'],
  // ... resto de la config
}
```
Esto evita que webpack intente bundlear `pdf-parse` (que usa `fs` y otros módulos Node.js nativos incompatibles con el bundler de Next.js App Router).

---

## Limitaciones conocidas

- No soporta PDFs escaneados (sin texto extraíble)
- No soporta múltiples archivos simultáneos
- Solo banco Itaú
- No hay revisión previa antes de guardar
- 5 ítems en bottom nav puede ser ajustado en pantallas muy pequeñas
