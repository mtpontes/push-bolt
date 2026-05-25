# Push Bolt - Multi-Device Real-Time Sync

Push Bolt is a high-performance serverless system designed for real-time synchronization of messages, links, texts, and files/images across multiple connected devices of the same authenticated user. 

The system is based on a low-cost, auto-scaling reactive architecture, focusing on Zero Cold Start through the use of Quarkus compiled to Native Image (GraalVM). All AWS cloud infrastructure is provisioned declaratively via AWS CDK.

## System Overview

![Architecture Diagram](./assets/diagrama-de-arquitetura-.svg)

The system separates communication into two main layers: a synchronous HTTP API for transactional operations and management, and a WebSocket API for presence maintenance and real-time push notifications to connected devices.

### Communication and Synchronization Flow

The real-time synchronization flow is event-driven:

1. Authentication: The client logs in via Google OAuth2 integrated with Amazon Cognito and receives a JWT token (id_token).
2. WebSocket Connection: The client opens a connection with the API Gateway WebSocket using `wss://.../prod?token=JWT`. The Custom Authorizer validates the token, and the `$connect` Lambda registers the connectionId and userId in the database.
3. New Message Dispatch: The client sends a POST request to `/messages` with the token in the Authorization header. The API Gateway HTTP validates the token and forwards the request to the REST Lambda.
4. Reactive Notification: The message is persisted in the DynamoDB table. The change triggers an event in DynamoDB Streams. The StreamNotifier Lambda processes the data stream, retrieves the active connectionIds of the user, and pushes the message to each connected device via the API Gateway Management API.

### Optimized File and Image Flow

To respect the API Gateway payload limits (10MB) and optimize latency, the system uses Amazon S3 with Pre-Signed URLs:

1. Upload Request: The client sends a POST request to `/messages/upload-url` providing the file name and type. The backend returns a signed S3 Pre-Signed PUT URL and a unique key (s3Key).
2. Direct Upload: The client uploads the binary directly from the browser to S3 via the provided URL, bypassing the Gateway.
3. Registration Confirmation: After completing the upload in S3, the client calls POST `/messages` passing only the file metadata (s3Key, name, type, etc). The backend verifies the existence and actual size of the file in S3 using the SDK before persisting the record.
4. Retrieval and Display: When listing messages via GET `/messages` or receiving a new message via WebSocket, the Lambda digitally signs the s3Key on the fly, generating a temporary S3 Pre-Signed GET URL so that the frontend renders the file directly from the private S3 bucket.

---

## Technologies Used

### AWS Services and Infrastructure
- AWS Lambda (with runtime PROVIDED_AL2023 to run the Quarkus compiled native image)
- Amazon DynamoDB (NoSQL database with Streams enabled in PAY_PER_REQUEST mode)
- Amazon S3 (secure file storage with CORS configured for direct client uploads)
- Amazon Cognito User Pool (identity management and Google OAuth2 integration)
- AWS API Gateway (HTTP API for REST and WebSocket API for bidirectional connections)
- AWS CloudWatch Logs (with log retention and auto-destruction in the CDK stack)

### Backend
- Java 25
- Quarkus (GraalVM Native Image)
- AWS SDK for Java v2 (software.amazon.awssdk)
- Lombok and Jackson REST

### Frontend
- React + TypeScript
- Vite
- Vitest and MSW (for API mocking in tests)

### Infrastructure as Code (IaC)
- AWS CDK (TypeScript)

---

## DynamoDB Data Modeling

### Table 1: Messages
Stores the history of messages and sent files.
- Partition Key (PK): `userId` (String) - Mapped from the `sub` attribute of the Cognito token.
- Sort Key (SK): `createdAt` (String) - ISO-8601 timestamp formatted as `YYYY-MM-DDTHH:mm:ss.SSSZ`.
- Common Attributes:
  - `messageId` (String/UUID)
  - `type` (String: "text", "link", "image", "file")
- Content Attributes (Optional):
  - `content` (String)
