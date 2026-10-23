# -*- coding: utf-8 -*-
"""
Generador del Manual Técnico y Operativo en Markdown
Catastro Móvil 2026 (CatastroMovil2026.apk)
"""

import os

md_content = """# MANUAL TÉCNICO Y DE OPERACIÓN DE LA APLICACIÓN MÓVIL
## CATASTRO MÓVIL 2026 – APLICATIVO NATIVO ANDROID (CatastroMovil2026.apk)

---

### FICHA TÉCNICA OFICIAL DEL APLICATIVO MÓVIL

| Parámetro | Especificación Oficial |
| :--- | :--- |
| **Nombre Oficial del APK** | Catastro Móvil ECC 2026 (`CatastroMovil2026.apk`) |
| **Ruta del Archivo APK** | `C:\\LNCZ\\proyecto-catastro-2026\\movil\\CatastroMovil2026.apk` |
| **Identificador de Paquete (Package ID)** | `com.gad.catastromovil.ecc` |
| **Versión de Producción** | **v4.7.6** (versionCode: 46) |
| **Nivel de Plataforma Android** | `minSdkVersion: 24` (Android 7.0+) \| `targetSdkVersion: 34` (Android 14) \| `compileSdk: 36` |
| **Stack de Tecnologías** | Capacitor 8.5.2 Nativo + React 19.2 + Vite 8.1 + Leaflet 1.9 + Proj4 2.20 |
| **Arquitectura de Persistencia** | IndexedDB (`idb` v2) + Respaldo Espejo en LocalStorage (**Garantía Cero Pérdida 100% Offline**) |
| **Sistema Geodésico y Proyección** | **EPSG:32717** (WGS 84 / UTM Zona 17S Ecuador) $\\leftrightarrow$ **EPSG:4326** (WGS 84 Geográficas) |
| **Disponibilidad de Documentos** | Word Docx: `C:\\LNCZ\\proyecto-catastro-2026\\informes\\Manual_Tecnico_Catastro_Movil_2026.docx` |

---

## 1. INTRODUCCIÓN Y ALCANCE

**Catastro Móvil 2026** es la solución de ingeniería de campo oficial concebida para la captura, actualización, fiscalización y levantamiento territorial georreferenciado en predios urbanos y rurales. 

Construida sobre el binomio de alta tecnología **Capacitor 8 + React 19**, la aplicación opera de forma autónoma bajo el paradigma **Offline-First**, permitiendo a brigadas topográficas y técnicos municipales levantar predios en zonas rurales o montañosas sin cobertura celular, garantizando la persistencia local íntegra y la sincronización bidireccional inmediata al retornar a cobertura de red.

> **UBICACIÓN Y DISTRIBUCIÓN OFICIAL:**  
> El aplicativo móvil compila nativamente como archivo `CatastroMovil2026.apk` alojado en `C:\\LNCZ\\proyecto-catastro-2026\\movil`. Dispone de empaquetado hermético con su propio JDK 21 y Android SDK independientes del sistema operativo Windows del desarrollador.

---

## 2. ARQUITECTURA DE SOFTWARE Y STACK TECNOLÓGICO

La arquitectura de Catastro Móvil está estructurada en capas desacopladas que integran servicios nativos del dispositivo Android con un motor geoespacial de alto rendimiento renderizado en WebView optimizada:

| Módulo / Capa | Tecnología / Librería | Función Crítica en la Aplicación |
| :--- | :--- | :--- |
| **Shell Nativo Android** | Capacitor 8.5.2 / Android Gradle | Encapsula el motor web, controla el ciclo de vida, puente nativo hacia hardware GPS y cámara fotográfica. |
| **Motor de Interfaz** | React 19.2 + Vite 8.1 | Renderizado reactivo ultrarrápido a 60 FPS, navegación móvil por pestañas e interactividad táctil fluida. |
| **Motor Cartográfico** | Leaflet 1.9.4 & React-Leaflet 5.0 | Despliegue de ortofotos satelitales, dibujo vectorial de polígonos, etiquetas métricas e interacción táctil. |
| **Motor Geodésico** | Proj4.js 2.20 | Conversión bidireccional instantánea entre EPSG:4326 (WGS84 Lat/Lng) y EPSG:32717 (UTM 17S Planar). |
| **Almacenamiento Local** | IndexedDB (`idb` 8.0) + LocalStorage | Persistencia transaccional de predios levantados, catálogo de posesionarios y configuraciones del dispositivo. |
| **Iconografía y UI** | Lucide React + SweetAlert2 | Diseño ergonómico para uso con una sola mano en campo bajo radiación solar intensa. |
| **Protocolo de Red** | Fetch API + AbortController | Control de timeouts estrictos (6s) y detección de latencia ante cold-start en la nube (Render). |

---

## 3. MODELO DE DATOS LOCAL Y RESILIENCIA "CERO PÉRDIDA"

El núcleo de persistencia móvil reside en `src/services/mobileDB.js` y se sustenta en una base de datos IndexedDB denominada `catastro_movil_db` (Versión 2).

La integridad de la información en campo es crítica: la pérdida accidental de vértices levantados tras horas de caminata bajo condiciones agrestes es inadmisible. Por ello, el sistema implementa una **Garantía Cero Pérdida** mediante **doble escritura simultánea (Dual-Write)** en IndexedDB y LocalStorage.

### Object Stores de IndexedDB:

| Object Store (Tabla) | Clave Primaria (`keyPath`) | Índices Secundarios | Descripción del Contenido |
| :--- | :--- | :--- | :--- |
| `offline_predios` | `offline_id` (ej: `off_171...`) | `sync_status`, `created_at` | Predios levantados en campo pendientes o en proceso de sincronización con sus vértices, linderos y fotos. |
| `cached_predios` | `id` (entero del servidor) | - | Copia local de predios existentes en el servidor central descargados para visualización offline en el mapa. |
| `cached_posesionarios` | `key` (cédula o clave generada) | `cedula` | Directorio precargado de posesionarios de la entidad para búsqueda y autocompletado en campo en 0 milisegundos. |
| `settings` | `key` (string único) | - | Parámetros globales: URL del backend, token JWT, UUID del dispositivo, modo de sincronización y proyecto activo. |

> **MECANISMO DE DOBLE ESCRITURA (DUAL-WRITE):**  
> La función `saveOfflinePredio(predio)` ejecuta una transacción asíncrona en IndexedDB y a renglón seguido escribe el registro en la clave `catastro_offline_predios_backup` de LocalStorage. Si el sistema operativo o el navegador reinicia el almacenamiento por presión de memoria, `getOfflinePredios()` fusiona automáticamente ambas fuentes garantizando la recuperación del 100% de los datos levantados.

---

## 4. MOTOR MATEMÁTICO, GEODÉSICO Y TOPOGRÁFICO DE CAMPO

A diferencia de visores móviles convencionales que delegan los cálculos al servidor, Catastro Móvil incorpora en `src/utils/geoUtils.js` un motor matemático compilado en JavaScript que ejecuta en el teléfono los mismos algoritmos geodésicos del Geoportal central:

### 4.1. Conversión de Coordenadas (EPSG:4326 $\\leftrightarrow$ EPSG:32717)
Las antenas GPS de los teléfonos inteligentes entregan latitud y longitud en grados decimales (Datum WGS 84). Para cumplir con el marco cartográfico oficial del Ecuador (UTM Zona 17 Sur), la función `wgs84ToUtm(lng, lat)` transforma las coordenadas a metros proyectados este ($X$) y norte ($Y$) con precisión milimétrica utilizando Proj4:
```javascript
const UTM17S = '+proj=utm +zone=17 +south +datum=WGS84 +units=m +no_defs';
const [x, y] = proj4('EPSG:4326', UTM17S, [lng, lat]);
```

### 4.2. Cálculo de Área Planar Mediante Fórmula del Cordón (Shoelace)
El cálculo de área de polígonos cerrados se realiza con `computePolygonArea(vertices)`, aplicando la sumatoria de Gauss sobre las coordenadas UTM planas:
$$\\text{Área} = \\frac{1}{2} \\left| \\sum_{i=0}^{n-1} (X_i Y_{i+1} - X_{i+1} Y_i) \\right|$$
El algoritmo computa la superficie en metros cuadrados ($m^2$) y hectáreas ($ha$) en menos de 1 milisegundo.

### 4.3. Algoritmo de Normalización Oficial (Vértice NW y Sentido Horario)
Para acatar la normativa catastral nacional, la función `normalizeVerticesClockwiseFromNW(vertices)` aplica dos transformaciones matemáticas rigurosas:
1. **Orientación Horaria:** Evalúa el signo del área con signo (*Signed Area*). Si es positivo (antihorario), invierte el arreglo de vértices para garantizar recorrido horario estricto.
2. **Identificación del Vértice Nor-Oeste (P01):** Normaliza las coordenadas dentro de la caja envolvente (*Bounding Box*) y evalúa el índice que maximiza $(\\text{normY} - \\text{normX})$. Dicho vértice es fijado obligatoriamente como **P01**, y los subsiguientes se enumeran consecutivamente (**P02, P03... Pn**) en sentido horario alrededor del predio.

### 4.4. Cálculo de Acimut y Rumbo Topográfico Cuadrantal
La función `calculateRumbo(dx, dy)` obtiene el acimut respecto al norte de cuadrícula y lo transforma a la nomenclatura clásica de agrimensura ecuatoriana:
- Cuadrante 1 ($0^\\circ$ a $90^\\circ$): `N [grados]° [minutos]' E`
- Cuadrante 2 ($90^\\circ$ a $180^\\circ$): `S [grados]° [minutos]' E`
- Cuadrante 3 ($180^\\circ$ a $270^\\circ$): `S [grados]° [minutos]' O`
- Cuadrante 4 ($270^\\circ$ a $360^\\circ$): `N [grados]° [minutos]' O`

---

## 5. MATRIZ DE SEGURIDAD, AUTENTICACIÓN Y ROLES

Catastro Móvil implementa un modelo de seguridad adaptativo que balancea el rigor criptográfico requerido por los administradores con la agilidad operativa necesaria para brigadistas contratados temporalmente en campo:

| Perfil de Usuario | Método de Acceso | Alcance y Permisos en el APK |
| :--- | :--- | :--- |
| **Superadmin / Administrador** | Credenciales (Usuario + Contraseña) vía JWT | Control total: dibujo manual, edición de vértices en mapa, eliminación de predios locales y del servidor, cambio de URL del backend. |
| **Técnico Geoportal** | Credenciales institucionales vía JWT | Levantamiento de predios, edición de ficha catastral, descarga de cartografía, subida de predios y consulta de auditoría. |
| **Brigadista de Campo (Operador)** | Nombre + Apellido (Licencia por Dispositivo) | Acceso rápido sin clave. Registro automático de `operador_temporal_id` asociado al UUID único del móvil. Levantamiento perimétrico con GPS y subida a su proyecto asignado. |

> **RESILIENCIA EN CONDICIONES EXTREMAS:**  
> Si un brigadista enciende el teléfono en un sector rural sin ninguna señal de internet, el sistema activa automáticamente el **Modo Campo Offline**. Genera un token local firmado (`offline_brigadista_...`), asocia los predios al GAD Urdaneta y almacena el levantamiento en espera de la conexión, sin bloquear jamás la operación del topógrafo.

---

## 6. PROTOCOLO DE SINCRONIZACIÓN Y RESOLUCIÓN DE CONFLICTOS

Al pulsar el botón **Sincronizar Pendientes** o cuando el modo automático detecta conexión Wi-Fi/4G estable, se desencadena el siguiente flujo de conciliación territorial en `src/services/api.js`:

1. **Verificación Previa de Conflicto:** Antes de enviar la geometría, el móvil consulta `POST /api/gis/predios/verificar-conflicto` con la clave catastral ingresada.
2. **Interfaz Interactiva de Resolución:** Si la clave ya existe en el servidor central (creada por otra brigada o preexistente en el Geoportal), el móvil despliega un modal SweetAlert2 con los datos del servidor (Área, Posesionario, Creador) y ofrece 3 alternativas:
   - **Sobreescribir:** Reemplaza la geometría y datos del servidor ejecutando un `PUT /api/gis/predios/{id}`.
   - **Conservar Servidor (Omitir):** Marca el predio móvil como sincronizado y preserva intacto el registro central.
   - **Asignar Nuevo Código:** Permite editar en el acto la clave catastral y reenviar el levantamiento como un predio nuevo.
3. **Creación Automática de Posesionario:** Si la cédula del posesionario no existe en la base central, el APK invoca primero `POST /api/gis/posesionarios`, obtiene el ID asignado y lo vincula al predio.
4. **Cierre Automático de Geometría:** Si el polígono tiene 3 o más vértices pero el último punto no coincide con el primero, el móvil agrega el punto de cierre automáticamente garantizando el cumplimiento del estándar OGC GeoJSON Polygon.
5. **Renovación Transparente de Sesión:** Si el token JWT caducó (Error HTTP 401), se solicita la clave al usuario mediante un modal emergente y se reanuda la cola de subida sin perder ningún dato.

---

## 7. PIPELINE DE COMPILACIÓN DEL APK Y AMBIENTE PORTABLE

El proyecto móvil cuenta con una infraestructura de compilación completamente desacoplada y portable. No requiere instalar Android Studio ni configurar variables de entorno globales en el sistema operativo Windows del desarrollador. Todo el pipeline se gestiona a través del script `build_apk.js` ubicado en `C:\\LNCZ\\proyecto-catastro-2026\\movil`.

### Flujo de Compilación Oficial (`npm run build:apk`):

```mermaid
graph TD
    A[0. Limpieza capacitor.config.json] --> B[1. npm run build - Vite 8]
    B --> C[2. npx cap sync android]
    C --> D[3. gradlew.bat assembleDebug con JDK 21 portable]
    D --> E[4. Generación app-debug.apk]
    E --> F[5. Copia a CatastroMovil2026.apk]
    E --> G[6. Histórico en Versiones/CatastroMovil2026_x.x.x.apk]
```

| Fase | Comando / Script Ejecutado | Detalle de la Operación |
| :--- | :--- | :--- |
| **0. Limpieza Config** | Lectura de `capacitor.config.json` | Elimina cualquier `server.url` de desarrollo para forzar empaquetado 100% autónomo y offline. |
| **1. Compilación Web** | `npm run build` (Vite 8) | Minifica el código React 19, genera bundles JS/CSS optimizados y empaqueta en la carpeta `dist/`. |
| **2. Sincronización** | `npx cap sync android` | Copia los assets estáticos de `dist/` dentro de `android/app/src/main/assets/public/` y enlaza plugins. |
| **3. Compilación Gradle** | `.\\gradlew.bat assembleDebug` | Utiliza JDK 21 y Android SDK portables ubicados en `movil/tools/` para compilar el bytecode Dalvik/ART. |
| **4. Versionado** | Extracción de `versionName` | Copia el APK generado como `CatastroMovil2026.apk` y crea una copia histórica en `Versiones/CatastroMovil2026_{version}.apk`. |

---

## 8. MANUAL DE OPERACIÓN EN CAMPO (GUÍA DE USUARIO)

### 8.1. Instalación del APK en el Dispositivo Móvil
1. Copiar el archivo `CatastroMovil2026.apk` al almacenamiento interno del teléfono o transferirlo por cable USB, WhatsApp o enlace compartido.
2. Abrir el archivo desde el explorador de archivos de Android. Si el sistema muestra la advertencia de *"Instalar aplicaciones desconocidas"*, autorizar al explorador de archivos.
3. Pulsar **Instalar**. Una vez concluida la instalación, abrir la aplicación.
4. Al primer inicio, conceder obligatoriamente los permisos de:
   - **Ubicación Precisa (GPS):** Seleccionar *"Mientras la app está en uso"*.
   - **Cámara y Almacenamiento:** Para captura de fotografías y guardado local de reportes.

### 8.2. Preparación Previa en Oficina (Antes de salir a Campo)
1. En la pantalla de Login, verificar la conexión pulsando el ícono de engranaje superior o accediendo a Ajustes.
2. Iniciar sesión con sus credenciales institucionales o mediante su Nombre y Apellido de Brigadista.
3. Ingresar a la pestaña **Ajustes** y presionar el botón **Descargar Predios del Servidor**. Esto almacenará en la memoria local del teléfono los predios preexistentes y el catálogo de posesionarios de la entidad.
4. En la pestaña **Mapa**, navegar y hacer zoom sobre la zona de trabajo para precargar en caché las imágenes satelitales.

### 8.3. Levantamiento Perimétrico con GPS ("Modo Caminar")
1. Situarse físicamente en la primera esquina o lindero del predio (preferiblemente el vértice Nor-Oeste).
2. En la pestaña **Mapa**, verificar que la barra superior indique **"GPS Fix"** con precisión en color verde ($< 5\\text{ m}$).
3. Abrir la barra flotante de herramientas y presionar **Caminar Perímetro**.
4. Presionar el botón **"+ Capturar Vértice"**. El sistema registrará el punto **P01** con sus coordenadas UTM, cota y precisión.
5. Caminar a lo largo del lindero perimétrico hasta la siguiente esquina y presionar nuevamente **"+ Capturar Vértice"** (se generará **P02** con la distancia métrica del tramo en vivo).
6. Continuar recorriendo todo el perímetro en sentido horario hasta llegar nuevamente al punto de inicio.
7. Presionar **Finalizar y Crear Ficha**. El móvil validará el polígono, calculará área y perímetro y abrirá automáticamente la Ficha Catastral.

### 8.4. Diligenciamiento de la Ficha Catastral
1. **Código / Clave Catastral:** Ingresar el código del predio asignado por el municipio.
2. **Búsqueda de Posesionario:** Digitar la cédula del propietario. El sistema buscará en 0 milisegundos en el catálogo local y autocompletará el nombre y apellidos completos.
3. **Colindantes:** El formulario desglosa cada tramo (**P01 ➔ P02, P02 ➔ P03...**) con su orientación geográfica calculada. Ingresar el nombre del vecino o elemento colindante (ej: *"Vía Pública"*, *"Familia Pérez"*, *"Río Ojivo"*).
4. **Guardar Predio:** Presionar **Guardar en el Teléfono**. El predio quedará protegido con estado *"Pendiente"*.

### 8.5. Emisión del Reporte Planimétrico en el Móvil
1. En cualquier momento, abrir la ficha del predio o tocar el polígono en el mapa y presionar **Ver Reporte Planimétrico**.
2. El aplicativo genera una lámina topográfica con:
   - Croquis del predio centrado con cuadrícula UTM oficial.
   - Cuadro de Construcción con vértices P01..Pn, coordenadas X, Y, rumbos y distancias.
   - Cuadro de Linderos oficiales (Norte, Sur, Este, Oeste).
   - Resumen de Superficie en $m^2$ y Hectáreas.
   - Código QR para validación institucional.

### 8.6. Sincronización al Servidor Central (Retorno a Oficina)
1. Al tener acceso a internet (Wi-Fi o datos móviles 4G), dirigirse a la pestaña **Sincronizar**.
2. Se observará la lista de predios levantados con su estado (*Pendiente*, *Sincronizado*, *Conflicto*).
3. Presionar **Sincronizar Todos**. El sistema transferirá los polígonos hacia la base PostgreSQL/PostGIS central.
4. En caso de detectarse que un código ya existía, el sistema consultará interactivamente si desea sobreescribir o renombrar el predio.

---

## 9. GUÍA DE SOLUCIÓN DE PROBLEMAS (TROUBLESHOOTING)

| Síntoma / Incidencia | Causa Raíz Identificada | Solución Inmediata Recomendada |
| :--- | :--- | :--- |
| **El GPS muestra "Sin Señal" o precisión en rojo (> 15 m)** | Dispositivo bajo techado, follaje denso o modo de ahorro de energía activo. | Salir a cielo abierto, verificar en Ajustes de Android que la Ubicación esté en "Alta Precisión" y desactivar el ahorro de batería. |
| **Error al sincronizar: "HTTP 401: Sesión Expirada"** | El token de seguridad JWT superó su tiempo de validez. | Aparecerá una ventana solicitando su contraseña. Ingrésela y presione "Renovar y Subir" para reanudar sin salir de la pantalla. |
| **La pantalla se queda en "Conectando con el Servidor..."** | El backend en Render Cloud estaba en reposo (Cold Start). | Esperar entre 15 y 30 segundos mientras el contenedor se despierta o presionar "Probar Conexión" en la pestaña Ajustes. |
| **El predio levantado no aparece en el mapa del Geoportal Web** | El predio fue guardado en el teléfono pero aún no ha sido sincronizado. | Ir a la pestaña "Sincronizar" en el móvil y presionar la nube de subida sobre el predio para cargarlo a la base central. |
| **Se requiere extraer los datos levantados sin usar internet** | Zona remota sin posibilidad de conexión a corto plazo. | En la pestaña Sincronizar, presionar "Exportar Backup JSON". Esto genera un archivo con todos los predios y vértices para transferirlo por cable USB. |

---

*Geoportal Catastral 2026 – Sistema Integrado de Gestión Territorial*  
*Documentación Técnica y Manual Operativo del Aplicativo Móvil Android*
"""

with open(r"C:\LNCZ\proyecto-catastro-2026\movil\MANUAL_TECNICO_MOVIL.md", "w", encoding="utf-8") as f:
    f.write(md_content)

with open(r"C:\LNCZ\proyecto-catastro-2026\informes\MANUAL_TECNICO_MOVIL.md", "w", encoding="utf-8") as f:
    f.write(md_content)

print("Manuales Markdown guardados exitosamente.")
