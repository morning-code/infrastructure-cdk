import * as cdk from '@aws-cdk/core';
import {RemovalPolicy, SecretValue, Tags} from '@aws-cdk/core';
import {AwsLogDriver, Cluster, ContainerImage, FargateService, FargateTaskDefinition} from '@aws-cdk/aws-ecs';
import {LogGroup} from '@aws-cdk/aws-logs';
import {ApplicationLoadBalancedFargateService} from '@aws-cdk/aws-ecs-patterns';
import {VpcStack} from "./vpc-stack";
import {RedashRdsStack} from "./redash-rds-stack";
import {StringParameter} from "@aws-cdk/aws-ssm";
import {RedashElastiCacheStack} from "./redash-elasticache-stack";

export interface RedashInitializeStackProps extends cdk.StackProps {
  vpcStack: VpcStack,
  redashRdsStack: RedashRdsStack,
  redashElastiCacheStack: RedashElastiCacheStack,
}

export class RedashInitializeStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props: RedashInitializeStackProps) {
    super(scope, id, props);
    // VPC
    const vpc = props.vpcStack.vpc;
    // RDS
    const rds = props.redashRdsStack.rds;
    // Redis
    const redis = props.redashElastiCacheStack.redis;

    const dbUser = 'root';
    const dbPassword = SecretValue.plainText(StringParameter.valueFromLookup(this, 'REDASH_DB_PASSWORD'));
    const dbUrl = 'postgresql://' + dbUser + ':' + dbPassword + '@' + rds.dbInstanceEndpointAddress + ':' + rds.dbInstanceEndpointPort + '/redash';

    // ECS Cluster
    const ecsCluster = new Cluster(this, 'EcsCluster', {
      clusterName: 'redash-initialize-cluster',
      vpc: vpc,
    });

    // Task Definition
    const taskDefinition = new FargateTaskDefinition(this, 'TaskDefinition', {
      memoryLimitMiB: 512,
      cpu: 256,
    });

    // Redash Container (for preview data)
    const redashContainerImage = ContainerImage.fromRegistry('redash/redash:latest');
    const redisUrl = 'redis://' + redis.attrPrimaryEndPointAddress + ':' + redis.attrPrimaryEndPointPort + '/0';

    // Redash - Initial DB creation
    taskDefinition.addContainer('RedashInitializeContainer', {
      image: redashContainerImage,
      memoryLimitMiB: 512,
      logging: new AwsLogDriver({
        logGroup: new LogGroup(this, 'RedashInitializeLogGroup', {
          logGroupName: 'redash-initialize',
          removalPolicy: RemovalPolicy.DESTROY,
        }),
        streamPrefix: 'redash-initialize',
      }),
      environment: {
        'PYTHONUNBUFFERED': '0',
        'REDASH_LOG_LEVEL': 'INFO',
        'REDASH_REDIS_URL': redisUrl,
        'REDASH_DATABASE_URL': dbUrl,
        'REDASH_PASSWORD_LOGIN_ENABLED': 'false',
        'REDASH_ALLOW_SCRIPTS_IN_USER_INPUT': 'true',
        'REDASH_DATE_FORMAT': 'YY/MM/DD',
      },
      command: ['create_db'],
    }).addPortMappings({
      containerPort: 5000,
    });

    // ECS - Fargate
    new FargateService(this, 'ECSService', {
      cluster: ecsCluster,
      serviceName: 'redash-initialize',
      desiredCount: 1,
      taskDefinition: taskDefinition,
    });

    // tagging
    Tags.of(this).add('ServiceName', 'morningcode');
  }
}