# Bitácora · Arquitecturas y procesos · Axel Hernandez

## Entorno

| Dato | Valor |
| --- | --- |
| Laptop (CPU, RAM) | Apple M4, 16 GB |
| nucleos según /metricas | 10 |
| MAX_TRABAJADORES y MAX_COLA | 10 y 20 |
| Duración de un reporte con n=2000000 | 239 ms en Postman para /reporte/pool; 224 ms medidos en el servidor |

## 1. Resultados

| Escenario | Latencia 50 % | Latencia máx. | Respuestas 2xx | Respuestas 503 | Timeouts / pendientes | bucle.maxMs |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 · bloqueo (/health) | 1 ms | 55 ms | 244464 | 0 | 0 | 3012 ms |
| 2 · worker sin límite | 1912 ms | 3411 ms | 508 | 0 | 50 sin respuesta contabilizada al cierre; timeout no reportado | 72 ms |
| 3 · pool con límite | 4 ms | 1701 ms | 483 | 70945 | 0 reportados | 45 ms |

### Escenario 1 · salida de autocannon

```text
Running 15s test @ http://localhost:3000/health
20 connections
Latency: 50% 1 ms; Max 55 ms
244k requests in 15.01s, 66.2 MB read
```

### Escenario 1 · respuesta de /metricas

```json
{
  "umbralLentaMs": 1000,
  "bucle": { "p50Ms": 11, "p99Ms": 13, "maxMs": 3012 },
  "nucleos": 10,
  "rutas": [
    { "ruta": "GET /health", "peticiones": 244464, "promedioMs": 0.037236698610002054, "maxMs": 7.748082999984035, "lentas": 0 },
    { "ruta": "GET /reporte/bloqueante", "peticiones": 2, "promedioMs": 3000.4230640000023, "maxMs": 3000.509292999981, "lentas": 2 }
  ],
  "pool": { "maxTrabajadores": 10, "activos": 0, "enCola": 0, "maxCola": 20, "rechazadas": 0 }
}
```

### Escenario 2 · salida de autocannon (repetición con códigos HTTP)

```text
Running 20s test @ http://localhost:3000/reporte/worker?n=2000000
50 connections
Latency: 50% 1912 ms; Max 3411 ms
Code 200: 508
558 requests in 20.03s, 142 kB read
```

### Escenario 2 · respuesta de /metricas

```json
{
  "umbralLentaMs": 1000,
  "bucle": { "p50Ms": 11, "p99Ms": 16, "maxMs": 72 },
  "nucleos": 10,
  "rutas": [
    { "ruta": "GET /reporte/worker", "peticiones": 508, "promedioMs": 1836.4228932480307, "maxMs": 3389.1502520000067, "lentas": 457 }
  ],
  "pool": { "maxTrabajadores": 10, "activos": 0, "enCola": 0, "maxCola": 20, "rechazadas": 0 }
}
```

### Escenario 3 · salida de autocannon

```text
Running 20s test @ http://localhost:3000/reporte/pool?n=2000000
50 connections
Latency: 50% 4 ms; Max 1701 ms
483 2xx responses, 70945 non 2xx responses
71k requests in 20.02s, 28.4 MB read
```

### Escenario 3 · respuesta de /metricas

```json
{
  "umbralLentaMs": 1000,
  "bucle": { "p50Ms": 11, "p99Ms": 20, "maxMs": 45 },
  "nucleos": 10,
  "rutas": [
    { "ruta": "GET /reporte/pool", "peticiones": 71448, "promedioMs": 8.279161046999125, "maxMs": 1694.0599589999983, "lentas": 464 }
  ],
  "pool": { "maxTrabajadores": 10, "activos": 0, "enCola": 0, "maxCola": 20, "rechazadas": 70965 }
}
```

## 2. Análisis

