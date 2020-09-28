#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import {VpcStack} from '../lib/vpc-stack';
import {RedashRdsStack} from "../lib/redash-rds-stack";
import {RedashElastiCacheStack} from "../lib/redash-elasticache-stack";
import {RedashInitializeStack} from "../lib/redash-initialize-stack";
import {RedashWorkerStack} from "../lib/redash-worker-stack";
import {RedashServerStack} from "../lib/redash-server-stack";
import {ServiceDiscoveryStack} from "../lib/service-discovery-stack";
import {Ec2StepServerStack} from "../lib/ec2-step-server-stack";

const account = 'xxx';

const env = {
  region: 'ap-northeast-1',
  account: account,
};

const app = new cdk.App();
const vpcStack = new VpcStack(app, 'VpcStack', {env: env});
const redashRdsStack = new RedashRdsStack(app, 'RedashRdsStack', {
  env: env,
  vpcStack: vpcStack,
});

const serviceDiscoveryStack = new ServiceDiscoveryStack(app, 'ServiceDiscoveryStack', {
  env: env, vpcStack: vpcStack
});

const ec2StepServerStack =  new Ec2StepServerStack(app, 'Ec2StepServerStack', {
  env: env,
  vpcStack: vpcStack,
});

const redashElastiCacheStack = new RedashElastiCacheStack(app, 'RedashElastiCacheStack', {
  env: env,
  vpcStack: vpcStack,
});

new RedashInitializeStack(app, 'RedashInitializeStack', {
  env: env,
  vpcStack: vpcStack,
  redashRdsStack: redashRdsStack,
  redashElastiCacheStack: redashElastiCacheStack,
});

new RedashServerStack(app, 'RedashServerStack', {
  env: env,
  vpcStack: vpcStack,
  serviceDiscoveryStack: serviceDiscoveryStack,
  redashRdsStack: redashRdsStack,
  redashElastiCacheStack: redashElastiCacheStack,
});

new RedashWorkerStack(app, 'RedashWorkerStack', {
  env: env,
  vpcStack: vpcStack,
  redashRdsStack: redashRdsStack,
  redashElastiCacheStack: redashElastiCacheStack,
});
