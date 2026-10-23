# Actualización del documento: almacén, pedidos y despacho

Texto para actualizar `PIL-ANDINA-final-v2.docx` con el módulo de **Almacén y despacho** (etapas 6 y 7) que se agregó
al prototipo. Hasta ahora el documento lo dejaba como "versión futura". Cada bloque indica la sección, qué hacer
(reemplazar o agregar) y el texto listo para pegar.

Estos cambios ya están aplicados en `PIL-ANDINA-final-v3.docx`; `PIL-ANDINA-final-v2.docx` queda sin tocar como versión anterior.

Criterio que conviene mantener en todo el documento: el módulo **no es de ventas comerciales**. No hay precios,
facturación ni cobranzas, que serían un ERP y siguen fuera del alcance. Es el registro de qué lote llega a qué cliente,
que es lo que pide la etapa 7 y la trazabilidad de la sección 6.2.

---

## 1. Introducción y propósito: criterio de alcance

**Reemplazar** el primer párrafo de "CRITERIO DE ALCANCE" por:

> La propuesta concreta se centra en la recepción y el control de calidad de la leche cruda, en el registro del
> producto terminado y su despacho por lote, y en la organización del personal que sostiene las siete etapas del
> proceso. La automatización integral de maquinaria (PLC/SCADA), la visión artificial, WMS y ERP se plantean como
> integraciones futuras, sujetas a evaluación técnica y aprobación de la empresa.

## 4.2. Objetivos específicos

**Reemplazar** el cuarto objetivo por:

> Desarrollar un prototipo web con los módulos de recepción y calidad, producto terminado, almacén y despacho,
> cobertura de puestos críticos, personal, asistencia y turnos, solicitudes, capacitación y reportes.

**Agregar** después del segundo objetivo:

> Extender la trazabilidad desde el lote de recepción hasta el lote de producto terminado y el cliente que lo recibe,
> de modo que un reclamo o un retiro de producto pueda rastrearse en ambos sentidos.

## 4.4. Alcance

**Dentro del alcance**: reemplazar las dos últimas líneas por:

> Flujo de recepción y control de calidad con trazabilidad por lote, desde el proveedor hasta el cliente.
> Diseño organizacional de planta: organigrama, dotación y RACI.
> Prototipo web: recepción y calidad; producto terminado, almacén y despacho por lote; cobertura de puestos críticos;
> personal, asistencia y turnos; solicitudes; capacitación y reportes.

**Fuera del alcance**: reemplazar "Vínculo del lote de recepción con los lotes de producción, producto terminado y
despacho." por:

> Registro de los lotes de producción intermedios (etapas 3 a 5) y sus parámetros de proceso.
> Gestión comercial: precios, facturación, cobranzas y acceso de clientes al sistema.
> Inventario de insumos (envases, aditivos, repuestos).

## 5.2. Fichas por etapa

**Etapa 6 · Enfriamiento y envasado**, fila "Mejora propuesta": reemplazar por:

> Registrar cada lote de producto terminado con los lotes de recepción de los que sale la leche (implementado en el
> prototipo). Fase futura: visión artificial.

**Etapa 7 · Almacenamiento y despacho**:

- Fila "Cargos": reemplazar por:

  > Encargado de almacén, auxiliares de despacho, atención de pedidos (logística).

- Fila "Mejora propuesta": reemplazar por:

  > Registro del lote despachado por pedido, con propuesta automática de lotes por FEFO y motivo obligatorio para
  > apartarse de ella (implementado en el prototipo). Fase futura: WMS con QR/RFID.

## 6.2. Trazabilidad entre etapas

**Reemplazar** el párrafo por:

> La cadena de trazabilidad propuesta es: proveedor → ingreso (cisterna) → lote de recepción → tanque → lote de
> producto terminado → pedido y cliente. El prototipo cubre la cadena completa salvo los lotes de producción intermedios
> (etapas 3 a 5): al envasar, cada lote de producto terminado se asocia con los lotes de recepción de los que sale, y al
> despachar, cada pedido queda con los lotes que se entregaron. Así, desde un lote de recepción se obtienen los clientes
> que recibieron esa leche (rastreo hacia adelante, para un retiro de producto) y desde un lote de producto terminado se
> llega a los proveedores y a su análisis (rastreo hacia atrás, ante un reclamo).

