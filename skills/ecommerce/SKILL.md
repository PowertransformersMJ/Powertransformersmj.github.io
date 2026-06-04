---
name: ecommerce
description: E-commerce Development - Comprehensive support for architecture, domain design, checkout flows, payment gateways (PSE, Wompi, Stripe), Colombian tax regulations (DIAN), logistics (COD), and SIC compliance.
requires-guidelines:
  - common
  - design/ecommerce-platforms
metadata:
  mcpmarket-version: 1.2.0
---
# Desarrollo de Sitios E-commerce (Arquitectura Global y Especialización Colombia)

## Cuándo usar esta Skill

- **Creación o diseño de la arquitectura** de un nuevo sitio de comercio electrónico.
- **Diseño e implementación de procesos críticos:** gestión de productos/variantes, carritos de compra, pasarelas de pago y flujos de checkout.
- **Revisión, auditoría y optimización** de e-commerce existentes para mejorar el rendimiento, la seguridad y el cumplimiento legal.
- **Integración de pasarelas de pago** colombianas (PSE, Wompi, PayU, ePayco, Bold, Mercado Pago) y globales (Stripe, PayPal, Adyen).
- **Implementación de lógica logística local:** Cálculo de fletes en tiempo real, selector estructurado DANE y Pago Contra Entrega (COD).
- **Alineación legal y tributaria:** Facturación electrónica obligatoria ante la DIAN, manejo del IVA y cumplimiento de normativas de la SIC (Estatuto del Consumidor).

---

## Diseño de Dominio y Modelado de Datos

### Entidades Core y Estructura de Base de Datos

| Entidad | Responsabilidad Principal | Atributos Críticos y Campos Locales (Colombia) |
| :--- | :--- | :--- |
| **Product** | Datos maestros del catálogo de productos. | `id`, `title`, `description`, `slug`, `categories`, `images_urls`, `status` (active/draft), `tax_rate` (IVA 0%, 5%, 19%), `impoconsumo` (si aplica). |
| **Variant** | Opciones de compra específicas (SKUs independientes). | `id`, `product_id`, `sku` (único), `price` (COP/USD), `compare_at_price` (precio tachado), `inventory_qty`, `weight_kg`, `dimensions` (alto, ancho, largo para cubicación de envíos), `version` (bloqueo optimista). |
| **Cart** | Estado del carrito de compras temporal. | `id`, `customer_id` (opcional), `items` (variant_id, qty), `coupon_code`, `discount_amount`, `updated_at`. |
| **Order** | Registro oficial de la compra y su trazabilidad. | `id`, `order_number` (secuencial/legible), `customer_id`, `status` (pedido, pago_pendiente, pagado, preparado, enviado, completado, cancelado), `total_tax`, `shipping_cost`, `total_amount`, `payment_id`, `tracking_number`, `invoice_id` (vínculo a Factura Electrónica). |
| **Customer** | Perfil, autenticación y datos del comprador. | `id`, `first_name`, `last_name`, `email`, `phone`, `document_type` (CC, CE, NIT, Pasaporte), `document_number` (requerido para facturación electrónica), `address_book`. |
| **Payment** | Transacción financiera asociada a un pedido. | `id`, `order_id`, `gateway_name` (Wompi, PayU, Stripe, etc.), `transaction_id`, `status` (approved, pending, rejected, refunded), `payment_method` (PSE, tarjeta_credito, nequi, daviplata, contra_entrega, efectivo), `gateway_response` (metadata). |

### Estructura de Direcciones (Divipola DANE)
Para evitar fallas de entrega en las transportadoras en Colombia (Servientrega, Coordinadora, Envía, Interrapidisimo), **nunca** uses campos de texto libre para las ciudades. El checkout debe implementar selectores en cascada:
1. **Departamento:** Catálogo estructurado de los 32 departamentos colombianos (ej. Antioquia, Cundinamarca, Valle del Cauca).
2. **Municipio/Ciudad:** Catálogo mapeado usando la nomenclatura oficial **Divipola del DANE** (ej. "Bogotá, D.C. [11001]", "Medellín [05001]").
3. **Dirección Detallada:** Tipo de vía (Calle, Carrera, Avenida), nomenclatura física, indicaciones (apto, oficina, conjunto).

