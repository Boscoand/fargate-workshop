#!/usr/bin/env node

const cdk = require('@aws-cdk/core');
const { CodePipelineStack } = require('../lib/codepipeline-stack');
const { FargateStack } = require('../lib/fargate-stack');

const app = new cdk.App();

new CodePipelineStack(app, 'CodePipelineStack');
new FargateStack(app, 'FargateStack');
