import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { ApiStack } from '../lib/api-stack';
import { StateStack } from '../lib/state-stack';
import { AuthStack } from '../lib/auth-stack';
import * as fs from 'fs';
import * as path from 'path';

// Ensure a mock function.zip exists in the backend target folder so that CDK asset staging doesn't fail
const targetDir = path.join(__dirname, '../../backend/target');
const zipFile = path.join(targetDir, 'function.zip');
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}
if (!fs.existsSync(zipFile)) {
  fs.writeFileSync(zipFile, 'mock-zip-content-for-cdk-tests');
}

describe('ApiStack', () => {
  it('should have HTTP API with correct routes', () => {
    // Arrange
    const app = new cdk.App();
    const stateStack = new StateStack(app, 'TestStateStack', { stage: 'test' });
    const authStack = new AuthStack(app, 'TestAuthStack', { stage: 'test' });

    // Act
    const apiStack = new ApiStack(app, 'TestApiStack', {
      messagesTable: stateStack.messagesTable,
      uploadsBucket: stateStack.uploadsBucket,
      connectionsTable: stateStack.connectionsTable,
      userPool: authStack.userPool,
      userPoolClient: authStack.userPoolClient,
      stage: 'test',
    });
    const template = Template.fromStack(apiStack);

    // Assert
    template.hasResourceProperties('AWS::ApiGatewayV2::Api', {
      ProtocolType: 'HTTP',
    });

    template.hasResourceProperties('AWS::ApiGatewayV2::Route', {
      RouteKey: 'POST /messages',
    });

    template.hasResourceProperties('AWS::ApiGatewayV2::Route', {
      RouteKey: 'GET /messages',
    });

    template.hasResourceProperties('AWS::ApiGatewayV2::Route', {
      RouteKey: 'POST /messages/upload-url',
    });

    // WebSocket API Assertions
    template.hasResourceProperties('AWS::ApiGatewayV2::Api', {
      ProtocolType: 'WEBSOCKET',
    });

    template.hasResourceProperties('AWS::ApiGatewayV2::Route', {
      RouteKey: '$connect',
    });

    template.hasResourceProperties('AWS::ApiGatewayV2::Route', {
      RouteKey: '$disconnect',
    });
  });
});