---

## Ecosistema de Pagos y Financiación

### 1. Débitos Directos
- **PSE (Pagos Seguros en Línea / ACH):** Imprescindible para el mercado colombiano. Permite debitar directamente desde cuentas de ahorro o corrientes de cualquier banco en Colombia. Debe mostrarse como opción destacada en el checkout.

### 2. Pasarelas de Pago
- **Wompi (Grupo Bancolombia):** Integración líder y recomendada en Colombia. Proporciona un flujo nativo y altamente optimizado para tarjetas de crédito, PSE, Nequi (con notificación push directa al celular) y Botón Bancolombia.
- **PayU Latam:** Plataforma transaccional de alto nivel. Excelente manejo de antifraude, soporte multi-moneda, y recaudos físicos.
- **Mercado Pago:** Pasarela rápida de integrar, sólida detección de fraudes mediante machine learning, cuenta con billetera digital e integración fluida.
- **ePayco:** Muy utilizada por su versatilidad, cobros por link y fuerte integración para recaudos móviles a través de Daviplata.
- **Stripe / PayPal / Adyen:** Emplear únicamente para transacciones internacionales, e-commerce transfronterizos o si el modelo de negocio opera en USD.
- **Bold:** Pasarela ágil para cobros rápidos online y links de pago.
- **Placetopay (Evertec):** Ideal para arquitecturas empresariales y corporativas que requieren conexión directa con adquirentes financieros.

### 3. Compra Ahora y Paga Después (BNPL)
- **Addi / Sistecrédito:** Integración clave para aumentar las tasas de conversión en Colombia. Permiten ofrecer créditos de consumo instantáneos durante el checkout mediante validación rápida por celular (código OTP y/o WhatsApp).

### 4. Corresponsales y Recaudo Físico (Offline)
- Para compras en efectivo, integrar a través de la pasarela agregadora el recaudo físico en redes capilares: **Efecty**, **Vía Baloto**, **Paga Todo**, **SuRed**, **Gana**.

---

## Requisitos Legales, Tributarios y Logísticos (Colombia)

### 1. Estatuto del Consumidor (Ley 1480 de 2011 & SIC)
- **Derecho de Retracto (Art. 47):** El cliente puede devolver compras realizadas por internet dentro de los 5 días hábiles siguientes a la entrega y recibir el 100% de su dinero. El comercio tiene hasta 30 días calendario para realizar el reembolso.
- **Reversión del Pago (Art. 51):** Obligación de reversar cargos ante reclamos de fraude, productos no recibidos o defectuosos. Se debe notificar al comercio y a la entidad financiera en un plazo máximo de 5 días hábiles.
- **Enlace Obligatorio de la SIC:** En el pie de página (footer) de la web, debe existir de forma permanente y visible un enlace a la Superintendencia de Industria y Comercio (www.sic.gov.co) para la radicación de PQRs.
- **Datos Legales Transparentes:** Exponer claramente en el sitio el NIT, Razón Social, teléfono de servicio al cliente y dirección física de notificaciones de la empresa.

### 2. Tratamiento de Datos (Ley 1581 de 2012 - Habeas Data)
- Solicitar aceptación explícita y documentada (Opt-in independiente, no pre-marcado) de la política de datos antes de enviar datos al checkout o registrar usuarios.

### 3. Facturación Electrónica Obligatoria (DIAN)
- Toda transacción comercial en línea debe generar factura electrónica de venta en Colombia.
- **Flujo de Integración:** Conectar el estado de la transacción `Pagado` mediante Webhooks a sistemas de facturación electrónica (como Siigo, Alegra, Facturatech o desarrollos a medida de proveedores autorizados) para emitir de forma inmediata la factura con código único CUFE y enviarla al correo electrónico del adquirente.

