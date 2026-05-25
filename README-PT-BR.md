# Push Bolt - Sincronização em Tempo Real Multi-Dispositivo

O Push Bolt é um sistema serverless de alta performance projetado para sincronização em tempo real de mensagens, links, textos e arquivos/imagens entre múltiplos dispositivos conectados de um mesmo usuário autenticado. 

O sistema é baseado em uma arquitetura reativa de baixo custo e escalabilidade automática, focando em Zero Cold Start por meio do uso do Quarkus compilado para Imagem Nativa (GraalVM). Toda a infraestrutura na nuvem AWS é provisionada de forma declarativa via AWS CDK.

## Visão Geral do Sistema

![Diagrama de Arquitetura](./assets/diagrama-de-arquitetura-.svg)

O sistema separa a comunicação em duas camadas principais: uma API HTTP síncrona para operações transacionais e gerenciamento, e uma API WebSocket para manutenção de presença e envio de notificações push em tempo real para os dispositivos conectados.

### Fluxo de Comunicação e Sincronização

O fluxo de sincronização em tempo real é orientado a eventos:

1. Autenticação: O cliente faz login via Google OAuth2 integrado ao Amazon Cognito e recebe um token JWT (id_token).
2. Conexão WebSocket: O cliente abre uma conexão com a API Gateway WebSocket utilizando `wss://.../prod?token=JWT`. O Custom Authorizer valida o token e a Lambda `$connect` registra o connectionId e o userId no banco.
3. Envio de Nova Mensagem: O cliente envia uma requisição POST para `/messages` com o token no header Authorization. O API Gateway HTTP valida o token e encaminha a requisição para a Lambda REST.
4. Notificação Reativa: A mensagem é persistida na tabela do DynamoDB. A alteração dispara um evento no DynamoDB Streams. A Lambda StreamNotifier processa o stream de dados, recupera os connectionIds ativos do usuário e faz o push da mensagem para cada dispositivo conectado via API Gateway Management API.

### Fluxo Otimizado de Arquivos e Imagens

Para respeitar os limites de payload do API Gateway (10MB) e otimizar a latência, o sistema utiliza o Amazon S3 com Pre-Signed URLs:

1. Solicitação de Upload: O cliente faz um POST para `/messages/upload-url` informando o nome e o tipo do arquivo. O backend retorna uma URL assinada S3 Pre-Signed PUT e uma chave única (s3Key).
2. Upload Direto: O cliente realiza o upload do binário diretamente do navegador para o S3 por meio da URL fornecida, contornando o Gateway.
3. Confirmação de Registro: Após concluir o upload no S3, o cliente chama o POST `/messages` passando apenas os metadados do arquivo (s3Key, nome, tipo, etc). O backend verifica a existência e o tamanho real do arquivo no S3 usando a SDK antes de persistir o registro.
4. Recuperação e Visualização: Ao listar as mensagens via GET `/messages` ou ao receber uma nova mensagem pelo WebSocket, a Lambda assina digitalmente a s3Key no momento da requisição, gerando uma URL temporária S3 Pre-Signed GET para que o frontend renderize o arquivo diretamente do bucket privado do S3.

---

## Tecnologias Utilizadas

### Serviços AWS e Infraestrutura
- AWS Lambda (com runtime PROVIDED_AL2023 para rodar o Quarkus compilado de forma nativa)
- Amazon DynamoDB (banco NoSQL com Streams ativado em modo PAY_PER_REQUEST)
- Amazon S3 (armazenamento seguro de arquivos com CORS configurado para uploads via front)
- Amazon Cognito User Pool (gerenciamento de identidades e integração Google OAuth2)
- AWS API Gateway (HTTP API para REST e WebSocket API para conexões bidirecionais)
- AWS CloudWatch Logs (com retenção de logs e destruição automática na stack do CDK)

