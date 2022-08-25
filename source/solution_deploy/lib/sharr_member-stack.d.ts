#!/usr/bin/env node
import * as cdk from '@aws-cdk/core';
import * as lambda from '@aws-cdk/aws-lambda';
export interface SolutionProps {
    description: string;
    solutionId: string;
    solutionDistBucket: string;
    solutionTMN: string;
    solutionVersion: string;
    runtimePython: lambda.Runtime;
}
export declare class MemberStack extends cdk.Stack {
    constructor(scope: cdk.App, id: string, props: SolutionProps);
}
