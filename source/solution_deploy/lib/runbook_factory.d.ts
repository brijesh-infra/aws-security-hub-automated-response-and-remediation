#!/usr/bin/env node
/******************************************************************************
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.        *
 *                                                                            *
 *  Licensed under the Apache License, Version 2.0 (the "License"). You may   *
 *  not use this file except in compliance with the License. A copy of the    *
 *  License is located at                                                     *
 *                                                                            *
 *      http://www.apache.org/licenses/LICENSE-2.0                            *
 *                                                                            *
 *  or in the 'license' file accompanying this file. This file is distributed *
 *  on an 'AS IS' BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND,        *
 *  express or implied. See the License for the specific language governing   *
 *  permissions and limitations under the License.                            *
 *****************************************************************************/
import { IssmPlaybookProps, RemediationRunbookProps } from '../../lib/ssmplaybook';
import * as lambda from '@aws-cdk/aws-lambda';
import * as cdk from '@aws-cdk/core';
export interface RunbookFactoryProps {
    solutionId: string;
    runtimePython: lambda.Runtime;
    solutionDistBucket: string;
    solutionTMN: string;
    solutionVersion: string;
    region: string;
    partition: string;
}
export declare class RunbookFactory extends cdk.Construct {
    constructor(scope: cdk.Construct, id: string, props: RunbookFactoryProps);
    static getLambdaFunctionName(solutionId: string): string;
    static getServiceToken(scope: cdk.Construct, solutionId: string): string;
    static getResourceType(): string;
    static createControlRunbook(scope: cdk.Construct, id: string, props: IssmPlaybookProps): cdk.CustomResource;
    static createRemediationRunbook(scope: cdk.Construct, id: string, props: RemediationRunbookProps): cdk.CustomResource;
}
