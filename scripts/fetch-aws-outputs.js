const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Esse script busca os outputs reais das stacks de CloudFormation no AWS e recria o infra/outputs.json
const stage = process.env.STAGE || 'dev';
console.log(`Buscando outputs das stacks AWS CloudFormation para o stage: ${stage}...`);

const stacks = [
  `PushBolt-StateStack-${stage}`,
  `PushBolt-AuthStack-${stage}`,
  `PushBolt-ApiStack-${stage}`
];

const outputs = {};

for (const stackName of stacks) {
  try {
    console.log(`Buscando informações da stack: ${stackName}`);
    
    // Executa a AWS CLI para recuperar a descrição da stack
    const data = execSync(`aws cloudformation describe-stacks --stack-name ${stackName} --output json`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'] // Ignora stderr para evitar poluir a saída em caso de stack não implantada
    });
    
    const stackInfo = JSON.parse(data);
    const stack = stackInfo.Stacks[0];
    
    if (stack && stack.Outputs) {
      outputs[stackName] = {};
      for (const output of stack.Outputs) {
        outputs[stackName][output.OutputKey] = output.OutputValue;
      }
      console.log(`Outputs da stack ${stackName} carregados com sucesso.`);
    } else {
      console.log(`Stack ${stackName} não retornou nenhum Output.`);
    }
  } catch (error) {
    console.warn(`Aviso: Não foi possível obter os outputs da stack ${stackName}. (Ela pode não estar implantada).`);
  }
}

const infraDir = path.join(__dirname, '..', 'infra');
const outputsFile = path.join(infraDir, 'outputs.json');

// Garante que a pasta infra existe
if (!fs.existsSync(infraDir)) {
  fs.mkdirSync(infraDir, { recursive: true });
}

// Grava o outputs.json recriado
fs.writeFileSync(outputsFile, JSON.stringify(outputs, null, 2), 'utf8');
console.log(`outputs.json gerado com sucesso em: ${outputsFile}`);