- File Attributes (Optional):
  - `s3Key` (String)
  - `fileName` (String)
  - `mimeType` (String)
  - `sizeBytes` (Number)

The table has DynamoDB Streams enabled with the `NEW_IMAGE` view type.

### Table 2: Connections
Stores devices currently connected to the real-time WebSocket.
- Partition Key (PK): `userId` (String)
- Sort Key (SK): `connectionId` (String) - Provided by the API Gateway WebSocket.
- Attributes:
  - `connectedAt` (String)
  - `ttl` (Number - Unix epoch timestamp for automatic cleanup of orphaned connections)

---

## API and Lambda Specification

All Java functions are packaged in a single zip file (`function.zip`), and the internal execution routing in Quarkus is managed by the `QUARKUS_LAMBDA_HANDLER` environment variable.

### HTTP Layer (REST Handlers)

#### 1. CreateMessageHandler (POST `/messages`)
- Quarkus Handler: `create-message`
- Role: Receives the payload from the frontend, validates file metadata if applicable, assigns UUID and creation date, and saves it in DynamoDB.
- Note: If there is an `s3Key` in the payload, the handler connects to S3 to verify if the object exists and retrieves the actual binary size.

#### 2. ListMessagesHandler (GET `/messages`)
- Quarkus Handler: `list-messages`
- Role: Retrieves the message history sorted in descending order by date (most recent first).
- Pagination: Uses the `nextToken` query parameter. The backend decodes the Base64 cursor containing the `userId##createdAt` key and passes it to DynamoDB in the `exclusiveStartKey` parameter. The response returns a new encoded `nextToken` if more pages are available.
- Signature: Dynamically generates temporary signed URLs (Pre-Signed GET) for images or files.

#### 3. GenerateUploadUrlHandler (POST `/messages/upload-url`)
- Quarkus Handler: `generate-upload-url`
- Role: Validates the requested file size and returns an in-memory generated S3 Pre-Signed PUT URL, along with the respective `s3Key` formatted as `userId/UUID_filename.ext`.
- Restriction: Upload limit of 25MB per file.

#### 4. DeleteMessageHandler (DELETE `/messages/{createdAt}`)
- Quarkus Handler: `delete-message`
- Role: Removes the history record from DynamoDB and, in case it is a file or image message, deletes the corresponding object in the S3 bucket.
- Validation: Ensures that only the owner of the message can delete it.

### WebSocket Layer

#### 5. CustomAuthorizer (Node.js Lambda)
- Executed outside the Quarkus binary (Node.js 20.x runtime).
- Role: Intercepts the WebSocket connection attempt, obtaining the token via the query string `?token=...`.
- Mechanics: Validates the token signature against the Cognito JWKS. Extracts the `sub` (userId) and `email` claims to inject them into the API Gateway WebSocket context.
- Local Bypass: In local environments (`local`, `dev`, `test`), cryptographic validation is skipped, and access is allowed using mock token data.

#### 6. WebSocketConnectHandler (`$connect`)
- Quarkus Handler: `websocket-connect`
- Role: Executed when the connection is established. Registers the connection ID and corresponding userId in the Connections table with a creation date and a TTL field set to 2 hours in the future.

#### 7. WebSocketDisconnectHandler (`$disconnect`)
- Quarkus Handler: `websocket-disconnect`
- Role: Removes the corresponding connection from the Connections table.

### Event-Driven Layer (Background)

#### 8. StreamNotifierHandler (DynamoDB Stream Trigger)
- Quarkus Handler: `stream-notifier`
- Role: Listens to the operations of the Messages table in the DynamoDB Stream.
- INSERT: Generates an in-memory Pre-Signed GET URL for file/image items. Locates all active connectionIds for the userId in the Connections table and sends the message in JSON format (`new_message`) using the ApiGatewayManagementApi.
- REMOVE: Propagates a deletion event (`delete_message` with the `createdAt` date) to all connected devices of the user.
- Stale Connection Handling: In case of a `GoneException` (HTTP 410) indicating that the socket was abruptly closed, the Lambda immediately deletes the connectionId record from the Connections table.

