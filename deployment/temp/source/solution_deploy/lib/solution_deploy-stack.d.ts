import * as cdk from '@aws-cdk/core';
import * as lambda from '@aws-cdk/aws-lambda';
export interface SHARRStackProps extends cdk.StackProps {
    solutionId: string;
    solutionVersion: string;
    solutionDistBucket: string;
    solutionTMN: string;
    solutionName: string;
    runtimePython: lambda.Runtime;
    orchLogGroup: string;
}
export declare class SolutionDeployStack extends cdk.Stack {
    SEND_ANONYMOUS_DATA: string;
    constructor(scope: cdk.App, id: string, props: SHARRStackProps);
}
