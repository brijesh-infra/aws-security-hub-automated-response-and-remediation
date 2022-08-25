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
import { OrchestratorMemberRole } from '../../lib/orchestrator_roles-construct';
export interface MemberRoleStackProps {
    readonly description: string;
    readonly solutionId: string;
    readonly solutionVersion: string;
    readonly solutionDistBucket: string;
}
export declare class MemberRoleStack extends cdk.Stack {
    _orchestratorMemberRole: OrchestratorMemberRole;
    constructor(scope: cdk.App, id: string, props: MemberRoleStackProps);
    getOrchestratorMemberRole(): OrchestratorMemberRole;
}
export interface StackProps {
    readonly description: string;
    readonly solutionId: string;
    readonly solutionVersion: string;
    readonly solutionDistBucket: string;
    ssmdocs?: string;
    roleStack: MemberRoleStack;
}
export declare class RemediationRunbookStack extends cdk.Stack {
    constructor(scope: cdk.App, id: string, props: StackProps);
}
