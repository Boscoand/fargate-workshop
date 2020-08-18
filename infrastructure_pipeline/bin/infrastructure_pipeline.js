#!/usr/bin/env node

const cdk = require('@aws-cdk/core');
const { InfrastructurePipelineStack } = require('../lib/infrastructure_pipeline-stack');

const app = new cdk.App();
new InfrastructurePipelineStack(app, 'InfrastructurePipelineStack');
