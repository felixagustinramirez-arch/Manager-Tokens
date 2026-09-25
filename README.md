# Token Manager

Una app para llevar el control de tus ciclos de tokens de Claude a mano.
No se conecta a Claude. No guarda contraseñas ni claves. Todo se queda
guardado dentro de tu propio teléfono.

## 1. ¿Cómo la subo a internet? (GitHub Pages)

Paso a paso, como si tuvieras 5 años:

1. Crea un repositorio nuevo en GitHub (por ejemplo, se llame `token-manager`).
2. Sube TODOS los archivos de esta carpeta dentro de ese repositorio
   (deben quedar en la raíz: `index.html`, `styles.css`, `app.js`, etc.,
   y la carpeta `icons/`).
3. Entra al repositorio en GitHub → botón **Settings** (arriba) → en el
   menú de la izquierda busca **Pages**.
4. En "Source" elige la rama `main` y la carpeta `/ (root)`. Guarda.
5. Espera un par de minutos. GitHub te va a dar un link parecido a:
   `https://tu-usuario.github.io/token-manager/`
6. Abre ese link. ¡Ya está en línea!

No necesitas servidor, ni Node, ni Python. Es un sitio 100% estático.

## 2. ¿Cómo la instalo en mi iPhone como una app?

1. Abre el link de tu app en **Safari** (tiene que ser Safari, no Chrome).
2. Toca el botón de **Compartir** (el cuadrito con la flecha hacia arriba).
3. Baja y toca **"Agregar a pantalla de inicio"**.
4. Ponle un nombre si quieres y toca **Agregar**.
5. Ahora tienes un ícono en tu pantalla, como cualquier app. Al abrirlo,
   se ve a pantalla completa, sin la barra de Safari.

## 3. ¿Cómo uso la app?

- Toca el botón **+** para agregar una cuenta.
- Cuando la cuenta llega a su corte, la verás como **"Esperando 1er mensaje"**.
- Cuando escribas el primer mensaje de verdad en Claude, toca
  **"Registrar 1er mensaje"** en esa cuenta. Ahí empieza a contar 5 horas
  (o el tiempo que hayas puesto).
- Si se te acaban los tokens antes de esas 5 horas, toca
  **"Agoté los tokens"**. El reloj sigue igual, no se mueve.
- Cuando llegue el corte, la app sola la pone en "Esperando 1er mensaje"
  otra vez.

## 4. Notificaciones — la verdad completa

Hay dos tipos de avisos:

**A) Avisos mientras tienes la app abierta o recién cerrada:**
Funcionan bien. Usan las notificaciones normales del teléfono.
Actívalas con el botón **"Activar avisos"**.

**B) Avisos con la app totalmente cerrada, horas después ("Web Push real"):**
Esto necesita que exista un servidor de verdad en algún lugar de internet
que le mande el aviso a tu teléfono, usando unas claves llamadas VAPID.
GitHub Pages **no** puede hacer esto por sí solo: no ejecuta programas,
solo entrega archivos. El código ya está preparado para recibir ese tipo
de aviso (mira `sw.js`), pero necesitarías montar un pequeño servidor
aparte (por ejemplo en un servicio gratuito) para que realmente te avise
con el teléfono bloqueado. Si no montas ese servidor, esta parte
simplemente no va a sonar sola.

## 5. Tus datos (copia de seguridad)

- **Exportar copia**: descarga un archivo `.json` con todas tus cuentas.
  Guárdalo donde quieras (Notas, correo, Drive, etc.).
- **Importar copia**: si cambias de teléfono o borras la app, usa ese
  archivo para recuperar todo.
- **Borrar todo**: borra todo lo guardado en este teléfono. No se puede
  deshacer.

## 6. Archivos del proyecto

- `index.html` — la pantalla principal.
- `styles.css` — cómo se ve (colores, tamaños).
- `app.js` — conecta todo.
- `db.js` — guarda tus datos en el teléfono (IndexedDB).
- `timer.js` — la regla de las 5 horas, el corazón de la app.
- `notifications.js` — los avisos.
- `sw.js` — hace que funcione sin internet y permite instalarla.
- `manifest.json` — le dice al teléfono cómo mostrar la app.
- `icons/` — los íconos de la app.

## 7. Seguridad

Esta app nunca te va a pedir tu contraseña de Claude, tus cookies ni
ninguna clave de API. Es solo un cuaderno de horarios para ti mismo.
