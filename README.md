# Proyecto PIL 2: proceso productivo de leche líquida (PIL Andina)

Prototipo académico de la materia **Diseño Organizacional y RRHH (SIS303)** de la USFX. Acompaña al documento
*Propuesta de mejora del proceso de producción de leche líquida* (`docs/PIL-ANDINA-final-v3.docx`).

El eje del sistema es el **proceso industrial**. Cubre la recepción y el control de calidad de la leche cruda, que es el
punto crítico del proceso; el producto terminado, el almacén y el despacho de pedidos por lote (etapas 6 y 7), y la
cobertura de los puestos críticos de las 7 etapas. Así la trazabilidad va del proveedor hasta el cliente. Recursos Humanos funciona como **soporte
organizacional** del proceso: personal, turnos, asistencia, solicitudes y capacitación.

## Módulos

| Grupo | Módulo | Qué hace |
|-------|--------|----------|
| Proceso productivo | Recepción de leche | El operador registra el ingreso (proveedor, cisterna, volumen, temperatura). El analista registra el análisis (acidez, densidad, grasa, alcohol, antibióticos) y el sistema sugiere aceptar, derivar o rechazar. El supervisor de calidad decide y se genera el lote. Al final, el operador registra la descarga a tanque. |
| | Trazabilidad de lotes | Desde un lote de recepción `LR-…` o un ingreso `ING-…` muestra el origen, el análisis, la decisión, el tanque, los lotes de producto terminado y los **clientes que lo recibieron**. Desde un lote de producto `LP-…` rastrea hacia atrás hasta los proveedores. |
| | Indicadores de calidad | Porcentaje de leche rechazada, conformidad por proveedor, tiempo de recepción, registros completos y parámetros fuera de norma. |
| | Parámetros y proveedores | Límites de aceptación configurables. Cada cambio exige motivo y queda en la bitácora. También administra proveedores y cisternas. |
| | Panel del proceso | Cobertura de puestos críticos por etapa, para hoy o un día futuro. Muestra la cobertura del período y la capacitación vigente en puestos críticos. |
| | Etapas y puestos | Las 7 etapas con sus puestos, quién los ocupa y las matrices RACI de la recepción y del almacén y despacho. |
| Almacén y despacho | Inventario | Stock de producto terminado por producto y por lote: despachable hoy, por vencer, vencido, por recibir y comprometido en pedidos. Kardex de movimientos. |
| | Lotes de producto terminado | Envasado registra el lote (`LP-…`) indicando de qué lotes de recepción sale la leche. El encargado de almacén lo recibe y confirma las unidades; los faltantes y ajustes exigen motivo. |
| | Pedidos y despacho | Atención de pedidos registra el pedido del cliente (solo cantidades, sin precios). El almacén lo despacha completo: el sistema propone los lotes por **FEFO** (vence primero, sale primero) y apartarse exige motivo. Devoluciones por lote. |
| | Indicadores de despacho | Despachos con lote registrado, cumplimiento de FEFO, entregas a tiempo, devoluciones, faltantes y mermas, por cliente y por producto. |
| | Productos y clientes | Catálogo de productos (vida útil, litros por unidad) y de clientes. |
| Soporte de RRHH | Personal | Ficha con cargo y **puesto en el proceso**, cuentas de acceso y filtros por etapa. |
| | Asistencia y turnos | Marcación propia, retrasos con tolerancia, ausencias, turnos y feriados. |
| | Permisos y vacaciones | Aprobación por etapas. Antes de aprobar, avisa si la solicitud deja **sin cobertura un puesto crítico**. |
| | Capacitación | Capacitaciones, inscripción y resultados. Alimenta el indicador de capacitación vigente en puestos críticos. |
| | Indicadores de personal | Asistencia, ausentismo, cumplimiento de capacitación y tiempos de aprobación, con exportación. |

Evaluación del desempeño y Clima/Comunicación quedan para **versiones futuras**, como indica el documento (sección 4.4).
Su código sigue en el repositorio, pero no tienen rutas en el frontend.

## Permisos: rol y puesto

