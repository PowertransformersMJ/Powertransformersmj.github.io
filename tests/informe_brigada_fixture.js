// Datos INVENTADOS para las pruebas del Informe de Mantenimiento Brigada (F60-ADM).
// Ningún dato de cliente: matrícula, serie, contrato, consignación, ODT, personas y
// fabricante son de mentira. No es un archivo de prueba (no termina en .test.js):
// lo importan las pruebas para compartir el mismo informe de ejemplo.
import {
  prellenar, cambiarCampo, confirmarPotencia, registrarArchivo, ponerFoto, asignarFirmante
} from '../assets/js/domain/informe_brigada_modelo.js';
import { SECCIONES_FIGURAS, MARCA_CLAVES } from '../assets/js/domain/informe_brigada_plantilla.js';

export const PERSONAS = Object.freeze({
  ingeniero: 'Ingeniero Prueba Uno',
  tecnicos: Object.freeze(['Técnico Prueba Dos', 'Técnico Prueba Tres'])
});

/** Huella de mentira (64 hex) para metadatos de archivo. */
export const huellaFalsa = (n) => String(n).padStart(4, '0').repeat(16);

/** Documento v2 de /transformadores, inventado. */
export function txPrueba() {
  return {
    id: 'tx-prueba-001',
    identificacion: { codigo: 'COD-SUBESTACION-PRUEBA', matricula: 'T9-Z/Z-PRU', numero_serie: 'SERIE-PRUEBA-001' },
    placa: { marca: '', serial: 'SERIAL-PLACA-NO-USAR', potencia_kva: 14000 },
    ubicacion: { subestacion_nombre: 'PRUEBA NORTE', zona: 'OCCIDENTE', departamento: 'cordoba', municipio: 'MUNICIPIO PRUEBA' },
    electrico: { tension_primaria_kv: 34.5, tension_secundaria_kv: 13.8, grupo_conexion: '' },
    fabricacion: { ano_fabricacion: 2019 },
    salud_actual: { hi_final: 2.2, condicion_fuente: 'excel' }
  };
}

/** Acción de refrigeración inventada (solo se lee). */
export function accionPrueba() {
  return {
    id: 'accion-prueba-1',
    fecha_accion: '2026-03-10',
    estado_accion: 'planificada',
    kva_onan: 10000,
    kva_onaf: 14000,
    mix: [{ key: 'k1', marca: 'MARCA-PRUEBA', modelo: 'VX-100', cfm_unitario: 7000, cantidad: 4, ubicacion: { lado: 'A', cuerpo: 1, posicion: 1 } }]
  };
}

/** Metadatos de una imagen de marca inventada. */
const metaMarca = (k, i) => ({ almacen: 'storage', ruta: 'informes_brigada_marca/logos/' + k + '/' + huellaFalsa(i), huella: huellaFalsa(i), mime: 'image/png', ancho: 300, alto: 120 });

/** Configuración inventada: editores por uid, contrato por defecto y los 5 logos. */
export function configPrueba({ conLogos = true } = {}) {
  const marca = {};
  MARCA_CLAVES.forEach((k, i) => { marca[k] = conLogos ? metaMarca(k, 100 + i) : null; });
  return {
    editores: ['uid-editor-1'],
    contrato_defecto: '9900000001',
    almacen: 'storage',
    firmantes: [
      { clave: 'f-firmante-prueba', nombre: 'FIRMANTE PRUEBA', cargo: 'Cargo de prueba',
        firma: { almacen: 'storage', ruta: 'informes_brigada_marca/firmas/f-firmante-prueba/' + huellaFalsa(7), huella: huellaFalsa(7), mime: 'image/png', ancho: 500, alto: 200, autorizacion: { fecha: '2026-01-15', medio: 'correo de prueba' } } }
    ],
    marca
  };
}

