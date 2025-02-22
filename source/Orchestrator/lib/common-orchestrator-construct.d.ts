#!/usr/bin/env node
/*****************************************************************************
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.   *
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
import * as cdk from '@aws-cdk/core';
import { StringParameter } from '@aws-cdk/aws-ssm';
export interface ConstructProps {
    roleArn: string;
    ssmDocStateLambda: string;
    ssmExecDocLambda: string;
    ssmExecMonitorLambda: string;
    notifyLambda: string;
    getApprovalRequirementLambda: string;
    solutionId: string;
    solutionName: string;
    solutionVersion: string;
    orchLogGroup: string;
    kmsKeyParm: StringParameter;
}
export declare class OrchestratorConstruct extends cdk.Construct {
    readonly orchArnParm: StringParameter;
    constructor(scope: cdk.Construct, id: string, props: ConstructProps);
}
