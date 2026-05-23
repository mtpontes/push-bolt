const crypto = require('crypto');
const https = require('https');

const REGION = process.env.REGION;
const USER_POOL_ID = process.env.USER_POOL_ID;
const STAGE = process.env.STAGE || 'prod';

// Cache para chaves públicas obtidas do Cognito
let jwksCache = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 horas

async function getJwks() {
  const now = Date.now();
  if (jwksCache && (now - cacheTimestamp < CACHE_TTL_MS)) {
    return jwksCache;
  }

  const url = `https://cognito-idp.${REGION}.amazonaws.com/${USER_POOL_ID}/.well-known/jwks.json`;
  
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json && Array.isArray(json.keys)) {
            jwksCache = json.keys;
            cacheTimestamp = Date.now();
            resolve(jwksCache);
          } else {
            reject(new Error('Invalid JWKS response format'));
          }
        } catch (err) {
          reject(err);
        }
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

function verifyJwtSignature(token, jwk) {
  const parts = token.split('.');
  const signatureInput = parts[0] + '.' + parts[1];
  const signature = Buffer.from(parts[2], 'base64url');
  
  try {
    const publicKey = crypto.createPublicKey({ key: jwk, format: 'jwk' });
    const pem = publicKey.export({ type: 'spki', format: 'pem' });
    
    const verify = crypto.createVerify('RSA-SHA256');
    verify.update(signatureInput);
    return verify.verify(pem, signature);
  } catch (err) {
    console.error('Erro na validação criptográfica da assinatura:', err);
    return false;
  }
}

exports.handler = async (event) => {
  const token = event.queryStringParameters && event.queryStringParameters.token;

  if (!token) {
    return denyPolicy(event.methodArn, 'user');
  }

  // Substitui a rota de conexão específica pelo wildcard de invocação geral da API
  const methodParts = event.methodArn.split('/');
  const apiArn = methodParts.slice(0, 2).join('/') + '/*';

  const parts = token.split('.');
  if (parts.length !== 3) {
    return denyPolicy(event.methodArn, 'user');
  }

  let payload;
  try {
    const payloadJson = Buffer.from(parts[1], 'base64').toString('utf8');
    payload = JSON.parse(payloadJson);
  } catch (err) {
    console.error('Erro ao decodificar payload do token:', err);
    return denyPolicy(event.methodArn, 'user');
  }

  const userId = payload.sub || payload['cognito:username'] || 'default-user';
  const userEmail = payload.email || 'mock@example.com';

  // Ativa bypass em ambiente de desenvolvimento local (LocalStack) ou quando ausente a infraestrutura Cognito
  const isLocalEnv = ['local', 'dev', 'test'].includes(STAGE) || !USER_POOL_ID || !REGION;
  
  if (isLocalEnv) {
    console.log(`Bypass de assinatura ativo (Stage: ${STAGE}) para o userId: ${userId}`);
    return allowPolicy(apiArn, userId, userEmail);
  }

  try {
    // 1. Validar Emissor (iss)
    const expectedIss = `https://cognito-idp.${REGION}.amazonaws.com/${USER_POOL_ID}`;
    if (payload.iss !== expectedIss) {
      console.error(`Emissor incorreto: ${payload.iss}. Esperado: ${expectedIss}`);
      return denyPolicy(event.methodArn, userId);
    }

    // 2. Validar Expiração (exp)
    const nowSec = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < nowSec) {
      console.error(`Token expirado. exp: ${payload.exp}, agora: ${nowSec}`);
      return denyPolicy(event.methodArn, userId);
    }

    // 3. Validar Assinatura Criptográfica via JWKS
    let header;
    try {
      const headerJson = Buffer.from(parts[0], 'base64').toString('utf8');
      header = JSON.parse(headerJson);
    } catch (err) {
      console.error('Erro ao decodificar header do token:', err);
      return denyPolicy(event.methodArn, userId);
    }

    const kid = header.kid;
    if (!kid) {
      console.error('Key ID (kid) ausente no cabeçalho do token');
      return denyPolicy(event.methodArn, userId);
    }

    const keys = await getJwks();
    const matchingJwk = keys.find(key => key.kid === kid);
    
    if (!matchingJwk) {
      console.error(`Nenhuma chave correspondente encontrada no JWKS para o kid: ${kid}`);
      return denyPolicy(event.methodArn, userId);
    }

    const isValid = verifyJwtSignature(token, matchingJwk);
    if (!isValid) {
      console.error('Assinatura de token inválida');
      return denyPolicy(event.methodArn, userId);
    }

    console.log(`Token autenticado com sucesso. User: ${userId}`);
    return allowPolicy(apiArn, userId, userEmail);

  } catch (err) {
    console.error('Exceção capturada na validação de token:', err);
    return denyPolicy(event.methodArn, userId);
  }
};

function allowPolicy(resource, userId, userEmail) {
  return {
    principalId: userId,
    policyDocument: {
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'execute-api:Invoke',
          Effect: 'Allow',
          Resource: resource,
        },
      ],
    },
    context: {
      sub: userId,
      email: userEmail,
    },
  };
}

function denyPolicy(resource, userId) {
  return {
    principalId: userId,
    policyDocument: {
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'execute-api:Invoke',
          Effect: 'Deny',
          Resource: resource,
        },
      ],
    },
  };
}
