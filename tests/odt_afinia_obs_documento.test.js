// Firma de ODT Afinia · «POR SUBSANAR» · ¿qué DOCUMENTO toca cada punto? (dominio puro, para el Excel del 2026-11-24)
// Cada categoría (control previo, registro fotográfico, ODT, varios a la vez, aclaración del AZT, sistema / decisión del
// Responsable, aviso y «Otro»), lo que FALTA o está MAL (también pide corregir), el pronombre que remite a la frase
// anterior, las referencias que NO cuentan («según la ODT…», «es la misma foto de…», «porque en la ODT dice…») y que, ante
// la duda, sale «Otro». Textos INVENTADOS, redactados para estas pruebas (repo público: ni personas, ni lugares, ni N.º,
// ni textos de puntos reales). La única frase tomada de afuera es el ejemplo que trae el pedido del Ingeniero.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  clasificarPunto, documentosDe, documentosDelPrefijo, normalizar, DOCUMENTOS, ETIQUETA_DOCUMENTO, ETIQUETA_CATEGORIA, CATEGORIAS, SEPARADOR
} from '../assets/js/domain/odt_afinia_obs_documento.js';

const C = (texto, quien = 'contratista') => clasificarPunto({ texto, quien });
const etiqueta = (texto, quien) => C(texto, quien).etiqueta;

describe('constantes', () => {
  test('tres documentos en el orden de las columnas, y las etiquetas que pidió el Ingeniero', () => {
    assert.deepEqual([...DOCUMENTOS], ['control_previo', 'registro_fotografico', 'odt']);
    assert.deepEqual({ ...ETIQUETA_DOCUMENTO }, { control_previo: 'Control previo', registro_fotografico: 'Registro fotográfico', odt: 'ODT' });
    assert.deepEqual({ ...ETIQUETA_CATEGORIA }, {
      aclaracion: 'Aclaración del AZT', sistema: 'Sistema / decisión del Responsable', aviso: 'Aviso', otro: 'Otro'
    });
    assert.equal(SEPARADOR, ' + ');
    assert.equal(normalizar('  Registro FOTOGRÁFICO,   hoja 2 '), 'registro fotografico, hoja 2');
  });
});

describe('un documento', () => {
  test('control previo: con el documento al comienzo o como lo que se corrige', () => {
    for (const t of [
      'Control previo: el N.º de permiso trae 90000009 y corresponde 90000001.',
      'Control previo: anotar la hora de llegada al sitio (07:30) en lugar de 06:00.',
      'Control previo: ajustar la hora de diligenciamiento a las 08:10. Según la ODT 90000002, a las 06:00 el grupo seguía en la base.',
      'Cambiar el sitio de trabajo escrito en el control previo de la ODT 90000001: figura «S/E Ficticia Uno» y corresponde «S/E Ficticia Dos».',
      'Subir un control previo hecho para esta visita (permiso 90000001, 12/12/2099, 06:45). El anexado es copia exacta del permiso de la ODT 90000003.',
      'Control previo: reemplazar el archivo cargado, que trae el permiso de otra orden (90000004), por uno propio con el 90000001.'
    ]) {
      const r = C(t);
      assert.equal(r.categoria, CATEGORIAS.documento, t);
      assert.deepEqual(r.documentos, ['control_previo'], t);
      assert.equal(r.etiqueta, 'Control previo', t);
    }
  });
  test('registro fotográfico: «registro fotográfico», «foto(s)», «fotografía» y la placa que no se lee', () => {
    for (const t of [
      'Registro fotográfico, hoja 3: agregar una imagen nítida de la placa del reactor con serial 999001.',
      'Registro fotográfico: reemplazar la imagen 2 (centro) por otra tomada en esta visita. Es la misma foto que aparece primero en el registro de otra orden (90000005).',
      'Anexar otra vez el registro fotográfico quitando la hoja 1, que corresponde a la ODT 90000006.',
      'Enviar una fotografía cercana de la placa del interruptor ficticio IF-9; en la imagen actual no se distingue el número de serie.',
      'Registro fotográfico, página 3 (equipo XYZ-999): la placa sale borrosa. Mandar otra tomada más cerca.',
      'Ajustar el día impreso en las hojas del registro fotográfico (aparece 02-02-2099; la visita fue el 04/02/2099, según el control previo y la ODT).',
      'Subir a la plataforma el registro fotográfico que falta para esta orden. Debe mostrar legible la placa del equipo (serial 999002, según la ODT).',
      'Registro fotográfico: el N.º ODT del encabezado de ambas hojas es 90000007 y corresponde 90000001; cambiarlo.',
      'Registro fotográfico: hay una imagen oculta bajo otra, igual a las de las ODT 90000002 y 90000003. Rehacer el registro solo con imágenes propias.',
      'Placa borrosa: tomarla de nuevo, de cerca.'
    ]) {
      const r = C(t);
      assert.deepEqual(r.documentos, ['registro_fotografico'], t);
      assert.equal(r.etiqueta, 'Registro fotográfico', t);
    }
  });
  test('ODT: «ODT, …:», «en la ODT», «Generar de nuevo la ODT», «Cargar la ODT», «La ODT no tiene…» y sus campos propios', () => {
    for (const t of [
      'ODT, condiciones ambientales finales: dice SÍ pero no describe nada. Marcar la casilla correcta o anotar lo encontrado.',
      'ODT: le falta la firma de quien recibe la zona.',
      'Generar de nuevo la ODT: en «Entrega ZT» sale 02/02/2099.',
      'Cargar la ODT con la firma del jefe de trabajo.',
      'En la ODT, cambiar la hora real de inicio: aparece 05:00 y el AZT dirá la correcta.',
      'Ajustar la hora real fin: figura 18:00 y todo apunta a 10:00.',
      'Completar las condiciones ambientales iniciales.',
      'Corregir los datos de placa en la ODT.',
      'La ODT no tiene la firma del jefe de trabajo.'
    ]) {
      const r = C(t);
      assert.deepEqual(r.documentos, ['odt'], t);
      assert.equal(r.etiqueta, 'ODT', t);
    }
  });
});