/** Un informe COMPLETO (sin faltantes que bloqueen), armado con la API del dominio. */
export function contenidoCompletoEjemplo() {
  let c = prellenar({ equipo: txPrueba(), config: configPrueba(), accion: accionPrueba() });
  const poner = (ruta, v) => { c = cambiarCampo(c, ruta, v); };
  poner('equipo.fabricante', 'FABRICANTE PRUEBA');
  poner('equipo.grupo_conexion', 'Dyn1');
  c = confirmarPotencia(c, true);
  poner('trabajo.fecha_inicio', '2026-03-20');
  poner('trabajo.fecha_fin', '2026-03-21');
  poner('personal.ingeniero', PERSONAS.ingeniero);
  poner('personal.tecnicos', PERSONAS.tecnicos.slice());
  poner('consignacion.numero', '000111');
  poner('odt', ['ODT-PRUEBA-1', 'ODT-PRUEBA-2']);
  poner('ventiladores.actual', [{ modelo: 'VA-50', cantidad: 3, cfm_unitario: 5000 }]);
  c.tablas.material.forEach((f, i) => { if (f.cantidad == null) poner('tablas.material.' + i + '.cantidad', 2 + i); });
  c.corrientes.filas.forEach((f, i) => {
    poner('corrientes.filas.' + i + '.r', 2.03 - i * 0.01);
    poner('corrientes.filas.' + i + '.s', 1.9);
    poner('corrientes.filas.' + i + '.t', 1.91);
  });
  poner('corrientes.nominal.r', 2.7); poner('corrientes.nominal.s', 2.7); poner('corrientes.nominal.t', 2.7);
  // Una foto inventada en cada hueco
  let n = 0;
  SECCIONES_FIGURAS.forEach((s) => c.figuras[s].forEach((g, gi) => g.figuras.forEach((f, fi) => f.fotos.forEach((ft, k) => {
    n += 1;
    const id = 'aFoto' + String(n).padStart(16, '0');
    const vertical = g.disposicion !== '1x1';
    c = registrarArchivo(c, id, { almacen: 'storage', ruta: 'informes_brigada/inf-prueba/archivos/' + id, mime: 'image/jpeg', ancho: vertical ? 600 : 1200, alto: vertical ? 800 : 870, tamano: 140000, huella: huellaFalsa(n), subidoPor: { uid: 'uid-editor-1', nombre: 'Editor Prueba' }, en: '2026-03-22T15:00:00.000Z' });
    c = ponerFoto(c, { seccion: s, g: gi, f: fi, k }, id);
  }))));
  // Óvalo de prueba en una foto del montaje
  poner('figuras.montaje.0.figuras.1.fotos.0.marcas', [{ x: 0.25, y: 0.3, w: 0.5, h: 0.4 }]);
  // Anexos: consignación (archivo propio) y fichas de la biblioteca
  const idc = 'aConsignacion0000000';
  c = registrarArchivo(c, idc, { almacen: 'storage', ruta: 'informes_brigada/inf-prueba/archivos/' + idc, mime: 'image/png', ancho: 1178, alto: 893, tamano: 300000, huella: huellaFalsa(900), subidoPor: { uid: 'uid-editor-1', nombre: 'Editor Prueba' }, en: '2026-03-22T15:00:00.000Z' });
  poner('anexos.0.archivo', idc);
  poner('anexos.1.ficha', { id: 'ficha_prueba_va-50_00000001', titulo: 'Ficha VA-50 de prueba', almacen: 'storage', ruta: 'informes_brigada_marca/fichas/ficha_prueba_va-50_00000001', mime: 'image/png', ancho: 1150, alto: 1538, huella: huellaFalsa(901) });
  poner('anexos.2.ficha', { id: 'ficha_prueba_vx-100_00000002', titulo: 'Ficha VX-100 de prueba', almacen: 'storage', ruta: 'informes_brigada_marca/fichas/ficha_prueba_vx-100_00000002', mime: 'image/jpeg', ancho: 828, alto: 1302, huella: huellaFalsa(902) });
  c = asignarFirmante(c, 'elaborado', { clave: 'f-firmante-prueba', nombre: 'Firmante Prueba' });
  poner('firmas.revisado.nombre', 'REVISOR PRUEBA');
  poner('firmas.aprobado.nombre', 'APROBADOR PRUEBA');
  return c;
}

/** Versión emitida inventada (lo que guardaría `versiones/1`), con la firma del «elaborado». */
export function versionEmitidaEjemplo(contenido, { en = '2026-03-23T02:30:00.000Z' } = {}) {
  const cfg = configPrueba();
  const f = cfg.firmantes[0];
  return {
    version: 1,
    contenido,
    huella: huellaFalsa(999),
    motivo: '',
    firmas: [{ rol: 'elaborado', clave: f.clave, nombre: f.nombre, firma: { almacen: f.firma.almacen, ruta: f.firma.ruta, huella: f.firma.huella, mime: f.firma.mime, ancho: f.firma.ancho, alto: f.firma.alto } }],
    marca: { ...cfg.marca },
    emitidoPor: { uid: 'uid-editor-1', nombre: 'Editor Prueba' },
    en
  };
}
