// Modal do vídeo do outdoor livre (20/11/2026): clicar num outdoor livre abre o vídeo de propaganda com o preço e o botão
// "Anunciar aqui" (que fecha o modal e deixa o cartão de compra do outdoor à vista).
import { create } from "zustand";
export const useModalOutdoor = create<{ slot: string | null; abrir: (slot: string | null) => void }>((set) => ({ slot: null, abrir: (slot) => set({ slot }) }));
