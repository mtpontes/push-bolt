#!/bin/bash

# Este script extrai os endpoints do CDK e atualiza o .env.local do frontend

echo "Extraindo endpoints do CDK..."

# Tenta ler o outputs.json gerado pelo cdk deploy
OUTPUTS_FILE="infra/outputs.json"

if [ ! -f "$OUTPUTS_FILE" ]; then
    echo "Erro: infra/outputs.json não encontrado. Certifique-se de que o deploy foi concluído."
    exit 1
fi

HTTP_URL=$(node -e "const fs = require('fs'); const outputs = JSON.parse(fs.readFileSync('$OUTPUTS_FILE', 'utf8')); console.log(outputs.ApiStack.HttpApiUrl);")
WS_URL=$(node -e "const fs = require('fs'); const outputs = JSON.parse(fs.readFileSync('$OUTPUTS_FILE', 'utf8')); console.log(outputs.ApiStack.WebSocketApiUrl);")

if [ "$HTTP_URL" == "null" ] || [ "$WS_URL" == "null" ]; then
    echo "Erro: Não foi possível encontrar os endpoints no outputs.json."
    exit 1
fi

# Cria ou sobrescreve o .env.local no frontend
ENV_FILE="frontend/.env.local"
echo "VITE_API_URL=$HTTP_URL" > "$ENV_FILE"
echo "VITE_WS_URL=$WS_URL" >> "$ENV_FILE"

echo "Arquivo $ENV_FILE atualizado com sucesso!"
echo "API URL: $HTTP_URL"
echo "WS URL: $WS_URL"