describe('varios documentos a la vez («+»)', () => {
  test('el ejemplo del pedido: ODT, control previo y registro fotográfico → los tres, en el orden de las columnas', () => {
    const r = C('Corregir la fecha y las horas en la ODT … y en su control previo, y la fecha en el registro fotográfico.');
    assert.deepEqual(r.documentos, ['control_previo', 'registro_fotografico', 'odt']);
    assert.equal(r.etiqueta, 'Control previo + Registro fotográfico + ODT');
    assert.equal(etiqueta('Si el AZT confirma que fue otro día, ajustar el día y la hora en la ODT 90000001, en el control previo y en el registro fotográfico.'),
      'Control previo + Registro fotográfico + ODT', 'también cuando el cambio depende de lo que diga el AZT');
  });
  test('lo principal en la ODT y, si fue otro día, también los otros dos', () => {
    assert.equal(etiqueta('Lo principal: en la ODT, cambiar la hora real fin (dice 18:00; todo apunta a 10:00). Si la visita fue otro día, ajustar también el día en el registro fotográfico, en el control previo y en la ODT.'),
      'Control previo + Registro fotográfico + ODT');
  });
  test('dos documentos al comienzo, o uno al comienzo y otro como lo que se corrige', () => {
    assert.equal(etiqueta('Control previo y registro fotográfico: ajustar el día.'), 'Control previo + Registro fotográfico');
    assert.equal(etiqueta('Ajustar el día en el control previo y mandar una foto nítida de la placa.'), 'Control previo + Registro fotográfico');
    assert.equal(etiqueta('Registro fotográfico: reemplazar la imagen 4. Aparte, ajustar la hora en el control previo.'), 'Control previo + Registro fotográfico');
  });
});

describe('lo que FALTA o está MAL también pide corregir', () => {
  test('«falta…», «no tiene…», «no se lee…», «sin…», «ilegible», «equivocada», «tomar de nuevo», «deben ser…»', () => {
    for (const [t, esperado] of [
      ['Falta el control previo.', 'Control previo'],
      ['Falta el registro fotográfico', 'Registro fotográfico'],
      ['No se lee la placa en la foto.', 'Registro fotográfico'],
      ['El control previo no tiene la firma del jefe de trabajo.', 'Control previo'],
      ['Control previo sin firma del jefe de trabajo.', 'Control previo'],
      ['Sin registro fotográfico del después.', 'Registro fotográfico'],
      ['Registro fotográfico ilegible.', 'Registro fotográfico'],
      ['El control previo trae la hora equivocada (06:00 en vez de 08:00).', 'Control previo'],
      ['Volver a tomar la foto de la placa, de cerca.', 'Registro fotográfico'],
      ['Las fotos de la prueba son las mismas de otra ODT: deben ser propias.', 'Registro fotográfico']
    ]) assert.equal(etiqueta(t), esperado, t);
  });
  test('un pronombre («generarla») o «debe decir…» sin documento propio: el de la frase anterior', () => {
    assert.equal(etiqueta('La ODT imprime mal la fecha de «Recibe ZP»; generarla de nuevo.'), 'ODT');
    assert.equal(etiqueta('En la ODT, la hora real fin dice 18:00; debe decir 10:00.'), 'ODT');
    assert.equal(etiqueta('El control previo quedó sin la hora. Completarlo.'), 'Control previo');
    // Sin pronombre no se adivina a qué se refiere.
    assert.equal(etiqueta('La foto 2 es de otro día. Corregir la fecha.'), 'Otro');
  });
  test('la ODT como sujeto solo cuenta si es ESTA (con N.º es otra ODT)', () => {
    assert.equal(etiqueta('La ODT no tiene la firma del jefe de trabajo.'), 'ODT');
    assert.equal(etiqueta('La ODT 90000002 no tiene la firma.'), 'Otro');
  });
});

