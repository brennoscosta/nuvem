"use client";
// Simulador de comportamentos. Emite eventos no mesmo formato que o orquestrador real vai emitir.
import { useEffect } from "react";
import { useEscritorio, type Status } from "../store";

const FALAS = {
  suporte: ["Respondendo um cliente", "Analisando um ticket", "Buscando na base de conhecimento", "Fechando o chamado #4821"],
  vendas: ["Qualificando um lead", "Montando uma proposta", "Follow-up com o cliente", "Atualizando o CRM"],
  marketing: ["Escrevendo um post", "Roteiro do próximo short", "Pesquisa de palavras-chave", "Revisando o criativo"],
  engenharia: ["Corrigindo um bug", "Revisando um PR", "Escrevendo testes", "Fazendo deploy"],
  diretoria: ["Revisando o plano da área", "Aprovando orçamento", "Lendo o relatório diário"],
};

const desde = new Map<string, number>();
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

export function useSimulador() {
  useEffect(() => {
    const timer = setInterval(() => {
      const s = useEscritorio.getState();
      if (!s.simulando) return;
      const agora = Date.now();
      for (const a of Object.values(s.agentes)) {
        const t0 = desde.get(a.id + a.status) ?? (desde.set(a.id + a.status, agora), agora);
        const dt = (agora - t0) / 1000;
        const emitir = (tipo: Parameters<typeof s.emitir>[1], texto?: string) => { desde.delete(a.id + a.status); s.emitir(a.id, tipo, texto); };
        const falas = FALAS[a.area] ?? FALAS.diretoria;
        switch (a.status as Status) {
          case "disponivel":
            if (dt > rnd(2, 6)) {
              const r = Math.random();
              if (a.nivel === "ceo" && r < 0.25) emitir("reuniao", "Chamou os diretores pra reunião");
              else if (r < 0.12) emitir("pausa", "Foi tomar um café");
              else if (r < 0.3) emitir("planejando", "Planejando o próximo passo");
              else emitir("tarefa_recebida", pick(falas));
            }
            break;
          case "trabalhando":
            if (dt > rnd(8, 16)) {
              const r = Math.random();
              if (["estagiario", "junior", "pleno"].includes(a.nivel) && r < 0.55) emitir("revisao_pedida", "Levando pra revisão");
              else if (r < 0.65) emitir("aprovado", "Entrega concluída");
              else if (r < 0.75) emitir("bloqueado", "Travei, preciso de ajuda");
              else if (r < 0.8 && ["gerente", "diretor"].includes(a.nivel)) emitir("aprovacao_do_dono", "Precisa da sua aprovação");
              else emitir("aprovado", "Entrega concluída");
            }
            break;
          case "planejando":
            if (dt > rnd(4, 7)) emitir("tarefa_recebida", pick(falas));
            break;
          case "em_revisao":
            if (dt > rnd(4, 7)) emitir(Math.random() < 0.75 ? "aprovado" : "devolvido", Math.random() < 0.75 ? "Aprovado pelo chefe" : "Voltou com ajustes");
            break;
          case "bloqueado":
            if (dt > rnd(5, 9)) emitir("voltou", "Desbloqueado, voltando ao trabalho");
            break;
          case "reuniao":
            if (dt > rnd(10, 16)) emitir("voltou", "Reunião encerrada");
            break;
          case "pausa":
            if (dt > rnd(8, 14)) emitir("voltou", "De volta à mesa");
            break;
          case "comemorando":
            if (dt > 3) emitir("voltou");
            break;
        }
      }
    }, 1000);
    return () => clearInterval(timer);
  }, []);
}
