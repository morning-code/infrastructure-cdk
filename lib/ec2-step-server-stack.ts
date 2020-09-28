import * as cdk from "@aws-cdk/core";
import {VpcStack} from "./vpc-stack";
import {CfnReplicationGroup} from "@aws-cdk/aws-elasticache";
import {
  AmazonLinuxImage,
  CfnInstance, Instance,
  InstanceClass,
  InstanceSize,
  InstanceType,
  Peer,
  Port,
  SecurityGroup, SubnetType
} from "@aws-cdk/aws-ec2";

export interface Ec2StepServerStackProps extends cdk.StackProps {
  vpcStack: VpcStack,
}

export class Ec2StepServerStack extends cdk.Stack {
  public readonly redis: CfnReplicationGroup;

  constructor(scope: cdk.Construct, id: string, props: Ec2StepServerStackProps) {
    super(scope, id, props);

    // VPC
    const vpc = props.vpcStack.vpc;

    // Security Group - RDS
    const cidrIp = '0.0.0.0/0';

    const securityGroup = new SecurityGroup(this, 'Ec2StepServerSg', {
        securityGroupName: 'Ec2StepServerSecurityGroup',
        description: 'security group for EC2 Step Server',
        vpc: vpc,
      }
    );
    securityGroup.addEgressRule(Peer.anyIpv4(), Port.allTraffic());
    securityGroup.addIngressRule(Peer.ipv4(cidrIp), Port.tcp(22));

    const ec2Instance = new Instance(this, 'Ec2StepServer', {
      vpc: vpc,
      vpcSubnets: {subnetType: SubnetType.PUBLIC},
      securityGroup: securityGroup,
      instanceName: 'step-server',
      machineImage: new AmazonLinuxImage(),
      instanceType: InstanceType.of(InstanceClass.T3, InstanceSize.MICRO),
      keyName: 'ec2-step-server',
    });

    // const ec2Instance2 = new CfnInstance(this, 'Ec2StepServer', {
    //   imageId: new AmazonLinuxImage().getImage(this).imageId,
    //   instanceType: InstanceType.of(InstanceClass.T3, InstanceSize.MICRO).toString(),
    //   networkInterfaces: [{
    //     associatePublicIpAddress: true,
    //     deviceIndex: '0',
    //     groupSet: [securityGroup.securityGroupId],
    //     subnetId: vpc.publicSubnets[0].subnetId
    //   }],
    //   keyName: 'ec2-step-server',
    // });

    new cdk.CfnOutput(this, 'PublicIp', {value: ec2Instance.instancePublicIp});
    new cdk.CfnOutput(this, 'PublicDnsName', {value: ec2Instance.instancePublicDnsName});
  }

}