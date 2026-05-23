import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { StateStack } from '../lib/state-stack';

test('DynamoDB Tables and S3 Bucket Created', () => {
  // Arrange
  const app = new cdk.App();

  // Act
  const stack = new StateStack(app, 'MyTestStack', { stage: 'test' });
  const template = Template.fromStack(stack);

  // Assert
  // Messages Table
  template.hasResourceProperties('AWS::DynamoDB::Table', {
    KeySchema: [
      { AttributeName: 'userId', KeyType: 'HASH' },
      { AttributeName: 'createdAt', KeyType: 'RANGE' }
    ],
    StreamSpecification: {
      StreamViewType: 'NEW_IMAGE'
    }
  });

  // Connections Table
  template.hasResourceProperties('AWS::DynamoDB::Table', {
    KeySchema: [
      { AttributeName: 'userId', KeyType: 'HASH' },
      { AttributeName: 'connectionId', KeyType: 'RANGE' }
    ],
    TimeToLiveSpecification: {
      AttributeName: 'ttl',
      Enabled: true
    }
  });

  // S3 Bucket
  template.hasResourceProperties('AWS::S3::Bucket', {
    CorsConfiguration: {
      CorsRules: [
        {
          AllowedMethods: ['GET', 'PUT', 'POST', 'DELETE', 'HEAD'],
          AllowedOrigins: ['*']
        }
      ]
    }
  });
});