### 4. Logística y Pago Contra Entrega (COD - Cash on Delivery)
- Debido a la desconfianza histórica y a los niveles de bancarización, el **Pago Contra Entrega** en efectivo al recibir el producto es de altísima demanda en Colombia.
- **Lógica de Envío:** Integrar APIs de cotización de fletes y generación automática de guías con transportadoras locales como **Coordinadora**, **Servientrega**, **Envía** o **Interrapidisimo**. El sistema debe verificar si la dirección del cliente cuenta con cobertura logística para cobros COD antes de habilitar la opción en el checkout.

---

## Arquitectura y Diseño Técnico

### 1. Patrón de Reserva de Stock Seguro (Bloqueo Optimista)
Para evitar la sobreventa (ventas en paralelo que agotan el stock físico real), implementa un bloqueo optimista en el nivel de base de datos utilizando versiones incrementales.

```typescript
// Ejemplo de persistencia con ORM (Prisma / TypeScript)
async function reserveStock(variantId: string, qty: number, currentVersion: number) {
  const result = await db.variant.updateMany({
    where: {
      id: variantId,
      inventory_qty: { gte: qty },
      version: currentVersion, // Asegura que no haya habido cambios concurrentes
    },
    data: {
      inventory_qty: { decrement: qty },
      version: { increment: 1 },
    },
  });
  
  if (result.count === 0) {
    throw new StockNotAvailableError("El stock solicitado ya no está disponible.");
  }
}
```

### 2. Flujo Transaccional de Pagos y Reservas

```
1. Confirmación de Carrito → Generación de Pre-Orden → Bloqueo temporal de stock (ej. 15 minutos).
2. Procesamiento de Pago → Redirección segura a la pasarela (PSE / Tarjeta / Wompi / PayU).
3. Respuesta del Servidor (Notificación / Webhook):
   ├── Éxito (Transacción Aprobada) → Confirmación definitiva de stock → Generar Factura Electrónica (DIAN) → Despacho.
   ├── Fallo (Transacción Rechazada) → Liberar stock de inmediato al inventario activo → Notificar al cliente.
   └── Pendiente (ej. PSE esperando aprobación de banco) → Mantener reserva de stock hasta confirmación del webhook.
4. Expiración de Tiempo (15 min sin respuesta del Gateway) → Cron job libera el stock reservado y cancela la pre-orden.
```

### 3. Enrutamiento de Transacciones en el Checkout Colombiano

```typescript
interface PaymentRequest {
  orderId: string;
  amount: number;
  paymentMethod: 'PSE' | 'CARD_wompi' | 'NEQUI_push' | 'ADDI_credit' | 'COD' | 'EFECTIVO_offline';
  customer: {
    documentType: 'CC' | 'NIT' | 'CE' | 'PP';
    documentNumber: string;
    email: string;
    fullName: string;
  };
}

async function handleCheckoutPayment(request: PaymentRequest) {
  switch (request.paymentMethod) {
    case 'PSE':
      // Redirección directa al flujo ACH a través de la pasarela elegida
      return await initializePSEFlow(request);
    case 'NEQUI_push':
      // API de Wompi permite envío push inmediato al celular asociado
      return await triggerNequiPush(request);
    case 'ADDI_credit':
      // Abre la ventana de checkout Addi para pre-aprobación del crédito
      return await startAddiCheckout(request);
    case 'COD':
      // Verifica cobertura de la transportadora antes de confirmar despacho con cobro
      await verifyLogisticsCoverage(request.orderId);
      return await registerCashOnDeliveryOrder(request.orderId);
    case 'EFECTIVO_offline':
      // Generar pin de pago para Efecty/Baloto/SuRed con validez de 24 horas
      return await generateOfflinePaymentPin(request);
    default:
      return await processStandardCreditCard(request);
  }
}
```