- **Rol** (Trabajador, Supervisor, RRHH, Gerencia): define los permisos en los módulos de RRHH.
- **Puesto en el proceso** (operador de recepción, analista de laboratorio, supervisor de calidad, encargado de almacén, etc.): define qué puede hacer cada persona en los módulos del proceso. Así se aplican las matrices RACI del documento.
  - Recepción:
    - Solo el operador de recepción registra los ingresos y las descargas.
    - Solo el analista registra los análisis.
    - Solo el supervisor de calidad decide y cambia los parámetros.
    - Quien analizó una muestra no puede decidir sobre ella (segregación de funciones).
  - Almacén y despacho:
    - Envasado (operario de envasado o supervisión de producción) registra los lotes de producto terminado.
    - Solo el encargado de almacén los recibe, ajusta el stock y registra devoluciones.
    - Solo atención de pedidos registra pedidos; los despacha el almacén.
    - Quien envasa no recibe y quien registra el pedido no lo despacha.
  - Gerencia, la supervisión de producción y la jefatura de planta consultan ambos módulos.

## Puesta en marcha

Requiere **Node.js 22.5 o superior**.

```bash
# 1. Backend (API en http://localhost:3000)
cd pil-backend
npm install
npm run seed          # carga datos de ejemplo (borra los existentes)
npm start

# 2. Frontend (en otra terminal; abre http://localhost:5173)
cd pil-frontend
npm install
npm run dev
```

## Usuarios de prueba

La contraseña inicial de cada cuenta es el **CI** del trabajador.

| Usuario | Puesto en el proceso / rol | Contraseña | Para probar |
|---------|----------------------------|-----------|-------------|
| `mtorrez` | Operador de recepción | 5567012 | Registrar ingresos y descargas |
| `dflores` | Analista de laboratorio | 7012456 | Analizar la muestra que espera análisis |
| `lmamani` | Supervisor de calidad (rol Supervisor) | 6672310 | Decidir el ingreso pendiente, modificar parámetros |
| `jsalinas` | Gerencia | 3456789 | Consultar todo. Aprobar la vacación de Luis: avisa que la recepción queda sin supervisor de calidad |
| `efernandez` | RRHH | 1109988 | Personal y puestos, panel del proceso, capacitación |
| `arojas` | Supervisora de producción (rol Supervisor) | 4521301 | Equipo de planta y cobertura |
| `scondori` | Operadora de recepción | 6120934 | Segunda operadora: su vacación no deja el puesto descubierto |
| `pramos` | Operadora de clarificación | 4890321 | Tiene permiso hoy: la etapa 3 queda descubierta |
| `jperez` | Operador térmico | 5891023 | Está de vacaciones; lo cubre otra operadora |
| `mlopez` | Operaria de envasado | 3341987 | Debe cambiar la contraseña en el primer ingreso; luego registra lotes envasados |
| `raguilar` | Encargado de almacén | 3987654 | Recibir el lote envasado hoy, ajustar stock, despachar y registrar devoluciones |
| `gtorrico` | Ejecutiva de atención de pedidos | 5678234 | Registrar y cancelar pedidos, mantener clientes |
| `wcruz` | Auxiliar de despacho | 6789345 | Despachar los dos pedidos pendientes de hoy |

El seed genera dos semanas de datos con fechas relativas a hoy:
- **Recepción:** 47 ingresos, rechazos por antibióticos y alcohol, derivaciones, una decisión que se apartó de la sugerencia
  y una corrección en la bitácora. El último día queda un ingreso esperando análisis y otro esperando decisión.
- **Almacén y despacho:** 23 lotes de producto terminado elaborados con la leche aceptada, 20 pedidos despachados por FEFO
  (uno fuera de FEFO, con motivo), uno cancelado, una devolución, un lote recibido con faltante y una merma. Hoy queda
  un lote por recibir y dos pedidos por despachar.

## Pruebas

```bash
cd pil-backend && npm test     # reglas de negocio (node --test), incluidas las de recepción e inventario (FEFO)
cd pil-frontend && npm run lint
```

## Estructura

```
Proyecto-PIL-2/
├── pil-backend/    # API REST: Node.js + Express 5 + SQLite nativo (node:sqlite)
├── pil-frontend/   # SPA: React 19 + Vite + React Router
└── docs/           # Documento del proyecto, plan y decisiones de la versión anterior
```