### Backend
- Java 25
- Quarkus (GraalVM Native Image)
- AWS SDK para Java v2 (software.amazon.awssdk)
- Lombok e Jackson REST

### Frontend
- React + TypeScript
- Vite
- Vitest e MSW (para mocking de API em testes)

### Infraestrutura como Código (IaC)
- AWS CDK (TypeScript)

---

## Modelagem de Dados no DynamoDB

### Tabela 1: Messages
Armazena o histórico de mensagens e arquivos enviados.
- Partition Key (PK): `userId` (String) - Mapeado a partir do atributo `sub` do token Cognito.
- Sort Key (SK): `createdAt` (String) - Timestamp ISO-8601 formatado como `YYYY-MM-DDTHH:mm:ss.SSSZ`.
- Atributos Comuns:
  - `messageId` (String/UUID)
  - `type` (String: "text", "link", "image", "file")
- Atributos de Conteúdo (Opcional):
  - `content` (String)
- Atributos de Arquivo (Opcional):
  - `s3Key` (String)
  - `fileName` (String)
  - `mimeType` (String)
  - `sizeBytes` (Number)

A tabela possui DynamoDB Streams habilitado com tipo de visualização `NEW_IMAGE`.

### Tabela 2: Connections
Armazena os dispositivos conectados no WebSocket em tempo real.
- Partition Key (PK): `userId` (String)
- Sort Key (SK): `connectionId` (String) - Fornecido pelo API Gateway WebSocket.
- Atributos:
  - `connectedAt` (String)
  - `ttl` (Number - Timestamp Unix epoch para expiração automática de conexões órfãs)

---

## Especificação de APIs e Lambdas

Todas as funções Java são empacotadas em um único arquivo zip (`function.zip`) e o roteamento interno de execução no Quarkus é gerenciado pela variável de ambiente `QUARKUS_LAMBDA_HANDLER`.

### Camada HTTP (Handlers REST)

#### 1. CreateMessageHandler (POST `/messages`)
- Handler Quarkus: `create-message`
- Papel: Recebe o payload do frontend, valida metadados do arquivo se aplicável, atribui UUID e data de criação, e grava no DynamoDB.
- Observação: Se houver `s3Key` no payload, o handler se conecta ao S3 para verificar se o objeto realmente existe e obter o tamanho real do binário.

#### 2. ListMessagesHandler (GET `/messages`)
- Handler Quarkus: `list-messages`
- Papel: Recupera o histórico de mensagens ordenado de forma decrescente por data (mais recentes primeiro).
- Paginação: Utiliza o parâmetro `nextToken` na query. O backend decodifica o cursor Base64 contendo a chave `userId##createdAt` e o repassa para o DynamoDB no parâmetro `exclusiveStartKey`. O retorno envia uma nova chave `nextToken` codificada se houver mais páginas disponíveis.
- Assinatura: Gera dinamicamente urls assinadas temporárias (Pre-Signed GET) para imagens ou arquivos.

#### 3. GenerateUploadUrlHandler (POST `/messages/upload-url`)
- Handler Quarkus: `generate-upload-url`
- Papel: Valida o tamanho do arquivo solicitado e retorna uma URL S3 Pre-Signed PUT gerada em memória, além do respectivo `s3Key` formatado como `userId/UUID_nome-do-arquivo.ext`.
- Restrição: Limite de upload de 25MB por arquivo.

#### 4. DeleteMessageHandler (DELETE `/messages/{createdAt}`)
- Handler Quarkus: `delete-message`
- Papel: Remove o registro do histórico do DynamoDB e, caso seja uma mensagem de arquivo ou imagem, exclui o objeto correspondente no bucket do S3.
- Validação: Garante que apenas o proprietário da mensagem possa deletá-la.

### Camada WebSocket

