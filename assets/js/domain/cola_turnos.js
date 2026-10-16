// ══════════════════════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Cola de turnos (dominio puro)
// ──────────────────────────────────────────────────────────────────────────────
// Cada tarea corre SOLA y en el orden en que llegó; si una falla, la siguiente
// igual corre. La usa la Configuración del Informe de Brigada (`99 §163.15`):
// el guardado del Ingeniero, el de cada firma y el de cada logo entran aquí, y
// una imagen recién subida se enlaza recién cuando le toca su turno. Antes, dos
// imágenes que terminaban de subir durante un mismo guardado chocaban y la
// segunda se perdía en silencio.
// En un archivo PROPIO a propósito (L-102).
// ══════════════════════════════════════════════════════════════════════════════

/**
 * @returns {{ enTurno: <T>(tarea: () => T | Promise<T>) => Promise<T>, readonly ocupada: boolean, readonly pendientes: number }}
 */
export function crearColaDeTurnos() {
  let ultima = Promise.resolve();
  let pendientes = 0;
  return {
    /** Corre `tarea` cuando terminen todas las anteriores; devuelve lo que ella devuelva (o su error). */
    enTurno(tarea) {
      pendientes++;
      const turno = ultima.then(() => tarea());
      const fin = () => { pendientes--; };
      ultima = turno.then(fin, fin);
      return turno;
    },
    get ocupada() { return pendientes > 0; },
    get pendientes() { return pendientes; }
  };
}
