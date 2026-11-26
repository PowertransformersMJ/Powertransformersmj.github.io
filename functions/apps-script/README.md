# El script de Google que envía los avisos de cumplimiento (99 §236)

SGM deja en cola los correos de aviso (10, 15 y 20 días desde la ejecución de las ODT). Este script, que vive en la
**cuenta remitente** (la cuenta de Gmail dedicada a SGM), los envía desde esa cuenta cada 10 minutos. No hay que
copiar claves ni contraseñas: el script se identifica solo y usted lo aprueba una vez en SGM.

## Antes de empezar

En SGM, pestaña **Indicadores → «Avisos de cumplimiento por correo»**, guarde la configuración con el **correo
remitente** igual a la cuenta donde va a instalar el script.

## Instalarlo (una sola vez, unos 10 minutos)

1. Abra **script.google.com** con la **cuenta remitente** (no con su cuenta personal).
2. Pulse **Nuevo proyecto**. Póngale de nombre «SGM avisos de cumplimiento».
3. En el engranaje **Configuración del proyecto**, marque **«Mostrar el archivo de manifiesto appsscript.json en el
   editor»**.
4. Vuelva al **Editor**:
   - Abra `appsscript.json`, borre lo que trae y pegue el contenido de `appsscript.json` de esta carpeta.
   - Abra `Código.gs`, borre lo que trae y pegue el contenido de `avisos-cumplimiento.gs` de esta carpeta.
   - Pulse **Guardar** (el icono del disquete).
5. Arriba, en la lista de funciones, elija **`instalar`** y pulse **Ejecutar**.
6. Google pide permiso: **Revisar permisos** → elija la cuenta remitente → si dice «Google no verificó esta app»,
   pulse **Configuración avanzada** → **Ir a SGM avisos de cumplimiento** → **Permitir**. (Es su propio script:
   envía correos desde esa cuenta, crea su disparador cada 10 minutos y habla solo con la plataforma de SGM.)
7. En el **Registro de ejecución** debe salir «Listo: … se creó uno que corre enviarPendientes cada 10 minutos»,
   «La plataforma respondió 403: Este script todavía no está aprobado en SGM…» y «Identificador de este script: …».
   Eso es lo esperado. Deje esa ventana abierta: el identificador sirve en el paso siguiente.

## Aprobarlo en SGM

8. En SGM, **Indicadores → «Avisos de cumplimiento por correo»**: aparece **«Hay un script de Google pidiendo permiso
   para enviar los avisos»** con «Su identificador: …». **Compruebe que es el mismo** que salió en el registro de
   ejecución del paso 7 (basta comparar los primeros números y las últimas letras antes de «.apps…»). Si no coincide,
   no lo apruebe: ejecute otra vez `probarConexion` y pulse «Volver a consultar» en SGM. Si coincide, pulse
   **«Aprobar este script»** y luego **«Sí, aprobar»**.
9. Vuelva a script.google.com, elija **`probarConexion`** y pulse **Ejecutar**: debe decir «La plataforma respondió
   200: Conexión aprobada…».

Listo. Desde ahí, cada 10 minutos el script envía lo que haya en cola. En SGM, en la misma sección, se ve la última
conexión del script y su último resultado; en el historial de correos de cada corte, el estado de cada correo.

## Si algo falla

- **El correo de un corte quedó «No se pudo enviar»**: lea el motivo en el historial; corríjalo (por ejemplo, una
  dirección mal escrita en la configuración) y pulse **«Revisar y enviar los avisos de este corte»**: vuelve a la cola
  sin repetir lo que ya salió.
- **Se instaló el script otra vez (o en otro proyecto)**: SGM lo trata como un script nuevo y pide aprobarlo de nuevo.
- **Pausar los envíos**: en SGM, desmarque «Avisos activos» y guarde. Mientras estén desactivados no sale nada y lo
  que estaba en cola espera; si en ese tiempo se guarda un corte más reciente, lo que dejaron los cortes anteriores ya
  no sale (sus ODT pudieron cerrarse). Al reactivarlos solo sale lo del corte más reciente; los avisos de un corte
  guardado con los avisos desactivados salen con el siguiente corte, o con **«Revisar y enviar los avisos de este
  corte»**. Para quitar el script del todo, en script.google.com → **Activadores** (el reloj) → borre el de
  `enviarPendientes`.
- **Un correo dice «El script de Google lo tomó y no confirmó el envío»**: el script se cortó o dejó de correr. En
  script.google.com → **Ejecuciones**, mire si hay errores, y en **Activadores**, que siga el de `enviarPendientes`.
- Google permite unos 100 destinatarios por día en una cuenta de Gmail: si se acaba, el script espera al día siguiente.