#### 5. CustomAuthorizer (Lambda Node.js)
- Executada fora do binário Quarkus (Runtime Node.js 20.x).
- Papel: Intercepta a tentativa de conexão WebSocket obtendo o token via Query String `?token=...`.
- Funcionamento: Valida a assinatura do token contra o JWKS do Cognito. Extrai as claims `sub` (userId) e `email` para injetar no contexto do API Gateway WebSocket.
- Bypass Local: Em ambientes locais (`local`, `dev`, `test`), a validação criptográfica é pulada e o acesso é liberado usando informações mockadas do token.

#### 6. WebSocketConnectHandler (`$connect`)
- Handler Quarkus: `websocket-connect`
- Papel: Executado ao estabelecer a conexão. Registra o ID da conexão e o userId correspondente na tabela Connections com uma data de criação e um campo TTL configurado para 2 horas no futuro.

#### 7. WebSocketDisconnectHandler (`$disconnect`)
- Handler Quarkus: `websocket-disconnect`
- Papel: Remove a conexão correspondente da tabela Connections.

### Camada Event-Driven (Segundo Plano)

#### 8. StreamNotifierHandler (DynamoDB Stream Trigger)
- Handler Quarkus: `stream-notifier`
- Papel: Escuta as operações da tabela Messages no DynamoDB Stream.
- INSERT: Gera em memória uma URL Pre-Signed GET para itens de arquivo/imagem. Localiza todos os connectionIds ativos do userId na tabela Connections e envia a mensagem em formato JSON (`new_message`) usando o módulo ApiGatewayManagementApi.
- REMOVE: Propaga um evento de deleção (`delete_message` com a data `createdAt`) para todos os dispositivos conectados do usuário.
- Tratamento de Conexões Mortas: Em caso de retorno `GoneException` (HTTP 410) indicando que o socket foi encerrado de forma abrupta, a Lambda remove imediatamente o registro daquele connectionId da tabela Connections.

---

## Resolução de Identidade do Usuário

Para garantir consistência no mapeamento entre a sessão do usuário e seus dados:

- Camada HTTP: O backend Quarkus resolve o ID do usuário verificando primeiro a presença dos cabeçalhos `x-user-id` ou `X-User-Id` (utilizados em ambiente de desenvolvimento local). Caso não definidos, o ID é extraído de `requestContext.authorizer.jwt.claims.sub` injetado pelo API Gateway HTTP.
- Camada WebSocket: O Custom Authorizer decodifica o token JWT e popula o contexto com os campos `sub` e `email`. Os handlers de conexão e desconexão no Quarkus extraem o ID do usuário de `requestContext.authorizer.sub` ou `requestContext.authorizer.claims.sub`.

---

## Estrutura do Repositório

O projeto está organizado como um monorepo dividido em três módulos principais:

```text
push-bolt-v3/
├── backend/                    # Módulo Quarkus (Java 25)
│   ├── pom.xml                 # Configurações Maven, dependências AWS e Quarkus BOM
│   ├── src/main/java/com/app/
│   │   ├── constants/          # Constantes HTTP
│   │   ├── dto/                # Classes de Request/Response isoladas por endpoint
│   │   ├── handlers/           # Handlers Lambda (http, websocket, stream)
│   │   ├── model/              # Classes de Entidade/Domínio (Message, Connection)
│   │   ├── repository/         # Camada de persistência do DynamoDB SDK v2
│   │   └── service/            # Serviços auxiliares (Auth, S3, ApiGateway)
│   └── src/test/java/com/app/  # Testes unitários e integração usando JUnit5
│
├── infra/                      # Infraestrutura e IaC AWS CDK (TypeScript)
│   ├── bin/                    # Entrypoint da stack
│   ├── handlers/               # Código do Custom Authorizer em Node.js
│   ├── lib/                    # Stacks CDK (api-stack.ts, auth-stack.ts, state-stack.ts)
│   └── package.json            # Dependências do CDK e scripts
│
└── frontend/                   # UI do aplicativo (React + TypeScript)
    ├── src/
    │   ├── components/         # Componentes React
    │   ├── hooks/              # Hooks customizados para WebSocket e Infinite Scroll
    │   ├── services/           # Serviços de API e upload no S3
    │   └── types/              # Tipos TypeScript espelhando os DTOs do backend Java
    └── package.json            # Dependências React e Vite
```

