import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';
import * as fs from 'fs';
import * as path from 'path';

export interface AuthStackProps extends cdk.StackProps {
  stage: string;
}

export class AuthStack extends cdk.Stack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;

  constructor(scope: Construct, id: string, props: AuthStackProps) {
    super(scope, id, props);

    // 1. Tentar ler as credenciais do Google OAuth localmente
    let googleClientId = '';
    let googleClientSecret = '';
    
    const credentialsPath = path.join(__dirname, '..', '..', 'credentials', 'google-oauth-crendentials.json');
    if (fs.existsSync(credentialsPath)) {
      try {
        const creds = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
        if (creds.web) {
          googleClientId = creds.web.client_id;
          googleClientSecret = creds.web.client_secret;
        }
      } catch (err: any) {
        console.warn('Aviso: Falha ao ler credentials/google-oauth-crendentials.json:', err.message);
      }
    }

    // 2. Criar o UserPool do Cognito
    this.userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: `push-bolt-user-pool-${props.stage}`,
      selfSignUpEnabled: true,
      signInAliases: {
        email: true,
      },
      autoVerify: {
        email: true,
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // 3. Criar o dominio do Cognito (Hosted UI)
    const domainPrefix = `push-bolt-auth-${props.stage}-${this.account}`;
    const cognitoDomain = this.userPool.addDomain('CognitoDomain', {
      cognitoDomain: {
        domainPrefix: domainPrefix,
      },
    });

    // 4. Configurar Provedor de Identidade do Google se as credenciais existirem
    let googleProvider: cognito.UserPoolIdentityProviderGoogle | undefined;
    const supportedProviders = [cognito.UserPoolClientIdentityProvider.COGNITO];

    if (googleClientId && googleClientSecret) {
      googleProvider = new cognito.UserPoolIdentityProviderGoogle(this, 'GoogleProvider', {
        userPool: this.userPool,
        clientId: googleClientId,
        clientSecretValue: cdk.SecretValue.unsafePlainText(googleClientSecret),
        attributeMapping: {
          email: cognito.ProviderAttribute.GOOGLE_EMAIL,
        },
        scopes: ['profile', 'email', 'openid'],
      });
      supportedProviders.push(cognito.UserPoolClientIdentityProvider.GOOGLE);
    }

    // 5. Configurar as URLs de Callback para Localhost e Produção (se definida)
    const callbackUrls = [
      'http://localhost:5173',
      'http://localhost:5173/',
    ];
    const logoutUrls = [
      'http://localhost:5173',
      'http://localhost:5173/',
    ];

    if (process.env.FRONTEND_PROD_URL) {
      callbackUrls.push(process.env.FRONTEND_PROD_URL);
      logoutUrls.push(process.env.FRONTEND_PROD_URL);
      if (!process.env.FRONTEND_PROD_URL.endsWith('/')) {
        callbackUrls.push(`${process.env.FRONTEND_PROD_URL}/`);
        logoutUrls.push(`${process.env.FRONTEND_PROD_URL}/`);
      }
    }

    // 6. Criar o Client associando os Providers e OAuth
    this.userPoolClient = new cognito.UserPoolClient(this, 'UserPoolClient', {
      userPool: this.userPool,
      userPoolClientName: `push-bolt-client-${props.stage}`,
      generateSecret: false,
      authFlows: {
        userPassword: true,
      },
      supportedIdentityProviders: supportedProviders,
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
          implicitCodeGrant: true, // Necessario para retorno simplificado de token hash em SPAs
        },
        scopes: [
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.PROFILE,
        ],
        callbackUrls: callbackUrls,
        logoutUrls: logoutUrls,
      },
    });

    if (googleProvider) {
      this.userPoolClient.node.addDependency(googleProvider);
    }

    // 7. Outputs
    new cdk.CfnOutput(this, 'CognitoDomainUrl', {
      value: cognitoDomain.baseUrl(),
    });

    new cdk.CfnOutput(this, 'CognitoGoogleRedirectUri', {
      value: `https://${domainPrefix}.auth.${this.region}.amazoncognito.com/oauth2/idpresponse`,
    });
  }
}
