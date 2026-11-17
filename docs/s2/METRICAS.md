# Métricas de Pedidos

## Experimento

Se envió `GET /health` mientras `GET /reporte/bloqueante` seguía en proceso.

- Código de estado de `/health`: **200 OK**.
- Tiempo de `/health` en Postman: **1468 ms**.

## Respuesta completa de `GET /metricas`

```json
{
  "umbralLentaMs": 1000,
  "rutas": [
    {
      "ruta": "GET /metricas",
      "peticiones": 6,
      "promedioMs": 3.3860971666605715,
      "maxMs": 5.978250000000116,
      "lentas": 0
    },
    {
      "ruta": "GET /reporte/bloqueante",
      "peticiones": 2,
      "promedioMs": 3001.700396999957,
      "maxMs": 3002.1696260000026,
      "lentas": 2
    },
    {
      "ruta": "GET /favicon.ico",
      "peticiones": 1,
      "promedioMs": 1.6566249999887077,
      "maxMs": 1.6566249999887077,
      "lentas": 0
    },
    {
      "ruta": "GET /",
      "peticiones": 2,
      "promedioMs": 1.959104000008665,
      "maxMs": 2.0492080000112765,
      "lentas": 0
    },
    {
      "ruta": "GET /health",
      "peticiones": 4,
      "promedioMs": 2.2383540000082576,
      "maxMs": 4.975999999995111,
      "lentas": 0
    }
  ]
}
```

## Explicación

Postman o el navegador miden desde que envían `/health` hasta que reciben la respuesta.
La petición bloqueante ocupa el hilo principal de Node.js y retrasa el procesamiento de `/health`.
El interceptor comienza a medir cuando Express recibe el control de esa petición, después de la espera en la cola.
Por eso registra una latencia baja para `/health`, aunque el cliente haya esperado varios segundos.
El cliente ve un fallo de rendimiento (respuesta tardía); si supera su timeout, puede percibir indisponibilidad.
