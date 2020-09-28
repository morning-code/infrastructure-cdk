import * as cdk from '@aws-cdk/core';
import {VpcStack} from "./vpc-stack";
import {DnsRecordType, PrivateDnsNamespace} from "@aws-cdk/aws-servicediscovery";
import {IPrivateDnsNamespace} from "@aws-cdk/aws-servicediscovery/lib/private-dns-namespace";

export interface ServiceDiscoveryStackProps extends cdk.StackProps {
  vpcStack: VpcStack,
}

export class ServiceDiscoveryStack extends cdk.Stack {
  public readonly namespace: IPrivateDnsNamespace;

  constructor(scope: cdk.Construct, id: string, props: ServiceDiscoveryStackProps) {
    super(scope, id, props);

    // CloudMap
    this.namespace = new PrivateDnsNamespace(this, 'NameSpace', {
      name: 'internal.mornigcode.io',
      vpc: props.vpcStack.vpc,
    });
  }
}