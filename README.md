# Reserva de stock y readiness

Desde esta carpeta, con Docker Desktop iniciado:

```sh
docker compose up --build -d
```

Inventario escucha en `localhost:3001` y Pedidos en `localhost:3000`.
Para probar el caso solicitado, ejecuta los siguientes comandos en orden:

```sh
curl -i -X POST http://localhost:3000/pedidos -H 'Content-Type: application/json' -d '{"sku":"MOUSE-USB","cantidad":30}'
curl -i -X POST http://localhost:3000/pedidos -H 'Content-Type: application/json' -d '{"sku":"MOUSE-USB","cantidad":30}'
curl -i http://localhost:3001/stock/MOUSE-USB
curl -i http://localhost:3000/health
curl -i http://localhost:3000/health/ready
docker compose stop inventario
curl -i http://localhost:3000/health
curl -i http://localhost:3000/health/ready
```

El primer pedido debe devolver 201, el segundo 409 y el stock debe quedar en 10. Los datos están en memoria: para reiniciarlos, ejecuta `docker compose down` y luego vuelve a iniciar los servicios. Una reserva que termina después de que Pedidos agote su tiempo de espera puede descontar stock aunque el cliente reciba un error; para un sistema real harían falta mecanismos de confirmación o idempotencia.
