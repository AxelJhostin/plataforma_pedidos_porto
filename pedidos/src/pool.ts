import { availableParallelism } from "node:os";
import { contarPrimosEnWorker } from "./worker-reporte";

interface Trabajo {
    n: number;
    resolve: (resultado: number) => void;
    reject: (error: Error) => void;
}

function leerLimite(nombre: string, predeterminado: number, minimo: number): number {
    const valor = Number(process.env[nombre] ?? predeterminado);
    return Number.isInteger(valor) && valor >= minimo ? valor : predeterminado;
}

const MAX_TRABAJADORES = leerLimite("MAX_TRABAJADORES", availableParallelism(), 1);
const MAX_COLA = leerLimite("MAX_COLA", MAX_TRABAJADORES * 2, 0);
const cola: Trabajo[] = [];
let activos = 0;
let rechazadas = 0;

export class PoolLleno extends Error {
    constructor() {
        super("El pool de reportes está lleno");
        this.name = "PoolLleno";
    }
}

function despachar(): void {
    while (activos < MAX_TRABAJADORES && cola.length > 0) {
        const trabajo = cola.shift()!;
        activos += 1;
        void contarPrimosEnWorker(trabajo.n).then(trabajo.resolve, trabajo.reject).finally(() => {
            activos -= 1;
            despachar();
        });
    }
}

export function contarPrimosEnPool(n: number): Promise<number> {
    return new Promise((resolve, reject) => {
        if (activos >= MAX_TRABAJADORES && cola.length >= MAX_COLA) {
            rechazadas += 1;
            const error = new PoolLleno();
            reject(error);
            return;
        }

        cola.push({ n, resolve, reject });
        despachar();
    });
}

export function estadoPool() {
    return {
        maxTrabajadores: MAX_TRABAJADORES,
        activos,
        enCola: cola.length,
        maxCola: MAX_COLA,
        rechazadas
    };
}
