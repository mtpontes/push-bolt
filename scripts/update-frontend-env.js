const fs = require('fs');
const path = require('path');

// Este script extrai os endpoints do CDK e atualiza o .env.local do frontend

console.log("Extraindo endpoints do CDK...");

const outputsFile = path.join(__dirname, '..', 'infra', 'outputs.json');

if (!fs.existsSync(outputsFile)) {
    console.error("Erro: infra/outputs.json não encontrado. Certifique-se de que o deploy foi concluído.");
    process.exit(1);
}

try {
    const rawData = fs.readFileSync(outputsFile, 'utf8');
    const outputs = JSON.parse(rawData);
    
    // Procura por chaves dinâmicas se o nome da stack tiver prefixos/sufixos
    // Mas no spec/Makefile original estava fixo como ApiStack
    let httpUrl = null;
    let wsUrl = null;
    let userPoolId = null;
    let userPoolClientId = null;
    let cognitoDomain = null;
    
    // Varre todas as stacks em outputs para extrair as variáveis necessárias
    for (const stackName in outputs) {
        const stack = outputs[stackName];
        if (stack.HttpApiUrl) httpUrl = stack.HttpApiUrl;
        if (stack.WebSocketApiUrl) wsUrl = stack.WebSocketApiUrl;
        if (stack.UserPoolId) userPoolId = stack.UserPoolId;
        if (stack.UserPoolClientId) userPoolClientId = stack.UserPoolClientId;
        if (stack.CognitoDomainUrl) cognitoDomain = stack.CognitoDomainUrl;
        
        // Fallbacks baseados nos exports exportados dinamicamente pelo CDK
        for (const key in stack) {
            if (key.includes('ExportsOutputRefUserPool') && !key.includes('UserPoolClient')) {
                userPoolId = stack[key];
            }
            if (key.includes('ExportsOutputRefUserPoolClient')) {
                userPoolClientId = stack[key];
            }
            if (key.includes('ExportsOutputRefCognitoDomainUrl')) {
                cognitoDomain = stack[key];
            }
        }
    }

    if (!httpUrl || !wsUrl) {
        console.error("Erro: Não foi possível encontrar os endpoints HttpApiUrl ou WebSocketApiUrl no outputs.json.");
        console.error("Conteúdo do outputs.json:", JSON.stringify(outputs, null, 2));
        process.exit(1);
    }

    const httpUrlClean = httpUrl.endsWith('/') ? httpUrl.slice(0, -1) : httpUrl;
    const wsUrlEscaped = wsUrl.replace(/\$default/, '$$$$default');

    const envFile = path.join(__dirname, '..', 'frontend', '.env.local');
    let envContent = `VITE_API_URL=${httpUrlClean}\n`;
    envContent += `VITE_WS_URL=${wsUrlEscaped}\n`;
    if (userPoolId) envContent += `VITE_COGNITO_USER_POOL_ID=${userPoolId}\n`;
    if (userPoolClientId) envContent += `VITE_COGNITO_CLIENT_ID=${userPoolClientId}\n`;
    if (cognitoDomain) envContent += `VITE_COGNITO_DOMAIN=${cognitoDomain}\n`;
    
    fs.writeFileSync(envFile, envContent, 'utf8');

    console.log(`Arquivo ${envFile} atualizado com sucesso!`);
    console.log(`API URL: ${httpUrlClean}`);
    console.log(`WS URL: ${wsUrl}`);
    if (userPoolId) console.log(`Cognito User Pool ID: ${userPoolId}`);
    if (userPoolClientId) console.log(`Cognito Client ID: ${userPoolClientId}`);
    if (cognitoDomain) console.log(`Cognito Domain: ${cognitoDomain}`);
} catch (error) {
    console.error("Erro ao processar as variáveis de ambiente:", error.message);
    process.exit(1);
}