### Escenario 1: ¿qué valor tuvo bucle.maxMs y cuál fue el maxMs de /health? ¿Por qué uno ve el bloqueo y el otro no?
`bucle.maxMs` llegó a 3012 ms durante las dos peticiones bloqueantes.
El middleware registró un máximo de 7.75 ms para `GET /health`.
El monitor del bucle de eventos mide el retraso global del proceso, incluso si Node.js está bloqueado.
El middleware de latencia empieza a medir cuando Express puede atender la petición.
La espera en la cola sucede antes de que el middleware tenga oportunidad de iniciar su cronómetro.

### Escenario 2: ¿cuántas peticiones se completaron y cuántas terminaron en timeout?
Autocannon mostró 558 solicitudes iniciadas y 508 respuestas HTTP 200.
El middleware también registró 508 respuestas finalizadas de `/reporte/worker`.
La diferencia es de 50 solicitudes que no tuvieron respuesta contabilizada al cierre de la prueba.
La salida guardada no incluye un contador explícito de timeout.
Por eso no afirmo que esas 50 fueran timeouts; quedan registradas como pendientes/no completadas durante la ventana.
Aunque un reporte individual tarde poco, 50 workers compiten al mismo tiempo por CPU y memoria.

### Escenario 3: ¿cuántas respuestas fueron 2xx y cuántas 503? ¿Qué diferencia hay para el cliente?
Autocannon registró 483 respuestas 2xx y 70945 no 2xx; en esta ruta los rechazos del pool son 503.
El pool mantuvo como máximo 10 trabajadores activos y 20 trabajos en cola.
Cuando se llenaron esos espacios, respondió con 503 y `Retry-After: 1`.
El cliente recibe una respuesta explícita que indica que el servidor está disponible, pero no acepta más trabajo por ahora.
Un timeout significa que no llegó una respuesta dentro del plazo, así que el cliente no sabe si el trabajo se procesó.

### Autocannon ignora Retry-After. ¿Qué efecto tuvo y qué debería hacer un cliente bien diseñado?
Autocannon siguió enviando peticiones sin esperar el segundo indicado por `Retry-After`.
El pool rechazó las solicitudes que excedían sus límites y el contador alcanzó 70965.
Esto generó muchas respuestas 503, aunque el número de workers y la cola quedaron acotados.
Un cliente bien diseñado respeta `Retry-After` y limita los reintentos.
También puede usar espera exponencial y variación aleatoria para evitar que todos reintenten a la vez.

### Con tres réplicas detrás de un balanceador, ¿qué mostraría /metricas y qué cambiaría?
Cada réplica guarda sus métricas y la cola en memoria local.
Una petición a `/metricas` mostraría solo las métricas de la réplica que la atendió.
Con 10 trabajadores por réplica, podría haber hasta 30 reportes activos entre las tres.
Con una cola de 20 por réplica, podrían esperar hasta 60 trabajos.
Para tener métricas globales se necesita agregar datos de todas las réplicas en un sistema compartido.
Para coordinar un límite global de trabajos se necesita un despachador o una cola distribuida.

## 3. Problemas encontrados
- No estaban el archivo `worker-reporte.ts` ni la ruta `/reporte/worker`; se reconstruyeron para poder reutilizar el worker en el pool y ejecutar los escenarios.
- En el escenario 2 quedaron 50 solicitudes sin respuesta contabilizada al cierre; la salida de autocannon no indicó explícitamente si expiraron por timeout.
- En el escenario 3, autocannon informó 70945 respuestas no 2xx y el pool registró 70965 rechazos; la consulta de métricas pudo coincidir con solicitudes que aún terminaban.

## 4. Uso declarado de IA
Usé ChatGPT/Codex como apoyo para revisar el enunciado, reconstruir el worker que faltaba, implementar el pool limitado, corregir un error de TypeScript y organizar el análisis. Ejecuté las pruebas con Docker, Postman y autocannon y revisé los resultados incluidos en esta bitácora.

