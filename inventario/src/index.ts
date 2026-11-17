import express, {Request, Response} from "express";

const PORT = Number(process.env.PORT ?? 3001);
const RETARDO_MS = Number(process.env.RETARDO_MS ?? 1000);

const stock = new Map<string, number>([
    ["Laptop-14", 5],
    ["MOUSE-USB", 40],
    ["Teclado-ES",12],
    ["Monitor-24", 0]
]);
const esperar = (ms: number) => new Promise<void>((r)=> setTimeout(r, ms));

const app = express();
app.use(express.json());
app.get("/health", (_req: Request, res: Response) => {
    res.json({status: "ok", servicio: "inventario"});
});

app.post("/stock/:sku/reservar", async (req: Request<{sku: string}>, res: Response) => {
    const {cantidad} = req.body ?? {};
    if (!Number.isInteger(cantidad) || cantidad <= 0) {
        res.status(400).json({error: "La cantidad debe ser un entero mayor que cero"});
        return;
    }
    if (RETARDO_MS > 0) await esperar(RETARDO_MS);
    const disponible = stock.get(req.params.sku);
    if (disponible === undefined) {
        res.status(404).json({error: "sku no encontrado " + req.params.sku});
        return;
    }
    if (disponible < cantidad) {
        res.status(409).json({error: "no hay stock suficiente para sku " + req.params.sku});
        return;
    }
    const restante = disponible - cantidad;
    stock.set(req.params.sku, restante);
    res.json({sku: req.params.sku, reservado: cantidad, restante});
});

app.get("/stock/:sku", async (req: Request<{sku: string}>, res: Response)=> {
    if(RETARDO_MS > 0) await esperar(RETARDO_MS);
        const disponible = stock.get(req.params.sku);
    if(disponible === undefined){
        res.status(404).json({error: "sku no encontrado "+req.params.sku});
        return;
    }
    res.json({sku: req.params.sku, disponible});

});

app.listen(PORT, () => {
    console.log(`servicio inventario escuchando en puerto ${PORT} retraso ${RETARDO_MS} ms`);
})
