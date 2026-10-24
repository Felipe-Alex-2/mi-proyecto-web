# PWA y operación offline de VESTA

## Uso

La web incorpora un manifiesto instalable, iconos VESTA, un Service Worker y
persistencia IndexedDB. Se trabaja en las pantallas habituales: el menú de
inventario se llama **Catálogo** y no existe un módulo separado para operar offline.
Los pendientes y conflictos se consultan desde **Mi perfil**; `/offline` redirige allí.

1. Iniciar sesión con conexión: comienza la descarga automática del catálogo.
2. **Mi perfil → Catálogo sin conexión** muestra la última descarga y permite
   **Actualizar catálogo ahora**. Se comprueba cada minuto si pasó una hora desde
   la última descarga completa. Solo se marca completada si todas las peticiones
   terminaron correctamente y la cuenta/tienda no cambió.
3. Esperar el indicador **Aplicación preparada sin conexión**. Se puede instalar
   desde el navegador compatible.
4. El cliente conserva acceso al catálogo descargado, búsquedas, filtros y páginas,
   y puede guardar reservas desde el detalle de una prenda del catálogo.
5. El personal registra los cobros en efectivo desde la **Terminal de Cobro de Pagos**,
   que admite tanto prendas como cobros manuales y reservas existentes. La terminal
   duplicada del centro offline fue retirada. Los pagos locales muestran **Pendiente
   de sincronizar**, sin emitir una factura como si ya estuvieran confirmados.
6. Al reconectar, las operaciones pendientes se sincronizan sin cambiar su UUID.
   La caja actualiza su historial y el stock. Los conflictos se consultan en el
   perfil. Los cobros de reserva no descuentan stock dos veces.

## Operación local desde las pantallas habituales

Las altas, ediciones y cambios de estado compatibles pasan por una cola persistente
con UUID incluso en línea, para poder reintentar una respuesta perdida sin duplicar.
Incluye proveedores, temporadas, promociones, categorías, tallas, colores, prendas
con variantes y stock inicial, personal, sucursales, asignación de personal, perfil,
movimientos y ajustes de stock. Las ventas en efectivo siguen en Pagos.
Los registros nuevos muestran **Pendiente de sincronizar** y aparecen en listados,
filtros, selectores y consultas de stock locales. Los conflictos se conservan para revisión.

La descarga inicial y horaria prepara catálogo y datos maestros, sucursales, stock,
personal (solo administradores), movimientos (roles autorizados), reservas e
información necesaria para Pagos. El administrador descarga todas las sucursales de
su empresa; encargados y cajeros conservan la restricción a su sucursal. No se
descargan datos de otras empresas. Se consultan bloques de 100 para prendas,
personal, movimientos, reservas y stock. La actualización se publica en una sola
transacción local al completar toda la descarga: un fallo no sustituye la copia
anterior ni elimina los pendientes. Se conserva como referencia la hora de inicio
de la descarga para no ocultar operaciones confirmadas durante ella.

Los identificadores locales permanecen estables en los comandos. El servidor
resuelve sus dependencias usando recibos de operaciones de la misma cuenta:
categoría/talla/color/sucursal → prenda/variante → movimiento/venta. Las referencias
todavía no confirmadas devuelven 424 y se conservan pendientes; las operaciones
independientes pueden continuar. El resultado y su recibo se confirman juntos.
Se vuelven a comprobar rol, pertenencia a empresa/sucursal, plan, departamento,
unicidad, precios y stock. Los ajustes físicos incluyen el stock conocido; si
cambió, quedan en conflicto para evitar sobrescribirlo silenciosamente.

Las contraseñas de altas/cambios de personal se cifran con AES-GCM en la cola, con
una clave no exportable en IndexedDB; no se incluyen en las vistas locales y se
retiran de la cola al confirmarse. El cifrado local no sustituye la seguridad del
dispositivo ni protege frente a scripts maliciosos del mismo origen. Las cuentas
creadas offline pueden iniciar sesión solo después de ser aceptadas por el servidor.

