import * as cdk from '@aws-cdk/core';
import {Duration, RemovalPolicy, SecretValue, Tags} from '@aws-cdk/core';
import {InstanceClass, InstanceSize, InstanceType, Peer, Port, SecurityGroup} from '@aws-cdk/aws-ec2';
import {DatabaseInstance, DatabaseInstanceEngine, PostgresEngineVersion, StorageType} from '@aws-cdk/aws-rds';
import {VpcStack} from "./vpc-stack";
import {IDatabaseInstance} from "@aws-cdk/aws-rds/lib/instance";
import {StringParameter} from "@aws-cdk/aws-ssm";

export interface RedashRdsStackProps extends cdk.StackProps {
  vpcStack: VpcStack,
}

export class RedashRdsStack extends cdk.Stack {
  public readonly rds: IDatabaseInstance

  constructor(scope: cdk.Construct, id: string, props: RedashRdsStackProps) {
    super(scope, id, props);

    // VPC
    const vpc = props.vpcStack.vpc;

    // Security Group - RDS
    const rdsSecurityGroup = new SecurityGroup(this, 'DbSg', {
        securityGroupName: 'DBSecurityGroup',
        description: 'security group for SonarQube RDS',
        vpc: vpc,
        allowAllOutbound: true,
      }
    )
    rdsSecurityGroup.addIngressRule(Peer.anyIpv4(), Port.tcp(5000), 'Redash Server Port', false);
    rdsSecurityGroup.addIngressRule(Peer.anyIpv4(), Port.tcp(5432), 'Redash Postgres Port', false);

    // RDS
    const databaseName = 'redash'
    const dbPassword = SecretValue.plainText(StringParameter.valueFromLookup(this, 'REDASH_DB_PASSWORD'));

    this.rds = new DatabaseInstance(this, 'RedashDB', {
      vpc: vpc,
      securityGroups: [rdsSecurityGroup],
      instanceIdentifier: 'redash-db',
      instanceType: InstanceType.of(InstanceClass.T3, InstanceSize.MICRO),
      masterUsername: 'root',
      masterUserPassword: dbPassword,
      engine: DatabaseInstanceEngine.postgres({
        version: PostgresEngineVersion.VER_12,
      }),
      databaseName: databaseName,
      iamAuthentication: true,
      enablePerformanceInsights: true,
      autoMinorVersionUpgrade: true,
      multiAz: false,
      backupRetention: Duration.days(7),
      deletionProtection: false,
      port: 5432,
      removalPolicy: RemovalPolicy.DESTROY,
      storageType: StorageType.GP2,
    });

    this.rds.connections.allowDefaultPortFrom(rdsSecurityGroup);

    // tagging
    Tags.of(this).add('ServiceName', 'morningcode');
  }
}