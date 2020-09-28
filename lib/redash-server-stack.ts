import * as cdk from '@aws-cdk/core';
import {RemovalPolicy, SecretValue, Tags} from '@aws-cdk/core';
import {AwsLogDriver, Cluster, ContainerImage, FargateTaskDefinition} from '@aws-cdk/aws-ecs';
import {LogGroup} from '@aws-cdk/aws-logs';
import {VpcStack} from "./vpc-stack";
import {RedashRdsStack} from "./redash-rds-stack";
import {StringParameter} from "@aws-cdk/aws-ssm";
import {RedashElastiCacheStack} from "./redash-elasticache-stack";
import {ServiceDiscoveryStack} from "./service-discovery-stack";
import {DnsRecordType, Service} from "@aws-cdk/aws-servicediscovery";
import {Peer, Port, SecurityGroup} from "@aws-cdk/aws-ec2";
import {ApplicationLoadBalancedFargateService} from "@aws-cdk/aws-ecs-patterns";

export interface RedashServerStackProps extends cdk.StackProps {
  vpcStack: VpcStack,
  serviceDiscoveryStack: ServiceDiscoveryStack,
  redashRdsStack: RedashRdsStack,
  redashElastiCacheStack: RedashElastiCacheStack,
}

export class RedashServerStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props: RedashServerStackProps) {
    super(scope, id, props);
    // VPC
    const vpc = props.vpcStack.vpc;
    // ServiceDiscovery
    const namespace = props.serviceDiscoveryStack.namespace;
    // RDS
    const rds = props.redashRdsStack.rds;
    // Redis
    const redis = props.redashElastiCacheStack.redis;

    const dbUser = 'root';
    const dbPassword = SecretValue.plainText(StringParameter.valueFromLookup(this, 'REDASH_DB_PASSWORD'));
    const dbUrl = 'postgresql://' + dbUser + ':' + dbPassword + '@' + rds.dbInstanceEndpointAddress + ':' + rds.dbInstanceEndpointPort + '/redash';

    // ECS Cluster
    const ecsCluster = new Cluster(this, 'EcsCluster', {
      clusterName: 'redash-server-cluster',
      vpc: vpc,
    });

    // Task Definition
    const taskDefinition = new FargateTaskDefinition(this, 'TaskDefinition', {
      memoryLimitMiB: 2048,
      cpu: 256,
    });

    // Redash Container (for preview data)
    const redashContainerImage = ContainerImage.fromRegistry('redash/redash:latest');
    const redisUrl = 'redis://' + redis.attrPrimaryEndPointAddress + ':' + redis.attrPrimaryEndPointPort + '/0';
    const redashCookieSecret = StringParameter.valueFromLookup(this, 'REDASH_COOKIE_SECRET');

    // Redash - Server
    taskDefinition.addContainer('RedashServerContainer', {
      image: redashContainerImage,
      memoryLimitMiB: 2048,
      logging: new AwsLogDriver({
        logGroup: new LogGroup(this, 'RedashServerLogGroup', {
          logGroupName: 'redash-server',
          removalPolicy: RemovalPolicy.DESTROY,
        }),
        streamPrefix: 'redash-server',
      }),
      environment: {
        'PYTHONUNBUFFERED': '0',
        'REDASH_LOG_LEVEL': 'DEBUG',
        'REDASH_REDIS_URL': redisUrl,
        'REDASH_DATABASE_URL': dbUrl,
        'REDASH_COOKIE_SECRET': redashCookieSecret,
        'REDASH_PASSWORD_LOGIN_ENABLED': 'false',
        'REDASH_ALLOW_SCRIPTS_IN_USER_INPUT': 'true',
        'REDASH_DATE_FORMAT': 'YY/MM/DD',
      },
      command: ['server'],
    }).addPortMappings({
      hostPort: 5000,
      containerPort: 5000,
    });

    // ECS - Fargate
    const securityGroup = new SecurityGroup(this, 'EcsSg', {
        securityGroupName: 'EcsSecurityGroup',
        description: 'security group for Redash ECS Service',
        vpc: vpc,
        allowAllOutbound: true,
      }
    )
    securityGroup.addIngressRule(Peer.anyIpv4(), Port.tcp(5000), 'Redash Server Port', false);
    securityGroup.addEgressRule(Peer.anyIpv4(), Port.allTcp(), 'ECS Service Internet Access');

    const ecsService = new ApplicationLoadBalancedFargateService(this, 'ECSService', {
      cluster: ecsCluster,
      serviceName: 'redash-server',
      desiredCount: 1,
      taskDefinition: taskDefinition,
      publicLoadBalancer: true,
    });

    /*
    const ecsService = new FargateService(this, 'ECSService', {
      cluster: ecsCluster,
      serviceName: 'redash-server',
      desiredCount: 1,
      taskDefinition: taskDefinition,
      securityGroups: [securityGroup],
    });
     */

    // ServiceDiscovery
    const service = new Service(this, 'RedashService', {
      namespace: namespace,
      dnsRecordType: DnsRecordType.A_AAAA,
      dnsTtl: cdk.Duration.seconds(30),
      loadBalancer: true,
      name: 'redash',
    });

    // const alb = new ApplicationLoadBalancer(this, 'ALB', {
    //   loadBalancerName: 'redash',
    //   vpc: vpc,
    //   securityGroup: albSecurityGroup,
    //   internetFacing: true,
    // });
    //
    // const listener = alb.addListener('Listener', {port: 80});
    // listener.addTargets('Target', {
    //   targets: [ecsService],
    //   port: 5000,
    //   protocol: ApplicationProtocol.HTTP,
    //   healthCheck: {
    //     port: '5000',
    //     path: '/ping',
    //   }
    // });
    //
    // service.registerLoadBalancer('Lb', alb);

    // const albSecurityGroup = new SecurityGroup(this, 'ALBSg', {
    //     securityGroupName: 'ALBSecurityGroup',
    //     description: 'security group for Redash ALB',
    //     vpc: vpc,
    //     allowAllOutbound: true,
    //   }
    // )
    // albSecurityGroup.addEgressRule(Peer.anyIpv4(), Port.allTcp(), 'ALB Internet Access');
    // ecsService.loadBalancer.addSecurityGroup(albSecurityGroup);
    // ecsService.listener.addTargets('Target', {
    //   port: 5000,
    //   protocol: ApplicationProtocol.HTTP,
    //   healthCheck: {
    //     port: '5000',
    //     path: '/ping',
    //   }
    // });

    service.registerLoadBalancer('Lb', ecsService.loadBalancer);

    // tagging
    Tags.of(this).add('ServiceName', 'morningcode');
  }
}