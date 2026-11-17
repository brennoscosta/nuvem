"use client";
// Rosto de cada pessoa da equipe na página Minha equipe (17/11/2026, no lugar da bolinha com a inicial): o retrato em SVG
// do mesmo boneco que trabalha no mapa. Na sede da Social RP a aparência vem do id (data/aparenciaAgente.ts, a mesma da
// planta 3D); nas lojas comuns, do boneco escolhido no escritório. Foto enviada pelo dono tem prioridade.
import { createContext, useContext, useMemo } from "react";
import { RetratoBoneco } from "@/office/ui/RetratoBoneco";
import { aparenciaAgente } from "@/office/data/aparenciaAgente";
import { bonecoDe } from "@/office/data/bonecos";
import { NIVEL_COR, type MembroEquipe } from "@/office/ui/equipeComum";

// true = sede (aparência gerada); false = loja comum (boneco do escritório)
export const RostoSede = createContext(false);

type Pessoa = Pick<MembroEquipe, "membroId" | "nome" | "cargo" | "nivel" | "camisa" | "boneco" | "foto" | "setorCor">;
const ehChefe = (m: Pick<MembroEquipe, "nivel">) => m.nivel === "ceo" || m.nivel === "diretor" || m.nivel === "gerente";

export function Rosto({ m, tamanho = 40, anel, selo = true, className = "" }: { m: Pessoa; tamanho?: number; anel?: string | null; selo?: boolean; className?: string }) {
  const sede = useContext(RostoSede);
  const { def, camisa } = useMemo(
    () => (sede ? aparenciaAgente({ id: m.membroId, nome: m.nome, cargo: m.cargo, nivel: m.nivel, camisa: m.camisa }) : { def: bonecoDe(m.boneco), camisa: m.camisa }),
    [sede, m.membroId, m.nome, m.cargo, m.nivel, m.camisa, m.boneco],
  );
  const borda = anel === null ? undefined : `0 0 0 2px #fff, 0 0 0 ${tamanho >= 40 ? 4 : 3.5}px ${anel ?? m.setorCor}`;
  return (
    <span className={`relative inline-block shrink-0 ${className}`} style={{ width: tamanho, height: tamanho }}>
      <span className="block overflow-hidden rounded-full" style={{ width: tamanho, height: tamanho, boxShadow: borda }}>
        {m.foto
          ? <img src={m.foto} alt="" width={tamanho} height={tamanho} className="h-full w-full object-cover" />
          : <RetratoBoneco def={def} roupa={camisa} tamanho={tamanho} />}
      </span>
      {selo && ehChefe(m) && tamanho >= 30 && <span className="absolute -bottom-0.5 -right-0.5 rounded-full border-2 border-white" style={{ width: tamanho * 0.3, height: tamanho * 0.3, background: NIVEL_COR[m.nivel] }} />}
    </span>
  );
}
