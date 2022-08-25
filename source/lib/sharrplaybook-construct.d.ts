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
export interface IControl {
    control: string;
    executes?: string;
}
export interface PlaybookProps {
    description: string;
    solutionId: string;
    solutionVersion: string;
    solutionDistBucket: string;
    solutionDistName: string;
    remediations: IControl[];
    securityStandard: string;
    securityStandardLongName: string;
    securityStandardVersion: string;
}
export declare class PlaybookPrimaryStack extends cdk.Stack {
    constructor(scope: cdk.Construct, id: string, props: PlaybookProps);
}
export interface MemberStackProps {
    description: string;
    solutionId: string;
    solutionVersion: string;
    solutionDistBucket: string;
    securityStandard: string;
    securityStandardVersion: string;
    securityStandardLongName: string;
    ssmdocs?: string;
    commonScripts?: string;
    remediations: IControl[];
}
export declare class PlaybookMemberStack extends cdk.Stack {
    constructor(scope: cdk.App, id: string, props: MemberStackProps);
}
