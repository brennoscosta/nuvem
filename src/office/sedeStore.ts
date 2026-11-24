// Estado do cartão das sedes (16/11/2026; desde 17/11 várias sedes, data/sedes.ts). Fica separado da interface para o
// mundoStore poder abrir o cartão (selecionar a chave de uma sede, ?sede=<id>, avisos) sem import circular com
// src/office/ui/CartaoOneState.tsx. `id` = qual sede está no cartão.
import { create } from "zustand";

export const useSede = create<{ aberto: boolean; id: string }>(() => ({ aberto: false, id: "" }));
