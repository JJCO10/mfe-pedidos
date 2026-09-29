// Micro frontend: SEGUIMIENTO DE PEDIDOS  (equipo "Pedidos")
// Tecnología: Lit 3 desde CDN (unpkg), sin build.
// Contrato: window.renderPedidos(idContenedor) / window.unmountPedidos(idContenedor)
// Escucha:  'pedido:confirmado'  { id, items, total, version }
// Publica:  'pedido:estado'      { pedidoId, estado, version }
import { LitElement, html, css } from 'https://unpkg.com/lit@3/index.js?module';
import { repeat } from 'https://unpkg.com/lit@3/directives/repeat.js?module';

const VERSION = '1.0.0';
const INTERVALO_MS = 3000;

// Estados por los que pasa un pedido, en orden
const ESTADOS = ['Recibido', 'En preparación', 'En camino', 'Entregado'];

const pesos = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

// ------------------------------------------------------------------
// Estado global del MFE (vive mientras el script esté cargado).
// Los pedidos se acumulan aquí aunque el usuario no esté viendo #/pedidos.
// ------------------------------------------------------------------
const pedidos = [];        // [{ id, items, total, estado, indiceEstado }]
const intervalos = {};     // pedidoId -> intervalId
let idMontado = null;      // dónde está montado el componente (o null)

// ------------------------------------------------------------------
// Web Component con Lit
// ------------------------------------------------------------------
class MfePedidos extends LitElement {
  static properties = {
    pedidos: { type: Array }
  };

  static styles = css`

    :host { display: block; }
    h2 { color: var(--color-primario, #0b4f8a); margin: 0 0 4px; }
    .version { font-size: 12px; color: #888; }
    .vacio { color: #777; }
    .lista { display: grid; gap: 12px; margin-top: 16px; }
    .pedido {
      background: #fff;
      border: 1px solid var(--color-borde, #dde3ea);
      border-radius: 6px;
      padding: 14px 16px;
    }
    .cabecera { display: flex; justify-content: space-between; align-items: baseline; }
    .id { font-weight: bold; }
    .total { font-weight: bold; }
    .items { font-size: 13px; color: #555; margin: 6px 0 10px; }
    .estado {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: bold;
      background: #eaf3fb;
      color: var(--color-primario, #0b4f8a);
    }
    .estado[data-estado="Recibido"]         { background: #eaf3fb; color: var(--color-primario, #0b4f8a); }
    .estado[data-estado="En preparación"]   { background: #fff3c4; color: #8a6b00; }
    .estado[data-estado="En camino"]        { background: #e6f0fb; color: #0b4f8a; }
    .estado[data-estado="Entregado"]        { background: #eaf6ea; color: var(--color-exito, #1b7a3e); }
    .progreso {
      display: flex;
      gap: 6px;
      margin-top: 10px;
      font-size: 11px;
      color: #888;
    }
    .progreso .paso { flex: 1; text-align: center; padding: 4px; border-radius: 4px; background: #f0f3f6; }
    .progreso .paso.hecho { background: var(--color-primario, #0b4f8a); color: #fff; }
  `;

  constructor() {
    super();
    this.pedidos = [];
  }

  render() {
    return html`
      <link rel="stylesheet" href="http://localhost:8081/tokens.css">
      <h2>Seguimiento de pedidos</h2>
      <span class="version">mfe-pedidos v${VERSION} · Lit desde CDN</span>

      ${this.pedidos.length === 0
        ? html`<p class="vacio">Aún no hay pedidos. Confirma uno desde el carrito.</p>`
        : html`
          <div class="lista">
            ${repeat(this.pedidos, p => p.id, p => this.renderPedido(p))}
          </div>
        `}
    `;
  }

  renderPedido(p) {
    return html`
      <article class="pedido">
        <div class="cabecera">
          <span class="id">Pedido #${p.id}</span>
          <span class="total">${pesos.format(p.total)}</span>
        </div>
        <div class="items">
          ${p.items.map(it => `${it.cantidad}× ${it.nombre}`).join(' · ')}
        </div>
        <span class="estado" data-estado="${p.estado}">${p.estado}</span>
        <div class="progreso">
          ${ESTADOS.map((e, i) => html`
            <div class="paso ${i <= p.indiceEstado ? 'hecho' : ''}">${e}</div>
          `)}
        </div>
      </article>
    `;
  }
}

if (!customElements.get('mfe-pedidos')) {
  customElements.define('mfe-pedidos', MfePedidos);
}

// ------------------------------------------------------------------
// Lógica de negocio: escuchar pedidos y avanzar estados
// ------------------------------------------------------------------
function crearPedido(detalle) {
  const p = {
    id: detalle.id,
    items: detalle.items,
    total: detalle.total,
    estado: ESTADOS[0],
    indiceEstado: 0
  };
  pedidos.push(p);

  // Notificar a la vista (si está montada)
  if (idMontado) refrescarVista();

  // Arrancar el avance automático de estados
  intervalos[p.id] = setInterval(() => avanzarEstado(p.id), INTERVALO_MS);
}

function avanzarEstado(pedidoId) {
  const p = pedidos.find(x => x.id === pedidoId);
  if (!p) return;

  p.indiceEstado += 1;
  p.estado = ESTADOS[p.indiceEstado];

  // Publicar el nuevo estado (lo escucha el contenedor para el toast)
  window.dispatchEvent(new CustomEvent('pedido:estado', {
    detail: {
      pedidoId: p.id,
      estado: p.estado,
      version: 1
    }
  }));

  if (idMontado) refrescarVista();

  // Detener el intervalo cuando el pedido ya está Entregado
  if (p.indiceEstado >= ESTADOS.length - 1) {
    clearInterval(intervalos[p.id]);
    delete intervalos[p.id];
  }
}

// El MFE escucha desde que se carga su script (por eso el contenedor lo precarga)
window.addEventListener('pedido:confirmado', function (e) {
  crearPedido(e.detail);
});

// ------------------------------------------------------------------
// Contrato de montaje / desmontaje
// ------------------------------------------------------------------
function refrescarVista() {
  const el = document.querySelector('mfe-pedidos');
  if (el) el.pedidos = [...pedidos]; // nueva referencia para que Lit re-renderice
}

window.renderPedidos = function (idContenedor) {
  const raiz = document.getElementById(idContenedor);
  const el = document.createElement('mfe-pedidos');
  el.pedidos = [...pedidos];   // pintar lo que ya había acumulado
  raiz.appendChild(el);
  idMontado = idContenedor;
};

window.unmountPedidos = function (idContenedor) {
  const raiz = document.getElementById(idContenedor);
  raiz.innerHTML = '';
  idMontado = null;
  // NO detenemos los intervalos: los pedidos siguen avanzando aunque el usuario
  // esté en otra ruta. Así cuando vuelva a #/pedidos, verá el estado actualizado.
};