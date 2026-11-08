#!/usr/bin/env bash
# Baixa o GLB do Tripo, otimiza (30k tris, textura 1024) e mede. Uso: scripts/cidade/predio.sh <nome> <url>
set -euo pipefail
nome="$1"; url="$2"
mkdir -p .higgs/predios
curl -sL -m 300 -o ".higgs/predios/$nome-bruto.glb" "$url"
ls -la ".higgs/predios/$nome-bruto.glb" | awk '{print "bruto", $5}'
ERRO=0.004 node scripts/cidade/otimizar.mjs ".higgs/predios/$nome-bruto.glb" "public/modelos/escritorio-$nome.glb" 30000 1024
ls -la "public/modelos/escritorio-$nome.glb" | awk '{print "otimizado", $5}'
node scripts/cidade/medida.mjs "public/modelos/escritorio-$nome.glb"