**Agregar** (opcional) una tabla con los códigos:

| Eslabón | Código | Quién lo registra |
|---|---|---|
| Ingreso de cisterna | ING-AAAAMMDD-NN | Operador de recepción |
| Lote de recepción | LR-AAAAMMDD-NN | Supervisor de calidad (al aceptar o derivar) |
| Lote de producto terminado | LP-AAAAMMDD-NN | Operario de envasado o supervisor de producción |
| Pedido | PED-AAAAMMDD-NN | Atención de pedidos |

## 6.3. Controles de confiabilidad

**Agregar** al final de la lista:

> Un lote de producto terminado solo puede salir de leche aceptada y descargada en las 48 horas previas, y no puede
> contener más litros que sus lotes de origen.
> Quien registra un lote en envasado no lo recibe en almacén, y quien registra un pedido no lo despacha.
> Al despachar, el sistema propone los lotes que vencen primero (FEFO); elegir otros exige motivo y queda registrado.
> El stock de cada lote se calcula a partir de sus movimientos (recepción, despacho y ajustes con motivo); las
> devoluciones de clientes se registran por lote y no vuelven al stock.

## 7.2. Organigrama de planta

**Reemplazar** el párrafo que sigue a la Figura 3 por:

> Las áreas resaltadas, Acopio y recepción y Calidad y laboratorio, intervienen en el flujo de recepción y usan el
> módulo de Recepción y calidad del prototipo. Almacén y despacho, junto con los operarios de envasado de Producción,
> usa el módulo de Almacén y despacho; la atención de pedidos se ubica en esa misma área.

La figura no incluye el puesto de atención de pedidos: si se rehace el organigrama, conviene agregarlo bajo Almacén y
despacho.

## 7.3. Puestos críticos y dotación por turno

**Agregar** debajo de la tabla:

> En la etapa 7, además del encargado de almacén (puesto crítico), intervienen el auxiliar de despacho y el ejecutivo
> de atención de pedidos, que no son críticos: si faltan, el encargado de almacén puede despachar, pero no registrar
> pedidos, para conservar la separación entre quien pide y quien despacha.

## 7.4. Matriz de responsabilidades (RACI)

**Agregar** una segunda tabla después de la actual, con el título "Matriz de responsabilidades de envasado, almacén y
despacho":

| Actividad | Op. envasado | Sup. producción | Enc. almacén | Aux. despacho | At. pedidos | Sup. calidad | Jefatura |
|---|---|---|---|---|---|---|---|
| Registrar lote envasado con su leche de origen | R | A | I | | | | |
| Recibir el lote en almacén y confirmar unidades | I | I | A/R | | | | |
| Ajustar stock (merma, vencidos) | | I | A/R | | | | I |
| Registrar y cancelar pedidos | | | I | I | A/R | | |
| Despachar por lote (FEFO) | | | A/R | R | I | | |
| Registrar devoluciones | | | A/R | | | I | I |
| Mantener productos y vida útil | | A/R | | | | C | |
| Mantener clientes | | | | | A/R | | |
| Rastrear un lote hasta el cliente | | C | C | | C | R | A |

**Agregar** debajo:

> El prototipo aplica esta matriz igual que la de recepción: cada acción solo la registra el puesto responsable.

## 9. Alcance del prototipo

**Reemplazar** el párrafo introductorio por:

> El prototipo reutiliza los módulos de personal ya construidos y agrega el módulo de Recepción y calidad, el de
> Almacén y despacho y el Panel del proceso, de modo que los responsables de cada ingreso, lote y despacho sean
> trabajadores registrados y los reportes combinen indicadores de calidad, de despacho y de cobertura.

### 9.1. Módulos

**Agregar** dos filas después de "Recepción y calidad":

| Módulo | Estado | Funciones | Aporte al proceso |
|---|---|---|---|
| Producto terminado y almacén | Nuevo | Registro del lote envasado con su leche de origen; recepción en almacén con control de faltantes; inventario por lote con vencimiento; ajustes con motivo; kardex. | Control de las etapas 6 y 7 y eslabón entre recepción y despacho. |
| Pedidos y despacho | Nuevo | Clientes y pedidos (solo cantidades); despacho completo por lote con propuesta FEFO; devoluciones por lote; trazabilidad hasta el cliente; indicadores de despacho. | Cumple la mejora propuesta de la etapa 7 y cierra la cadena de trazabilidad. |

