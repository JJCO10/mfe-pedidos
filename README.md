# mfe-pedidos

Micro frontend de seguimiento de pedidos. Escucha `pedido:confirmado`,
avanza el estado de cada pedido automáticamente y publica `pedido:estado`.

- **Versión:** `1.0.0` (visible en pantalla bajo el título)
- **Tecnología:** Lit 3 desde CDN (unpkg, `?module`). Sin build.
- **Despliegue:** Render — Static Site
- **Producción:** https://mfe-pedidos.onrender.com
- **Local:** `http://localhost:8085`

---

## 1. Contrato de montaje / desmontaje

El MFE expone dos funciones globales en `window`:

```js
window.renderPedidos(idContenedor);   // monta el componente en #idContenedor
window.unmountPedidos(idContenedor);  // desmonta y limpia ese contenedor
```

Ejemplo de uso desde el contenedor:

```js
// montar
window.renderPedidos('raiz-pedidos');

// desmontar
window.unmountPedidos('raiz-pedidos');
```

> **Nota:** `unmountPedidos` **no** detiene los `setInterval`. Los pedidos
> siguen avanzando de estado aunque el usuario navegue a otra ruta. Cuando
> vuelva a `#/pedidos`, verá el estado actualizado.

---

## 2. Eventos

### Escucha: `pedido:confirmado`

Lo dispara el carrito (u otro MFE) cuando el usuario confirma una compra.

```js
window.dispatchEvent(new CustomEvent('pedido:confirmado', {
  detail: {
    id: 7777,                                              // number
    items: [{ id: 1, nombre: 'Chivo guisado', precio: 28000, cantidad: 1 }],
    total: 30800,                                          // number
    version: 1                                             // number
  }
}));
```

### Publica: `pedido:estado`

Se emite **cada vez que un pedido cambia de estado** (cada ~3 s).

```js
window.addEventListener('pedido:estado', (e) => {
  console.log(e.detail);
  // { pedidoId: 7777, estado: 'En preparación', version: 1 }
});
```

| Campo      | Tipo     | Descripción                          |
|------------|----------|--------------------------------------|
| `pedidoId` | `number` | ID del pedido que cambió de estado   |
| `estado`   | `string` | Uno de los 4 estados (ver abajo)     |
| `version`  | `number` | Versión del contrato del evento: `1` |

---

## 3. Estados

```
Recibido → En preparación → En camino → Entregado
```

Cada pedido avanza automáticamente con `setInterval` cada **3000 ms**.
El intervalo se detiene solo cuando el pedido llega a `Entregado`.

---

## 4. Precarga

El registro del contenedor marca este MFE como `precargar: true`, porque
necesita escuchar `pedido:confirmado` aunque el usuario no esté en
`#/pedidos`. Si no se precarga, se pierden pedidos confirmados antes de
entrar a la ruta de seguimiento.

---

## 5. Cómo consumirlo desde el contenedor (single-spa)

El contenedor carga el MFE con un `import()` dinámico cross-origin. Por eso
el MFE **debe servirse con CORS habilitado** y con `Content-Type` correcto.

### Import map recomendado

```html
<script type="importmap">
{
  "imports": {
    "@SaborUPC/pedidos": "https://mfe-pedidos.onrender.com/pedidos.js"
  }
}
</script>
```

### Registro en single-spa

```ts
// SaborUPC-root-config.ts
registerApplication({
  name: '@SaborUPC/pedidos',
  app: () => import('@SaborUPC/pedidos'),
  activeWhen: ['#/pedidos'],
  customProps: {
    domElement: '#raiz-pedidos',
    render: 'renderPedidos',
    unmount: 'unmountPedidos'
  }
});
```

> Si haces el import directo con la URL completa, usa
> `/* webpackIgnore: true */` para que webpack no intente bundlearlo:
> ```ts
> app: () => import(/* webpackIgnore: true */ 'https://mfe-pedidos.onrender.com/pedidos.js')
> ```

