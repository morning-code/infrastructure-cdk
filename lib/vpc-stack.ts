import * as cdk from '@aws-cdk/core';
import * as ec2 from '@aws-cdk/aws-ec2';
import {Tags} from "@aws-cdk/core";

export class VpcStack extends cdk.Stack {
  public vpc: ec2.IVpc

  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    // VPC
    this.vpc = new ec2.Vpc(this, 'Vpc', {
      maxAzs: 2,
      cidr: '10.0.0.0/16',
    });

    Tags.of(this).add('ServiceName', 'morning-code');
  }
}