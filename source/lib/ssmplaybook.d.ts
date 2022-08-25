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
import { Policy } from '@aws-cdk/aws-iam';
export interface IssmPlaybookProps {
    securityStandard: string;
    securityStandardVersion: string;
    controlId: string;
    ssmDocPath: string;
    ssmDocFileName: string;
    solutionVersion: string;
    solutionDistBucket: string;
    adminRoleName?: string;
    remediationPolicy?: Policy;
    adminAccountNumber?: string;
    solutionId: string;
    scriptPath?: string;
    commonScripts?: string;
}
export declare class SsmPlaybook extends cdk.Construct {
    constructor(scope: cdk.Construct, id: string, props: IssmPlaybookProps);
}
export interface ITriggerProps {
    description?: string;
    securityStandard: string;
    generatorId: string;
    controlId: string;
    targetArn: string;
}
export declare class Trigger extends cdk.Construct {
    constructor(scope: cdk.Construct, id: string, props: ITriggerProps);
}
export interface IOneTriggerProps {
    description?: string;
    targetArn: string;
    serviceToken: string;
    prereq: cdk.CfnResource[];
}
export declare class OneTrigger extends cdk.Construct {
    constructor(scope: cdk.Construct, id: string, props: IOneTriggerProps);
}
export interface RoleProps {
    readonly solutionId: string;
    readonly ssmDocName: string;
    readonly remediationPolicy: Policy;
    readonly remediationRoleName: string;
}
export declare class SsmRole extends cdk.Construct {
    constructor(scope: cdk.Construct, id: string, props: RoleProps);
}
export interface RemediationRunbookProps {
    ssmDocName: string;
    ssmDocPath: string;
    ssmDocFileName: string;
    solutionVersion: string;
    solutionDistBucket: string;
    remediationPolicy?: Policy;
    solutionId: string;
    scriptPath?: string;
}
export declare class SsmRemediationRunbook extends cdk.Construct {
    constructor(scope: cdk.Construct, id: string, props: RemediationRunbookProps);
}
