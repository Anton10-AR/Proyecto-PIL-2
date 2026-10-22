# Proyecto PIL 2: proceso productivo de leche líquida (PIL Andina)

Prototipo académico de la materia **Diseño Organizacional y RRHH (SIS303)** de la USFX. Acompaña al documento
*Propuesta de mejora del proceso de producción de leche líquida* (`docs/PIL-ANDINA-final-v2.docx`).

El eje del sistema es el **proceso industrial**. Cubre la recepción y el control de calidad de la leche cruda, que es el
punto crítico del proceso, y la cobertura de los puestos críticos de las 7 etapas. Recursos Humanos funciona como **soporte
organizacional** del proceso: personal, turnos, asistencia, solicitudes y capacitación.

## Módulos

| Grupo | Módulo | Qué hace |
|-------|--------|----------|
| Proceso productivo | Recepción de leche | El operador registra el ingreso (proveedor, cisterna, volumen, temperatura). El analista registra el análisis (acidez, densidad, grasa, alcohol, antibióticos) y el sistema sugiere aceptar, derivar o rechazar. El supervisor de calidad decide y se genera el lote. Al final, el operador registra la descarga a tanque. |
| | Trazabilidad de lotes | A partir de un lote `LR-…` o un ingreso `ING-…` muestra el origen, el análisis, la decisión, el tanque, los responsables y las correcciones. |
| | Indicadores de calidad | Porcentaje de leche rechazada, conformidad por proveedor, tiempo de recepción, registros completos y parámetros fuera de norma. |
| | Parámetros y proveedores | Límites de aceptación configurables. Cada cambio exige motivo y queda en la bitácora. También administra proveedores y cisternas. |
| | Panel del proceso | Cobertura de puestos críticos por etapa, para hoy o un día futuro. Muestra la cobertura del período y la capacitación vigente en puestos críticos. |
| | Etapas y puestos | Las 7 etapas con sus puestos, quién los ocupa y la matriz RACI de la recepción. |
| Soporte de RRHH | Personal | Ficha con cargo y **puesto en el proceso**, cuentas de acceso y filtros por etapa. |
| | Asistencia y turnos | Marcación propia, retrasos con tolerancia, ausencias, turnos y feriados. |
| | Permisos y vacaciones | Aprobación por etapas. Antes de aprobar, avisa si la solicitud deja **sin cobertura un puesto crítico**. |
| | Capacitación | Capacitaciones, inscripción y resultados. Alimenta el indicador de capacitación vigente en puestos críticos. |
| | Indicadores de personal | Asistencia, ausentismo, cumplimiento de capacitación y tiempos de aprobación, con exportación. |

Evaluación del desempeño y Clima/Comunicación quedan para **versiones futuras**, como indica el documento (sección 4.4).
Su código sigue en el repositorio, pero no tienen rutas en el frontend.

## Permisos: rol y puesto

- **Rol** (Trabajador, Supervisor, RRHH, Gerencia): define los permisos en los módulos de RRHH.
- **Puesto en el proceso** (operador de recepción, analista de laboratorio, supervisor de calidad, etc.): define qué puede hacer cada persona en Recepción. Así se aplica la matriz RACI del documento:
  - Solo el operador de recepción registra los ingresos y las descargas.
  - Solo el analista registra los análisis.
  - Solo el supervisor de calidad decide y cambia los parámetros.
  - Quien analizó una muestra no puede decidir sobre ella (segregación de funciones).
  - Gerencia, la supervisión de producción y la jefatura de planta consultan.

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
| `mlopez` | Operaria de envasado | 3341987 | Debe cambiar la contraseña en el primer ingreso |

El seed genera dos semanas de recepción con fechas relativas a hoy: 47 ingresos, rechazos por antibióticos y alcohol,
derivaciones, una decisión que se apartó de la sugerencia y una corrección en la bitácora. El último día queda un
ingreso esperando análisis y otro esperando decisión.

## Pruebas

```bash
cd pil-backend && npm test     # reglas de negocio (node --test), incluidas las de recepción
cd pil-frontend && npm run lint
```

## Estructura

```
Proyecto-PIL-2/
├── pil-backend/    # API REST: Node.js + Express 5 + SQLite nativo (node:sqlite)
├── pil-frontend/   # SPA: React 19 + Vite + React Router
└── docs/           # Documento del proyecto, plan y decisiones de la versión anterior
```