**Reemplazar** la fila "Reportes", columna "Funciones", por:

> Indicadores de calidad, de despacho (sección 10.1) y de personal.

### 9.2. Roles del sistema

**Agregar** a la tabla:

| Rol | Responsabilidad en el sistema |
|---|---|
| Operario de envasado | Registrar los lotes de producto terminado con su leche de origen. |
| Encargado de almacén | Recibir los lotes, ajustar el stock, despachar y registrar devoluciones. |
| Auxiliar de despacho | Despachar los pedidos por lote. |
| Ejecutivo de atención de pedidos | Registrar y cancelar pedidos; mantener los clientes. |

**Reemplazar** la última frase del párrafo de acceso por:

> … en Recepción y en Almacén y despacho dependen del puesto en el proceso, de modo que el sistema aplica las matrices
> RACI de la sección 7.4.

### 9.3. Entidades

**Cambiar el título** a "Entidades de los módulos del proceso" y **agregar** a la tabla:

| Entidad | Datos principales |
|---|---|
| Producto | Código, nombre, presentación, litros por unidad, vida útil (días). |
| Lote de producto terminado | Código LP, producto, unidades, fecha de elaboración y de vencimiento, lotes de recepción de origen, responsable de envasado, unidades recibidas en almacén y responsable de la recepción. |
| Movimiento de inventario | Lote, tipo (ingreso, despacho o ajuste), cantidad, pedido o motivo, responsable, fecha y hora. |
| Cliente | Código, nombre, tipo (distribuidor, supermercado, tienda o institucional), ciudad, dirección. |
| Pedido | Código PED, cliente, fecha de entrega, productos y cantidades, estado, responsable. |
| Despacho | Pedido, lotes y unidades entregadas, cumplimiento de FEFO y motivo, vehículo, responsable. |
| Devolución | Pedido, lote, cantidad, motivo, responsable. |

## 10.1. Indicadores de seguimiento

**Agregar** a la tabla:

| Indicador | Cálculo | Frecuencia | En el prototipo |
|---|---|---|---|
| Despachos con lote registrado | Despachos con lote registrado ÷ despachos totales × 100 | Semanal | Sí (el sistema no permite despachar sin lote) |
| Cumplimiento de FEFO | Despachos con los lotes que vencen primero ÷ despachos totales × 100 | Semanal | Sí |
| Devoluciones | Unidades devueltas ÷ unidades despachadas × 100 | Mensual | Sí |
| Mermas y bajas | Unidades dadas de baja ÷ unidades recibidas en almacén × 100 | Mensual | Sí |

## 10.2. Plan de implementación gradual

En la tabla, **reemplazar** las actividades de dos fases:

- Fase 2: "Construir los módulos de Recepción y calidad y de Almacén y despacho, y ampliar Personal con etapa y turno."
- Fase 3: "Agregar indicadores de calidad, despacho y cobertura; probar con datos de ejemplo."

## 10.3. Riesgos y medidas de control

**Agregar** una fila:

| Riesgo | Medida de mitigación |
|---|---|
| Producto vencido o rotación incorrecta | Propuesta de lotes por FEFO, alerta de lotes por vencer y motivo obligatorio para apartarse de la propuesta. |

## 11. Conclusiones

**Reemplazar** el cuarto párrafo por:

> El prototipo refleja esta visión: incorpora el módulo de Recepción y calidad, el de Almacén y despacho y el Panel
> del proceso, y vincula a sus responsables con los módulos de personal, asistencia, solicitudes y capacitación ya
> desarrollados. Con el registro del producto terminado y del despacho por lote, la trazabilidad llega del proveedor
> al cliente. La automatización industrial avanzada y la gestión comercial quedan como fase futura.

**Agregar** a las recomendaciones (11.1):

> Validar con almacén y logística la vida útil de cada producto, la regla FEFO y el procedimiento de devoluciones antes
> del piloto del despacho.
