"use client";
// Abertura do mapa (WE-15, 21/11/2026): o que o servidor já sabe do pedido, para o primeiro quadro. O HTML do servidor
// e a hidratação não têm acesso ao endereço da página, então modoMundo() (mundoStore.ts) dava "não é o mapa" e a tela
// mostrava a barra do escritório da Nuvem ("Escritório Nuvem", "0 agentes", "+ Contratar agente") até o JavaScript
// carregar. A página da raiz (app/page.tsx) preenche isto; depois da hidratação modoMundo() continua mandando.
import { createContext, useContext } from "react";

export interface InicioMundo { mundo: boolean; sede: string | null; lote: string | null }
export const SEM_INICIO: InicioMundo = { mundo: false, sede: null, lote: null };
export const InicioMundoCtx = createContext<InicioMundo>(SEM_INICIO);
export const useInicioMundo = () => useContext(InicioMundoCtx);