### 4. API Core (REST)

```yaml
GET    /products          # Listar catálogo (con filtros de categoría, precio e IVA)
GET    /products/:id      # Detalle del producto con sus variantes (SKUs, tallas, colores)
POST   /cart/items        # Modificar cantidades o agregar elementos al carrito
POST   /orders/checkout   # Iniciar flujo de compra, solicitar datos tributarios (Cédula/NIT)
POST   /orders/webhook    # Listener asíncrono para notificaciones de pago (Wompi, PayU, etc.)
GET    /orders/:id/status # Estado del pedido y enlace de guía de transportadora
```

---

## Seguridad y Rendimiento (Métricas Clave)

### Seguridad Obligatoria
- Encriptación TLS/HTTPS forzada en todo el sitio web.
- Cumplimiento de estándares **PCI DSS** (los datos de tarjetas de crédito deben ser tokenizados directamente por los scripts del Gateway; el servidor del e-commerce jamás debe recibir ni almacenar números de tarjetas o códigos CVV en sus bases de datos).
- Implementación de tokens CSRF y cabeceras de seguridad CSP (Content Security Policy).

### Rendimiento (Objetivos Core Web Vitals)

| Métrica | Meta de Rendimiento |
| :--- | :--- |
| **Tiempo de carga visual inicial (LCP)** | < 2.5 segundos (Optimizado para móviles de gama media bajo redes 4G). |
| **Retraso de la primera interacción (FID)** | < 100ms. |
| **Tiempo de respuesta de búsqueda / filtros** | < 400ms (Sugerido usar Algolia o indexación local en memoria/Redis). |
| **Procesamiento de pagos (API Gateway)** | < 4 segundos (Tiempo límite de respuesta de API de la pasarela antes de timeout). |

---

## Opciones de Plataforma

### Shopify
- API de tienda: Storefront API / Admin GraphQL API
- Framework headless: Hydrogen (React/Remix)

### WooCommerce
- API REST nativa de WooCommerce
- Integración con WordPress

### Desarrollo a Medida (Custom)
- Pasarelas: Stripe / Wompi / PayU / Mercado Pago / ePayco / Placetopay / Addi
- Buscadores: Algolia / Elasticsearch / Meilisearch

---

## Formato de Salida Esperado de la IA

### Al proponer o documentar la arquitectura:
```
📋 DOMINIO: Modelado lógico de base de datos e IVA (Colombia)
💳 PAGOS: Configuración detallada de pasarelas locales (PSE, Nequi, Addi, etc.)
🚚 LOGÍSTICA: Integración con transportadoras nacionales y flujo Contra Entrega (COD)
⚖️ LEGALIDAD: Checklist de cumplimiento de Ley 1480 (SIC) y Habeas Data
```

### Al revisar, auditar o depurar código existente:
```
🔴 CRÍTICO: Problemas graves detectados (ej. vulnerabilidades de inyección, riesgos de sobreventa de stock en paralelo, omisión de la reversión de pago).
🟡 ADVERTENCIA: Puntos de mejora en el rendimiento del checkout, fallos en la persistencia de carritos abandonados, o falta de campos requeridos por la DIAN.
📊 RESUMEN: Porcentaje de cumplimiento de buenas prácticas generales y locales de comercio electrónico (X%).
```

---

## Referencias y Base de Conocimientos

Consultar documentación técnica actualizada para:
- Shopify Dev: `/websites/shopify_dev` o https://shopify.dev/
- MedusaJS (E-commerce open-source en Node.js): `/medusajs/medusa`
- Stripe API: https://stripe.com/docs/api
- WooCommerce REST API: https://woocommerce.github.io/woocommerce-rest-api-docs/
- Wompi Colombia API: https://docs.wompi.co/
- PayU Latam API: https://developers.payulatam.com/
