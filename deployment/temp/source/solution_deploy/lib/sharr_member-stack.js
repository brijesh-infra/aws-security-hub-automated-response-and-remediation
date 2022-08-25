#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemberStack = void 0;
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
const cdk_nag = require("cdk-nag");
const cdk = require("@aws-cdk/core");
const fs = require("fs");
const admin_account_parm_construct_1 = require("../../lib/admin_account_parm-construct");
const aws_ssm_1 = require("@aws-cdk/aws-ssm");
const s3 = require("@aws-cdk/aws-s3");
const aws_kms_1 = require("@aws-cdk/aws-kms");
const aws_iam_1 = require("@aws-cdk/aws-iam");
const runbook_factory_1 = require("./runbook_factory");
const core_1 = require("@aws-cdk/core");
class MemberStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        const stack = cdk.Stack.of(this);
        const RESOURCE_PREFIX = props.solutionId.replace(/^DEV-/, ''); // prefix on every resource name
        const adminAccount = new admin_account_parm_construct_1.AdminAccountParm(this, 'AdminAccountParameter', {
            solutionId: props.solutionId
        });
        //Create a new parameter to track Redshift.4 S3 bucket
        const createS3BucketForRedshift4 = new cdk.CfnParameter(this, 'CreateS3BucketForRedshiftAuditLogging', {
            description: "Create S3 Bucket For Redshift Cluster Audit Logging.",
            type: "String",
            allowedValues: ["yes", "no"],
            default: "no"
        });
        const enableS3BucketForRedShift4 = new cdk.CfnCondition(this, "EnableS3BucketForRedShift4", {
            expression: cdk.Fn.conditionEquals(createS3BucketForRedshift4.valueAsString, 'yes')
        });
        //Create the S3 Bucket for Redshift.4
        const s3BucketForAuditLogging = new s3.Bucket(this, "S3BucketForRedShiftAuditLogging", {
            encryption: s3.BucketEncryption.S3_MANAGED,
            publicReadAccess: false,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
        });
        cdk_nag.NagSuppressions.addResourceSuppressions(s3BucketForAuditLogging, [
            { id: 'AwsSolutions-S1', reason: 'This is a logging bucket.' }
        ]);
        const bucketPolicy = new s3.BucketPolicy(this, 'S3BucketForRedShiftAuditLoggingBucketPolicy', {
            bucket: s3BucketForAuditLogging,
            removalPolicy: core_1.RemovalPolicy.RETAIN
        });
        bucketPolicy.document.addStatements(new aws_iam_1.PolicyStatement({
            sid: 'Put bucket policy needed for audit logging',
            effect: aws_iam_1.Effect.ALLOW,
            actions: [
                "s3:GetBucketAcl",
                "s3:PutObject"
            ],
            principals: [new aws_iam_1.ServicePrincipal('redshift.amazonaws.com')],
            resources: [
                s3BucketForAuditLogging.bucketArn,
                cdk.Fn.sub("arn:${AWS::Partition}:s3:::${BucketName}/*", {
                    BucketName: `${s3BucketForAuditLogging.bucketName}`
                })
            ]
        }));
        const bucketPolicy_cfn_ref = bucketPolicy.node.defaultChild;
        bucketPolicy_cfn_ref.cfnOptions.condition = enableS3BucketForRedShift4;
        const s3BucketForAuditLogging_cfn_ref = s3BucketForAuditLogging.node.defaultChild;
        s3BucketForAuditLogging_cfn_ref.cfnOptions.metadata = {
            cfn_nag: {
                rules_to_suppress: [{
                        id: 'W35',
                        reason: 'Logs bucket does not require logging configuration'
                    }]
            }
        };
        cdk_nag.NagSuppressions.addResourceSuppressions(s3BucketForAuditLogging, [
            { id: 'AwsSolutions-S1', reason: 'Logs bucket does not require logging configuration' },
            { id: 'AwsSolutions-S10', reason: 'Secure transport requirement is redundant for this use case' }
        ]);
        cdk_nag.NagSuppressions.addResourceSuppressions(bucketPolicy, [
            { id: 'AwsSolutions-S10', reason: 'Secure transport requirement is redundant for this use case' }
        ]);
        s3BucketForAuditLogging_cfn_ref.cfnOptions.condition = enableS3BucketForRedShift4;
        bucketPolicy_cfn_ref.addDependsOn(s3BucketForAuditLogging_cfn_ref);
        //--------------------------
        // KMS Customer Managed Key
        // Key Policy
        const kmsKeyPolicy = new aws_iam_1.PolicyDocument();
        const kmsPerms = new aws_iam_1.PolicyStatement();
        kmsPerms.addActions('kms:GenerateDataKey', 'kms:GenerateDataKeyPair', 'kms:GenerateDataKeyPairWithoutPlaintext', 'kms:GenerateDataKeyWithoutPlaintext', 'kms:Decrypt', 'kms:Encrypt', 'kms:ReEncryptFrom', 'kms:ReEncryptTo', 'kms:DescribeKey', 'kms:DescribeCustomKeyStores');
        kmsPerms.effect = aws_iam_1.Effect.ALLOW;
        kmsPerms.addResources("*"); // Only the key the policydocument is attached to
        kmsPerms.addPrincipals(new aws_iam_1.ServicePrincipal('sns.amazonaws.com'));
        kmsPerms.addPrincipals(new aws_iam_1.ServicePrincipal('s3.amazonaws.com'));
        kmsPerms.addPrincipals(new aws_iam_1.ServicePrincipal(`logs.${stack.urlSuffix}`));
        kmsPerms.addPrincipals(new aws_iam_1.ServicePrincipal(`logs.${stack.region}.${stack.urlSuffix}`));
        kmsPerms.addPrincipals(new aws_iam_1.ServicePrincipal(`cloudtrail.${stack.urlSuffix}`));
        kmsPerms.addPrincipals(new aws_iam_1.ServicePrincipal('cloudwatch.amazonaws.com'));
        kmsKeyPolicy.addStatements(kmsPerms);
        const kmsKey = new aws_kms_1.Key(this, 'SHARR Remediation Key', {
            enableKeyRotation: true,
            alias: `${RESOURCE_PREFIX}-SHARR-Remediation-Key`,
            trustAccountIdentities: true,
            policy: kmsKeyPolicy
        });
        new aws_ssm_1.StringParameter(this, 'SHARR Key Alias', {
            description: 'KMS Customer Managed Key that will encrypt data for remediations',
            parameterName: `/Solutions/${RESOURCE_PREFIX}/CMK_REMEDIATION_ARN`,
            stringValue: kmsKey.keyArn
        });
        new aws_ssm_1.StringParameter(this, 'SHARR Member Version', {
            description: 'Version of the AWS Security Hub Automated Response and Remediation solution',
            parameterName: `/Solutions/${RESOURCE_PREFIX}/member-version`,
            stringValue: props.solutionVersion
        });
        /********************
        ** Parameters
        ********************/
        const logGroupName = new cdk.CfnParameter(this, "LogGroupName", {
            type: "String",
            description: "Name of the log group to be used to create metric filters and cloudwatch alarms. You must use a Log Group that is the the logging destination of a multi-region CloudTrail"
        });
        /*********************************************
        ** Create SSM Parameter to store log group name
        *********************************************/
        new aws_ssm_1.StringParameter(stack, 'SSMParameterLogGroupName', {
            description: 'Parameter to store log group name',
            parameterName: `/Solutions/${RESOURCE_PREFIX}/Metrics_LogGroupName`,
            stringValue: logGroupName.valueAsString
        });
        /*********************************************
        ** Create SSM Parameter to store encryption key alias for the PCI.S3.4/AFSBP.S3.4
        *********************************************/
        new aws_ssm_1.StringParameter(stack, 'SSMParameterForS3.4EncryptionKeyAlias', {
            description: 'Parameter to store encryption key alias for the PCI.S3.4/AFSBP.S3.4, replace the default value with the KMS Key Alias, other wise the remediation will enable the default AES256 encryption for the bucket.',
            parameterName: `/Solutions/${RESOURCE_PREFIX}/afsbp/1.0.0/S3.4/KmsKeyAlias`,
            stringValue: 'default-s3-encryption'
        });
        /*********************************************
        ** Create SSM Parameter to store the S3 bucket name for AFSBP.REDSHIFT.4
        *********************************************/
        const ssmParameterForRedshift4BucketName = new aws_ssm_1.StringParameter(stack, 'SSMParameterForS3BucketNameForREDSHIFT4', {
            description: 'Parameter to store the S3 bucket name for the remediation AFSBP.REDSHIFT.4, the default value is bucket-name which has to be updated by the user before using the remediation.',
            parameterName: `/Solutions/${props.solutionId}/afsbp/1.0.0/REDSHIFT.4/S3BucketNameForAuditLogging`,
            stringValue: s3BucketForAuditLogging.bucketName
        });
        const ssmParameterForRedshift4BucketName_cfn_ref = ssmParameterForRedshift4BucketName.node.defaultChild;
        ssmParameterForRedshift4BucketName_cfn_ref.cfnOptions.condition = enableS3BucketForRedShift4;
        ssmParameterForRedshift4BucketName_cfn_ref.addDependsOn(s3BucketForAuditLogging_cfn_ref);
        new cdk.CfnMapping(this, 'SourceCode', {
            mapping: { "General": {
                    "S3Bucket": props.solutionDistBucket,
                    "KeyPrefix": props.solutionTMN + '/' + props.solutionVersion
                } }
        });
        const runbookFactory = new runbook_factory_1.RunbookFactory(this, 'RunbookProvider', {
            solutionId: props.solutionId,
            runtimePython: props.runtimePython,
            solutionDistBucket: props.solutionDistBucket,
            solutionTMN: props.solutionTMN,
            solutionVersion: props.solutionVersion,
            region: this.region,
            partition: this.partition
        });
        //-------------------------------------------------------------------------
        // Runbooks - shared automations
        //
        const runbookStack = new cdk.CfnStack(this, `RunbookStackNoRoles`, {
            templateUrl: "https://" + cdk.Fn.findInMap("SourceCode", "General", "S3Bucket") +
                "-reference.s3.amazonaws.com/" + cdk.Fn.findInMap("SourceCode", "General", "KeyPrefix") +
                "/aws-sharr-remediations.template"
        });
        runbookStack.node.addDependency(runbookFactory);
        //-------------------------------------------------------------------------
        // Loop through all of the Playbooks to create reference
        //
        const PB_DIR = `${__dirname}/../../playbooks`;
        const ignore = ['.DS_Store', 'common', '.pytest_cache', 'NEWPLAYBOOK', '.coverage'];
        const illegalChars = /[\._]/g;
        const listOfPlaybooks = [];
        fs.readdir(PB_DIR, (err, items) => {
            items.forEach((file) => {
                if (!ignore.includes(file)) {
                    const templateFile = `${file}MemberStack.template`;
                    //---------------------------------------------------------------------
                    // Playbook Member Template Nested Stack
                    //
                    const parmname = file.replace(illegalChars, '');
                    const memberStackOption = new cdk.CfnParameter(this, `LoadMemberStack${parmname}`, {
                        type: "String",
                        description: `Load Playbook member stack for ${file}?`,
                        default: "yes",
                        allowedValues: ["yes", "no"]
                    });
                    memberStackOption.overrideLogicalId(`Load${parmname}MemberStack`);
                    listOfPlaybooks.push(memberStackOption.logicalId);
                    const memberStack = new cdk.CfnStack(this, `PlaybookMemberStack${file}`, {
                        parameters: {
                            'SecHubAdminAccount': adminAccount.adminAccountNumber.valueAsString
                        },
                        templateUrl: "https://" + cdk.Fn.findInMap("SourceCode", "General", "S3Bucket") +
                            "-reference.s3.amazonaws.com/" + cdk.Fn.findInMap("SourceCode", "General", "KeyPrefix") +
                            "/playbooks/" + templateFile
                    });
                    memberStack.node.addDependency(runbookFactory);
                    memberStack.cfnOptions.condition = new cdk.CfnCondition(this, `load${file}Cond`, {
                        expression: cdk.Fn.conditionEquals(memberStackOption, "yes")
                    });
                }
            });
        });
        /********************
        ** Metadata
        ********************/
        stack.templateOptions.metadata = {
            "AWS::CloudFormation::Interface": {
                ParameterGroups: [
                    {
                        Label: { default: "LogGroup Configuration" },
                        Parameters: [logGroupName.logicalId]
                    },
                    {
                        Label: { default: "Playbooks" },
                        Parameters: listOfPlaybooks
                    }
                ],
                ParameterLabels: {
                    [logGroupName.logicalId]: {
                        default: "Provide the name of the LogGroup to be used to create Metric Filters and Alarms",
                    }
                }
            }
        };
    }
}
exports.MemberStack = MemberStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2hhcnJfbWVtYmVyLXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsic2hhcnJfbWVtYmVyLXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7QUFDQTs7Ozs7Ozs7Ozs7OzsrRUFhK0U7QUFDL0UsbUNBQW1DO0FBQ25DLHFDQUFxQztBQUNyQyx5QkFBeUI7QUFDekIseUZBQTBFO0FBQzFFLDhDQUFtRDtBQUVuRCxzQ0FBc0M7QUFDdEMsOENBQXVDO0FBQ3ZDLDhDQUswQjtBQUMxQix1REFBbUQ7QUFFbkQsd0NBQThDO0FBVzlDLE1BQWEsV0FBWSxTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBQ3hDLFlBQVksS0FBYyxFQUFFLEVBQVUsRUFBRSxLQUFvQjtRQUMxRCxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUN4QixNQUFNLEtBQUssR0FBRyxHQUFHLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUNqQyxNQUFNLGVBQWUsR0FBRyxLQUFLLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxnQ0FBZ0M7UUFFL0YsTUFBTSxZQUFZLEdBQUcsSUFBSSwrQ0FBZ0IsQ0FBQyxJQUFJLEVBQUUsdUJBQXVCLEVBQUU7WUFDdkUsVUFBVSxFQUFFLEtBQUssQ0FBQyxVQUFVO1NBQzdCLENBQUMsQ0FBQztRQUVILHNEQUFzRDtRQUN0RCxNQUFNLDBCQUEwQixHQUFHLElBQUksR0FBRyxDQUFDLFlBQVksQ0FBQyxJQUFJLEVBQUUsdUNBQXVDLEVBQUU7WUFDckcsV0FBVyxFQUFFLHNEQUFzRDtZQUNuRSxJQUFJLEVBQUUsUUFBUTtZQUNkLGFBQWEsRUFBQyxDQUFDLEtBQUssRUFBRSxJQUFJLENBQUM7WUFDM0IsT0FBTyxFQUFFLElBQUk7U0FDZCxDQUFDLENBQUM7UUFFSCxNQUFNLDBCQUEwQixHQUFHLElBQUksR0FBRyxDQUFD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QUMsU0FBUyxDQUFDO3FCQUNyQztvQkFDRDt3QkFDRSxLQUFLLEVBQUUsRUFBQyxPQUFPLEVBQUUsV0FBVyxFQUFDO3dCQUM3QixVQUFVLEVBQUUsZUFBZTtxQkFDNUI7aUJBQ0Y7Z0JBQ0QsZUFBZSxFQUFFO29CQUNmLENBQUMsWUFBWSxDQUFDLFNBQVMsQ0FBQyxFQUFFO3dCQUN4QixPQUFPLEVBQUUsaUZBQWlGO3FCQUMzRjtpQkFDRjthQUNGO1NBQ0YsQ0FBQztJQUNKLENBQUM7Q0FDRjtBQXZRRCxrQ0F1UUMiLCJzb3VyY2VzQ29udGVudCI6WyIjIS91c3IvYmluL2VudiBub2RlXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAqICBDb3B5cmlnaHQgQW1hem9uLmNvbSwgSW5jLiBvciBpdHMgYWZmaWxpYXRlcy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC4gICAqXG4gKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAqXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZSBMaWNlbnNlLCBWZXJzaW9uIDIuMCAodGhlIFwiTGljZW5zZVwiKS4gWW91IG1heSAgICpcbiAqICBub3QgdXNlIHRoaXMgZmlsZSBleGNlcHQgaW4gY29tcGxpYW5jZSB3aXRoIHRoZSBMaWNlbnNlLiBBIGNvcHkgb2YgdGhlICAgICpcbiAqICBMaWNlbnNlIGlzIGxvY2F0ZWQgYXQgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICpcbiAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICpcbiAqICAgICAgaHR0cDovL3d3dy5hcGFjaGUub3JnL2xpY2Vuc2VzL0xJQ0VOU0UtMi4wICAgICAgICAgICAgICAgICAgICAgICAgICAgICpcbiAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICpcbiAqICBvciBpbiB0aGUgJ2xpY2Vuc2UnIGZpbGUgYWNjb21wYW55aW5nIHRoaXMgZmlsZS4gVGhpcyBmaWxlIGlzIGRpc3RyaWJ1dGVkICpcbiAqICBvbiBhbiAnQVMgSVMnIEJBU0lTLCBXSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTlkgS0lORCwgICAgICAgICpcbiAqICBleHByZXNzIG9yIGltcGxpZWQuIFNlZSB0aGUgTGljZW5zZSBmb3IgdGhlIHNwZWNpZmljIGxhbmd1YWdlIGdvdmVybmluZyAgICpcbiAqICBwZXJtaXNzaW9ucyBhbmQgbGltaXRhdGlvbnMgdW5kZXIgdGhlIExpY2Vuc2UuICAgICAgICAgICAgICAgICAgICAgICAgICAgICpcbiAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cbmltcG9ydCAqIGFzIGNka19uYWcgZnJvbSAnY2RrLW5hZyc7XG5pbXBvcnQgKiBhcyBjZGsgZnJvbSAnQGF3cy1jZGsvY29yZSc7XG5pbXBvcnQgKiBhcyBmcyBmcm9tICdmcyc7XG5pbXBvcnQgeyBBZG1pbkFjY291bnRQYXJtIH0gZnJvbSAnLi4vLi4vbGliL2FkbWluX2FjY291bnRfcGFybS1jb25zdHJ1Y3QnO1xuaW1wb3J0IHsgU3RyaW5nUGFyYW1ldGVyIH0gZnJvbSAnQGF3cy1jZGsvYXdzLXNzbSc7XG5pbXBvcnQgKiBhcyBzc20gZnJvbSAnQGF3cy1jZGsvYXdzLXNzbSc7XG5pbXBvcnQgKiBhcyBzMyBmcm9tICdAYXdzLWNkay9hd3MtczMnO1xuaW1wb3J0IHsgS2V5IH0gZnJvbSAnQGF3cy1jZGsvYXdzLWttcyc7XG5pbXBvcnQge1xuICBQb2xpY3lTdGF0ZW1lbnQsXG4gIEVmZmVjdCxcbiAgUG9saWN5RG9jdW1lbnQsXG4gIFNlcnZpY2VQcmluY2lwYWxcbn0gZnJvbSAnQGF3cy1jZGsvYXdzLWlhbSc7XG5pbXBvcnQgeyBSdW5ib29rRmFjdG9yeSB9IGZyb20gJy4vcnVuYm9va19mYWN0b3J5JztcbmltcG9ydCAqIGFzIGxhbWJkYSBmcm9tICdAYXdzLWNkay9hd3MtbGFtYmRhJztcbmltcG9ydCB7IFJlbW92YWxQb2xpY3kgfSBmcm9tICdAYXdzLWNkay9jb3JlJztcblxuZXhwb3J0IGludGVyZmFjZSBTb2x1dGlvblByb3BzIHtcbiAgZGVzY3JpcHRpb246IHN0cmluZztcbiAgc29sdXRpb25JZDogc3RyaW5nO1xuICBzb2x1dGlvbkRpc3RCdWNrZXQ6IHN0cmluZztcbiAgc29sdXRpb25UTU46IHN0cmluZztcbiAgc29sdXRpb25WZXJzaW9uOiBzdHJpbmc7XG4gIHJ1bnRpbWVQeXRob246IGxhbWJkYS5SdW50aW1lO1xufVxuXG5leHBvcnQgY2xhc3MgTWVtYmVyU3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xuICBjb25zdHJ1Y3RvcihzY29wZTogY2RrLkFwcCwgaWQ6IHN0cmluZywgcHJvcHM6IFNvbHV0aW9uUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcbiAgICBjb25zdCBzdGFjayA9IGNkay5TdGFjay5vZih0aGlzKTtcbiAgICBjb25zdCBSRVNPVVJDRV9QUkVGSVggPSBwcm9wcy5zb2x1dGlvbklkLnJlcGxhY2UoL15ERVYtLywgJycpOyAvLyBwcmVmaXggb24gZXZlcnkgcmVzb3VyY2UgbmFtZVxuXG4gICAgY29uc3QgYWRtaW5BY2NvdW50ID0gbmV3IEFkbWluQWNjb3VudFBhcm0odGhpcywgJ0FkbWluQWNjb3VudFBhcmFtZXRlcicsIHtcbiAgICAgIHNvbHV0aW9uSWQ6IHByb3BzLnNvbHV0aW9uSWRcbiAgICB9KTtcblxuICAgIC8vQ3JlYXRlIGEgbmV3IHBhcmFtZXRlciB0byB0cmFjayBSZWRzaGlmdC40IFMzIGJ1Y2tldFxuICAgIGNvbnN0IGNyZWF0ZVMzQnVja2V0Rm9yUmVkc2hpZnQ0ID0gbmV3IGNkay5DZm5QYXJhbWV0ZXIodGhpcywgJ0NyZWF0ZVMzQnVja2V0Rm9yUmVkc2hpZnRBdWRpdExvZ2dpbmcnLCB7XG4gICAgICBkZXNjcmlwdGlvbjogXCJDcmVhdGUgUzMgQnVja2V0IEZvciBSZWRzaGlmdCBDbHVzdGVyIEF1ZGl0IExvZ2dpbmcuXCIsXG4gICAgICB0eXBlOiBcIlN0cmluZ1wiLFxuICAgICAgYWxsb3dlZFZhbHVlczpbXCJ5ZXNcIiwgXCJub1wiXSxcbiAgICAgIGRlZmF1bHQ6IFwibm9cIlxuICAgIH0pO1xuXG4gICAgY29uc3QgZW5hYmxlUzNCdWNrZXRGb3JSZWRTaGlmdDQgPSBuZXcgY2RrLkNmbkNvbmRpdGlvbih0aGlzLFxuICAgICAgXCJFbmFibGVTM0J1Y2tldEZvclJlZFNoaWZ0NFwiLFxuICAgICAge1xuICAgICAgICBleHByZXNzaW9uOiBjZGsuRm4uY29uZGl0aW9uRXF1YWxzKGNyZWF0ZVMzQnVja2V0Rm9yUmVkc2hpZnQ0LnZhbHVlQXNTdHJpbmcsICd5ZXMnKVxuICAgICAgfSlcblxuICAgIC8vQ3JlYXRlIHRoZSBTMyBCdWNrZXQgZm9yIFJlZHNoaWZ0LjRcblxuICAgIGNvbnN0IHMzQnVja2V0Rm9yQXVkaXRMb2dnaW5nID0gbmV3IHMzLkJ1Y2tldCh0aGlzLCBcIlMzQnVja2V0Rm9yUmVkU2hpZnRBdWRpdExvZ2dpbmdcIiwge1xuICAgICAgZW5jcnlwdGlvbjogczMuQnVja2V0RW5jcnlwdGlvbi5TM19NQU5BR0VELFxuICAgICAgcHVibGljUmVhZEFjY2VzczogZmFsc2UsXG4gICAgICBibG9ja1B1YmxpY0FjY2VzczogczMuQmxvY2tQdWJsaWNBY2Nlc3MuQkxPQ0tfQUxMLFxuICAgIH0pXG5cbiAgICBjZGtfbmFnLk5hZ1N1cHByZXNzaW9ucy5hZGRSZXNvdXJjZVN1cHByZXNzaW9ucyhzM0J1Y2tldEZvckF1ZGl0TG9nZ2luZywgW1xuICAgICAge2lkOiAnQXdzU29sdXRpb25zLVMxJywgcmVhc29uOiAnVGhpcyBpcyBhIGxvZ2dpbmcgYnVja2V0Lid9XG4gICAgXSk7XG5cbiAgICBjb25zdCBidWNrZXRQb2xpY3kgPSBuZXcgczMuQnVja2V0UG9saWN5KHRoaXMsICdTM0J1Y2tldEZvclJlZFNoaWZ0QXVkaXRMb2dnaW5nQnVja2V0UG9saWN5Jywge1xuICAgICAgYnVja2V0OiBzM0J1Y2tldEZvckF1ZGl0TG9nZ2luZyxcbiAgICAgIHJlbW92YWxQb2xpY3k6IFJlbW92YWxQb2xpY3kuUkVUQUlOXG4gICAgfSlcbiAgICBidWNrZXRQb2xpY3kuZG9jdW1lbnQuYWRkU3RhdGVtZW50cyhcbiAgICAgIG5ldyBQb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICBzaWQ6ICdQdXQgYnVja2V0IHBvbGljeSBuZWVkZWQgZm9yIGF1ZGl0IGxvZ2dpbmcnLFxuICAgICAgICBlZmZlY3Q6IEVmZmVjdC5BTExPVyxcbiAgICAgICAgYWN0aW9uczogW1xuICAgICAgICAgIFwiczM6R2V0QnVja2V0QWNsXCIsXG4gICAgICAgICAgXCJzMzpQdXRPYmplY3RcIlxuICAgICAgICBdLFxuICAgICAgICBwcmluY2lwYWxzOiBbbmV3IFNlcnZpY2VQcmluY2lwYWwoJ3JlZHNoaWZ0LmFtYXpvbmF3cy5jb20nKV0sXG4gICAgICAgIHJlc291cmNlczogW1xuICAgICAgICAgIHMzQnVja2V0Rm9yQXVkaXRMb2dnaW5nLmJ1Y2tldEFybixcbiAgICAgICAgICBjZGsuRm4uc3ViKFwiYXJuOiR7QVdTOjpQYXJ0aXRpb259OnMzOjo6JHtCdWNrZXROYW1lfS8qXCIsIHtcbiAgICAgICAgICAgIEJ1Y2tldE5hbWU6IGAke3MzQnVja2V0Rm9yQXVkaXRMb2dnaW5nLmJ1Y2tldE5hbWV9YFxuICAgICAgICAgIH0pXG4gICAgICAgIF1cbiAgICAgIH0pXG4gICAgKTtcbiAgICBjb25zdCBidWNrZXRQb2xpY3lfY2ZuX3JlZiA9IGJ1Y2tldFBvbGljeS5ub2RlLmRlZmF1bHRDaGlsZCBhcyBzMy5DZm5CdWNrZXRQb2xpY3lcbiAgICBidWNrZXRQb2xpY3lfY2ZuX3JlZi5jZm5PcHRpb25zLmNvbmRpdGlvbiA9IGVuYWJsZVMzQnVja2V0Rm9yUmVkU2hpZnQ0XG5cbiAgICBjb25zdCBzM0J1Y2tldEZvckF1ZGl0TG9nZ2luZ19jZm5fcmVmID0gczNCdWNrZXRGb3JBdWRpdExvZ2dpbmcubm9kZS5kZWZhdWx0Q2hpbGQgYXMgczMuQ2ZuQnVja2V0XG4gICAgczNCdWNrZXRGb3JBdWRpdExvZ2dpbmdfY2ZuX3JlZi5jZm5PcHRpb25zLm1ldGFkYXRhID0ge1xuICAgICAgY2ZuX25hZzoge1xuICAgICAgICBydWxlc190b19zdXBwcmVzczogW3tcbiAgICAgICAgICBpZDogJ1czNScsXG4gICAgICAgICAgcmVhc29uOiAnTG9ncyBidWNrZXQgZG9lcyBub3QgcmVxdWlyZSBsb2dnaW5nIGNvbmZpZ3VyYXRpb24nXG4gICAgICAgIH1dXG4gICAgICB9XG4gICAgfTtcblxuICAgIGNka19uYWcuTmFnU3VwcHJlc3Npb25zLmFkZFJlc291cmNlU3VwcHJlc3Npb25zKHMzQnVja2V0Rm9yQXVkaXRMb2dnaW5nLCBbXG4gICAgICB7aWQ6ICdBd3NTb2x1dGlvbnMtUzEnLCByZWFzb246ICdMb2dzIGJ1Y2tldCBkb2VzIG5vdCByZXF1aXJlIGxvZ2dpbmcgY29uZmlndXJhdGlvbid9LFxuICAgICAge2lkOiAnQXdzU29sdXRpb25zLVMxMCcsIHJlYXNvbjogJ1NlY3VyZSB0cmFuc3BvcnQgcmVxdWlyZW1lbnQgaXMgcmVkdW5kYW50IGZvciB0aGlzIHVzZSBjYXNlJ31cbiAgICBdKTtcbiAgICBjZGtfbmFnLk5hZ1N1cHByZXNzaW9ucy5hZGRSZXNvdXJjZVN1cHByZXNzaW9ucyhidWNrZXRQb2xpY3ksIFtcbiAgICAgIHtpZDogJ0F3c1NvbHV0aW9ucy1TMTAnLCByZWFzb246ICdTZWN1cmUgdHJhbnNwb3J0IHJlcXVpcmVtZW50IGlzIHJlZHVuZGFudCBmb3IgdGhpcyB1c2UgY2FzZSd9XG4gICAgXSk7XG5cbiAgICBzM0J1Y2tldEZvckF1ZGl0TG9nZ2luZ19jZm5fcmVmLmNmbk9wdGlvbnMuY29uZGl0aW9uID0gZW5hYmxlUzNCdWNrZXRGb3JSZWRTaGlmdDQ7XG5cbiAgICBidWNrZXRQb2xpY3lfY2ZuX3JlZi5hZGREZXBlbmRzT24oczNCdWNrZXRGb3JBdWRpdExvZ2dpbmdfY2ZuX3JlZilcblxuICAgIC8vLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICAvLyBLTVMgQ3VzdG9tZXIgTWFuYWdlZCBLZXlcblxuICAgIC8vIEtleSBQb2xpY3lcbiAgICBjb25zdCBrbXNLZXlQb2xpY3k6UG9saWN5RG9jdW1lbnQgPSBuZXcgUG9saWN5RG9jdW1lbnQoKTtcbiAgICBjb25zdCBrbXNQZXJtczpQb2xpY3lTdGF0ZW1lbnQgPSBuZXcgUG9saWN5U3RhdGVtZW50KCk7XG4gICAga21zUGVybXMuYWRkQWN0aW9ucyhcbiAgICAgICAgJ2ttczpHZW5lcmF0ZURhdGFLZXknLFxuICAgICAgICAna21zOkdlbmVyYXRlRGF0YUtleVBhaXInLFxuICAgICAgICAna21zOkdlbmVyYXRlRGF0YUtleVBhaXJXaXRob3V0UGxhaW50ZXh0JyxcbiAgICAgICAgJ2ttczpHZW5lcmF0ZURhdGFLZXlXaXRob3V0UGxhaW50ZXh0JyxcbiAgICAgICAgJ2ttczpEZWNyeXB0JyxcbiAgICAgICAgJ2ttczpFbmNyeXB0JyxcbiAgICAgICAgJ2ttczpSZUVuY3J5cHRGcm9tJyxcbiAgICAgICAgJ2ttczpSZUVuY3J5cHRUbycsXG4gICAgICAgICdrbXM6RGVzY3JpYmVLZXknLFxuICAgICAgICAna21zOkRlc2NyaWJlQ3VzdG9tS2V5U3RvcmVzJ1xuICAgICk7XG4gICAga21zUGVybXMuZWZmZWN0ID0gRWZmZWN0LkFMTE9XO1xuICAgIGttc1Blcm1zLmFkZFJlc291cmNlcyhcIipcIik7IC8vIE9ubHkgdGhlIGtleSB0aGUgcG9saWN5ZG9jdW1lbnQgaXMgYXR0YWNoZWQgdG9cbiAgICBrbXNQZXJtcy5hZGRQcmluY2lwYWxzKG5ldyBTZXJ2aWNlUHJpbmNpcGFsKCdzbnMuYW1hem9uYXdzLmNvbScpKTtcbiAgICBrbXNQZXJtcy5hZGRQcmluY2lwYWxzKG5ldyBTZXJ2aWNlUHJpbmNpcGFsKCdzMy5hbWF6b25hd3MuY29tJykpO1xuICAgIGttc1Blcm1zLmFkZFByaW5jaXBhbHMobmV3IFNlcnZpY2VQcmluY2lwYWwoYGxvZ3MuJHtzdGFjay51cmxTdWZmaXh9YCkpO1xuICAgIGttc1Blcm1zLmFkZFByaW5jaXBhbHMobmV3IFNlcnZpY2VQcmluY2lwYWwoYGxvZ3MuJHtzdGFjay5yZWdpb259LiR7c3RhY2sudXJsU3VmZml4fWApKTtcbiAgICBrbXNQZXJtcy5hZGRQcmluY2lwYWxzKG5ldyBTZXJ2aWNlUHJpbmNpcGFsKGBjbG91ZHRyYWlsLiR7c3RhY2sudXJsU3VmZml4fWApKTtcbiAgICBrbXNQZXJtcy5hZGRQcmluY2lwYWxzKG5ldyBTZXJ2aWNlUHJpbmNpcGFsKCdjbG91ZHdhdGNoLmFtYXpvbmF3cy5jb20nKSk7XG4gICAga21zS2V5UG9saWN5LmFkZFN0YXRlbWVudHMoa21zUGVybXMpO1xuXG4gICAgY29uc3Qga21zS2V5OktleSA9IG5ldyBLZXkodGhpcywgJ1NIQVJSIFJlbWVkaWF0aW9uIEtleScsIHtcbiAgICAgIGVuYWJsZUtleVJvdGF0aW9uOiB0cnVlLFxuICAgICAgYWxpYXM6IGAke1JFU09VUkNFX1BSRUZJWH0tU0hBUlItUmVtZWRpYXRpb24tS2V5YCxcbiAgICAgIHRydXN0QWNjb3VudElkZW50aXRpZXM6IHRydWUsXG4gICAgICBwb2xpY3k6IGttc0tleVBvbGljeVxuICAgIH0pO1xuXG4gICAgbmV3IFN0cmluZ1BhcmFtZXRlcih0aGlzLCAnU0hBUlIgS2V5IEFsaWFzJywge1xuICAgICAgZGVzY3JpcHRpb246ICdLTVMgQ3VzdG9tZXIgTWFuYWdlZCBLZXkgdGhhdCB3aWxsIGVuY3J5cHQgZGF0YSBmb3IgcmVtZWRpYXRpb25zJyxcbiAgICAgIHBhcmFtZXRlck5hbWU6IGAvU29sdXRpb25zLyR7UkVTT1VSQ0VfUFJFRklYfS9DTUtfUkVNRURJQVRJT05fQVJOYCxcbiAgICAgIHN0cmluZ1ZhbHVlOiBrbXNLZXkua2V5QXJuXG4gICAgfSk7XG5cbiAgICBuZXcgU3RyaW5nUGFyYW1ldGVyKHRoaXMsICdTSEFSUiBNZW1iZXIgVmVyc2lvbicsIHtcbiAgICAgICAgZGVzY3JpcHRpb246ICdWZXJzaW9uIG9mIHRoZSBBV1MgU2VjdXJpdHkgSHViIEF1dG9tYXRlZCBSZXNwb25zZSBhbmQgUmVtZWRpYXRpb24gc29sdXRpb24nLFxuICAgICAgICBwYXJhbWV0ZXJOYW1lOiBgL1NvbHV0aW9ucy8ke1JFU09VUkNFX1BSRUZJWH0vbWVtYmVyLXZlcnNpb25gLFxuICAgICAgICBzdHJpbmdWYWx1ZTogcHJvcHMuc29sdXRpb25WZXJzaW9uXG4gICAgfSk7XG5cbiAgICAvKioqKioqKioqKioqKioqKioqKipcbiAgICAqKiBQYXJhbWV0ZXJzXG4gICAgKioqKioqKioqKioqKioqKioqKiovXG5cbiAgICBjb25zdCBsb2dHcm91cE5hbWUgPSBuZXcgY2RrLkNmblBhcmFtZXRlcih0aGlzLCBcIkxvZ0dyb3VwTmFtZVwiLCB7XG4gICAgICB0eXBlOiBcIlN0cmluZ1wiLFxuICAgICAgZGVzY3JpcHRpb246IFwiTmFtZSBvZiB0aGUgbG9nIGdyb3VwIHRvIGJlIHVzZWQgdG8gY3JlYXRlIG1ldHJpYyBmaWx0ZXJzIGFuZCBjbG91ZHdhdGNoIGFsYXJtcy4gWW91IG11c3QgdXNlIGEgTG9nIEdyb3VwIHRoYXQgaXMgdGhlIHRoZSBsb2dnaW5nIGRlc3RpbmF0aW9uIG9mIGEgbXVsdGktcmVnaW9uIENsb3VkVHJhaWxcIlxuICAgIH0pO1xuXG4gICAgLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgICoqIENyZWF0ZSBTU00gUGFyYW1ldGVyIHRvIHN0b3JlIGxvZyBncm91cCBuYW1lXG4gICAgKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuICAgIG5ldyBTdHJpbmdQYXJhbWV0ZXIoc3RhY2ssICdTU01QYXJhbWV0ZXJMb2dHcm91cE5hbWUnLCB7XG4gICAgICBkZXNjcmlwdGlvbjogJ1BhcmFtZXRlciB0byBzdG9yZSBsb2cgZ3JvdXAgbmFtZScsXG4gICAgICBwYXJhbWV0ZXJOYW1lOiBgL1NvbHV0aW9ucy8ke1JFU09VUkNFX1BSRUZJWH0vTWV0cmljc19Mb2dHcm91cE5hbWVgLFxuICAgICAgc3RyaW5nVmFsdWU6IGxvZ0dyb3VwTmFtZS52YWx1ZUFzU3RyaW5nXG4gICAgfSk7XG5cbiAgICAvKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgKiogQ3JlYXRlIFNTTSBQYXJhbWV0ZXIgdG8gc3RvcmUgZW5jcnlwdGlvbiBrZXkgYWxpYXMgZm9yIHRoZSBQQ0kuUzMuNC9BRlNCUC5TMy40XG4gICAgKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuICAgIG5ldyBTdHJpbmdQYXJhbWV0ZXIoc3RhY2ssICdTU01QYXJhbWV0ZXJGb3JTMy40RW5jcnlwdGlvbktleUFsaWFzJywge1xuICAgICAgZGVzY3JpcHRpb246ICdQYXJhbWV0ZXIgdG8gc3RvcmUgZW5jcnlwdGlvbiBrZXkgYWxpYXMgZm9yIHRoZSBQQ0kuUzMuNC9BRlNCUC5TMy40LCByZXBsYWNlIHRoZSBkZWZhdWx0IHZhbHVlIHdpdGggdGhlIEtNUyBLZXkgQWxpYXMsIG90aGVyIHdpc2UgdGhlIHJlbWVkaWF0aW9uIHdpbGwgZW5hYmxlIHRoZSBkZWZhdWx0IEFFUzI1NiBlbmNyeXB0aW9uIGZvciB0aGUgYnVja2V0LicsXG4gICAgICBwYXJhbWV0ZXJOYW1lOiBgL1NvbHV0aW9ucy8ke1JFU09VUkNFX1BSRUZJWH0vYWZzYnAvMS4wLjAvUzMuNC9LbXNLZXlBbGlhc2AsXG4gICAgICBzdHJpbmdWYWx1ZTogJ2RlZmF1bHQtczMtZW5jcnlwdGlvbidcbiAgICB9KTtcblxuICAgIC8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAqKiBDcmVhdGUgU1NNIFBhcmFtZXRlciB0byBzdG9yZSB0aGUgUzMgYnVja2V0IG5hbWUgZm9yIEFGU0JQLlJFRFNISUZULjRcbiAgICAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG4gICAgY29uc3Qgc3NtUGFyYW1ldGVyRm9yUmVkc2hpZnQ0QnVja2V0TmFtZSA9IG5ldyBTdHJpbmdQYXJhbWV0ZXIoc3RhY2ssICdTU01QYXJhbWV0ZXJGb3JTM0J1Y2tldE5hbWVGb3JSRURTSElGVDQnLCB7XG4gICAgICBkZXNjcmlwdGlvbjogJ1BhcmFtZXRlciB0byBzdG9yZSB0aGUgUzMgYnVja2V0IG5hbWUgZm9yIHRoZSByZW1lZGlhdGlvbiBBRlNCUC5SRURTSElGVC40LCB0aGUgZGVmYXVsdCB2YWx1ZSBpcyBidWNrZXQtbmFtZSB3aGljaCBoYXMgdG8gYmUgdXBkYXRlZCBieSB0aGUgdXNlciBiZWZvcmUgdXNpbmcgdGhlIHJlbWVkaWF0aW9uLicsXG4gICAgICBwYXJhbWV0ZXJOYW1lOiBgL1NvbHV0aW9ucy8ke3Byb3BzLnNvbHV0aW9uSWR9L2Fmc2JwLzEuMC4wL1JFRFNISUZULjQvUzNCdWNrZXROYW1lRm9yQXVkaXRMb2dnaW5nYCxcbiAgICAgIHN0cmluZ1ZhbHVlOiBzM0J1Y2tldEZvckF1ZGl0TG9nZ2luZy5idWNrZXROYW1lXG4gICAgfSk7XG5cbiAgICBjb25zdCBzc21QYXJhbWV0ZXJGb3JSZWRzaGlmdDRCdWNrZXROYW1lX2Nmbl9yZWYgPSBzc21QYXJhbWV0ZXJGb3JSZWRzaGlmdDRCdWNrZXROYW1lLm5vZGUuZGVmYXVsdENoaWxkIGFzIHNzbS5DZm5QYXJhbWV0ZXJcbiAgICBzc21QYXJhbWV0ZXJGb3JSZWRzaGlmdDRCdWNrZXROYW1lX2Nmbl9yZWYuY2ZuT3B0aW9ucy5jb25kaXRpb24gPSBlbmFibGVTM0J1Y2tldEZvclJlZFNoaWZ0NFxuXG4gICAgc3NtUGFyYW1ldGVyRm9yUmVkc2hpZnQ0QnVja2V0TmFtZV9jZm5fcmVmLmFkZERlcGVuZHNPbihzM0J1Y2tldEZvckF1ZGl0TG9nZ2luZ19jZm5fcmVmKVxuXG5cbiAgICBuZXcgY2RrLkNmbk1hcHBpbmcodGhpcywgJ1NvdXJjZUNvZGUnLCB7XG4gICAgICBtYXBwaW5nOiB7IFwiR2VuZXJhbFwiOiB7XG4gICAgICAgIFwiUzNCdWNrZXRcIjogcHJvcHMuc29sdXRpb25EaXN0QnVja2V0LFxuICAgICAgICBcIktleVByZWZpeFwiOiBwcm9wcy5zb2x1dGlvblRNTiArICcvJyArIHByb3BzLnNvbHV0aW9uVmVyc2lvblxuICAgICAgfX1cbiAgICB9KTtcblxuICAgIGNvbnN0IHJ1bmJvb2tGYWN0b3J5ID0gbmV3IFJ1bmJvb2tGYWN0b3J5KHRoaXMsICdSdW5ib29rUHJvdmlkZXInLCB7XG4gICAgICBzb2x1dGlvbklkOiBwcm9wcy5zb2x1dGlvbklkLFxuICAgICAgcnVudGltZVB5dGhvbjogcHJvcHMucnVudGltZVB5dGhvbixcbiAgICAgIHNvbHV0aW9uRGlzdEJ1Y2tldDogcHJvcHMuc29sdXRpb25EaXN0QnVja2V0LFxuICAgICAgc29sdXRpb25UTU46IHByb3BzLnNvbHV0aW9uVE1OLFxuICAgICAgc29sdXRpb25WZXJzaW9uOiBwcm9wcy5zb2x1dGlvblZlcnNpb24sXG4gICAgICByZWdpb246IHRoaXMucmVnaW9uLFxuICAgICAgcGFydGl0aW9uOiB0aGlzLnBhcnRpdGlvblxuICAgIH0pO1xuXG4gICAgLy8tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAgLy8gUnVuYm9va3MgLSBzaGFyZWQgYXV0b21hdGlvbnNcbiAgICAvL1xuICAgIGNvbnN0IHJ1bmJvb2tTdGFjayA9IG5ldyBjZGsuQ2ZuU3RhY2sodGhpcywgYFJ1bmJvb2tTdGFja05vUm9sZXNgLCB7XG4gICAgICB0ZW1wbGF0ZVVybDogXCJodHRwczovL1wiICsgY2RrLkZuLmZpbmRJbk1hcChcIlNvdXJjZUNvZGVcIiwgXCJHZW5lcmFsXCIsIFwiUzNCdWNrZXRcIikgK1xuICAgICAgXCItcmVmZXJlbmNlLnMzLmFtYXpvbmF3cy5jb20vXCIgKyBjZGsuRm4uZmluZEluTWFwKFwiU291cmNlQ29kZVwiLCBcIkdlbmVyYWxcIiwgXCJLZXlQcmVmaXhcIikgK1xuICAgICAgXCIvYXdzLXNoYXJyLXJlbWVkaWF0aW9ucy50ZW1wbGF0ZVwiXG4gICAgfSk7XG5cbiAgICBydW5ib29rU3RhY2subm9kZS5hZGREZXBlbmRlbmN5KHJ1bmJvb2tGYWN0b3J5KTtcblxuICAgIC8vLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgIC8vIExvb3AgdGhyb3VnaCBhbGwgb2YgdGhlIFBsYXlib29rcyB0byBjcmVhdGUgcmVmZXJlbmNlXG4gICAgLy9cbiAgICBjb25zdCBQQl9ESVIgPSBgJHtfX2Rpcm5hbWV9Ly4uLy4uL3BsYXlib29rc2A7XG4gICAgY29uc3QgaWdub3JlID0gWycuRFNfU3RvcmUnLCAnY29tbW9uJywgJy5weXRlc3RfY2FjaGUnLCAnTkVXUExBWUJPT0snLCAnLmNvdmVyYWdlJ107XG4gICAgY29uc3QgaWxsZWdhbENoYXJzID0gL1tcXC5fXS9nO1xuICAgIGNvbnN0IGxpc3RPZlBsYXlib29rczogc3RyaW5nW10gPSBbXTtcbiAgICBmcy5yZWFkZGlyKFBCX0RJUiwgKGVyciwgaXRlbXMpID0+IHtcbiAgICAgIGl0ZW1zLmZvckVhY2goKGZpbGUpID0+IHtcbiAgICAgICAgaWYgKCFpZ25vcmUuaW5jbHVkZXMoZmlsZSkpIHtcbiAgICAgICAgICBjb25zdCB0ZW1wbGF0ZUZpbGUgPSBgJHtmaWxlfU1lbWJlclN0YWNrLnRlbXBsYXRlYDtcbiAgICAgICAgICAvLy0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgICAgICAgIC8vIFBsYXlib29rIE1lbWJlciBUZW1wbGF0ZSBOZXN0ZWQgU3RhY2tcbiAgICAgICAgICAvL1xuICAgICAgICAgIGNvbnN0IHBhcm1uYW1lID0gZmlsZS5yZXBsYWNlKGlsbGVnYWxDaGFycywgJycpO1xuICAgICAgICAgIGNvbnN0IG1lbWJlclN0YWNrT3B0aW9uID0gbmV3IGNkay5DZm5QYXJhbWV0ZXIodGhpcywgYExvYWRNZW1iZXJTdGFjayR7cGFybW5hbWV9YCwge1xuICAgICAgICAgICAgdHlwZTogXCJTdHJpbmdcIixcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBgTG9hZCBQbGF5Ym9vayBtZW1iZXIgc3RhY2sgZm9yICR7ZmlsZX0/YCxcbiAgICAgICAgICAgIGRlZmF1bHQ6IFwieWVzXCIsXG4gICAgICAgICAgICBhbGxvd2VkVmFsdWVzOiBbXCJ5ZXNcIiwgXCJub1wiXVxuICAgICAgICAgIH0pO1xuICAgICAgICAgIG1lbWJlclN0YWNrT3B0aW9uLm92ZXJyaWRlTG9naWNhbElkKGBMb2FkJHtwYXJtbmFtZX1NZW1iZXJTdGFja2ApO1xuICAgICAgICAgIGxpc3RPZlBsYXlib29rcy5wdXNoKG1lbWJlclN0YWNrT3B0aW9uLmxvZ2ljYWxJZCk7XG5cbiAgICAgICAgICBjb25zdCBtZW1iZXJTdGFjayA9IG5ldyBjZGsuQ2ZuU3RhY2sodGhpcywgYFBsYXlib29rTWVtYmVyU3RhY2ske2ZpbGV9YCwge1xuICAgICAgICAgICAgcGFyYW1ldGVyczoge1xuICAgICAgICAgICAgICAnU2VjSHViQWRtaW5BY2NvdW50JzogYWRtaW5BY2NvdW50LmFkbWluQWNjb3VudE51bWJlci52YWx1ZUFzU3RyaW5nXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgdGVtcGxhdGVVcmw6IFwiaHR0cHM6Ly9cIiArIGNkay5Gbi5maW5kSW5NYXAoXCJTb3VyY2VDb2RlXCIsIFwiR2VuZXJhbFwiLCBcIlMzQnVja2V0XCIpICtcbiAgICAgICAgICAgIFwiLXJlZmVyZW5jZS5zMy5hbWF6b25hd3MuY29tL1wiICsgY2RrLkZuLmZpbmRJbk1hcChcIlNvdXJjZUNvZGVcIiwgXCJHZW5lcmFsXCIsIFwiS2V5UHJlZml4XCIpICtcbiAgICAgICAgICAgIFwiL3BsYXlib29rcy9cIiArIHRlbXBsYXRlRmlsZVxuICAgICAgICAgIH0pXG5cbiAgICAgICAgICBtZW1iZXJTdGFjay5ub2RlLmFkZERlcGVuZGVuY3kocnVuYm9va0ZhY3RvcnkpO1xuXG4gICAgICAgICAgbWVtYmVyU3RhY2suY2ZuT3B0aW9ucy5jb25kaXRpb24gPSBuZXcgY2RrLkNmbkNvbmRpdGlvbih0aGlzLCBgbG9hZCR7ZmlsZX1Db25kYCwge1xuICAgICAgICAgICAgZXhwcmVzc2lvbjogY2RrLkZuLmNvbmRpdGlvbkVxdWFscyhtZW1iZXJTdGFja09wdGlvbiwgXCJ5ZXNcIilcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSk7XG4gICAgLyoqKioqKioqKioqKioqKioqKioqXG4gICAgKiogTWV0YWRhdGFcbiAgICAqKioqKioqKioqKioqKioqKioqKi9cbiAgICBzdGFjay50ZW1wbGF0ZU9wdGlvbnMubWV0YWRhdGEgPSB7XG4gICAgICBcIkFXUzo6Q2xvdWRGb3JtYXRpb246OkludGVyZmFjZVwiOiB7XG4gICAgICAgIFBhcmFtZXRlckdyb3VwczogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIExhYmVsOiB7ZGVmYXVsdDogXCJMb2dHcm91cCBDb25maWd1cmF0aW9uXCJ9LFxuICAgICAgICAgICAgUGFyYW1ldGVyczogW2xvZ0dyb3VwTmFtZS5sb2dpY2FsSWRdXG4gICAgICAgICAgfSxcbiAgICAgICAgICB7XG4gICAgICAgICAgICBMYWJlbDoge2RlZmF1bHQ6IFwiUGxheWJvb2tzXCJ9LFxuICAgICAgICAgICAgUGFyYW1ldGVyczogbGlzdE9mUGxheWJvb2tzXG4gICAgICAgICAgfVxuICAgICAgICBdLFxuICAgICAgICBQYXJhbWV0ZXJMYWJlbHM6IHtcbiAgICAgICAgICBbbG9nR3JvdXBOYW1lLmxvZ2ljYWxJZF06IHtcbiAgICAgICAgICAgIGRlZmF1bHQ6IFwiUHJvdmlkZSB0aGUgbmFtZSBvZiB0aGUgTG9nR3JvdXAgdG8gYmUgdXNlZCB0byBjcmVhdGUgTWV0cmljIEZpbHRlcnMgYW5kIEFsYXJtc1wiLFxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH07XG4gIH1cbn1cbiJdfQ==