---

## 6. CORS y `Content-Type`

Render sirve los archivos estáticos, pero **no agrega headers CORS por
defecto**. Para que single-spa pueda cargar el MFE desde otro origen
(`http://localhost:9000`), el repo incluye un archivo **`_headers`** en la
raíz del Publish Directory:

```
/*
  Access-Control-Allow-Origin: *

/*.js
  Content-Type: text/javascript; charset=utf-8

/*.html
  Content-Type: text/html; charset=utf-8

/*.css
  Content-Type: text/css; charset=utf-8
```

### Verificar que Render los está aplicando

```bash
curl -I https://mfe-pedidos.onrender.com/pedidos.js
```

Debe incluir:

```
HTTP/2 200
content-type: text/javascript; charset=utf-8
access-control-allow-origin: *
```

Si falta `access-control-allow-origin`, revisa que:

1. `_headers` esté en la raíz del **Publish Directory** (no en la raíz del repo, si el Publish Directory es una subcarpeta).
2. La sintaxis sea exacta: sin tabulaciones, sin comillas, con dos espacios de indentación y línea en blanco entre bloques.
3. El deploy de Render haya terminado en estado **Live**.

---

## 7. Encoding

Todos los archivos del MFE están guardados en **UTF-8 sin BOM**. Esto es
crítico porque el estado `'En preparación'` se usa como string literal y
como selector CSS:

```css
.estado[data-estado="En preparación"] { ... }
```

Si el archivo se sirviera como Latin-1, el string se corrompería a
`'En preparaciÃ³n'` y ni el CSS ni la comparación funcionarían.

El `_headers` fuerza `charset=utf-8` en la respuesta para evitarlo.

---

## 8. Desarrollo local

```bash
python -m http.server 8085
```

- **Modo independiente:** http://localhost:8085/
  El botón **"Simular pedido confirmado"** dispara un `pedido:confirmado`
  falso y la lista muestra los `pedido:estado` publicados en vivo.

- **Prueba de contrato:** http://localhost:8085/contrato.html
  Verifica:
  - `window.renderPedidos` y `window.unmountPedidos` son funciones.
  - El montaje genera contenido en el contenedor.
  - Existe `<mfe-pedidos>` con Shadow DOM y el título "Seguimiento".
  - El MFE reacciona a `pedido:confirmado` y el pedido aparece en pantalla.
  - Se emite `pedido:estado` con la estructura correcta
    (`pedidoId: number`, `estado: string`, `version: 1`).
  - El primer estado emitido es `'En preparación'` (tras ~3.5 s).

---

## 9. Estructura del repo

```
mfe-pedidos/
├── _headers          # CORS + Content-Type charset=utf-8 (Render)
├── pedidos.js        # El MFE (Lit 3 desde CDN, sin build)
├── index.html        # Modo independiente (botón "Simular pedido")
├── contrato.html     # Prueba de contrato automatizada
└── README.md         # Este archivo
```

---

## 10. Despliegue en Render

**Tipo:** Static Site
**Build Command:** *(vacío)*
**Publish Directory:** `.` (o la carpeta donde estén los archivos)

No requiere `npm install` ni build. Lit se carga desde unpkg en tiempo de
ejecución del navegador.

---

## 11. Checklist para el equipo del contenedor

- [ ] Cargar el MFE con `import()` o `<script type="module">` desde
      `https://mfe-pedidos.onrender.com/pedidos.js`.
- [ ] Marcar el MFE como **precargar: true** en el registro.
- [ ] Llamar `window.renderPedidos(idContenedor)` al montar la ruta `#/pedidos`.
- [ ] Llamar `window.unmountPedidos(idContenedor)` al salir de la ruta.
- [ ] Escuchar `pedido:estado` para mostrar toasts / notificaciones.
- [ ] Disparar `pedido:confirmado` desde el carrito al confirmar la compra.
- [ ] Verificar en consola que no hay errores de CORS al cargar el script.