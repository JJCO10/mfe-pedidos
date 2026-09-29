# mfe-pedidos

Micro frontend de seguimiento de pedidos. Escucha `pedido:confirmado`,
avanza el estado de cada pedido automáticamente y publica `pedido:estado`.

## Puerto
`http://localhost:8085`

Ejemplo:
    python -m http.server 8085

## Tecnología
Lit 3 desde CDN (unpkg, `?module`). Sin build.

## Contrato de montaje / desmontaje
- `window.renderPedidos(idContenedor)`
- `window.unmountPedidos(idContenedor)`

## Eventos
- **Escucha:** `pedido:confirmado`
  - `detail`: `{ id, items, total, version }`
- **Publica:** `pedido:estado`
  - `detail`: `{ pedidoId, estado, version }`
  - Versión: 1.
  - Se emite cada vez que un pedido cambia de estado.

## Estados
`Recibido → En preparación → En camino → Entregado`

Cada pedido avanza automáticamente con `setInterval` cada ~3 s.
Los intervalos **no se detienen** al desmontar: los pedidos siguen
avanzando aunque el usuario navegue a otra ruta.

## Precarga
El registro del contenedor marca este MFE como `precargar: true`, porque
necesita escuchar `pedido:confirmado` aunque el usuario no esté en `#/pedidos`.

## Modo independiente
Abrir `http://localhost:8085/`.
El botón "Simular pedido confirmado" dispara un `pedido:confirmado` falso,
y la lista muestra los `pedido:estado` publicados.

## Prueba de contrato
Abrir `http://localhost:8085/contrato.html`.
Verifica funciones expuestas, montaje, reacción a `pedido:confirmado`
y estructura de `pedido:estado`.

## Versión visible
`VERSION = '1.0.0'` (mostrado en pantalla bajo el título).