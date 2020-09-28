import * as cdk from '@aws-cdk/core';
import * as ec2 from '@aws-cdk/aws-ec2';
import {Tags} from '@aws-cdk/core';

export class VpcStack extends cdk.Stack {
  public readonly vpc: ec2.IVpc

  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    // VPC
    this.vpc = new ec2.Vpc(this, 'Vpc', {
      maxAzs: 2,
      cidr: '10.0.0.0/16',
      enableDnsHostnames: true,
      enableDnsSupport: true,
    });

    /*
    // InternetGateway
    const internetGateway = new ec2.CfnInternetGateway(this, 'InternetGateway', {});
    new ec2.CfnVPCGatewayAttachment(this, 'InternetGw', {
      vpcId: this.vpc.vpcId,
      internetGatewayId: internetGateway.ref
    });

    // Public Subnet
    new ec2.Subnet(this, 'PublicSubnet1a', {
      availabilityZone: 'ap-northeast-1a',
      vpcId: this.vpc.vpcId,
      cidrBlock: '10.0.0.0/24'
    }).addRoute('PublicSubnetRoute', {
      routerType: ec2.RouterType.GATEWAY,
      routerId: internetGateway.ref
    });
     */

    Tags.of(this).add('ServiceName', 'morningcode');
  }
}