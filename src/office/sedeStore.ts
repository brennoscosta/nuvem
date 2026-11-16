// Estado do cartão da sede do OneState (16/11/2026). Fica separado da interface para o mundoStore poder abrir o cartão
// (selecionar a chave da sede, ?sede=1, avisos) sem import circular com src/office/ui/CartaoOneState.tsx.
import { create } from "zustand";

export const useSede = create<{ aberto: boolean }>(() => ({ aberto: false }));
