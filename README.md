# Push Bolt v2 - Multi-Device Real-Time Sync

Sistema serverless de alta performance para sincronização de mensagens, links e arquivos em tempo real entre múltiplos dispositivos.

## Arquitetura do Backend

O backend foi construído utilizando **Quarkus** compilado para **Imagem Nativa (GraalVM)**, garantindo Zero Cold Start nas funções AWS Lambda. Todas as funções compartilham um único artefato (`function.zip`), e a lógica de execução é selecionada via variável de ambiente `QUARKUS_LAMBDA_HANDLER`.

### Handlers do Backend

Abaixo estão os handlers principais e seus respectivos papéis no sistema:

#### 1. `CreateMessageHandler` (POST `/messages`)
*   **Papel:** Ponto de entrada para novas mensagens de texto e metadados de arquivos.
*   **Funcionamento:** Recebe o payload do cliente, gera um UUID único e um timestamp ISO-8601, e persiste a mensagem na tabela `Messages` do DynamoDB.
*   **Importância:** É o gatilho inicial para o fluxo de sincronização.

#### 2. `ListMessagesHandler` (GET `/messages`)
*   **Papel:** Recuperação do histórico de mensagens com suporte a Scroll Infinito.
*   **Funcionamento:** Realiza uma Query no DynamoDB filtrando por `userId` e ordenando por `createdAt` descendente. Gera URLs assinadas temporárias (S3 Pre-Signed GET) para qualquer item do tipo arquivo ou imagem.
*   **Paginação:** Utiliza um cursor Base64 (`nextToken`) para navegação eficiente entre grandes volumes de dados.

#### 3. `GenerateUploadUrlHandler` (POST `/messages/upload-url`)
*   **Papel:** Gestão segura de uploads de arquivos.
*   **Funcionamento:** Valida as restrições de upload (tamanho máximo de 25MB) e gera uma URL S3 Pre-Signed PUT.
*   **Fluxo:** O cliente solicita esta URL, faz o upload diretamente para o S3 (contornando o limite de 10MB do API Gateway) e depois chama o `CreateMessageHandler` para registrar o arquivo.

#### 4. `WebSocketConnectHandler` (`$connect`)
*   **Papel:** Gestão de presença em tempo real.
*   **Funcionamento:** Registra o `connectionId` do WebSocket e o `userId` na tabela `Connections` quando um novo dispositivo se conecta.
*   **TTL:** Os registros possuem Time-To-Live para garantir a limpeza de conexões órfãs.

#### 5. `StreamNotifierHandler` (Gatilho de Stream)
*   **Papel:** O "Cérebro" da sincronização em tempo real.
*   **Funcionamento:** É disparado automaticamente pelo **DynamoDB Streams** sempre que uma nova mensagem é inserida na tabela `Messages`.
*   **Processamento:** 
    1. Identifica o usuário da nova mensagem.
    2. Busca todos os `connectionId`s ativos desse usuário na tabela `Connections`.
    3. Realiza o Push em tempo real via **ApiGatewayManagementApi**.
    4. Limpa conexões inativas (GoneException) automaticamente.

---

## Estratégia de Desenvolvimento (TDD)

O projeto segue um fluxo rigoroso de **Test-Driven Development (RED-GREEN-REFACTOR)**:
1.  **RED**: Escrita de testes unitários/integração simulando falhas (Asserts ou Mocks).
2.  **GREEN**: Implementação do código mínimo necessário para passar nos testes.
3.  **REFACTOR**: Limpeza de código, melhoria de nomes e otimização sem quebrar os contratos.

## Como Rodar Localmente

O projeto foi preparado para rodar totalmente offline via **LocalStack**.

### 1. Subir Infraestrutura (DynamoDB e S3)
Certifique-se de ter o Docker instalado e execute:
```bash
docker-compose up -d
```
Isso criará as tabelas e o bucket automaticamente através do script `scripts/init-aws.sh`.

### 2. Rodar o Backend
Na pasta `backend`:
```bash
./mvnw quarkus:dev
```
O backend usará automaticamente o endpoint `http://localhost:4566` para simular a AWS.

### 3. Rodar o Frontend
Na pasta `frontend`:
```bash
npm install
npm run dev
```

## Configuração para Produção

O sistema é flexível e utiliza variáveis de ambiente para definir os recursos reais na AWS:

| Variável | Descrição | Padrão |
|----------|-----------|--------|
| `MESSAGES_TABLE_NAME` | Nome da tabela de mensagens | `Messages` |
| `CONNECTIONS_TABLE_NAME` | Nome da tabela de conexões | `Connections` |
| `STORAGE_BUCKET_NAME` | Nome do bucket S3 | `push-bolt-storage` |
| `AWS_REGION` | Região da AWS | `us-east-1` |

No deploy via AWS CDK, essas variáveis são injetadas automaticamente nas Lambdas.

## Tecnologias Utilizadas

*   **Backend:** Java 17+, Quarkus (Native), AWS SDK v2.
*   **Frontend:** React + TypeScript, Vite, Vitest, MSW (para mocks de API).
*   **Cloud:** AWS Lambda, DynamoDB, S3, API Gateway (HTTP & WebSocket).
*   **IaC:** AWS CDK (TypeScript).
