"use client";
// Natal (20/11/2026): a classe we-natal no <html> (sininho do logotipo, app/globals.css). O script do layout põe a classe
// antes de pintar, mas o React, ao assumir o <html> da página, volta os atributos aos do layout e ela sumia; este componente
// põe de novo logo depois. ?natal=0 desliga (prévias).
import { useEffect } from "react";
import { natalNoNavegador } from "@/office/data/natal";

export function ClasseNatal() {
  useEffect(() => { document.documentElement.classList.toggle("we-natal", natalNoNavegador()); }, []);
  return null;
}
