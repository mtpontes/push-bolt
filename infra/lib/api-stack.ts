import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import * as path from 'path';

export interface ApiStackProps extends cdk.StackProps {
  messagesTable: dynamodb.Table;
  uploadsBucket: s3.Bucket;
  connectionsTable: dynamodb.Table;
  userPool: cognito.UserPool;
  userPoolClient: cognito.UserPoolClient;
  stage: string;
}

export class ApiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    // Lambda Layer or common configuration for Quarkus Native
    const lambdaProps: Partial<lambda.FunctionProps> = {
      runtime: lambda.Runtime.PROVIDED_AL2023,
      handler: 'not.used.for.quarkus.native',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../backend/target/function.zip')),
      memorySize: 512,
      timeout: cdk.Duration.seconds(30),
      environment: {
        MESSAGES_TABLE: props.messagesTable.tableName,
        MESSAGES_TABLE_NAME: props.messagesTable.tableName,
        UPLOADS_BUCKET: props.uploadsBucket.bucketName,
        STORAGE_BUCKET_NAME: props.uploadsBucket.bucketName,
        CONNECTIONS_TABLE: props.connectionsTable.tableName,
        CONNECTIONS_TABLE_NAME: props.connectionsTable.tableName,
        STAGE: props.stage,
        APP_STAGE: props.stage,
      },
    };

    // 1. CreateMessageHandler (POST /messages)
    const createMessageFunctionName = `push-bolt-create-message-${props.stage}`;
    const createMessageLogGroup = new logs.LogGroup(this, 'CreateMessageLogGroup', {
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    const createMessageHandler = new lambda.Function(this, 'CreateMessageHandler', {
      ...lambdaProps as lambda.FunctionProps,
      functionName: createMessageFunctionName,
      logGroup: createMessageLogGroup,
      environment: {
        ...lambdaProps.environment,
        QUARKUS_LAMBDA_HANDLER: 'create-message',
      },
    });
    props.messagesTable.grantReadWriteData(createMessageHandler);
    props.uploadsBucket.grantRead(createMessageHandler);

    // 2. ListMessagesHandler (GET /messages)
    const listMessagesFunctionName = `push-bolt-list-messages-${props.stage}`;
    const listMessagesLogGroup = new logs.LogGroup(this, 'ListMessagesLogGroup', {
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    const listMessagesHandler = new lambda.Function(this, 'ListMessagesHandler', {
      ...lambdaProps as lambda.FunctionProps,
      functionName: listMessagesFunctionName,
      logGroup: listMessagesLogGroup,
      environment: {
        ...lambdaProps.environment,
        QUARKUS_LAMBDA_HANDLER: 'list-messages',
      },
    });
    props.messagesTable.grantReadData(listMessagesHandler);
    props.uploadsBucket.grantRead(listMessagesHandler);

    // 3. GenerateUploadUrlHandler (POST /messages/upload-url)
    const generateUploadUrlFunctionName = `push-bolt-generate-upload-url-${props.stage}`;
    const generateUploadUrlLogGroup = new logs.LogGroup(this, 'GenerateUploadUrlLogGroup', {
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    const generateUploadUrlHandler = new lambda.Function(this, 'GenerateUploadUrlHandler', {
      ...lambdaProps as lambda.FunctionProps,
      functionName: generateUploadUrlFunctionName,
      logGroup: generateUploadUrlLogGroup,
      environment: {
        ...lambdaProps.environment,
        QUARKUS_LAMBDA_HANDLER: 'generate-upload-url',
      },
    });
    props.uploadsBucket.grantPut(generateUploadUrlHandler);

    // 3b. DeleteMessageHandler (DELETE /messages/{createdAt})
    const deleteMessageFunctionName = `push-bolt-delete-message-${props.stage}`;
    const deleteMessageLogGroup = new logs.LogGroup(this, 'DeleteMessageLogGroup', {
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    const deleteMessageHandler = new lambda.Function(this, 'DeleteMessageHandler', {
      ...lambdaProps as lambda.FunctionProps,
      functionName: deleteMessageFunctionName,
      logGroup: deleteMessageLogGroup,
      environment: {
        ...lambdaProps.environment,
        QUARKUS_LAMBDA_HANDLER: 'delete-message',
      },
    });
    props.messagesTable.grantReadWriteData(deleteMessageHandler);
    props.uploadsBucket.grantDelete(deleteMessageHandler);

    // 4. WebSocket Connect Handler
    const webSocketConnectFunctionName = `push-bolt-websocket-connect-${props.stage}`;
    const webSocketConnectLogGroup = new logs.LogGroup(this, 'WebSocketConnectLogGroup', {
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    const webSocketConnectHandler = new lambda.Function(this, 'WebSocketConnectHandler', {
      ...lambdaProps as lambda.FunctionProps,
      functionName: webSocketConnectFunctionName,
      logGroup: webSocketConnectLogGroup,
      environment: {
        ...lambdaProps.environment,
        QUARKUS_LAMBDA_HANDLER: 'websocket-connect',
      },
    });
    props.connectionsTable.grantReadWriteData(webSocketConnectHandler);

    // 5. WebSocket Disconnect Handler
    const webSocketDisconnectFunctionName = `push-bolt-websocket-disconnect-${props.stage}`;
    const webSocketDisconnectLogGroup = new logs.LogGroup(this, 'WebSocketDisconnectLogGroup', {
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    const webSocketDisconnectHandler = new lambda.Function(this, 'WebSocketDisconnectHandler', {
      ...lambdaProps as lambda.FunctionProps,
      functionName: webSocketDisconnectFunctionName,
      logGroup: webSocketDisconnectLogGroup,
      environment: {
        ...lambdaProps.environment,
        QUARKUS_LAMBDA_HANDLER: 'websocket-disconnect',
      },
    });
    props.connectionsTable.grantReadWriteData(webSocketDisconnectHandler);

    // 6. Mock Authorizer Lambda (Node.js)
    const authorizerFunctionName = `push-bolt-authorizer-${props.stage}`;
    const authorizerLogGroup = new logs.LogGroup(this, 'AuthorizerLogGroup', {
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    const authorizerHandler = new lambda.Function(this, 'AuthorizerHandler', {
      runtime: lambda.Runtime.NODEJS_20_X,
      functionName: authorizerFunctionName,
      logGroup: authorizerLogGroup,
      handler: 'authorizer.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../handlers')),
      environment: {
        USER_POOL_ID: props.userPool.userPoolId,
        REGION: this.region,
        STAGE: props.stage,
      },
    });

    // HTTP API
    const httpApi = new apigatewayv2.CfnApi(this, 'HttpApi', {
      name: `push-bolt-http-api-${props.stage}`,
      protocolType: 'HTTP',
      corsConfiguration: {
        allowHeaders: ['*'],
        allowMethods: ['*'],
        allowOrigins: ['*'],
        maxAge: 300,
      },
    });

    // HTTP JWT Authorizer pointing to Cognito User Pool
    const httpJwtAuthorizer = new apigatewayv2.CfnAuthorizer(this, 'HttpJwtAuthorizer', {
      apiId: httpApi.ref,
      authorizerType: 'JWT',
      identitySource: ['$request.header.Authorization'],
      name: 'CognitoJwtAuthorizer',
      jwtConfiguration: {
        audience: [props.userPoolClient.userPoolClientId],
        issuer: `https://cognito-idp.${this.region}.amazonaws.com/${props.userPool.userPoolId}`,
      },
    });

    const stage = new apigatewayv2.CfnStage(this, 'HttpApiStage', {
      apiId: httpApi.ref,
      stageName: '$default',
      autoDeploy: true,
    });

    // Integrations
    const createMessageIntegration = new apigatewayv2.CfnIntegration(this, 'CreateMessageIntegration', {
      apiId: httpApi.ref,
      integrationType: 'AWS_PROXY',
      integrationUri: createMessageHandler.functionArn,
      payloadFormatVersion: '2.0',
    });

    const listMessagesIntegration = new apigatewayv2.CfnIntegration(this, 'ListMessagesIntegration', {
      apiId: httpApi.ref,
      integrationType: 'AWS_PROXY',
      integrationUri: listMessagesHandler.functionArn,
      payloadFormatVersion: '2.0',
    });

    const generateUploadUrlIntegration = new apigatewayv2.CfnIntegration(this, 'GenerateUploadUrlIntegration', {
      apiId: httpApi.ref,
      integrationType: 'AWS_PROXY',
      integrationUri: generateUploadUrlHandler.functionArn,
      payloadFormatVersion: '2.0',
    });

    const deleteMessageIntegration = new apigatewayv2.CfnIntegration(this, 'DeleteMessageIntegration', {
      apiId: httpApi.ref,
      integrationType: 'AWS_PROXY',
      integrationUri: deleteMessageHandler.functionArn,
      payloadFormatVersion: '2.0',
    });

    // Routes
    new apigatewayv2.CfnRoute(this, 'CreateMessageRoute', {
      apiId: httpApi.ref,
      routeKey: 'POST /messages',
      authorizationType: 'JWT',
      authorizerId: httpJwtAuthorizer.ref,
      target: `integrations/${createMessageIntegration.ref}`,
    });

    new apigatewayv2.CfnRoute(this, 'ListMessagesRoute', {
      apiId: httpApi.ref,
      routeKey: 'GET /messages',
      authorizationType: 'JWT',
      authorizerId: httpJwtAuthorizer.ref,
      target: `integrations/${listMessagesIntegration.ref}`,
    });

    new apigatewayv2.CfnRoute(this, 'GenerateUploadUrlRoute', {
      apiId: httpApi.ref,
      routeKey: 'POST /messages/upload-url',
      authorizationType: 'JWT',
      authorizerId: httpJwtAuthorizer.ref,
      target: `integrations/${generateUploadUrlIntegration.ref}`,
    });

    new apigatewayv2.CfnRoute(this, 'DeleteMessageRoute', {
      apiId: httpApi.ref,
      routeKey: 'DELETE /messages/{createdAt}',
      authorizationType: 'JWT',
      authorizerId: httpJwtAuthorizer.ref,
      target: `integrations/${deleteMessageIntegration.ref}`,
    });

    // WebSocket API
    const webSocketApi = new apigatewayv2.CfnApi(this, 'WebSocketApi', {
      name: `push-bolt-websocket-api-${props.stage}`,
      protocolType: 'WEBSOCKET',
      routeSelectionExpression: '$request.body.action',
    });

    const webSocketStage = new apigatewayv2.CfnStage(this, 'WebSocketApiStage', {
      apiId: webSocketApi.ref,
      stageName: 'prod',
      autoDeploy: true,
    });

    // WebSocket Authorizer
    const wsAuthorizer = new apigatewayv2.CfnAuthorizer(this, 'WebSocketAuthorizer', {
      apiId: webSocketApi.ref,
      authorizerType: 'REQUEST',
      identitySource: ['route.request.querystring.token'],
      name: 'MockAuthorizer',
      authorizerUri: `arn:aws:apigateway:${this.region}:lambda:path/2015-03-31/functions/${authorizerHandler.functionArn}/invocations`,
    });

    // WebSocket Integrations
    const connectIntegration = new apigatewayv2.CfnIntegration(this, 'ConnectIntegration', {
      apiId: webSocketApi.ref,
      integrationType: 'AWS_PROXY',
      integrationUri: webSocketConnectHandler.functionArn,
    });

    const disconnectIntegration = new apigatewayv2.CfnIntegration(this, 'DisconnectIntegration', {
      apiId: webSocketApi.ref,
      integrationType: 'AWS_PROXY',
      integrationUri: webSocketDisconnectHandler.functionArn,
    });

    // WebSocket Routes
    new apigatewayv2.CfnRoute(this, 'ConnectRoute', {
      apiId: webSocketApi.ref,
      routeKey: '$connect',
      authorizationType: 'CUSTOM',
      authorizerId: wsAuthorizer.ref,
      target: `integrations/${connectIntegration.ref}`,
    });

    new apigatewayv2.CfnRoute(this, 'DisconnectRoute', {
      apiId: webSocketApi.ref,
      routeKey: '$disconnect',
      target: `integrations/${disconnectIntegration.ref}`,
    });

    // Lambda permissions for API Gateway
    const principal = new cdk.aws_iam.ServicePrincipal('apigateway.amazonaws.com');
    
    createMessageHandler.addPermission('ApiPermission', { 
      principal,
      sourceArn: `arn:aws:execute-api:${this.region}:${this.account}:${httpApi.ref}/*`
    });
    listMessagesHandler.addPermission('ApiPermission', { 
      principal,
      sourceArn: `arn:aws:execute-api:${this.region}:${this.account}:${httpApi.ref}/*`
    });
    generateUploadUrlHandler.addPermission('ApiPermission', { 
      principal,
      sourceArn: `arn:aws:execute-api:${this.region}:${this.account}:${httpApi.ref}/*`
    });
    deleteMessageHandler.addPermission('ApiPermission', { 
      principal,
      sourceArn: `arn:aws:execute-api:${this.region}:${this.account}:${httpApi.ref}/*`
    });
    
    // WebSocket Permissions with explicit Source ARNs
    webSocketConnectHandler.addPermission('WSConnectPermission', {
      principal,
      sourceArn: `arn:aws:execute-api:${this.region}:${this.account}:${webSocketApi.ref}/*/$connect`
    });
    webSocketDisconnectHandler.addPermission('WSDisconnectPermission', {
      principal,
      sourceArn: `arn:aws:execute-api:${this.region}:${this.account}:${webSocketApi.ref}/*/$disconnect`
    });
    authorizerHandler.addPermission('WSAuthorizerPermission', {
      principal,
      sourceArn: `arn:aws:execute-api:${this.region}:${this.account}:${webSocketApi.ref}/*`
    });

    // 7. Stream Notifier Handler (DynamoDB Stream)
    const streamNotifierFunctionName = `push-bolt-stream-notifier-${props.stage}`;
    const streamNotifierLogGroup = new logs.LogGroup(this, 'StreamNotifierLogGroup', {
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    const streamNotifierHandler = new lambda.Function(this, 'StreamNotifierHandler', {
      ...lambdaProps as lambda.FunctionProps,
      functionName: streamNotifierFunctionName,
      logGroup: streamNotifierLogGroup,
      environment: {
        ...lambdaProps.environment,
        QUARKUS_LAMBDA_HANDLER: 'stream-notifier',
        WEBSOCKET_ENDPOINT: `https://${webSocketApi.ref}.execute-api.${this.region}.amazonaws.com/prod`,
        WEBSOCKET_API_ENDPOINT: `https://${webSocketApi.ref}.execute-api.${this.region}.amazonaws.com/prod`,
      },
    });
    props.messagesTable.grantReadData(streamNotifierHandler);
    props.messagesTable.grantStreamRead(streamNotifierHandler);
    props.connectionsTable.grantReadWriteData(streamNotifierHandler);
    props.uploadsBucket.grantRead(streamNotifierHandler);

    // Grant permission to push to WebSocket
    streamNotifierHandler.addToRolePolicy(new cdk.aws_iam.PolicyStatement({
      actions: ['execute-api:ManageConnections'],
      resources: [`arn:aws:execute-api:${this.region}:${this.account}:${webSocketApi.ref}/*`],
    }));

    // Add DynamoDB Stream mapping
    new lambda.EventSourceMapping(this, 'MessagesStreamMapping', {
      target: streamNotifierHandler,
      eventSourceArn: props.messagesTable.tableStreamArn!,
      startingPosition: lambda.StartingPosition.LATEST,
      batchSize: 1,
    });

    // Outputs
    new cdk.CfnOutput(this, 'HttpApiUrl', {
      value: `https://${httpApi.ref}.execute-api.${this.region}.amazonaws.com/`,
    });

    new cdk.CfnOutput(this, 'WebSocketApiUrl', {
      value: `wss://${webSocketApi.ref}.execute-api.${this.region}.amazonaws.com/prod`,
    });

    new cdk.CfnOutput(this, 'UserPoolId', {
      value: props.userPool.userPoolId,
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: props.userPoolClient.userPoolClientId,
    });
  }
}
