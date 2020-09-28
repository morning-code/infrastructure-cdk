import * as cdk from '@aws-cdk/core';
import {Duration, RemovalPolicy, SecretValue, Tags} from '@aws-cdk/core';
import {InstanceClass, InstanceSize, InstanceType, Peer, Port, SecurityGroup} from '@aws-cdk/aws-ec2';
import {DatabaseInstance, DatabaseInstanceEngine, PostgresEngineVersion, StorageType} from '@aws-cdk/aws-rds';
import {VpcStack} from "./vpc-stack";
import {IDatabaseInstance} from "@aws-cdk/aws-rds/lib/instance";
import {StringParameter} from "@aws-cdk/aws-ssm";
import {CfnReplicationGroup, CfnSubnetGroup} from "@aws-cdk/aws-elasticache";

export interface RedashElastiCacheStackProps extends cdk.StackProps {
  vpcStack: VpcStack,
}

export class RedashElastiCacheStack extends cdk.Stack {
  public readonly redis: CfnReplicationGroup;

  constructor(scope: cdk.Construct, id: string, props: RedashElastiCacheStackProps) {
    super(scope, id, props);

    // VPC
    const vpc = props.vpcStack.vpc;
    // Security Group - RDS
    const securityGroup = new SecurityGroup(this, 'RedisSg', {
        securityGroupName: 'RedisSecurityGroup',
        description: 'security group for Redash Redis',
        vpc: vpc,
        allowAllOutbound: true,
      }
    )
    securityGroup.addIngressRule(Peer.anyIpv4(), Port.tcp(6379), 'Redash Redis Port', false);

    // Subnet
    const subnetGroup = new CfnSubnetGroup(this, 'RedisSubnetGroup', {
      description: 'Redash Redis SubnetGroup',
      subnetIds: vpc.privateSubnets.map(subnet => subnet.subnetId),
      cacheSubnetGroupName: 'redash-redis-subnet-group',
    });

    // ElastiCache
    this.redis = new CfnReplicationGroup(this, 'ElastiCache', {
      replicationGroupId: 'redash-redis-cluster',
      replicationGroupDescription: 'Redis for Redash',
      cacheNodeType: 'cache.t2.micro',
      engine: 'redis',
      numCacheClusters: 1,
      automaticFailoverEnabled: false,
      autoMinorVersionUpgrade: false,
      port: 6379,
      securityGroupIds: [
        securityGroup.securityGroupId,
      ],
      cacheSubnetGroupName: subnetGroup.cacheSubnetGroupName,
      snapshotWindow: '02:00-04:00', // 11:00 - 13:00 JST
      snapshotRetentionLimit: 7,
    });

    // tagging
    Tags.of(this).add('ServiceName', 'morningcode');
  }
}