IndexedDB v3 incluye índices de cuenta y contexto. Mi perfil muestra uso/cuota
estimados del sitio y permite solicitar almacenamiento persistente. La cuota la
comparte el origen de la web y la PWA, aunque sus sesiones y bases estén separadas.
El navegador decide cuánto espacio concede y si permite persistencia; borrar datos
del sitio elimina las copias y los pendientes que no hayan llegado al servidor.
No se garantiza capacidad ilimitada ni una cantidad fija de registros. Fuentes:
[Storage API](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API) y
[almacenamiento PWA en Edge](https://learn.microsoft.com/en-us/microsoft-edge/progressive-web-apps/how-to/offline).

Las fotos remotas no se descargan automáticamente. PayPal, IA, backups y gestión
de suscripciones necesitan conexión. La actualización horaria necesita la app
abierta y conectada; al reabrir se vuelve a intentar. Un dispositivo cerrado no
ejecuta estas tareas. No se modificó la aplicación Flutter ni sus bases SQLite.

El catálogo completo autorizado se descarga por páginas de 100 prendas, junto
con sus detalles y precios; no hay un límite artificial de 50. Las respuestas ya
incluyen variantes y evitan hacer una consulta adicional por prenda. Para caja se
preparan las sucursales e inventarios autorizados. Las búsquedas nuevas y la
paginación del catálogo se resuelven sobre la copia completa sin conexión.

La actualización horaria requiere la PWA abierta y conexión. Si estuvo cerrada,
se comprueba al abrirla o recuperar el foco. PayPal necesita Internet. La descarga
del catálogo **no es un backup de la empresa**; los respaldos del backend tienen
su apartado independiente, descrito al final de este documento.

## Ejecutar la PWA en localhost

El backend conserva su configuración local y debe escuchar en el puerto 8000.
Desde la carpeta web:

```powershell
npm ci
npm run build:local
..\backend\.venv\Scripts\python.exe scripts/serve-pwa.py
```

Abrir **http://localhost:8080**. El puerto ya forma parte de los orígenes locales
permitidos del proyecto. `npm start` sigue siendo el servidor habitual de
Angular en 4200: permite desarrollar la interfaz y probar IndexedDB, pero el
Service Worker se registra en la compilación optimizada de la PWA.

Para Amplify se conserva `npm run build`, que usa el entorno de despliegue y
genera `dist/web/browser`. El script `pwa-precache.mjs` enumera los recursos
compilados, incluidos los módulos diferidos, y calcula la versión de la caché.
La PWA remota necesita HTTPS y la regla SPA de reescritura existente.
No se desplegó ni se modificó Railway o Amplify en esta entrega.

## Persistencia y aislamiento

- La web y la PWA instalada mantienen sesiones independientes, incluso en el
  mismo navegador y origen. La ventana instalada se detecta por `display-mode`
  o `navigator.standalone`; entrar en pantalla completa en una pestaña no cambia
  su sesión. No se escoge una sesión mediante parámetros de URL.
- La web conserva las claves existentes. La PWA usa el prefijo `vesta_pwa:` para
  tokens e identidad offline. Al actualizar, la PWA pide iniciar sesión de nuevo;
  la sesión compartida anterior queda únicamente en la web.
- IndexedDB `vesta-offline` para web y `vesta_pwa:vesta-offline` para PWA:
  almacenes `cache` y `operations` independientes, con bloqueos de sincronización
  separados. Las descargas y pendientes anteriores quedan en la web y no se
  borran ni se copian automáticamente a la PWA; descargar allí el catálogo otra vez.
- Cerrar sesión en una aplicación no cierra la otra. Los JWT nuevos incluyen un
  identificador único incluso para dos inicios de la misma cuenta en el mismo segundo.
- Ambas aplicaciones consultan el mismo backend: los datos comerciales autorizados
  siguen sincronizados según cuenta, empresa y permisos. Esto separa sesiones y
  almacenamiento local; no crea bases de negocio distintas ni una barrera entre
  scripts del mismo origen. Las pestañas web comparten la sesión web y las ventanas
  instaladas comparten la sesión PWA dentro del mismo perfil de navegador.
- Claves de copia por API, cuenta, empresa y contexto de sucursal del cliente;
  el personal guarda consultas autorizadas de cada sucursal bajo sus URLs.
- La cola conserva UUID, empresa, sucursal, usuario, cuerpo original, fecha local,
  estado, intentos, mensaje y resultado central.
- El usuario global puede cambiar de empresa: los comandos conservan su empresa
  y sucursal originales, y se vuelven a validar en el backend.
- Se limpia el estado visible al cambiar o cerrar sesión. Los pendientes de una
  cuenta no se envían con otra; se conservan para cuando vuelva su propietario.
- El Service Worker guarda únicamente los archivos de la aplicación. Las
  respuestas autenticadas nunca se guardan como una caché HTTP compartida.
- Las credenciales de PayPal nunca se guardan en la cola. Las contraseñas de
  cambios de personal se conservan cifradas hasta confirmar la operación. La identidad
  mínima de sesión permite reabrir sin conexión; el servidor vuelve a validar
  credenciales, roles, suscripción y pertenencia antes de aceptar una operación.

## Sincronización y conflictos

Las escrituras comerciales soportadas obtienen primero un UUID persistente,
incluso en línea. Si se pierde la respuesta, se reenvía el mismo comando a
`POST /api/v1/sync/operations`, sin crear otra venta o reserva. El backend registra
la operación y su recibo en una sola transacción. Un UUID con otro contenido se
rechaza. Los comandos no permiten reproducir peticiones arbitrarias.

La cola se procesa por orden local de registro y se coordina entre pestañas con
Web Locks cuando está disponible. Hay reintentos al volver la red, recuperar el
foco y cada 10 segundos. Los errores de conexión, timeout y servidor conservan
el pendiente. Los rechazos de negocio quedan en conflicto y se pueden revisar y
volver a intentar con los mismos datos. Una sonda ligera permite recuperar el
indicador en línea aunque no queden pendientes. No se ejecuta una sincronización
cerrando completamente el navegador: continúa al abrirlo o mientras esté activo.

El endpoint de cobro offline acepta únicamente efectivo y personal autorizado.
Admite ventas con prendas, cobros manuales y cobros de reservas válidas. Verifica precios actuales (incluidas promociones y precio
por variante), sucursal y stock bajo bloqueo. Guarda el cobro, movimientos y
recibo juntos; cualquier fallo revierte todo. No reemplaza por cero un inventario
insuficiente. La reserva utiliza las mismas reglas y bloqueos existentes.

Entre dispositivos gana la operación que el servidor consigue confirmar primero,
no una fecha manipulable del celular o PC. Una venta local puede quedar en
conflicto si otro dispositivo consumió las últimas unidades. No se inventa stock
ni se confirma un pago electrónico offline. Los conflictos se conservan para
revisión; no se cambian automáticamente los precios ya acordados con el cliente.

## PayPal de suscripción

El clic abre una pestaña inmediatamente para evitar el bloqueo de ventanas
emergentes. La pestaña original permanece en Mi plan. El retorno usa el origen
real de la web, validado contra la lista de orígenes permitidos del backend.
Esto admite tanto localhost:4200 como la PWA en localhost:8080.

PayPal vuelve primero a VESTA para capturar y comprobar el pago de USD 25. Solo
cuando se confirma se activa Profesional, se avisa a la pestaña original y la
pestaña de pago se redirige al inicio de PayPal Sandbox. Un error o cancelación
no activa el plan. La revisión `f5b61021f003` añade el origen a los registros de
checkout; también lo hace la inicialización idempotente local.

## Verificación

- Pruebas de IndexedDB: persistencia entre instancias, separación de cuentas y
  tiendas, respuesta perdida, conflicto de stock y exclusión de PayPal offline.
- Pruebas de sincronización: contexto original, conservación del UUID y
  recuperación de conectividad sin operaciones pendientes.
- Pruebas backend: venta atómica, reintento sin duplicar, stock insuficiente,
  precio cambiado, tenant ajeno, rollback antes del recibo y retorno PayPal seguro.
- Prueba de navegador con ambos servidores apagados: la PWA volvió a abrir y
  conservó el catálogo. Una venta ficticia persistió al recargar y se confirmó
  automáticamente al restablecer un backend con una **copia aislada** de SQLite.
  Generó un pago, un movimiento y un recibo. La base real de desarrollo no recibió
  esa venta. Evidencias en `../output/design/web-offline-pwa.jpg` y
  `../output/design/web-pwa-sincronizada.jpg`.
- La aprobación y el pago completo con una cuenta compradora PayPal Sandbox
  siguen disponibles para una prueba manual. No se realizó un cobro real.
- Los bloqueos concurrentes PostgreSQL deben validarse también al desplegar en
  ese motor; las pruebas locales usan SQLite.


## Backup de empresa: separado del catálogo offline

**Administración → Backup**, disponible para administradores, permite crear y
descargar respaldos del backend. El administrador SaaS también puede escoger la
empresa; un administrador ordinario queda limitado a la suya.

- Generación automática: una copia por día calendario de Bolivia, comprobada por
  el backend cada minuto. Sigue funcionando con la web cerrada mientras el servidor
  permanezca activo. Si se apagó, crea el respaldo del día al arrancar nuevamente.
- Creación manual y descarga desde la misma pantalla; historial de copias
  automáticas y manuales con fecha, empresa, tamaño, registros y SHA-256.
- Contiene tablas comerciales de la empresa: sucursales, prendas, atributos,
  stock, movimientos, ventas, reservas, carritos, bitácora, personal y datos básicos
  de sus clientes asociados, plan y suscripción. La selección actual de otra tienda
  de un cliente global no se exporta.
- Excluye hashes de contraseña, tokens de sesión/restablecimiento, claves de
  servicios y datos comerciales de otras empresas. No es un volcado global de
  PostgreSQL ni sustituye un respaldo físico de infraestructura.
- Descarga directa de JSON sin comprimir (`.json`), con importes decimales exactos.
  Crear una copia también inicia su descarga. El archivo privado del servidor se
  conserva comprimido; la descarga comprueba su integridad antes de entregar el JSON.
  Las copias nuevas muestran el SHA-256 del JSON descargado.
- Recuperación desde Backup: arrastrar o seleccionar un archivo de hasta 32 MB
  (`.json` o una copia anterior `.json.gz`). El servidor comprueba formato, empresa,
  campos, dependencias y duplicados y muestra un resumen por tabla con ejemplos.
  El análisis no escribe datos. Solo el botón **Recuperar datos faltantes** confirma
  la carga; la revisión firmada vence después de 15 minutos y está vinculada al
  archivo, administrador y empresa. Si cambia el archivo o la situación de los
  datos, se exige volver a analizar.
- La recuperación inserta únicamente faltantes, en orden de dependencias y en una
  transacción. Identifica coincidencias por ID y claves únicas de negocio (por
  ejemplo, nombre de prenda, categoría, SKU, variante y stock por sucursal) y enlaza
  las relaciones con los registros existentes. No sobrescribe precios ni stock
  actual ni suma nuevamente existencias o reproduce movimientos/pagos. Un error de
  escritura revierte la carga completa. Las prendas desactivadas cuentan como
  existentes y no se reactivan automáticamente.
- Cuentas, relaciones de clientes y configuración de empresa/plan/suscripción se
  muestran como información y no se importan: el archivo no contiene contraseñas
  para recrear cuentas ni puede conceder roles, suscripciones o acceso a otra empresa.
  Las relaciones ausentes o incompatibles se omiten con explicación; también se
  verifican el límite de sucursales del plan y el departamento actual.
- No se eliminan copias antiguas automáticamente.

Variables del backend (sin modificar credenciales existentes):

```dotenv
BACKUPS_ENABLED=true
BACKUP_DIR=private_backups
```

La ruta relativa se resuelve dentro de la carpeta backend y está ignorada por
Git. **En Railway debe montarse almacenamiento persistente**, por ejemplo en
`/data`, y usar `BACKUP_DIR=/data/backups`. Sin volumen los archivos locales del
contenedor no sobreviven a una recreación del servicio. Una copia descargada se
puede conservar fuera del servidor. No se cambió el despliegue remoto.

API protegida: `GET /api/v1/backups`, `POST /api/v1/backups` y
`GET /api/v1/backups/{id}/download`; `tenant_id` solo permite seleccionar otra
empresa cuando la cuenta tiene la capacidad de administrador SaaS. Las pruebas
verifican aislamiento, ausencia de credenciales, integridad, deduplicación diaria,
cliente global y pago de reserva sin descontar inventario por segunda vez.

## Punto 7: sincronización y conflictos en web y PWA

- La cola persistente se procesa al recuperar conexión, al enfocar la aplicación
  y cada 10 segundos mientras está abierta. Una caída, timeout o error temporal
  conserva la operación pendiente para volver a enviarla con el mismo UUID.
- El backend guarda el resultado y su comprobante idempotente en la misma
  transacción que la reserva, venta y movimientos. Reenviar el mismo comando
  devuelve el resultado guardado; reutilizar su UUID con otros datos después de
  confirmarlo se rechaza. Los bloqueos y las actualizaciones condicionales de
  stock impiden que dos reservas consuman la última unidad.
- Los rechazos por existencias devuelven `STOCK_INSUFFICIENT`, nombre de prenda,
  variante y cantidades disponible/solicitada. No dejan reservas, pagos ni
  descuentos parciales. Se guardan como conflicto y no se reintentan solos;
  las operaciones independientes de la cola pueden continuar.
- En **Mi perfil → Cambios pendientes y resultados**, se muestra el motivo y
  se permite reintentar tras revisar o corregir cantidades de reservas y ventas
  directas de contado rechazadas por stock. Se pueden reducir cantidades o quitar
  líneas con 0, conservando al menos una. El total de venta se recalcula y vuelve
  a validarse en el backend. Se conserva el UUID para impedir un segundo cobro si
  otra ventana ya confirmó el original. Operaciones con resultado incierto no
  se editan: primero se reenvían para consultar su confirmación idempotente.
- Guardar una operación offline no garantiza existencias ni confirma un cobro.
  PayPal requiere conexión; no se cobra desde el almacenamiento local.