describe('las referencias a otro papel NO cuentan', () => {
  test('«según…», «para que coincida con…», «es la misma foto de…», «copia de…», «que está en…»', () => {
    assert.equal(etiqueta('Control previo: ajustar la hora para que coincida con la hora real de inicio de la ODT.'), 'Control previo');
    assert.equal(etiqueta('Registro fotográfico: reemplazar la imagen 2, que es la misma del control previo de la ODT 90000002.'), 'Registro fotográfico');
    assert.equal(etiqueta('Ajustar el día del registro fotográfico, según la ODT y el control previo.'), 'Registro fotográfico');
    assert.equal(etiqueta('Control previo: ajustar la hora; debe ser igual a la del registro fotográfico.'), 'Control previo');
    assert.equal(etiqueta('Control previo: ajustar el día, que debe ser el que figura en la ODT.'), 'Control previo');
    assert.equal(etiqueta('Control previo: reemplazar el anexo, que es copia del registro fotográfico de otra orden (90000003).'), 'Control previo');
  });
  test('«porque…», «en la ODT dice / figura…» y «sin cambiar…» son explicaciones, no lo que se corrige', () => {
    assert.equal(etiqueta('Control previo: corregir el día, porque en la ODT dice otro.'), 'Control previo');
    assert.equal(etiqueta('Corregir el día en el control previo: dice 28/02 y en la ODT figura 01/03.'), 'Control previo');
    assert.equal(etiqueta('Corregir la hora del control previo, porque el registro fotográfico muestra otra.'), 'Control previo');
    assert.equal(etiqueta('Corregir la hora del control previo, sin cambiar la ODT.'), 'Control previo');
  });
  test('un campo de la ODT en un punto que empieza por otro documento no la suma', () => {
    // El campo va en la MISMA frase que el verbo: sin la regla, saldría «Control previo + ODT».
    assert.equal(etiqueta('Control previo: ajustar la hora real de inicio anotada (13:00).'), 'Control previo');
    assert.equal(etiqueta('Registro fotográfico, hoja 1: cambiar el rótulo «hora real fin».'), 'Registro fotográfico');
    // Sin otro documento al comienzo, el mismo campo sí la señala.
    assert.equal(etiqueta('Ajustar la hora real de inicio anotada (13:00).'), 'ODT');
  });
  test('«N.º ODT», «de esta ODT» y «la ODT dice» son referencias: solo la ODT que se corrige cuenta', () => {
    assert.equal(etiqueta('Registro fotográfico: el N.º ODT del encabezado está mal; cambiarlo.'), 'Registro fotográfico');
    assert.equal(etiqueta('Control previo: poner la hora en que arrancó esta ODT.'), 'Control previo');
  });
});