---

## User Identity Resolution

To ensure consistency in mapping between the user session and their data:

- HTTP Layer: The Quarkus backend resolves the user ID by first checking for the presence of the `x-user-id` or `X-User-Id` headers (used in local development environments). If not defined, the ID is extracted from `requestContext.authorizer.jwt.claims.sub` injected by the HTTP API Gateway.
- WebSocket Layer: The Custom Authorizer decodes the JWT token and populates the context with the `sub` and `email` fields. The connection and disconnection handlers in Quarkus extract the user ID from `requestContext.authorizer.sub` or `requestContext.authorizer.claims.sub`.

---

## Repository Structure

The project is organized as a monorepo divided into three main modules:

```text
push-bolt-v3/
├── backend/                    # Quarkus Module (Java 25)
│   ├── pom.xml                 # Maven configs, AWS dependencies, and Quarkus BOM
│   ├── src/main/java/com/app/
│   │   ├── constants/          # HTTP constants
│   │   ├── dto/                # Request/Response classes isolated per endpoint
│   │   ├── handlers/           # Lambda Handlers (http, websocket, stream)
│   │   ├── model/              # Entity/Domain classes (Message, Connection)
│   │   ├── repository/         # DynamoDB SDK v2 persistence layer
│   │   └── service/            # Auxiliary services (Auth, S3, ApiGateway)
│   └── src/test/java/com/app/  # Unit and integration tests using JUnit5
│
├── infra/                      # AWS CDK Infrastructure and IaC (TypeScript)
│   ├── bin/                    # Stack entrypoint
│   ├── handlers/               # Custom Authorizer code in Node.js
│   ├── lib/                    # CDK Stacks (api-stack.ts, auth-stack.ts, state-stack.ts)
│   └── package.json            # CDK dependencies and scripts
│
└── frontend/                   # Application UI (React + TypeScript)
    ├── src/
    │   ├── components/         # React components
    │   ├── hooks/              # Custom hooks for WebSocket and Infinite Scroll
    │   ├── services/           # API services and S3 upload
    │   └── types/              # TypeScript types mirroring Java backend DTOs
    └── package.json            # React and Vite dependencies
```

---

## AWS IAM Access Policies

To allow AWS CDK to perform context lookup and execute proper resource provisioning, the following IAM access policy is recommended for the deployment pipeline or user:

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

## Development Guidelines and Business Rules

When creating, expanding, or refactoring the backend and frontend, strictly observe the following rules:

### 1. Golden Rule of DTOs (Strict API Contracts)
- Each endpoint in the system has its own request and response data contracts. Creating universal DTOs (e.g., `MessageDTO`) is forbidden.
- Always map database entities (such as `Message` or `Connection`) to the respective Response DTOs before returning the API result. Never expose internal entities directly.

### 2. GraalVM Native Image Compatibility
- To ensure that native compilation works seamlessly without reflection-based serialization issues, make sure to add the `@RegisterForReflection` annotation to all DTOs, Entities, Quarkus Handlers, and internal communication classes handled via JSON.

### 3. S3Presigner Singleton Performance
- To optimize warm-up and avoid costly reconnection overhead on every HTTP/WebSocket request, the `S3Presigner` instance from the AWS SDK v2 must be initialized as a static singleton and injected via Quarkus CDI only once.

### 4. Java Style Guide
- Use of `this`: Always use the `this.` prefix when referring to properties or methods belonging to the class itself.
- Control flow structures: If the body of an `if` conditional contains only a single statement, do not use braces `{}`.
- Use of `var`: Use the `var` keyword only when the type is explicitly clear on the right side of the assignment (e.g., `var conn = new Connection()`).

### 5. Test Writing Pattern
- All tests in the backend must follow the **Given/When/Then** or **Arrange/Act/Assert** pattern.
- The blocks inside the body of the test method must be visually separated by comments (e.g., `// Arrange`, `// Act`, `// Assert`).
- Test names declared with `@DisplayName` must follow the semantic structure of Given/When/Then.