---

## Políticas de Acesso AWS IAM

Para que o AWS CDK realize o lookup de contexto e efetue o provisionamento correto de recursos, a seguinte política de acesso IAM é recomendada para o usuário ou pipeline de execução:

```json
{
	"Version": "2012-10-17",
	"Statement": [
		{
			"Sid": "AllowCloudFormationRead",
			"Effect": "Allow",
			"Action": [
				"cloudformation:DescribeStacks",
				"cloudformation:GetTemplate",
				"cloudformation:DescribeStackEvents",
				"cloudformation:DescribeStackResources"
			],
			"Resource": "*"
		},
		{
			"Sid": "AllowReadCDKBootstrapVersion",
			"Effect": "Allow",
			"Action": "ssm:GetParameter",
			"Resource": "arn:aws:ssm:*:314146297418:parameter/cdk-bootstrap/hnb659fds/version"
		},
		{
			"Sid": "AllowCDKLookupAndDeploy",
			"Effect": "Allow",
			"Action": "sts:AssumeRole",
			"Resource": [
				"arn:aws:iam::314146297418:role/cdk-hnb659fds-lookup-role-314146297418-*",
				"arn:aws:iam::314146297418:role/cdk-hnb659fds-deploy-role-314146297418-*",
				"arn:aws:iam::314146297418:role/cdk-hnb659fds-file-publishing-role-314146297418-*",
				"arn:aws:iam::314146297418:role/cdk-hnb659fds-image-publishing-role-314146297418-*"
			]
		}
	]
}
```

---

## Diretrizes de Desenvolvimento e Regras de Negócio

Ao criar, expandir ou refatorar o backend e frontend, observe as seguintes regras estritas:

### 1. Regra de Ouro dos DTOs (Contratos de API Estritos)
- Cada endpoint do sistema possui seus próprios contratos de dados de entrada e saída. É proibido criar DTOs universais (ex. `MessageDTO`).
- Mapeie sempre as entidades de banco (como `Message` ou `Connection`) para os respectivos DTOs de Response antes de retornar o resultado da API. Nunca exponha entidades internas diretamente.

### 2. Compatibilidade com GraalVM Native Image
- Para garantir que a compilação nativa funcione sem problemas de serialização por reflexão, adicione a anotação `@RegisterForReflection` obrigatoriamente em todos os DTOs, Entidades, Handlers Quarkus e classes internas de comunicação que trafeguem via JSON.

### 3. Performance com Singleton S3Presigner
- Para otimizar o warm-up e evitar a recriação de conexões caras a cada requisição HTTP/WebSocket, a instância de `S3Presigner` do AWS SDK v2 deve ser inicializada de forma Singleton estática e injetada via CDI do Quarkus apenas uma vez.

### 4. Guia de Estilo Java
- Uso do `this`: Sempre utilize o prefixo `this.` ao acessar propriedades ou métodos pertencentes à própria classe.
- Estruturas de controle: Se o corpo de uma condicional `if` contiver apenas uma única instrução, não utilize chaves `{}`.
- Uso do `var`: Utilize a palavra-chave `var` apenas quando a tipagem for explicitamente clara do lado direito da atribuição (ex: `var conn = new Connection()`).

### 5. Padrão de Escrita de Testes
- Todos os testes no backend devem seguir o padrão **Given/When/Then** ou **Arrange/Act/Assert**.
- Os blocos dentro do corpo do método de teste devem ser separados visualmente por comentários (ex. `// Arrange`, `// Act`, `// Assert`).
- O nome dos testes declarados com `@DisplayName` deve seguir a estrutura semântica de Given/When/Then.
