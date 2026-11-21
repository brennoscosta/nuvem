"use client";
// A visita guiada de 12/11/2026 (passeio de 30 s, avançando sozinho) virou o guia passo a passo com holofote em
// 21/11/2026 (frente "tutorial"): src/office/guia/GuiaMundo.tsx. Este arquivo só reexporta, para o Painel continuar igual.
// ?tour=1 e ?tour=0 continuam valendo (agora também ?guia=1, ?guia=0 e ?guia=<roteiro>).
export { GuiaMundo as VisitaGuiada } from "../guia/GuiaMundo";
