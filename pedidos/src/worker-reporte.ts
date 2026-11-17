import { parentPort, workerData, Worker } from "node:worker_threads";
import { join } from "node:path";

interface EntradaWorker {
    n: number;
}

interface MensajeWorker {
    resultado?: number;
    error?: string;
}

function contarPrimos(n: number): number {
    let total = 0;
    for (let candidato = 2; candidato <= n; candidato += 1) {
        let esPrimo = true;
        for (let divisor = 2; divisor * divisor <= candidato; divisor += 1) {
            if (candidato % divisor === 0) {
                esPrimo = false;
                break;
            }
        }
        if (esPrimo) total += 1;
    }
    return total;
}

export function contarPrimosEnWorker(n: number): Promise<number> {
    return new Promise((resolve, reject) => {
        const worker = new Worker(join(__dirname, "worker-reporte.js"), { workerData: { n } });
        let mensaje: MensajeWorker | undefined;
        let errorWorker: Error | undefined;
        worker.once("message", (respuesta: MensajeWorker) => { mensaje = respuesta; });
        worker.once("error", (error) => {
            errorWorker = error instanceof Error ? error : new Error(String(error));
        });
        worker.once("exit", (codigo) => {
            if (errorWorker) reject(errorWorker);
            else if (codigo !== 0) reject(new Error(`El worker terminó con código ${codigo}`));
            else if (mensaje?.error) reject(new Error(mensaje.error));
            else if (mensaje?.resultado === undefined) reject(new Error("El worker terminó sin devolver un resultado"));
            else resolve(mensaje.resultado);
        });
    });
}

if (parentPort) {
    try {
        const { n } = workerData as EntradaWorker;
        parentPort.postMessage({ resultado: contarPrimos(n) });
    } catch (error) {
        parentPort.postMessage({ error: error instanceof Error ? error.message : String(error) });
    } finally {
        parentPort.close();
    }
}
