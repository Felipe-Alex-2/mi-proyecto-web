# Tienda web de VESTA

El cliente y el visitante usan un layout de tienda independiente del panel del personal. El administrador SaaS, administrador, encargado y cajero conservan sus menús y destinos habituales.

La entrada web abre la tienda pública. Los enlaces desconocidos y los enlaces al panel sin sesión vuelven a `/home`. Cerrar sesión también devuelve a la tienda. Una sesión guardada vencida no fuerza el login al restaurar la página: se continúa como visitante. Iniciar sesión es necesario al usar funciones personales; una cuenta de cliente permanece en la tienda y una cuenta del personal entra en su panel. El inicio de la aplicación móvil permanece sin cambios y sigue requiriendo acceso.

## Navegación

- `/home`: portada pública y prendas destacadas.
- `/catalog`: catálogo público, filtros, paginación y detalle enlazable con `?product=ID`.
- `/cart`: carrito de la cuenta, cantidades y creación de reserva.
- `/my-reservations`: reservas de todas las tiendas, cancelación permitida, pago y comprobante de reserva.
- `/favorites`: favoritos de la cuenta en la empresa seleccionada.
- `/for-you`: recomendaciones del asistente Carlitos.
- `/fitting`: medidas, recomendación de talla, foto/cámara y generación IDM-VTON.
- `/notifications`: avisos y marcas de lectura.
- `/account`: perfil, avatar/foto y opciones sin conexión existentes.
- `/purchases`: historial de compras en caja y descarga de comprobantes PDF.

Solo la portada, el catálogo y sus filtros/detalles admiten visitantes. Agregar al carrito o guardar favoritos abre la solicitud de acceso. Las rutas personales también están protegidas frente a accesos directos. `returnUrl` conserva el destino después de iniciar sesión o registrarse y se limita a rutas de la tienda. El personal regresa al panel correspondiente a su rol.

## Empresa, sucursal y datos compartidos

El visitante puede elegir empresa y sucursal sin iniciar sesión. La selección se recuerda en la pestaña y se valida contra el directorio. Al iniciar sesión desde una acción de la tienda, se adopta esa selección para continuar en el mismo catálogo. La cuenta usa las API de carrito, reservas, perfil, medidas, notificaciones e historial que ya usa el móvil.

El catálogo anónimo usa `/api/v1/shop/catalog`, que exige una empresa activa y una sucursal activa que le pertenezca. Todas sus consultas aplican el aislamiento del ORM. El catálogo autenticado conserva `/api/v1/catalog` y su integración con los datos sin conexión existentes. Los encabezados `X-Vesta-Tenant`/`X-Vesta-Branch` y sus equivalentes en español fijan el contexto comercial del dispositivo; el servidor verifica la relación entre empresa y sucursal.

Las reservas en efectivo o con intención de pago PayPal se crean por el mecanismo existente de operaciones durables. Si la reserva queda pendiente de sincronizar, se informa expresamente y no se intenta abrir PayPal. El backend elimina del carrito las prendas reservadas. El pago retoma la reserva ya creada; no crea otra. Los pagos de reservas de otra tienda requieren seleccionar su tienda primero. Las compras previas y reservas se conservan al cambiar de empresa.

## Backend y despliegue

Se agrega `customer_favorites` con propiedad por usuario y empresa, una restricción para evitar duplicados y migración `f5b61028f001`. La tabla participa en los respaldos y su restauración.

Antes de usar el frontend actualizado, actualizar y reiniciar el backend. Si `AUTO_CREATE_TABLES=true`, el arranque crea la tabla nueva. En despliegues administrados con Alembic, ejecutar `alembic upgrade head` como parte de la actualización. No se modificaron las bases de datos del usuario durante la implementación: la verificación HTTP usa SQLite aislado.

PayPal continúa en el modo configurado por el backend (actualmente Sandbox). Su retorno web usa un origen autorizado de CORS y vuelve a `/paypal-return`, que confirma el pago antes de mostrar éxito. IDM-VTON depende del servicio de inferencia configurado; si no está disponible, la interfaz informa que no se pudo generar la prueba. La cámara requiere permiso del navegador y HTTPS o localhost. No se ejecutaron pagos reales ni se enviaron fotos personales a servicios externos durante las pruebas.

Las pruebas de integración cubren catálogo anónimo, empresa/sucursal inválidas, empresa suspendida, bloqueo de acciones anónimas, favoritos por usuario, cambio de empresa, contexto por dispositivo, carrito → reserva y URLs de retorno PayPal con proveedor simulado. La verificación visual utiliza un servidor temporal separado, definido en `output/pruebas/qa_tienda.py`.
