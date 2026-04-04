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
- Sección de resultado: transacciones guardadas vs duplicadas omitidas

**`app/api/extractos/route.ts`**
Endpoint `POST` que recibe `multipart/form-data` con:
- `cardId`: string
- `file`: PDF

Lógica:
1. Parsear multipart con `request.formData()`
2. Extraer texto del PDF con `pdf-parse`
3. Si no hay texto extraíble → error 400 "PDF sin texto extraíble"
4. Fetch de categorías activas desde DB para incluir en el prompt
5. Llamada a GPT-4o-mini con el texto y las categorías
6. Parsear JSON de respuesta (retry una vez si falla)
7. Para cada transacción:
   - Buscar duplicado en DB (cardId + date ±1 día + amount exacto)
   - Si no existe → insertar con `source: 'extracto'`
8. Retornar `{ saved: number, skipped: number, transactions: [...] }`

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

**`components/BottomNav.tsx`**
Agregar ítem: `{ href: '/extractos', icon: '📄', label: 'Extractos' }`

**`app/layout.tsx`**
Agregar el mismo ítem al sidebar desktop.

---

## Prompt a GPT

```
Eres un asistente que extrae transacciones de extractos bancarios del banco Itaú Uruguay.

Dado el siguiente texto de un extracto bancario, extrae TODAS las transacciones y devuelve un JSON array con este formato exacto:
[
  {
    "date": "YYYY-MM-DD",
    "amount": 1234.56,
    "currency": "UYU",
    "description": "descripción de la transacción",
    "categoryId": "<id de la categoría más apropiada>"
  }
]

Reglas:
- Solo gastos (no incluir pagos de tarjeta, saldos, ni resúmenes)
- Moneda: "UYU" o "USD" según corresponda
- amount: siempre positivo
- categoryId: elegir el más apropiado de esta lista:
  <lista de categorías con id y nombre>
- Si no hay categoría clara, usar el id de "Otros"
- Responde SOLO con el JSON array, sin texto adicional

Texto del extracto:
<texto extraído del PDF>
```

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
| PDF sin texto extraíble | 400 "Este PDF no tiene texto extraíble. Asegurate de subir un PDF digital, no escaneado." |
| GPT no devuelve JSON válido | Retry una vez; si falla → 500 "No se pudo procesar el extracto" |
| Archivo mayor a 10MB | 400 "El archivo no puede superar 10MB" |
| cardId inválido | 400 "Tarjeta no encontrada" |

---

## Dependencias a instalar

```bash
npm install pdf-parse
npm install --save-dev @types/pdf-parse
```

---

## Limitaciones conocidas

- No soporta PDFs escaneados
- No soporta múltiples archivos simultáneos
- Solo banco Itaú
- No hay revisión previa antes de guardar
