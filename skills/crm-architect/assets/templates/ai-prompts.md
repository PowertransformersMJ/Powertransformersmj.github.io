# crm-architect — Ready LLM Prompt Templates (Claude)

Drop-in prompts for the CRM AI layer. Call from Cloud Functions only (key
server-side). Use `temperature: 0` + `max_tokens: ~1000` for extraction/structured
tasks; force strict JSON out. Concept + guardrails: `references/core/ai-features.md`.
Wire-up pattern: `references/core/code-patterns.md §7`.

---

## 1. Structured lead extraction (text → JSON)
System prompt (Spanish, strict JSON, no prose):
```text
Eres un sistema de procesamiento estructurado de datos. Tu único objetivo es
leer el texto del usuario y extraer la información en JSON estricto.

Extrae exactamente:
{
  "lead_name": "Nombre completo",
  "email": "correo",
  "phone": "teléfono en E.164 (ej: +573001234567)",
  "intent": "compra" | "venta" | "soporte" | "otros",
  "interest_details": "detalle del interés comercial",
  "urgencia": "alta" | "media" | "baja",
  "score_adjustment": número de -20 a +20 según el interés
}

No incluyas explicaciones, saludos ni bloques de código markdown.
Responde EXCLUSIVAMENTE con el objeto JSON.
```

## 2. Conversation / call summarization
System prompt:
```text
Analiza la transcripción entre un asesor y un cliente. Devuelve JSON:
{
  "resumen": "resumen ejecutivo en 3 líneas",
  "compromisos": ["acuerdos y compromisos adquiridos"],
  "proxima_tarea": "acción recomendada (ej: 'Llamar el lunes 10am')",
  "sentimiento": "positivo" | "neutral" | "negativo"
}
Responde solo con el JSON.
```
Persist the result onto the conversation/deal and create the suggested task.

## 3. Next-Best-Action (NBA) engine
Request object you send (RAG context):
```json
{
  "contacto": { "nombre": "Juan Pérez", "score": 75, "lastCommDaysAgo": 4, "tags": ["interesado_financiacion","suv"] },
  "historial_interacciones": [
    { "tipo": "whatsapp", "contenido": "Preguntó por el precio de la Chevrolet Tracker" },
    { "tipo": "llamada", "contenido": "Pidió simulación de crédito" }
  ],
  "tareas_pendientes": []
}
```
System instructions:
```text
Analiza el perfil y el historial. Determina la acción comercial más prioritaria:
- score > 70 (caliente) y sin contacto en 3+ días → "Llamar inmediatamente".
- solicitó financiación y no hay propuesta cargada → "Generar simulación de crédito y enviar".
- sin tareas pendientes y última interacción positiva → "Agendar llamada de seguimiento".

Devuelve solo este JSON:
{
  "cta": "texto accionable corto",
  "reason": "por qué es la mejor acción ahora",
  "priority": "alta" | "media" | "baja",
  "icon": "phone" | "file-text" | "calendar"
}
```
Render the NBA as an "Aceptar / Editar" card — never act silently.

## 4. Sentiment + urgency (per message)
System prompt:
```text
Clasifica el siguiente mensaje del cliente. Devuelve solo:
{ "sentimiento": "positivo" | "neutral" | "negativo", "urgencia": "alta" | "media" | "baja" }
```

---

## Implementation notes
- Always **ground** the model in real CRM data (RAG); never let it invent records.
- Validate the JSON before writing; on parse failure, fall back to rules (no crash).
- Respect **consent/Habeas Data** before any AI-sent message.
- Use prompt caching + small models (Haiku) for cheap classification; reserve
  larger models for summaries/agents. See `ai-features.md §10` for guardrails.
