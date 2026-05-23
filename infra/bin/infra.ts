#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib/core';
import { StateStack } from '../lib/state-stack';
import { AuthStack } from '../lib/auth-stack';
import { ApiStack } from '../lib/api-stack';

const app = new cdk.App();
const stage = app.node.tryGetContext('stage') || process.env.STAGE || 'dev';

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT || process.env.AWS_ACCOUNT_ID,
  region: process.env.CDK_DEFAULT_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1',
};

const stateStack = new StateStack(app, `PushBolt-StateStack-${stage}`, {
  stage,
  env,
});

const authStack = new AuthStack(app, `PushBolt-AuthStack-${stage}`, {
  stage,
  env,
});

new ApiStack(app, `PushBolt-ApiStack-${stage}`, {
  messagesTable: stateStack.messagesTable,
  uploadsBucket: stateStack.uploadsBucket,
  connectionsTable: stateStack.connectionsTable,
  userPool: authStack.userPool,
  userPoolClient: authStack.userPoolClient,
  stage,
  env,
});