describe('aclaración del AZT, sistema / decisión del Responsable y aviso', () => {
  test('AZT que pide aclarar o confirmar, sin pedir corregir un documento → «Aclaración del AZT» (aunque nombre la foto o la ODT)', () => {
    for (const t of [
      'Aclarar en qué subestación estaban usted y su grupo el 03/03/2099 entre 08:00 y 10:00: las ODT 90000001 y 90000002 los ubican en la S/E Ficticia Uno y la 90000003 en la S/E Ficticia Dos.',
      'Confirmar si en esta visita también se probó el equipo de serial 999003 (página 2 del registro).',
      'El reloj del medidor que se ve en la imagen 1 del registro fotográfico marca otro mes que la ODT (06/06/2099). Aclarar cuándo se hicieron las fotos y la prueba.',
      'Confirmar la capacidad del equipo: en la placa de la foto se alcanza a leer 75 kVA y la base de datos dice 0.1 MVA.',
      'Indicar qué transformador se intervino.'
    ]) {
      const r = C(t, 'azt');
      assert.equal(r.categoria, CATEGORIAS.aclaracion, t);
      assert.deepEqual(r.documentos, [], 'una aclaración no marca documentos');
      assert.equal(r.etiqueta, 'Aclaración del AZT');
    }
  });
  test('casos de producción (2026-11-24): «Reemitir el control previo…», «Cargar en Afinia la ODT…», AZT «Confirmar… para completarla en el sistema»', () => {
    assert.equal(etiqueta('Reemitir el control previo con el N.º de PT/OT 90000009: hoy dice 90000008, que es de otra S/E.'), 'Control previo');
    assert.equal(etiqueta('Reemitir el control previo con fecha 02/02/2099: hoy dice 01/02/2099.'), 'Control previo');
    assert.equal(etiqueta('Cargar en Afinia la ODT corregida, firmada solo por el jefe de trabajo.'), 'ODT');
    assert.equal(etiqueta('Confirmar el nombre de la Persona 1 (¿Nombre Ficticio?) para completarla en el sistema.', 'azt'), 'Aclaración del AZT');
    // Un contratista que «confirma» sin documento sigue en «Otro» (la regla nueva es solo para el AZT).
    assert.equal(etiqueta('Confirmar el nombre de la Persona 1 para completarla en el sistema.', 'contratista'), 'Otro');
  });
  test('AZT que SÍ pide corregir un documento → ese documento; un contratista que «aclara» no es aclaración del AZT', () => {
    assert.equal(etiqueta('Confirmar la hora y corregir el control previo si hace falta.', 'azt'), 'Control previo');
    assert.equal(etiqueta('Aclarar por qué la cuadrilla llegó tarde.', 'contratista'), 'Otro');
  });
  test('Responsable: «… en el sistema…», «Decidir…», «Definir…», «Aceptar…» → «Sistema / decisión del Responsable»', () => {
    for (const t of [
      'Cuando el AZT confirme el horario, ajustar en el sistema las horas reales de la ODT 90000001 para que queden iguales a las de la ODT ya corregida.',
      'Definir si la hora real fin se deja en 18:00 o se pasa a 10:00 en el sistema.',
      'Decidir si vale un control previo idéntico al de la ODT 90000002.',
      'Aceptar o no el control previo repetido.'
    ]) {
      const r = C(t, 'responsable');
      assert.equal(r.categoria, CATEGORIAS.sistema, t);
      assert.deepEqual(r.documentos, []);
      assert.equal(r.etiqueta, 'Sistema / decisión del Responsable');
    }
    // El mismo texto, de un contratista, no es «sistema».
    assert.notEqual(C('Decidir si vale el control previo.', 'contratista').categoria, CATEGORIAS.sistema);
  });
  test('«Aviso:» al comienzo → «Aviso», le toque a quien le toque', () => {
    for (const quien of ['azt', 'contratista', 'responsable']) {
      const r = C('Aviso: punto informativo de prueba, sin nada que corregir en el control previo.', quien);
      assert.equal(r.categoria, CATEGORIAS.aviso);
      assert.deepEqual(r.documentos, []);
      assert.equal(r.etiqueta, 'Aviso');
    }
    assert.equal(etiqueta('Un aviso: corregir el control previo.'), 'Control previo', 'solo cuenta si EMPIEZA por «Aviso:»');
  });
});

describe('conservadora: ante la duda, «Otro» (nunca inventa)', () => {
  test('frases que solo describen, sin pedir un cambio, y textos que no nombran un documento', () => {
    for (const [t, quien] of [
      ['La ODT dice 10/10/2099 y el control previo 11/10/2099.', 'contratista'],
      ['Publicar de nuevo cuando todo esté aclarado.', 'responsable'],
      ['Revisar con la cuadrilla lo que pasó ese día.', 'contratista'],
      ['Cambiar el número de permiso: hoy trae 90000009 y corresponde 90000001.', 'contratista'],
      ['Al tomar la muestra se usó otro frasco.', 'azt'],
      ['No se pudo verificar el serial.', 'contratista'],
      ['Sin novedad.', 'contratista'],
      ['', 'contratista'],
      ['   ', 'azt']
    ]) {
      const r = C(t, quien);
      assert.equal(r.categoria, CATEGORIAS.otro, JSON.stringify(t));
      assert.deepEqual(r.documentos, []);
      assert.equal(r.etiqueta, 'Otro');
    }
    assert.equal(clasificarPunto().etiqueta, 'Otro', 'sin datos');
    assert.equal(clasificarPunto({ texto: 42, quien: 'azt' }).etiqueta, 'Otro', 'un texto que no es texto');
  });
  test('piezas sueltas: el prefijo y los documentos', () => {
    assert.deepEqual(documentosDelPrefijo(normalizar('Registro fotográfico, hoja 3 (equipo XYZ): anexar')), ['registro_fotografico']);
    assert.deepEqual(documentosDelPrefijo(normalizar('ODT 90000001: corregir el control previo')), [], '«ODT <N.º>:» es una referencia, no el documento');
    assert.deepEqual(documentosDelPrefijo(normalizar('Corregir el control previo: la hora')), []);
    assert.deepEqual(documentosDe('ODT 90000001: corregir el control previo.'), ['control_previo']);
    assert.deepEqual(documentosDe('Es la misma foto de la ODT 90000002.'), [], 'sin pedir un cambio no hay documento (salvo el del comienzo)');
  });
});
