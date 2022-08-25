#!/usr/bin/env node
"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.RemediationRunbookStack = exports.MemberRoleStack = void 0;
//
// Remediation Runbook Stack - installs non standard-specific remediation
// runbooks that are used by one or more standards
//
const cdk = require("@aws-cdk/core");
const aws_iam_1 = require("@aws-cdk/aws-iam");
const orchestrator_roles_construct_1 = require("../../lib/orchestrator_roles-construct");
const admin_account_parm_construct_1 = require("../../lib/admin_account_parm-construct");
const rds6_remediation_resources_1 = require("../../remediation_runbooks/rds6-remediation-resources");
const runbook_factory_1 = require("./runbook_factory");
const ssmplaybook_1 = require("../../lib/ssmplaybook");
class MemberRoleStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        /********************
        ** Parameters
        ********************/
        const RESOURCE_PREFIX = props.solutionId.replace(/^DEV-/, ''); // prefix on every resource name
        const adminRoleName = `${RESOURCE_PREFIX}-SHARR-Orchestrator-Admin`;
        const adminAccount = new admin_account_parm_construct_1.AdminAccountParm(this, 'AdminAccountParameter', {
            solutionId: props.solutionId
        });
        this._orchestratorMemberRole = new orchestrator_roles_construct_1.OrchestratorMemberRole(this, 'OrchestratorMemberRole', {
            solutionId: props.solutionId,
            adminAccountId: adminAccount.adminAccountNumber.valueAsString,
            adminRoleName: adminRoleName
        });
    }
    getOrchestratorMemberRole() {
        return this._orchestratorMemberRole;
    }
}
exports.MemberRoleStack = MemberRoleStack;
class RemediationRunbookStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        let ssmdocs = '';
        if (props.ssmdocs == undefined) {
            ssmdocs = '../remediation_runbooks';
        }
        else {
            ssmdocs = props.ssmdocs;
        }
        const RESOURCE_PREFIX = props.solutionId.replace(/^DEV-/, ''); // prefix on every resource name
        const remediationRoleNameBase = `${RESOURCE_PREFIX}-`;
        //-----------------------
        // CreateCloudTrailMultiRegionTrail
        //
        {
            const remediationName = 'CreateCloudTrailMultiRegionTrail';
            const inlinePolicy = new aws_iam_1.Policy(props.roleStack, `SHARR-Remediation-Policy-${remediationName}`);
            const cloudtrailPerms = new aws_iam_1.PolicyStatement();
            cloudtrailPerms.addActions("cloudtrail:CreateTrail", "cloudtrail:UpdateTrail", "cloudtrail:StartLogging");
            cloudtrailPerms.effect = aws_iam_1.Effect.ALLOW;
            cloudtrailPerms.addResources("*");
            inlinePolicy.addStatements(cloudtrailPerms);
            const s3Perms = new aws_iam_1.PolicyStatement();
            s3Perms.addActions("s3:CreateBucket", "s3:PutEncryptionConfiguration", "s3:PutBucketPublicAccessBlock", "s3:PutBucketLogging", "s3:PutBucketAcl", "s3:PutBucketPolicy");
            s3Perms.effect = aws_iam_1.Effect.ALLOW;
            s3Perms.addResources(`arn:${this.partition}:s3:::so0111-*`);
            inlinePolicy.addStatements(s3Perms);
            new ssmplaybook_1.SsmRole(props.roleStack, 'RemediationRole ' + remediationName, {
                solutionId: props.solutionId,
                ssmDocName: remediationName,
                remediationPolicy: inlinePolicy,
                remediationRoleName: `${remediationRoleNameBase}${remediationName}`
            });
            runbook_factory_1.RunbookFactory.createRemediationRunbook(this, 'SHARR ' + remediationName, {
                ssmDocName: remediationName,
                ssmDocPath: ssmdocs,
                ssmDocFileName: `${remediationName}.yaml`,
                scriptPath: `${ssmdocs}/scripts`,
                solutionVersion: props.solutionVersion,
                solutionDistBucket: props.solutionDistBucket,
                solutionId: props.solutionId
            });
            // CFN-NAG
            // WARN W12: IAM policy should not allow * resource
            let childToMod = inlinePolicy.node.findChild('Resource');
            childToMod.cfnOptions.metadata = {
                cfn_nag: {
                    rules_to_suppress: [{
                            id: 'W12',
                            reason: 'Resource * is required for to allow remediation.'
                        }, {
                            id: 'W28',
                            reason: 'Static names chosen intentionally to provide integration in cross-account permissions.'
                        }]
                }
            };
        }
        //-----------------------
        // CreateLogMetricAndAlarm
        //
        {
            const remediationName = 'CreateLogMetricFilterAndAlarm';
            const inlinePolicy = new aws_iam_1.Policy(props.roleStack, `SHARR-Remediation-Policy-${remediationName}`);
            const remediationPolicy = new aws_iam_1.PolicyStatement();
            remediationPolicy.addActions("logs:PutMetricFilter", "cloudwatch:PutMetricAlarm");
            remediationPolicy.effect = aws_iam_1.Effect.ALLOW;
            remediationPolicy.addResources(`arn:${this.partition}:logs:*:${this.account}:log-group:*`);
            remediationPolicy.addResources(`arn:${this.partition}:cloudwatch:*:${this.account}:alarm:*`);
            inlinePolicy.addStatements(remediationPolicy);
            {
                var snsPerms = new aws_iam_1.PolicyStatement();
                snsPerms.addActions("sns:CreateTopic", "sns:SetTopicAttributes");
                snsPerms.effect = aws_iam_1.Effect.ALLOW;
                snsPerms.addResources(`arn:${this.partition}:sns:*:${this.account}:SO0111-SHARR-LocalAlarmNotification`);
                inlinePolicy.addStatements(snsPerms);
            }
            new ssmplaybook_1.SsmRole(props.roleStack, 'RemediationRole ' + remediationName, {
                solutionId: props.solutionId,
                ssmDocName: remediationName,
                remediationPolicy: inlinePolicy,
                remediationRoleName: `${remediationRoleNameBase}${remediationName}`
            });
            runbook_factory_1.RunbookFactory.createRemediationRunbook(this, 'SHARR ' + remediationName, {
                ssmDocName: remediationName,
                ssmDocPath: ssmdocs,
                ssmDocFileName: `${remediationName}.yaml`,
                scriptPath: `${ssmdocs}/scripts`,
                solutionVersion: props.solutionVersion,
                solutionDistBucket: props.solutionDistBucket,
                solutionId: props.solutionId
            });
        }
        //-----------------------
        // EnableAutoScalingGroupELBHealthCheck
        //
        {
            const remediationName = 'EnableAutoScalingGroupELBHealthCheck';
            const inlinePolicy = new aws_iam_1.Policy(props.roleStack, `SHARR-Remediation-Policy-${remediationName}`);
            const asPerms = new aws_iam_1.PolicyStatement();
            asPerms.addActions("autoscaling:UpdateAutoScalingGroup", "autoscaling:DescribeAutoScalingGroups");
            asPerms.effect = aws_iam_1.Effect.ALLOW;
            asPerms.addResources("*");
            inlinePolicy.addStatements(asPerms);
            new ssmplaybook_1.SsmRole(props.roleStack, 'RemediationRole ' + remediationName, {
                solutionId: props.solutionId,
                ssmDocName: remediationName,
                remediationPolicy: inlinePolicy,
                remediationRoleName: `${remediationRoleNameBase}${remediationName}`
            });
            runbook_factory_1.RunbookFactory.createRemediationRunbook(this, 'SHARR ' + remediationName, {
                ssmDocName: remediationName,
                ssmDocPath: ssmdocs,
                ssmDocFileName: `${remediationName}.yaml`,
                scriptPath: `${ssmdocs}/scripts`,
                solutionVersion: props.solutionVersion,
                solutionDistBucket: props.solutionDistBucket,
                solutionId: props.solutionId
            });
            let childToMod = inlinePolicy.node.findChild('Resource');
            childToMod.cfnOptions.metadata = {
                cfn_nag: {
                    rules_to_suppress: [{
                            id: 'W12',
                            reason: 'Resource * is required for to allow remediation for *any* ASG.'
                        }]
                }
            };
        }
        //-----------------------
        // EnableAWSConfig
        //
        {
            const remediationName = 'EnableAWSConfig';
            const inlinePolicy = new aws_iam_1.Policy(props.roleStack, `SHARR-Remediation-Policy-${remediationName}`);
            {
                let iamPerms = new aws_iam_1.PolicyStatement();
                iamPerms.addActions("iam:GetRole", "iam:PassRole");
                iamPerms.effect = aws_iam_1.Effect.ALLOW;
                iamPerms.addResources(`arn:${this.partition}:iam::${this.account}:role/aws-service-role/config.amazonaws.com/AWSServiceRoleForConfig`, `arn:${this.partition}:iam::${this.account}:role/SO0111-CreateAccessLoggingBucket`);
                inlinePolicy.addStatements(iamPerms);
            }
            {
                let snsPerms = new aws_iam_1.PolicyStatement();
                snsPerms.addActions("sns:CreateTopic", "sns:SetTopicAttributes");
                snsPerms.effect = aws_iam_1.Effect.ALLOW;
                snsPerms.addResources(`arn:${this.partition}:sns:*:${this.account}:SO0111-SHARR-AWSConfigNotification`);
                inlinePolicy.addStatements(snsPerms);
            }
            {
                var ssmPerms = new aws_iam_1.PolicyStatement();
                ssmPerms.addActions("ssm:StartAutomationExecution");
                ssmPerms.effect = aws_iam_1.Effect.ALLOW;
                ssmPerms.addResources(`arn:${this.partition}:ssm:*:${this.account}:automation-definition/SHARR-CreateAccessLoggingBucket:*`);
                inlinePolicy.addStatements(ssmPerms);
            }
            {
                var configPerms = new aws_iam_1.PolicyStatement();
                configPerms.addActions("ssm:GetAutomationExecution", "config:PutConfigurationRecorder", "config:PutDeliveryChannel", "config:DescribeConfigurationRecorders", "config:StartConfigurationRecorder");
                configPerms.effect = aws_iam_1.Effect.ALLOW;
                configPerms.addResources(`*`);
                inlinePolicy.addStatements(configPerms);
            }
            const s3Perms = new aws_iam_1.PolicyStatement();
            s3Perms.addActions("s3:CreateBucket", "s3:PutEncryptionConfiguration", "s3:PutBucketPublicAccessBlock", "s3:PutBucketLogging", "s3:PutBucketAcl", "s3:PutBucketPolicy");
            s3Perms.effect = aws_iam_1.Effect.ALLOW;
            s3Perms.addResources(`arn:${this.partition}:s3:::so0111-*`);
            inlinePolicy.addStatements(s3Perms);
            new ssmplaybook_1.SsmRole(props.roleStack, 'RemediationRole ' + remediationName, {
                solutionId: props.solutionId,
                ssmDocName: remediationName,
                remediationPolicy: inlinePolicy,
                remediationRoleName: `${remediationRoleNameBase}${remediationName}`
            });
            runbook_factory_1.RunbookFactory.createRemediationRunbook(this, 'SHARR ' + remediationName, {
                ssmDocName: remediationName,
                ssmDocPath: ssmdocs,
                ssmDocFileName: `${remediationName}.yaml`,
                scriptPath: `${ssmdocs}/scripts`,
                solutionVersion: props.solutionVersion,
                solutionDistBucket: props.solutionDistBucket,
                solutionId: props.solutionId
            });
            let childToMod = inlinePolicy.node.findChild('Resource');
            childToMod.cfnOptions.metadata = {
                cfn_nag: {
                    rules_to_suppress: [{
                            id: 'W12',
                            reason: 'Resource * is required for to allow remediation for *any* resource.'
                        }]
                }
            };
        }
        //-----------------------
        // EnableCloudTrailToCloudWatchLogging
        //
        {
            const remediationName = 'EnableCloudTrailToCloudWatchLogging';
            const inlinePolicy = new aws_iam_1.Policy(props.roleStack, `SHARR-Remediation-Policy-${remediationName}`);
            // Role for CT->CW logging
            const ctcw_remediation_policy_statement_1 = new aws_iam_1.PolicyStatement();
            ctcw_remediation_policy_statement_1.addActions("logs:CreateLogStream");
            ctcw_remediation_policy_statement_1.effect = aws_iam_1.Effect.ALLOW;
            ctcw_remediation_policy_statement_1.addResources("arn:" + this.partition + ":logs:*:*:log-group:*");
            const ctcw_remediation_policy_statement_2 = new aws_iam_1.PolicyStatement();
            ctcw_remediation_policy_statement_2.addActions("logs:PutLogEvents");
            ctcw_remediation_policy_statement_2.effect = aws_iam_1.Effect.ALLOW;
            ctcw_remediation_policy_statement_2.addResources("arn:" + this.partition + ":logs:*:*:log-group:*:log-stream:*");
            const ctcw_remediation_policy_doc = new aws_iam_1.PolicyDocument();
            ctcw_remediation_policy_doc.addStatements(ctcw_remediation_policy_statement_1);
            ctcw_remediation_policy_doc.addStatements(ctcw_remediation_policy_statement_2);
            const ctcw_remediation_role = new aws_iam_1.Role(props.roleStack, 'ctcwremediationrole', {
                assumedBy: new aws_iam_1.ServicePrincipal(`cloudtrail.${this.urlSuffix}`),
                inlinePolicies: {
                    'default_lambdaPolicy': ctcw_remediation_policy_doc
                },
                roleName: `${RESOURCE_PREFIX}-CloudTrailToCloudWatchLogs`
            });
            ctcw_remediation_role.applyRemovalPolicy(cdk.RemovalPolicy.RETAIN);
            {
                let childToMod = ctcw_remediation_role.node.findChild('Resource');
                childToMod.cfnOptions.metadata = {
                    cfn_nag: {
                        rules_to_suppress: [{
                                id: 'W28',
                                reason: 'Static names chosen intentionally to provide integration in cross-account permissions'
                            }]
                    }
                };
            }
            {
                const ctperms = new aws_iam_1.PolicyStatement();
                ctperms.addActions("cloudtrail:UpdateTrail");
                ctperms.effect = aws_iam_1.Effect.ALLOW;
                ctperms.addResources("arn:" + this.partition + ":cloudtrail:*:" + this.account + ":trail/*");
                inlinePolicy.addStatements(ctperms);
            }
            {
                const ctcwiam = new aws_iam_1.PolicyStatement();
                ctcwiam.addActions("iam:PassRole");
                ctcwiam.addResources(ctcw_remediation_role.roleArn);
                inlinePolicy.addStatements(ctcwiam);
            }
            {
                const ctcwlogs = new aws_iam_1.PolicyStatement();
                ctcwlogs.addActions("logs:CreateLogGroup", "logs:DescribeLogGroups");
                ctcwlogs.effect = aws_iam_1.Effect.ALLOW;
                ctcwlogs.addResources("*");
                inlinePolicy.addStatements(ctcwlogs);
            }
            new ssmplaybook_1.SsmRole(props.roleStack, 'RemediationRole ' + remediationName, {
                solutionId: props.solutionId,
                ssmDocName: remediationName,
                remediationPolicy: inlinePolicy,
                remediationRoleName: `${remediationRoleNameBase}${remediationName}`
            });
            runbook_factory_1.RunbookFactory.createRemediationRunbook(this, 'SHARR ' + remediationName, {
                ssmDocName: remediationName,
                ssmDocPath: ssmdocs,
                ssmDocFileName: `${remediationName}.yaml`,
                scriptPath: `${ssmdocs}/scripts`,
                solutionVersion: props.solutionVersion,
                solutionDistBucket: props.solutionDistBucket,
                solutionId: props.solutionId
            });
            {
                let childToMod = inlinePolicy.node.findChild('Resource');
                childToMod.cfnOptions.metadata = {
                    cfn_nag: {
                        rules_to_suppress: [{
                                id: 'W12',
                                reason: 'Resource * is required for to allow creation and description of any log group'
                            }, {
                                id: 'W28',
                                reason: 'Static resource names are required to enable cross-account functionality'
                            }]
                    }
                };
            }
        }
        //-----------------------
        // EnableCloudTrailEncryption
        //
        {
            const remediationName = 'EnableCloudTrailEncryption';
            const inlinePolicy = new aws_iam_1.Policy(props.roleStack, `SHARR-Remediation-Policy-${remediationName}`);
            const cloudtrailPerms = new aws_iam_1.PolicyStatement();
            cloudtrailPerms.addActions("cloudtrail:UpdateTrail");
            cloudtrailPerms.effect = aws_iam_1.Effect.ALLOW;
            cloudtrailPerms.addResources("*");
            inlinePolicy.addStatements(cloudtrailPerms);
            new ssmplaybook_1.SsmRole(props.roleStack, 'RemediationRole ' + remediationName, {
                solutionId: props.solutionId,
                ssmDocName: remediationName,
                remediationPolicy: inlinePolicy,
                remediationRoleName: `${remediationRoleNameBase}${remediationName}`
            });
            runbook_factory_1.RunbookFactory.createRemediationRunbook(this, 'SHARR ' + remediationName, {
                ssmDocName: remediationName,
                ssmDocPath: ssmdocs,
                ssmDocFileName: `${remediationName}.yaml`,
                scriptPath: `${ssmdocs}/scripts`,
                solutionVersion: props.solutionVersion,
                solutionDistBucket: props.solutionDistBucket,
                solutionId: props.solutionId
            });
            // CFN-NAG
            // WARN W12: IAM policy should not allow * resource
            let childToMod = inlinePolicy.node.findChild('Resource');
            childToMod.cfnOptions.metadata = {
                cfn_nag: {
                    rules_to_suppress: [{
                            id: 'W12',
                            reason: 'Resource * is required for to allow remediation.'
                        }, {
                            id: 'W28',
                            reason: 'Static names chosen intentionally to provide integration in cross-account permissions.'
                        }]
                }
            };
        }
        //-----------------------
        // EnableDefaultEncryptionS3
        //
        {
            const remediationName = 'EnableDefaultEncryptionS3';
            const inlinePolicy = new aws_iam_1.Policy(props.roleStack, `SHARR-Remediation-Policy-${remediationName}`);
            inlinePolicy.addStatements(new aws_iam_1.PolicyStatement({
                actions: [
                    "s3:PutEncryptionConfiguration",
                    "kms:GenerateDataKey"
                ],
                resources: [
                    "*"
                ],
                effect: aws_iam_1.Effect.ALLOW
            }));
            new ssmplaybook_1.SsmRole(props.roleStack, 'RemediationRole ' + remediationName, {
                solutionId: props.solutionId,
                ssmDocName: remediationName,
                remediationPolicy: inlinePolicy,
                remediationRoleName: `${remediationRoleNameBase}${remediationName}`
            });
            runbook_factory_1.RunbookFactory.createRemediationRunbook(this, 'SHARR ' + remediationName, {
                ssmDocName: remediationName,
                ssmDocPath: ssmdocs,
                ssmDocFileName: `${remediationName}.yaml`,
                scriptPath: `${ssmdocs}/scripts`,
                solutionVersion: props.solutionVersion,
                solutionDistBucket: props.solutionDistBucket,
                solutionId: props.solutionId
            });
            // CFN-NAG
            // WARN W12: IAM policy should not allow * resource
            let childToMod = inlinePolicy.node.findChild('Resource');
            childToMod.cfnOptions.metadata = {
                cfn_nag: {
                    rules_to_suppress: [{
                            id: 'W12',
                            reason: 'Resource * is required for to allow remediation.'
                        }, {
                            id: 'W28',
                            reason: 'Static names chosen intentionally to provide integration in cross-account permissions.'
                        }]
                }
            };
        }
        //-----------------------
        // EnableVPCFlowLogs
        //
        {
            const remediationName = 'EnableVPCFlowLogs';
            const inlinePolicy = new aws_iam_1.Policy(props.roleStack, `SHARR-Remediation-Policy-${remediationName}`);
            {
                let remediationPerms = new aws_iam_1.PolicyStatement();
                remediationPerms.addActions("ec2:CreateFlowLogs");
                remediationPerms.effect = aws_iam_1.Effect.ALLOW;
                remediationPerms.addResources(`arn:${this.partition}:ec2:*:${this.account}:vpc/*`, `arn:${this.partition}:ec2:*:${this.account}:vpc-flow-log/*`);
                inlinePolicy.addStatements(remediationPerms);
            }
            {
                let iamPerms = new aws_iam_1.PolicyStatement();
                iamPerms.addActions("iam:PassRole");
                iamPerms.effect = aws_iam_1.Effect.ALLOW;
                iamPerms.addResources(`arn:${this.partition}:iam::${this.account}:role/${RESOURCE_PREFIX}-${remediationName}-remediationRole`);
                inlinePolicy.addStatements(iamPerms);
            }
            {
                let ssmPerms = new aws_iam_1.PolicyStatement();
                ssmPerms.addActions("ssm:GetParameter");
                ssmPerms.effect = aws_iam_1.Effect.ALLOW;
                ssmPerms.addResources(`arn:${this.partition}:ssm:*:${this.account}:parameter/${RESOURCE_PREFIX}/CMK_REMEDIATION_ARN`);
                inlinePolicy.addStatements(ssmPerms);
            }
            {
                let validationPerms = new aws_iam_1.PolicyStatement();
                validationPerms.addActions("ec2:DescribeFlowLogs", "logs:CreateLogGroup", "logs:DescribeLogGroups");
                validationPerms.effect = aws_iam_1.Effect.ALLOW;
                validationPerms.addResources("*");
                inlinePolicy.addStatements(validationPerms);
            }
            // Remediation Role - used in the remediation
            const remediation_policy = new aws_iam_1.PolicyStatement();
            remediation_policy.effect = aws_iam_1.Effect.ALLOW;
            remediation_policy.addActions("logs:CreateLogGroup", "logs:CreateLogStream", "logs:DescribeLogGroups", "logs:DescribeLogStreams", "logs:PutLogEvents");
            remediation_policy.addResources("*");
            const remediation_doc = new aws_iam_1.PolicyDocument();
            remediation_doc.addStatements(remediation_policy);
            const remediation_role = new aws_iam_1.Role(props.roleStack, 'EnableVPCFlowLogs-remediationrole', {
                assumedBy: new aws_iam_1.ServicePrincipal('vpc-flow-logs.amazonaws.com'),
                inlinePolicies: {
                    'default_lambdaPolicy': remediation_doc
                },
                roleName: `${RESOURCE_PREFIX}-EnableVPCFlowLogs-remediationRole`
            });
            remediation_role.applyRemovalPolicy(cdk.RemovalPolicy.RETAIN);
            const roleResource = remediation_role.node.findChild('Resource');
            roleResource.cfnOptions.metadata = {
                cfn_nag: {
                    rules_to_suppress: [{
                            id: 'W11',
                            reason: 'Resource * is required due to the administrative nature of the solution.'
                        }, {
                            id: 'W28',
                            reason: 'Static names chosen intentionally to provide integration in cross-account permissions'
                        }]
                }
            };
            new ssmplaybook_1.SsmRole(props.roleStack, 'RemediationRole ' + remediationName, {
                solutionId: props.solutionId,
                ssmDocName: remediationName,
                remediationPolicy: inlinePolicy,
                remediationRoleName: `${remediationRoleNameBase}${remediationName}`
            });
            runbook_factory_1.RunbookFactory.createRemediationRunbook(this, 'SHARR ' + remediationName, {
                ssmDocName: remediationName,
                ssmDocPath: ssmdocs,
                ssmDocFileName: `${remediationName}.yaml`,
                scriptPath: `${ssmdocs}/scripts`,
                solutionVersion: props.solutionVersion,
                solutionDistBucket: props.solutionDistBucket,
                solutionId: props.solutionId
            });
            let childToMod = inlinePolicy.node.findChild('Resource');
            childToMod.cfnOptions.metadata = {
                cfn_nag: {
                    rules_to_suppress: [{
                            id: 'W12',
                            reason: 'Resource * is required for to allow remediation for *any* resources.'
                        }]
                }
            };
        }
        //-----------------------
        // CreateAccessLoggingBucket
        //
        {
            const remediationName = 'CreateAccessLoggingBucket';
            const inlinePolicy = new aws_iam_1.Policy(props.roleStack, `SHARR-Remediation-Policy-${remediationName}`);
            const s3Perms = new aws_iam_1.PolicyStatement();
            s3Perms.addActions("s3:CreateBucket", "s3:PutEncryptionConfiguration", "s3:PutBucketAcl");
            s3Perms.effect = aws_iam_1.Effect.ALLOW;
            s3Perms.addResources("*");
            inlinePolicy.addStatements(s3Perms);
            new ssmplaybook_1.SsmRole(props.roleStack, 'RemediationRole ' + remediationName, {
                solutionId: props.solutionId,
                ssmDocName: remediationName,
                remediationPolicy: inlinePolicy,
                remediationRoleName: `${remediationRoleNameBase}${remediationName}`
            });
            runbook_factory_1.RunbookFactory.createRemediationRunbook(this, 'SHARR ' + remediationName, {
                ssmDocName: remediationName,
                ssmDocPath: ssmdocs,
                ssmDocFileName: `${remediationName}.yaml`,
                scriptPath: `${ssmdocs}/scripts`,
                solutionVersion: props.solutionVersion,
                solutionDistBucket: props.solutionDistBucket,
                solutionId: props.solutionId
            });
            let childToMod = inlinePolicy.node.findChild('Resource');
            childToMod.cfnOptions.metadata = {
                cfn_nag: {
                    rules_to_suppress: [{
                            id: 'W12',
                            reason: 'Resource * is required for to allow remediation for *any* resources.'
                        }]
                }
            };
        }
        //-----------------------
        // MakeEBSSnapshotsPrivate
        //
        {
            const remediationName = 'MakeEBSSnapshotsPrivate';
            const inlinePolicy = new aws_iam_1.Policy(props.roleStack, `SHARR-Remediation-Policy-${remediationName}`);
            const ec2Perms = new aws_iam_1.PolicyStatement();
            ec2Perms.addActions("ec2:ModifySnapshotAttribute", "ec2:DescribeSnapshots");
            ec2Perms.effect = aws_iam_1.Effect.ALLOW;
            ec2Perms.addResources("*");
            inlinePolicy.addStatements(ec2Perms);
            new ssmplaybook_1.SsmRole(props.roleStack, 'RemediationRole ' + remediationName, {
                solutionId: props.solutionId,
                ssmDocName: remediationName,
                remediationPolicy: inlinePolicy,
                remediationRoleName: `${remediationRoleNameBase}${remediationName}`
            });
            runbook_factory_1.RunbookFactory.createRemediationRunbook(this, 'SHARR ' + remediationName, {
                ssmDocName: remediationName,
                ssmDocPath: ssmdocs,
                ssmDocFileName: `${remediationName}.yaml`,
                scriptPath: `${ssmdocs}/scripts`,
                solutionVersion: props.solutionVersion,
                solutionDistBucket: props.solutionDistBucket,
                solutionId: props.solutionId
            });
            // CFN-NAG
            // WARN W12: IAM policy should not allow * resource
            let childToMod = inlinePolicy.node.findChild('Resource');
            childToMod.cfnOptions.metadata = {
                cfn_nag: {
                    rules_to_suppress: [{
                            id: 'W12',
                            reason: 'Resource * is required for to allow remediation for *any* snapshot.'
                        }]
                }
            };
        }
        //-----------------------
        // MakeRDSSnapshotPrivate
        //
        {
            const remediationName = 'MakeRDSSnapshotPrivate';
            const inlinePolicy = new aws_iam_1.Policy(props.roleStack, `SHARR-Remediation-Policy-${remediationName}`);
            const remediationPerms = new aws_iam_1.PolicyStatement();
            remediationPerms.addActions("rds:ModifyDBSnapshotAttribute", "rds:ModifyDBClusterSnapshotAttribute");
            remediationPerms.effect = aws_iam_1.Effect.ALLOW;
            remediationPerms.addResources("*");
            inlinePolicy.addStatements(remediationPerms);
            new ssmplaybook_1.SsmRole(props.roleStack, 'RemediationRole ' + remediationName, {
                solutionId: props.solutionId,
                ssmDocName: remediationName,
                remediationPolicy: inlinePolicy,
                remediationRoleName: `${remediationRoleNameBase}${remediationName}`
            });
            runbook_factory_1.RunbookFactory.createRemediationRunbook(this, 'SHARR ' + remediationName, {
                ssmDocName: remediationName,
                ssmDocPath: ssmdocs,
                ssmDocFileName: `${remediationName}.yaml`,
                scriptPath: `${ssmdocs}/scripts`,
                solutionVersion: props.solutionVersion,
                solutionDistBucket: props.solutionDistBucket,
                solutionId: props.solutionId
            });
            // CFN-NAG
            // WARN W12: IAM policy should not allow * resource
            let childToMod = inlinePolicy.node.findChild('Resource');
            childToMod.cfnOptions.metadata = {
                cfn_nag: {
                    rules_to_suppress: [{
                            id: 'W12',
                            reason: 'Resource * is required for to allow remediation for *any* snapshot.'
                        }]
                }
            };
        }
        //-----------------------
        // RemoveLambdaPublicAccess
        //
        {
            const remediationName = 'RemoveLambdaPublicAccess';
            const inlinePolicy = new aws_iam_1.Policy(props.roleStack, `SHARR-Remediation-Policy-${remediationName}`);
            const lambdaPerms = new aws_iam_1.PolicyStatement();
            lambdaPerms.addActions("lambda:GetPolicy", "lambda:RemovePermission");
            lambdaPerms.effect = aws_iam_1.Effect.ALLOW;
            lambdaPerms.addResources('*');
            inlinePolicy.addStatements(lambdaPerms);
            new ssmplaybook_1.SsmRole(props.roleStack, 'RemediationRole ' + remediationName, {
                solutionId: props.solutionId,
                ssmDocName: remediationName,
                remediationPolicy: inlinePolicy,
                remediationRoleName: `${remediationRoleNameBase}${remediationName}`
            });
            runbook_factory_1.RunbookFactory.createRemediationRunbook(this, 'SHARR ' + remediationName, {
                ssmDocName: remediationName,
                ssmDocPath: ssmdocs,
                ssmDocFileName: `${remediationName}.yaml`,
                scriptPath: `${ssmdocs}/scripts`,
                solutionVersion: props.solutionVersion,
                solutionDistBucket: props.solutionDistBucket,
                solutionId: props.solutionId
            });
            // CFN-NAG
            // WARN W12: IAM policy should not allow * resource
            let childToMod = inlinePolicy.node.findChild('Resource');
            childToMod.cfnOptions.metadata = {
                cfn_nag: {
                    rules_to_suppress: [{
                            id: 'W12',
                            reason: 'Resource * is required for to allow remediation for any resource.'
                        }]
                }
            };
        }
        //-----------------------
        // RevokeUnrotatedKeys
        //
        {
            const remediationName = 'RevokeUnrotatedKeys';
            const inlinePolicy = new aws_iam_1.Policy(props.roleStack, `SHARR-Remediation-Policy-${remediationName}`);
            const remediationPolicy = new aws_iam_1.PolicyStatement();
            remediationPolicy.addActions("iam:UpdateAccessKey", "iam:ListAccessKeys", "iam:GetAccessKeyLastUsed", "iam:GetUser");
            remediationPolicy.effect = aws_iam_1.Effect.ALLOW;
            remediationPolicy.addResources("arn:" + this.partition + ":iam::" + this.account + ":user/*");
            inlinePolicy.addStatements(remediationPolicy);
            const cfgPerms = new aws_iam_1.PolicyStatement();
            cfgPerms.addActions("config:ListDiscoveredResources");
            cfgPerms.effect = aws_iam_1.Effect.ALLOW;
            cfgPerms.addResources("*");
            inlinePolicy.addStatements(cfgPerms);
            new ssmplaybook_1.SsmRole(props.roleStack, 'RemediationRole ' + remediationName, {
                solutionId: props.solutionId,
                ssmDocName: remediationName,
                remediationPolicy: inlinePolicy,
                remediationRoleName: `${remediationRoleNameBase}${remediationName}`
            });
            runbook_factory_1.RunbookFactory.createRemediationRunbook(this, 'SHARR ' + remediationName, {
                ssmDocName: remediationName,
                ssmDocPath: ssmdocs,
                ssmDocFileName: `${remediationName}.yaml`,
                scriptPath: `${ssmdocs}/scripts`,
                solutionVersion: props.solutionVersion,
                solutionDistBucket: props.solutionDistBucket,
                solutionId: props.solutionId
            });
            let childToMod = inlinePolicy.node.findChild('Resource');
            childToMod.cfnOptions.metadata = {
                cfn_nag: {
                    rules_to_suppress: [{
                            id: 'W12',
                            reason: 'Resource * is required for to allow remediation for any resource.'
                        }]
                }
            };
        }
        //-----------------------
        // SetSSLBucketPolicy
        //
        {
            const remediationName = 'SetSSLBucketPolicy';
            const inlinePolicy = new aws_iam_1.Policy(props.roleStack, `SHARR-Remediation-Policy-${remediationName}`);
            {
                let remediationPerms = new aws_iam_1.PolicyStatement();
                remediationPerms.addActions("s3:GetBucketPolicy", "s3:PutBucketPolicy");
                remediationPerms.effect = aws_iam_1.Effect.ALLOW;
                remediationPerms.addResources("*");
                inlinePolicy.addStatements(remediationPerms);
            }
            new ssmplaybook_1.SsmRole(props.roleStack, 'RemediationRole ' + remediationName, {
                solutionId: props.solutionId,
                ssmDocName: remediationName,
                remediationPolicy: inlinePolicy,
                remediationRoleName: `${remediationRoleNameBase}${remediationName}`
            });
            let childToMod = inlinePolicy.node.findChild('Resource');
            childToMod.cfnOptions.metadata = {
                cfn_nag: {
                    rules_to_suppress: [{
                            id: 'W12',
                            reason: 'Resource * is required for to allow remediation for *any* resource.'
                        }]
                }
            };
            runbook_factory_1.RunbookFactory.createRemediationRunbook(this, 'SHARR ' + remediationName, {
                ssmDocName: remediationName,
                ssmDocPath: ssmdocs,
                ssmDocFileName: `${remediationName}.yaml`,
                scriptPath: `${ssmdocs}/scripts`,
                solutionVersion: props.solutionVersion,
                solutionDistBucket: props.solutionDistBucket,
                solutionId: props.solutionId
            });
        }
        //-----------------------
        // ReplaceCodeBuildClearTextCredentials
        //
        {
            const remediationName = 'ReplaceCodeBuildClearTextCredentials';
            const inlinePolicy = new aws_iam_1.Policy(props.roleStack, `SHARR-Remediation-Policy-${remediationName}`);
            const remediationPolicy = new aws_iam_1.PolicyStatement();
            remediationPolicy.addActions("codeBuild:BatchGetProjects", "codeBuild:UpdateProject", "ssm:PutParameter", "iam:CreatePolicy");
            remediationPolicy.effect = aws_iam_1.Effect.ALLOW;
            remediationPolicy.addResources("*");
            inlinePolicy.addStatements(remediationPolicy);
            // CodeBuild projects are built by service roles
            const attachRolePolicy = new aws_iam_1.PolicyStatement();
            attachRolePolicy.addActions('iam:AttachRolePolicy');
            attachRolePolicy.addResources(`arn:${this.partition}:iam::${this.account}:role/service-role/*`);
            inlinePolicy.addStatements(attachRolePolicy);
            // Just in case, explicitly deny permission to modify our own role policy
            const attachRolePolicyDeny = new aws_iam_1.PolicyStatement();
            attachRolePolicyDeny.addActions('iam:AttachRolePolicy');
            attachRolePolicyDeny.effect = aws_iam_1.Effect.DENY;
            attachRolePolicyDeny.addResources(`arn:${this.partition}:iam::${this.account}:role/${remediationRoleNameBase}${remediationName}`);
            inlinePolicy.addStatements(attachRolePolicyDeny);
            new ssmplaybook_1.SsmRole(props.roleStack, 'RemediationRole ' + remediationName, {
                solutionId: props.solutionId,
                ssmDocName: remediationName,
                remediationPolicy: inlinePolicy,
                remediationRoleName: `${remediationRoleNameBase}${remediationName}`
            });
            runbook_factory_1.RunbookFactory.createRemediationRunbook(this, 'SHARR ' + remediationName, {
                ssmDocName: remediationName,
                ssmDocPath: ssmdocs,
                ssmDocFileName: `${remediationName}.yaml`,
                scriptPath: `${ssmdocs}/scripts`,
                solutionVersion: props.solutionVersion,
                solutionDistBucket: props.solutionDistBucket,
                solutionId: props.solutionId
            });
            let childToMod = inlinePolicy.node.findChild('Resource');
            childToMod.cfnOptions.metadata = {
                cfn_nag: {
                    rules_to_suppress: [{
                            id: 'W12',
                            reason: 'Resource * is required for to allow remediation for *any* resource.'
                        }]
                }
            };
        }
        //----------------------------
        // S3BlockDenyList
        //
        {
            const remediationName = 'S3BlockDenylist';
            const inlinePolicy = new aws_iam_1.Policy(props.roleStack, `SHARR-Remediation-Policy-${remediationName}`);
            const remediationPolicy = new aws_iam_1.PolicyStatement();
            remediationPolicy.addActions("s3:PutBucketPolicy", "s3:GetBucketPolicy");
            remediationPolicy.effect = aws_iam_1.Effect.ALLOW;
            remediationPolicy.addResources("*");
            inlinePolicy.addStatements(remediationPolicy);
            new ssmplaybook_1.SsmRole(props.roleStack, 'RemediationRole ' + remediationName, {
                solutionId: props.solutionId,
                ssmDocName: remediationName,
                remediationPolicy: inlinePolicy,
                remediationRoleName: `${remediationRoleNameBase}${remediationName}`
            });
            runbook_factory_1.RunbookFactory.createRemediationRunbook(this, 'SHARR ' + remediationName, {
                ssmDocName: remediationName,
                ssmDocPath: ssmdocs,
                ssmDocFileName: `${remediationName}.yaml`,
                scriptPath: `${ssmdocs}/scripts`,
                solutionVersion: props.solutionVersion,
                solutionDistBucket: props.solutionDistBucket,
                solutionId: props.solutionId
            });
            let childToMod = inlinePolicy.node.findChild('Resource');
            childToMod.cfnOptions.metadata = {
                cfn_nag: {
                    rules_to_suppress: [{
                            id: 'W12',
                            reason: 'Resource * is required for to allow remediation for *any* resource.'
                        }]
                }
            };
        }
        //-----------------------------------------
        // AWS-EncryptRdsSnapshot
        //
        {
            const remediationName = 'EncryptRDSSnapshot';
            const inlinePolicy = new aws_iam_1.Policy(props.roleStack, `SHARR-Remediation-Policy-${remediationName}`);
            const remediationPolicy = new aws_iam_1.PolicyStatement();
            remediationPolicy.addActions('rds:CopyDBSnapshot', 'rds:CopyDBClusterSnapshot', 'rds:DescribeDBSnapshots', 'rds:DescribeDBClusterSnapshots', 'rds:DeleteDBSnapshot', 'rds:DeleteDBClusterSnapshots');
            remediationPolicy.effect = aws_iam_1.Effect.ALLOW;
            remediationPolicy.addResources('*');
            inlinePolicy.addStatements(remediationPolicy);
            new ssmplaybook_1.SsmRole(props.roleStack, 'RemediationRole ' + remediationName, {
                solutionId: props.solutionId,
                ssmDocName: remediationName,
                remediationPolicy: inlinePolicy,
                remediationRoleName: `${remediationRoleNameBase}${remediationName}`
            });
            runbook_factory_1.RunbookFactory.createRemediationRunbook(this, 'SHARR ' + remediationName, {
                ssmDocName: remediationName,
                ssmDocPath: ssmdocs,
                ssmDocFileName: `${remediationName}.yaml`,
                scriptPath: `${ssmdocs}/scripts`,
                solutionVersion: props.solutionVersion,
                solutionDistBucket: props.solutionDistBucket,
                solutionId: props.solutionId
            });
            let childToMod = inlinePolicy.node.findChild('Resource');
            childToMod.cfnOptions.metadata = {
                cfn_nag: {
                    rules_to_suppress: [
                        {
                            id: 'W12',
                            reason: 'Resource * is required for to allow remediation for *any* resource.'
                        }
                    ]
                }
            };
        }
        //-----------------------
        // DisablePublicAccessToRedshiftCluster
        //
        {
            const remediationName = 'DisablePublicAccessToRedshiftCluster';
            const inlinePolicy = new aws_iam_1.Policy(props.roleStack, `SHARR-Remediation-Policy-${remediationName}`);
            const remediationPolicy = new aws_iam_1.PolicyStatement();
            remediationPolicy.addActions('redshift:ModifyCluster', 'redshift:DescribeClusters');
            remediationPolicy.effect = aws_iam_1.Effect.ALLOW;
            remediationPolicy.addResources('*');
            inlinePolicy.addStatements(remediationPolicy);
            new ssmplaybook_1.SsmRole(props.roleStack, 'RemediationRole ' + remediationName, {
                solutionId: props.solutionId,
                ssmDocName: remediationName,
                remediationPolicy: inlinePolicy,
                remediationRoleName: `${remediationRoleNameBase}${remediationName}`
            });
            runbook_factory_1.RunbookFactory.createRemediationRunbook(this, 'SHARR ' + remediationName, {
                ssmDocName: remediationName,
                ssmDocPath: ssmdocs,
                ssmDocFileName: `${remediationName}.yaml`,
                scriptPath: `${ssmdocs}/scripts`,
                solutionVersion: props.solutionVersion,
                solutionDistBucket: props.solutionDistBucket,
                solutionId: props.solutionId
            });
            const childToMod = inlinePolicy.node.findChild('Resource');
            childToMod.cfnOptions.metadata = {
                cfn_nag: {
                    rules_to_suppress: [
                        {
                            id: 'W12',
                            reason: 'Resource * is required for to allow remediation for any resource.'
                        }
                    ]
                }
            };
        }
        //-----------------------
        // EnableRedshiftClusterAuditLogging
        //
        {
            const remediationName = 'EnableRedshiftClusterAuditLogging';
            const inlinePolicy = new aws_iam_1.Policy(props.roleStack, `SHARR-Remediation-Policy-${remediationName}`);
            const remediationPolicy = new aws_iam_1.PolicyStatement();
            remediationPolicy.addActions('redshift:DescribeLoggingStatus', 'redshift:EnableLogging');
            remediationPolicy.effect = aws_iam_1.Effect.ALLOW;
            remediationPolicy.addResources('*');
            inlinePolicy.addStatements(remediationPolicy);
            remediationPolicy.addActions('s3:PutObject');
            remediationPolicy.effect = aws_iam_1.Effect.ALLOW;
            remediationPolicy.addResources('*');
            inlinePolicy.addStatements(remediationPolicy);
            new ssmplaybook_1.SsmRole(props.roleStack, 'RemediationRole ' + remediationName, {
                solutionId: props.solutionId,
                ssmDocName: remediationName,
                remediationPolicy: inlinePolicy,
                remediationRoleName: `${remediationRoleNameBase}${remediationName}`
            });
            runbook_factory_1.RunbookFactory.createRemediationRunbook(this, 'SHARR ' + remediationName, {
                ssmDocName: remediationName,
                ssmDocPath: ssmdocs,
                ssmDocFileName: `${remediationName}.yaml`,
                scriptPath: `${ssmdocs}/scripts`,
                solutionVersion: props.solutionVersion,
                solutionDistBucket: props.solutionDistBucket,
                solutionId: props.solutionId
            });
            const childToMod = inlinePolicy.node.findChild('Resource');
            childToMod.cfnOptions.metadata = {
                cfn_nag: {
                    rules_to_suppress: [
                        {
                            id: 'W12',
                            reason: 'Resource * is required for to allow remediation for any resource.'
                        }
                    ]
                }
            };
        }
        //-----------------------
        // EnableAutomaticVersionUpgradeOnRedshiftCluster
        //
        {
            const remediationName = 'EnableAutomaticVersionUpgradeOnRedshiftCluster';
            const inlinePolicy = new aws_iam_1.Policy(props.roleStack, `SHARR-Remediation-Policy-${remediationName}`);
            const remediationPolicy = new aws_iam_1.PolicyStatement();
            remediationPolicy.addActions('redshift:ModifyCluster', 'redshift:DescribeClusters');
            remediationPolicy.effect = aws_iam_1.Effect.ALLOW;
            remediationPolicy.addResources('*');
            inlinePolicy.addStatements(remediationPolicy);
            new ssmplaybook_1.SsmRole(props.roleStack, 'RemediationRole ' + remediationName, {
                solutionId: props.solutionId,
                ssmDocName: remediationName,
                remediationPolicy: inlinePolicy,
                remediationRoleName: `${remediationRoleNameBase}${remediationName}`
            });
            runbook_factory_1.RunbookFactory.createRemediationRunbook(this, 'SHARR ' + remediationName, {
                ssmDocName: remediationName,
                ssmDocPath: ssmdocs,
                ssmDocFileName: `${remediationName}.yaml`,
                scriptPath: `${ssmdocs}/scripts`,
                solutionVersion: props.solutionVersion,
                solutionDistBucket: props.solutionDistBucket,
                solutionId: props.solutionId
            });
            const childToMod = inlinePolicy.node.findChild('Resource');
            childToMod.cfnOptions.metadata = {
                cfn_nag: {
                    rules_to_suppress: [
                        {
                            id: 'W12',
                            reason: 'Resource * is required for to allow remediation for any resource.'
                        }
                    ]
                }
            };
        }
        //-----------------------
        // EnableAutomaticSnapshotsOnRedshiftCluster
        //
        {
            const remediationName = 'EnableAutomaticSnapshotsOnRedshiftCluster';
            const inlinePolicy = new aws_iam_1.Policy(props.roleStack, `SHARR-Remediation-Policy-${remediationName}`);
            const remediationPolicy = new aws_iam_1.PolicyStatement();
            remediationPolicy.addActions('redshift:ModifyCluster', 'redshift:DescribeClusters');
            remediationPolicy.effect = aws_iam_1.Effect.ALLOW;
            remediationPolicy.addResources('*');
            inlinePolicy.addStatements(remediationPolicy);
            new ssmplaybook_1.SsmRole(props.roleStack, 'RemediationRole ' + remediationName, {
                solutionId: props.solutionId,
                ssmDocName: remediationName,
                remediationPolicy: inlinePolicy,
                remediationRoleName: `${remediationRoleNameBase}${remediationName}`
            });
            runbook_factory_1.RunbookFactory.createRemediationRunbook(this, 'SHARR ' + remediationName, {
                ssmDocName: remediationName,
                ssmDocPath: ssmdocs,
                ssmDocFileName: `${remediationName}.yaml`,
                scriptPath: `${ssmdocs}/scripts`,
                solutionVersion: props.solutionVersion,
                solutionDistBucket: props.solutionDistBucket,
                solutionId: props.solutionId
            });
            const childToMod = inlinePolicy.node.findChild('Resource');
            childToMod.cfnOptions.metadata = {
                cfn_nag: {
                    rules_to_suppress: [
                        {
                            id: 'W12',
                            reason: 'Resource * is required for to allow remediation for any resource.'
                        }
                    ]
                }
            };
        }
        //=========================================================================
        // The following are permissions only for use with AWS-owned documents that
        //   are available to GovCloud and China partition customers.
        //=========================================================================
        //-----------------------
        // AWS-ConfigureS3BucketLogging
        //
        {
            const remediationName = 'ConfigureS3BucketLogging';
            const inlinePolicy = new aws_iam_1.Policy(props.roleStack, `SHARR-Remediation-Policy-${remediationName}`);
            const s3Perms = new aws_iam_1.PolicyStatement();
            s3Perms.addActions("s3:PutBucketLogging", "s3:CreateBucket", "s3:PutEncryptionConfiguration");
            s3Perms.addActions("s3:PutBucketAcl");
            s3Perms.effect = aws_iam_1.Effect.ALLOW;
            s3Perms.addResources("*");
            inlinePolicy.addStatements(s3Perms);
            new ssmplaybook_1.SsmRole(props.roleStack, 'RemediationRole ' + remediationName, {
                solutionId: props.solutionId,
                ssmDocName: remediationName,
                remediationPolicy: inlinePolicy,
                remediationRoleName: `${remediationRoleNameBase}${remediationName}`
            });
            let childToMod = inlinePolicy.node.findChild('Resource');
            childToMod.cfnOptions.metadata = {
                cfn_nag: {
                    rules_to_suppress: [{
                            id: 'W12',
                            reason: 'Resource * is required for to allow remediation for *any* resource.'
                        }]
                }
            };
        }
        //-----------------------------------------
        // AWS-DisablePublicAccessForSecurityGroup
        //
        {
            const remediationName = 'DisablePublicAccessForSecurityGroup';
            const inlinePolicy = new aws_iam_1.Policy(props.roleStack, `SHARR-Remediation-Policy-${remediationName}`);
            const remediationPermsEc2 = new aws_iam_1.PolicyStatement();
            remediationPermsEc2.addActions("ec2:DescribeSecurityGroupReferences", "ec2:DescribeSecurityGroups", "ec2:UpdateSecurityGroupRuleDescriptionsEgress", "ec2:UpdateSecurityGroupRuleDescriptionsIngress", "ec2:RevokeSecurityGroupIngress", "ec2:RevokeSecurityGroupEgress");
            remediationPermsEc2.effect = aws_iam_1.Effect.ALLOW;
            remediationPermsEc2.addResources("*");
            inlinePolicy.addStatements(remediationPermsEc2);
            new ssmplaybook_1.SsmRole(props.roleStack, 'RemediationRole ' + remediationName, {
                solutionId: props.solutionId,
                ssmDocName: remediationName,
                remediationPolicy: inlinePolicy,
                remediationRoleName: `${remediationRoleNameBase}${remediationName}`
            });
            let childToMod = inlinePolicy.node.findChild('Resource');
            childToMod.cfnOptions.metadata = {
                cfn_nag: {
                    rules_to_suppress: [{
                            id: 'W12',
                            reason: 'Resource * is required for to allow remediation for *any* resource.'
                        }]
                }
            };
        }
        //=========================================================================
        // The following runbooks are copied from AWS-owned documents to make them
        //   available to GovCloud and China partition customers. The
        //   SsmRemediationRunbook should be removed when they become available in
        //   aws-cn and aws-us-gov. The SsmRole must be retained.
        //=========================================================================
        //-----------------------
        // AWSConfigRemediation-ConfigureS3BucketPublicAccessBlock
        //
        {
            const remediationName = 'ConfigureS3BucketPublicAccessBlock';
            const inlinePolicy = new aws_iam_1.Policy(props.roleStack, `SHARR-Remediation-Policy-${remediationName}`);
            const remediationPolicy = new aws_iam_1.PolicyStatement();
            remediationPolicy.addActions("s3:PutBucketPublicAccessBlock", "s3:GetBucketPublicAccessBlock");
            remediationPolicy.effect = aws_iam_1.Effect.ALLOW;
            remediationPolicy.addResources("*");
            inlinePolicy.addStatements(remediationPolicy);
            new ssmplaybook_1.SsmRole(props.roleStack, 'RemediationRole ' + remediationName, {
                solutionId: props.solutionId,
                ssmDocName: remediationName,
                remediationPolicy: inlinePolicy,
                remediationRoleName: `${remediationRoleNameBase}${remediationName}`
            });
            runbook_factory_1.RunbookFactory.createRemediationRunbook(this, 'SHARR ' + remediationName, {
                ssmDocName: remediationName,
                ssmDocPath: ssmdocs,
                ssmDocFileName: `${remediationName}.yaml`,
                scriptPath: `${ssmdocs}/scripts`,
                solutionVersion: props.solutionVersion,
                solutionDistBucket: props.solutionDistBucket,
                solutionId: props.solutionId
            });
            let childToMod = inlinePolicy.node.findChild('Resource');
            childToMod.cfnOptions.metadata = {
                cfn_nag: {
                    rules_to_suppress: [{
                            id: 'W12',
                            reason: 'Resource * is required for to allow remediation for *any* resource.'
                        }]
                }
            };
        }
        //-----------------------
        // AWSConfigRemediation-ConfigureS3PublicAccessBlock
        //
        {
            const remediationName = 'ConfigureS3PublicAccessBlock';
            const inlinePolicy = new aws_iam_1.Policy(props.roleStack, `SHARR-Remediation-Policy-${remediationName}`);
            const remediationPolicy = new aws_iam_1.PolicyStatement();
            remediationPolicy.addActions("s3:PutAccountPublicAccessBlock", "s3:GetAccountPublicAccessBlock");
            remediationPolicy.effect = aws_iam_1.Effect.ALLOW;
            remediationPolicy.addResources("*");
            inlinePolicy.addStatements(remediationPolicy);
            new ssmplaybook_1.SsmRole(props.roleStack, 'RemediationRole ' + remediationName, {
                solutionId: props.solutionId,
                ssmDocName: remediationName,
                remediationPolicy: inlinePolicy,
                remediationRoleName: `${remediationRoleNameBase}${remediationName}`
            });
            runbook_factory_1.RunbookFactory.createRemediationRunbook(this, 'SHARR ' + remediationName, {
                ssmDocName: remediationName,
                ssmDocPath: ssmdocs,
                ssmDocFileName: `${remediationName}.yaml`,
                scriptPath: `${ssmdocs}/scripts`,
                solutionVersion: props.solutionVersion,
                solutionDistBucket: props.solutionDistBucket,
                solutionId: props.solutionId
            });
            let childToMod = inlinePolicy.node.findChild('Resource');
            childToMod.cfnOptions.metadata = {
                cfn_nag: {
                    rules_to_suppress: [{
                            id: 'W12',
                            reason: 'Resource * is required for to allow remediation for *any* resource.'
                        }]
                }
            };
        }
        //-----------------------
        // AWSConfigRemediation-EnableCloudTrailLogFileValidation
        //
        {
            const remediationName = 'EnableCloudTrailLogFileValidation';
            const inlinePolicy = new aws_iam_1.Policy(props.roleStack, `SHARR-Remediation-Policy-${remediationName}`);
            const remediationPolicy = new aws_iam_1.PolicyStatement();
            remediationPolicy.addActions("cloudtrail:UpdateTrail", "cloudtrail:GetTrail");
            remediationPolicy.effect = aws_iam_1.Effect.ALLOW;
            remediationPolicy.addResources("arn:" + this.partition + ":cloudtrail:*:" + this.account + ":trail/*");
            inlinePolicy.addStatements(remediationPolicy);
            new ssmplaybook_1.SsmRole(props.roleStack, 'RemediationRole ' + remediationName, {
                solutionId: props.solutionId,
                ssmDocName: remediationName,
                remediationPolicy: inlinePolicy,
                remediationRoleName: `${remediationRoleNameBase}${remediationName}`
            });
            runbook_factory_1.RunbookFactory.createRemediationRunbook(this, 'SHARR ' + remediationName, {
                ssmDocName: remediationName,
                ssmDocPath: ssmdocs,
                ssmDocFileName: `${remediationName}.yaml`,
                scriptPath: `${ssmdocs}/scripts`,
                solutionVersion: props.solutionVersion,
                solutionDistBucket: props.solutionDistBucket,
                solutionId: props.solutionId
            });
        }
        //-----------------------
        // AWSConfigRemediation-EnableEbsEncryptionByDefault
        //
        {
            const remediationName = 'EnableEbsEncryptionByDefault';
            const inlinePolicy = new aws_iam_1.Policy(props.roleStack, `SHARR-Remediation-Policy-${remediationName}`);
            const ec2Perms = new aws_iam_1.PolicyStatement();
            ec2Perms.addActions("ec2:EnableEBSEncryptionByDefault", "ec2:GetEbsEncryptionByDefault");
            ec2Perms.effect = aws_iam_1.Effect.ALLOW;
            ec2Perms.addResources("*");
            inlinePolicy.addStatements(ec2Perms);
            new ssmplaybook_1.SsmRole(props.roleStack, 'RemediationRole ' + remediationName, {
                solutionId: props.solutionId,
                ssmDocName: remediationName,
                remediationPolicy: inlinePolicy,
                remediationRoleName: `${remediationRoleNameBase}${remediationName}`
            });
            runbook_factory_1.RunbookFactory.createRemediationRunbook(this, 'SHARR ' + remediationName, {
                ssmDocName: remediationName,
                ssmDocPath: ssmdocs,
                ssmDocFileName: `${remediationName}.yaml`,
                scriptPath: `${ssmdocs}/scripts`,
                solutionVersion: props.solutionVersion,
                solutionDistBucket: props.solutionDistBucket,
                solutionId: props.solutionId
            });
            // CFN-NAG
            // WARN W12: IAM policy should not allow * resource
            let childToMod = inlinePolicy.node.findChild('Resource');
            childToMod.cfnOptions.metadata = {
                cfn_nag: {
                    rules_to_suppress: [{
                            id: 'W12',
                            reason: 'Resource * is required for to allow remediation for *any* resource.'
                        }]
                }
            };
        }
        //-----------------------
        // AWSConfigRemediation-EnableEnhancedMonitoringOnRDSInstance
        //
        {
            const remediationName = 'EnableEnhancedMonitoringOnRDSInstance';
            const inlinePolicy = new aws_iam_1.Policy(props.roleStack, `SHARR-Remediation-Policy-${remediationName}`);
            {
                let iamPerms = new aws_iam_1.PolicyStatement();
                iamPerms.addActions("iam:GetRole", "iam:PassRole");
                iamPerms.effect = aws_iam_1.Effect.ALLOW;
                iamPerms.addResources(`arn:${this.partition}:iam::${this.account}:role/${RESOURCE_PREFIX}-RDSMonitoring-remediationRole`);
                inlinePolicy.addStatements(iamPerms);
            }
            {
                const rdsPerms = new aws_iam_1.PolicyStatement();
                rdsPerms.addActions("rds:DescribeDBInstances", "rds:ModifyDBInstance");
                rdsPerms.effect = aws_iam_1.Effect.ALLOW;
                rdsPerms.addResources("*");
                inlinePolicy.addStatements(rdsPerms);
            }
            new ssmplaybook_1.SsmRole(props.roleStack, 'RemediationRole ' + remediationName, {
                solutionId: props.solutionId,
                ssmDocName: remediationName,
                remediationPolicy: inlinePolicy,
                remediationRoleName: `${remediationRoleNameBase}${remediationName}`
            });
            runbook_factory_1.RunbookFactory.createRemediationRunbook(this, 'SHARR ' + remediationName, {
                ssmDocName: remediationName,
                ssmDocPath: ssmdocs,
                ssmDocFileName: `${remediationName}.yaml`,
                scriptPath: `${ssmdocs}/scripts`,
                solutionVersion: props.solutionVersion,
                solutionDistBucket: props.solutionDistBucket,
                solutionId: props.solutionId
            });
            // CFN-NAG
            // WARN W12: IAM policy should not allow * resource
            let childToMod = inlinePolicy.node.findChild('Resource');
            childToMod.cfnOptions.metadata = {
                cfn_nag: {
                    rules_to_suppress: [{
                            id: 'W12',
                            reason: 'Resource * is required for to allow remediation for *any* RDS database.'
                        }]
                }
            };
            new rds6_remediation_resources_1.Rds6EnhancedMonitoringRole(props.roleStack, 'Rds6EnhancedMonitoringRole', {
                roleName: `${RESOURCE_PREFIX}-RDSMonitoring-remediationRole`
            });
        }
        //-----------------------
        // AWSConfigRemediation-EnableKeyRotation
        //
        {
            const remediationName = 'EnableKeyRotation';
            const inlinePolicy = new aws_iam_1.Policy(props.roleStack, `SHARR-Remediation-Policy-${remediationName}`);
            const remediationPerms = new aws_iam_1.PolicyStatement();
            remediationPerms.addActions("kms:EnableKeyRotation", "kms:GetKeyRotationStatus");
            remediationPerms.effect = aws_iam_1.Effect.ALLOW;
            remediationPerms.addResources("*");
            inlinePolicy.addStatements(remediationPerms);
            new ssmplaybook_1.SsmRole(props.roleStack, 'RemediationRole ' + remediationName, {
                solutionId: props.solutionId,
                ssmDocName: remediationName,
                remediationPolicy: inlinePolicy,
                remediationRoleName: `${remediationRoleNameBase}${remediationName}`
            });
            runbook_factory_1.RunbookFactory.createRemediationRunbook(this, 'SHARR ' + remediationName, {
                ssmDocName: remediationName,
                ssmDocPath: ssmdocs,
                ssmDocFileName: `${remediationName}.yaml`,
                scriptPath: `${ssmdocs}/scripts`,
                solutionVersion: props.solutionVersion,
                solutionDistBucket: props.solutionDistBucket,
                solutionId: props.solutionId
            });
            // CFN-NAG
            // WARN W12: IAM policy should not allow * resource
            let childToMod = inlinePolicy.node.findChild('Resource');
            childToMod.cfnOptions.metadata = {
                cfn_nag: {
                    rules_to_suppress: [{
                            id: 'W12',
                            reason: 'Resource * is required for to allow remediation for *any* resource.'
                        }]
                }
            };
        }
        //-----------------------
        // AWSConfigRemediation-EnableRDSClusterDeletionProtection
        //
        {
            const remediationName = 'EnableRDSClusterDeletionProtection';
            const inlinePolicy = new aws_iam_1.Policy(props.roleStack, `SHARR-Remediation-Policy-${remediationName}`);
            const iamPerms = new aws_iam_1.PolicyStatement();
            iamPerms.addActions("iam:GetRole");
            iamPerms.effect = aws_iam_1.Effect.ALLOW;
            iamPerms.addResources('arn:' + this.partition + ':iam::' + this.account + ':role/RDSEnhancedMonitoringRole');
            inlinePolicy.addStatements(iamPerms);
            const configPerms = new aws_iam_1.PolicyStatement();
            configPerms.addActions("config:GetResourceConfigHistory");
            configPerms.effect = aws_iam_1.Effect.ALLOW;
            configPerms.addResources("*");
            inlinePolicy.addStatements(configPerms);
            const rdsPerms = new aws_iam_1.PolicyStatement();
            rdsPerms.addActions("rds:DescribeDBClusters", "rds:ModifyDBCluster");
            rdsPerms.effect = aws_iam_1.Effect.ALLOW;
            rdsPerms.addResources("*");
            inlinePolicy.addStatements(rdsPerms);
            new ssmplaybook_1.SsmRole(props.roleStack, 'RemediationRole ' + remediationName, {
                solutionId: props.solutionId,
                ssmDocName: remediationName,
                remediationPolicy: inlinePolicy,
                remediationRoleName: `${remediationRoleNameBase}${remediationName}`
            });
            runbook_factory_1.RunbookFactory.createRemediationRunbook(this, 'SHARR ' + remediationName, {
                ssmDocName: remediationName,
                ssmDocPath: ssmdocs,
                ssmDocFileName: `${remediationName}.yaml`,
                scriptPath: `${ssmdocs}/scripts`,
                solutionVersion: props.solutionVersion,
                solutionDistBucket: props.solutionDistBucket,
                solutionId: props.solutionId
            });
            // CFN-NAG
            // WARN W12: IAM policy should not allow * resource
            let childToMod = inlinePolicy.node.findChild('Resource');
            childToMod.cfnOptions.metadata = {
                cfn_nag: {
                    rules_to_suppress: [{
                            id: 'W12',
                            reason: 'Resource * is required for to allow remediation for *any* RDS database.'
                        }]
                }
            };
        }
        //-----------------------
        // AWSConfigRemediation-EnableCopyTagsToSnapshotOnRDSCluster
        //
        {
            const remediationName = 'EnableCopyTagsToSnapshotOnRDSCluster';
            const inlinePolicy = new aws_iam_1.Policy(props.roleStack, `SHARR-Remediation-Policy-${remediationName}`);
            const iamPerms = new aws_iam_1.PolicyStatement();
            iamPerms.addActions("iam:GetRole");
            iamPerms.effect = aws_iam_1.Effect.ALLOW;
            iamPerms.addResources('arn:' + this.partition + ':iam::' + this.account + ':role/RDSEnhancedMonitoringRole');
            inlinePolicy.addStatements(iamPerms);
            const configPerms = new aws_iam_1.PolicyStatement();
            configPerms.addActions("config:GetResourceConfigHistory");
            configPerms.effect = aws_iam_1.Effect.ALLOW;
            configPerms.addResources("*");
            inlinePolicy.addStatements(configPerms);
            const rdsPerms = new aws_iam_1.PolicyStatement();
            rdsPerms.addActions("rds:DescribeDBClusters", "rds:ModifyDBCluster");
            rdsPerms.effect = aws_iam_1.Effect.ALLOW;
            rdsPerms.addResources("*");
            inlinePolicy.addStatements(rdsPerms);
            new ssmplaybook_1.SsmRole(props.roleStack, 'RemediationRole ' + remediationName, {
                solutionId: props.solutionId,
                ssmDocName: remediationName,
                remediationPolicy: inlinePolicy,
                remediationRoleName: `${remediationRoleNameBase}${remediationName}`
            });
            runbook_factory_1.RunbookFactory.createRemediationRunbook(this, 'SHARR ' + remediationName, {
                ssmDocName: remediationName,
                ssmDocPath: ssmdocs,
                ssmDocFileName: `${remediationName}.yaml`,
                scriptPath: `${ssmdocs}/scripts`,
                solutionVersion: props.solutionVersion,
                solutionDistBucket: props.solutionDistBucket,
                solutionId: props.solutionId
            });
            // CFN-NAG
            // WARN W12: IAM policy should not allow * resource
            let childToMod = inlinePolicy.node.findChild('Resource');
            childToMod.cfnOptions.metadata = {
                cfn_nag: {
                    rules_to_suppress: [{
                            id: 'W12',
                            reason: 'Resource * is required for to allow remediation for *any* RDS database.'
                        }]
                }
            };
        }
        //-----------------------
        // EnableRDSInstanceDeletionProtection
        //
        {
            const remediationName = 'EnableRDSInstanceDeletionProtection';
            const inlinePolicy = new aws_iam_1.Policy(props.roleStack, `SHARR-Remediation-Policy-${remediationName}`);
            const rdsPerms = new aws_iam_1.PolicyStatement();
            rdsPerms.addActions('rds:DescribeDBInstances', 'rds:ModifyDBInstance');
            rdsPerms.addResources('*');
            inlinePolicy.addStatements(rdsPerms);
            new ssmplaybook_1.SsmRole(props.roleStack, 'RemediationRole ' + remediationName, {
                solutionId: props.solutionId,
                ssmDocName: remediationName,
                remediationPolicy: inlinePolicy,
                remediationRoleName: `${remediationRoleNameBase}${remediationName}`
            });
            runbook_factory_1.RunbookFactory.createRemediationRunbook(this, 'SHARR ' + remediationName, {
                ssmDocName: remediationName,
                ssmDocPath: ssmdocs,
                ssmDocFileName: `${remediationName}.yaml`,
                scriptPath: `${ssmdocs}/scripts`,
                solutionVersion: props.solutionVersion,
                solutionDistBucket: props.solutionDistBucket,
                solutionId: props.solutionId
            });
            let childToMod = inlinePolicy.node.findChild('Resource');
            childToMod.cfnOptions.metadata = {
                cfn_nag: {
                    rules_to_suppress: [{
                            id: 'W12',
                            reason: 'Resource * is required for to allow remediation for *any* RDS database.'
                        }]
                }
            };
        }
        //-----------------------
        // EnableMultiAZOnRDSInstance
        //
        {
            const remediationName = 'EnableMultiAZOnRDSInstance';
            const inlinePolicy = new aws_iam_1.Policy(props.roleStack, `SHARR-Remediation-Policy-${remediationName}`);
            const rdsPerms = new aws_iam_1.PolicyStatement();
            rdsPerms.addActions('rds:DescribeDBInstances', 'rds:ModifyDBInstance');
            rdsPerms.addResources('*');
            inlinePolicy.addStatements(rdsPerms);
            new ssmplaybook_1.SsmRole(props.roleStack, 'RemediationRole ' + remediationName, {
                solutionId: props.solutionId,
                ssmDocName: remediationName,
                remediationPolicy: inlinePolicy,
                remediationRoleName: `${remediationRoleNameBase}${remediationName}`
            });
            runbook_factory_1.RunbookFactory.createRemediationRunbook(this, 'SHARR ' + remediationName, {
                ssmDocName: remediationName,
                ssmDocPath: ssmdocs,
                ssmDocFileName: `${remediationName}.yaml`,
                scriptPath: `${ssmdocs}/scripts`,
                solutionVersion: props.solutionVersion,
                solutionDistBucket: props.solutionDistBucket,
                solutionId: props.solutionId
            });
            let childToMod = inlinePolicy.node.findChild('Resource');
            childToMod.cfnOptions.metadata = {
                cfn_nag: {
                    rules_to_suppress: [{
                            id: 'W12',
                            reason: 'Resource * is required for to allow remediation for *any* RDS database.'
                        }]
                }
            };
        }
        //-----------------------
        // AWSConfigRemediation-RemoveVPCDefaultSecurityGroupRules
        //
        {
            const remediationName = 'RemoveVPCDefaultSecurityGroupRules';
            const inlinePolicy = new aws_iam_1.Policy(props.roleStack, `SHARR-Remediation-Policy-${remediationName}`);
            const remediationPolicy1 = new aws_iam_1.PolicyStatement();
            remediationPolicy1.addActions("ec2:UpdateSecurityGroupRuleDescriptionsEgress", "ec2:UpdateSecurityGroupRuleDescriptionsIngress", "ec2:RevokeSecurityGroupIngress", "ec2:RevokeSecurityGroupEgress");
            remediationPolicy1.effect = aws_iam_1.Effect.ALLOW;
            remediationPolicy1.addResources("arn:" + this.partition + ":ec2:*:" + this.account + ":security-group/*");
            const remediationPolicy2 = new aws_iam_1.PolicyStatement();
            remediationPolicy2.addActions("ec2:DescribeSecurityGroupReferences", "ec2:DescribeSecurityGroups");
            remediationPolicy2.effect = aws_iam_1.Effect.ALLOW;
            remediationPolicy2.addResources("*");
            inlinePolicy.addStatements(remediationPolicy1, remediationPolicy2);
            new ssmplaybook_1.SsmRole(props.roleStack, 'RemediationRole ' + remediationName, {
                solutionId: props.solutionId,
                ssmDocName: remediationName,
                remediationPolicy: inlinePolicy,
                remediationRoleName: `${remediationRoleNameBase}${remediationName}`
            });
            runbook_factory_1.RunbookFactory.createRemediationRunbook(this, 'SHARR ' + remediationName, {
                ssmDocName: remediationName,
                ssmDocPath: ssmdocs,
                ssmDocFileName: `${remediationName}.yaml`,
                scriptPath: `${ssmdocs}/scripts`,
                solutionVersion: props.solutionVersion,
                solutionDistBucket: props.solutionDistBucket,
                solutionId: props.solutionId
            });
            let childToMod = inlinePolicy.node.findChild('Resource');
            childToMod.cfnOptions.metadata = {
                cfn_nag: {
                    rules_to_suppress: [{
                            id: 'W12',
                            reason: 'Resource * is required for to allow remediation for any resource.'
                        }, {
                            id: 'W28',
                            reason: 'Static names chosen intentionally to provide integration in cross-account permissions'
                        }]
                }
            };
        }
        //-----------------------
        // AWSConfigRemediation-RevokeUnusedIAMUserCredentials
        //
        {
            const remediationName = 'RevokeUnusedIAMUserCredentials';
            const inlinePolicy = new aws_iam_1.Policy(props.roleStack, `SHARR-Remediation-Policy-${remediationName}`);
            const remediationPolicy = new aws_iam_1.PolicyStatement();
            remediationPolicy.addActions("iam:UpdateAccessKey", "iam:ListAccessKeys", "iam:GetAccessKeyLastUsed", "iam:GetUser", "iam:GetLoginProfile", "iam:DeleteLoginProfile");
            remediationPolicy.effect = aws_iam_1.Effect.ALLOW;
            remediationPolicy.addResources("arn:" + this.partition + ":iam::" + this.account + ":user/*");
            inlinePolicy.addStatements(remediationPolicy);
            const cfgPerms = new aws_iam_1.PolicyStatement();
            cfgPerms.addActions("config:ListDiscoveredResources");
            cfgPerms.effect = aws_iam_1.Effect.ALLOW;
            cfgPerms.addResources("*");
            inlinePolicy.addStatements(cfgPerms);
            new ssmplaybook_1.SsmRole(props.roleStack, 'RemediationRole ' + remediationName, {
                solutionId: props.solutionId,
                ssmDocName: remediationName,
                remediationPolicy: inlinePolicy,
                remediationRoleName: `${remediationRoleNameBase}${remediationName}`
            });
            runbook_factory_1.RunbookFactory.createRemediationRunbook(this, 'SHARR ' + remediationName, {
                ssmDocName: remediationName,
                ssmDocPath: ssmdocs,
                ssmDocFileName: `${remediationName}.yaml`,
                scriptPath: `${ssmdocs}/scripts`,
                solutionVersion: props.solutionVersion,
                solutionDistBucket: props.solutionDistBucket,
                solutionId: props.solutionId
            });
            let childToMod = inlinePolicy.node.findChild('Resource');
            childToMod.cfnOptions.metadata = {
                cfn_nag: {
                    rules_to_suppress: [{
                            id: 'W12',
                            reason: 'Resource * is required for to allow remediation for any resource.'
                        }]
                }
            };
        }
        //-----------------------
        // AWSConfigRemediation-SetIAMPasswordPolicy
        //
        {
            const remediationName = 'SetIAMPasswordPolicy';
            const inlinePolicy = new aws_iam_1.Policy(props.roleStack, `SHARR-Remediation-Policy-${remediationName}`);
            const remediationPolicy = new aws_iam_1.PolicyStatement();
            remediationPolicy.addActions("iam:UpdateAccountPasswordPolicy", "iam:GetAccountPasswordPolicy", "ec2:UpdateSecurityGroupRuleDescriptionsIngress", "ec2:RevokeSecurityGroupIngress", "ec2:RevokeSecurityGroupEgress");
            remediationPolicy.effect = aws_iam_1.Effect.ALLOW;
            remediationPolicy.addResources("*");
            inlinePolicy.addStatements(remediationPolicy);
            new ssmplaybook_1.SsmRole(props.roleStack, 'RemediationRole ' + remediationName, {
                solutionId: props.solutionId,
                ssmDocName: remediationName,
                remediationPolicy: inlinePolicy,
                remediationRoleName: `${remediationRoleNameBase}${remediationName}`
            });
            runbook_factory_1.RunbookFactory.createRemediationRunbook(this, 'SHARR ' + remediationName, {
                ssmDocName: remediationName,
                ssmDocPath: ssmdocs,
                ssmDocFileName: `${remediationName}.yaml`,
                scriptPath: `${ssmdocs}/scripts`,
                solutionVersion: props.solutionVersion,
                solutionDistBucket: props.solutionDistBucket,
                solutionId: props.solutionId
            });
            let childToMod = inlinePolicy.node.findChild('Resource');
            childToMod.cfnOptions.metadata = {
                cfn_nag: {
                    rules_to_suppress: [{
                            id: 'W12',
                            reason: 'Resource * is required for to allow remediation for any resource.'
                        }]
                }
            };
        }
        //-----------------------
        // AWSConfigRemediation-DisablePublicAccessToRDSInstance
        //
        {
            const remediationName = 'DisablePublicAccessToRDSInstance';
            const inlinePolicy = new aws_iam_1.Policy(props.roleStack, `SHARR-Remediation-Policy-${remediationName}`);
            const remediationPolicy = new aws_iam_1.PolicyStatement();
            remediationPolicy.addActions('rds:DescribeDBInstances', 'rds:ModifyDBInstance');
            remediationPolicy.effect = aws_iam_1.Effect.ALLOW;
            remediationPolicy.addResources("*");
            inlinePolicy.addStatements(remediationPolicy);
            new ssmplaybook_1.SsmRole(props.roleStack, 'RemediationRole ' + remediationName, {
                solutionId: props.solutionId,
                ssmDocName: remediationName,
                remediationPolicy: inlinePolicy,
                remediationRoleName: `${remediationRoleNameBase}${remediationName}`
            });
            runbook_factory_1.RunbookFactory.createRemediationRunbook(this, 'SHARR ' + remediationName, {
                ssmDocName: remediationName,
                ssmDocPath: ssmdocs,
                ssmDocFileName: `${remediationName}.yaml`,
                scriptPath: `${ssmdocs}/scripts`,
                solutionVersion: props.solutionVersion,
                solutionDistBucket: props.solutionDistBucket,
                solutionId: props.solutionId
            });
            let childToMod = inlinePolicy.node.findChild('Resource');
            childToMod.cfnOptions.metadata = {
                cfn_nag: {
                    rules_to_suppress: [
                        {
                            id: 'W12',
                            reason: 'Resource * is required for to allow remediation for any resource.'
                        }
                    ]
                }
            };
        }
        //-----------------------
        // AWSConfigRemediation-EnableMinorVersionUpgradeOnRDSDBInstance
        //
        {
            const remediationName = 'EnableMinorVersionUpgradeOnRDSDBInstance';
            const inlinePolicy = new aws_iam_1.Policy(props.roleStack, `SHARR-Remediation-Policy-${remediationName}`);
            const remediationPolicy = new aws_iam_1.PolicyStatement();
            remediationPolicy.addActions('rds:DescribeDBInstances', 'rds:ModifyDBInstance');
            remediationPolicy.effect = aws_iam_1.Effect.ALLOW;
            remediationPolicy.addResources("*");
            inlinePolicy.addStatements(remediationPolicy);
            new ssmplaybook_1.SsmRole(props.roleStack, 'RemediationRole ' + remediationName, {
                solutionId: props.solutionId,
                ssmDocName: remediationName,
                remediationPolicy: inlinePolicy,
                remediationRoleName: `${remediationRoleNameBase}${remediationName}`
            });
            runbook_factory_1.RunbookFactory.createRemediationRunbook(this, 'SHARR ' + remediationName, {
                ssmDocName: remediationName,
                ssmDocPath: ssmdocs,
                ssmDocFileName: `${remediationName}.yaml`,
                scriptPath: `${ssmdocs}/scripts`,
                solutionVersion: props.solutionVersion,
                solutionDistBucket: props.solutionDistBucket,
                solutionId: props.solutionId
            });
            let childToMod = inlinePolicy.node.findChild('Resource');
            childToMod.cfnOptions.metadata = {
                cfn_nag: {
                    rules_to_suppress: [
                        {
                            id: 'W12',
                            reason: 'Resource * is required for to allow remediation for any resource.'
                        }
                    ]
                }
            };
        }
    }
}
exports.RemediationRunbookStack = RemediationRunbookStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVtZWRpYXRpb25fcnVuYm9vay1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInJlbWVkaWF0aW9uX3J1bmJvb2stc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFDQTs7Ozs7Ozs7Ozs7OzsrRUFhK0U7OztBQUUvRSxFQUFFO0FBQ0YseUVBQXlFO0FBQ3pFLGtEQUFrRDtBQUNsRCxFQUFFO0FBQ0YscUNBQXFDO0FBQ3JDLDhDQVMwQjtBQUMxQix5RkFBZ0Y7QUFDaEYseUZBQTBFO0FBQzFFLHNHQUFtRztBQUNuRyx1REFBbUQ7QUFDbkQsdURBQWdEO0FBU2hELE1BQWEsZUFBZ0IsU0FBUSxHQUFHLENBQUMsS0FBSztJQUc1QyxZQUFZLEtBQWMsRUFBRSxFQUFVLEVBQUUsS0FBMkI7UUFDakUsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDeEI7OzZCQUVxQjtRQUNyQixNQUFNLGVBQWUsR0FBRyxLQUFLLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxnQ0FBZ0M7UUFDOUYsTUFBTSxhQUFhLEdBQUcsR0FBRyxlQUFlLDJCQUEyQixDQUFBO1FBRW5FLE1BQU0sWUFBWSxHQUFHLElBQUksK0NBQWdCLENBQUMsSUFBSSxFQUFFLHVCQUF1QixFQUFFO1lBQ3JFLFVBQVUsRUFBRSxLQUFLLENBQUMsVUFBVTtTQUMvQixDQUFDLENBQUE7UUFDRixJQUFJLENBQUMsdUJBQXVCLEdBQUcsSUFBSSxxREFBc0IsQ0FBQyxJQUFJLEVBQUUsd0JBQXdCLEVBQUU7WUFDdEYsVUFBVSxFQUFFLEtBQUssQ0FBQyxVQUFVO1lBQzVCLGNBQWMsRUFBRSxZQUFZLENBQUMsa0JBQWtCLENBQUMsYUFBYTtZQUM3RCxhQUFhLEVBQUUsYUFBYTtTQUMvQixDQUFDLENBQUE7SUFDSixDQUFDO0lBRUMseUJBQXlCO1FBQ3JCLE9BQU8sSUFBSSxDQUFDLHVCQUF1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KioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAqICBDb3B5cmlnaHQgQW1hem9uLmNvbSwgSW5jLiBvciBpdHMgYWZmaWxpYXRlcy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC4gICAqXG4gKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAqXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZSBMaWNlbnNlLCBWZXJzaW9uIDIuMCAodGhlIFwiTGljZW5zZVwiKS4gWW91IG1heSAgICpcbiAqICBub3QgdXNlIHRoaXMgZmlsZSBleGNlcHQgaW4gY29tcGxpYW5jZSB3aXRoIHRoZSBMaWNlbnNlLiBBIGNvcHkgb2YgdGhlICAgICpcbiAqICBMaWNlbnNlIGlzIGxvY2F0ZWQgYXQgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICpcbiAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICpcbiAqICAgICAgaHR0cDovL3d3dy5hcGFjaGUub3JnL2xpY2Vuc2VzL0xJQ0VOU0UtMi4wICAgICAgICAgICAgICAgICAgICAgICAgICAgICpcbiAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICpcbiAqICBvciBpbiB0aGUgJ2xpY2Vuc2UnIGZpbGUgYWNjb21wYW55aW5nIHRoaXMgZmlsZS4gVGhpcyBmaWxlIGlzIGRpc3RyaWJ1dGVkICpcbiAqICBvbiBhbiAnQVMgSVMnIEJBU0lTLCBXSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTlkgS0lORCwgICAgICAgICpcbiAqICBleHByZXNzIG9yIGltcGxpZWQuIFNlZSB0aGUgTGljZW5zZSBmb3IgdGhlIHNwZWNpZmljIGxhbmd1YWdlIGdvdmVybmluZyAgICpcbiAqICBwZXJtaXNzaW9ucyBhbmQgbGltaXRhdGlvbnMgdW5kZXIgdGhlIExpY2Vuc2UuICAgICAgICAgICAgICAgICAgICAgICAgICAgICpcbiAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuLy9cbi8vIFJlbWVkaWF0aW9uIFJ1bmJvb2sgU3RhY2sgLSBpbnN0YWxscyBub24gc3RhbmRhcmQtc3BlY2lmaWMgcmVtZWRpYXRpb25cbi8vIHJ1bmJvb2tzIHRoYXQgYXJlIHVzZWQgYnkgb25lIG9yIG1vcmUgc3RhbmRhcmRzXG4vL1xuaW1wb3J0ICogYXMgY2RrIGZyb20gJ0Bhd3MtY2RrL2NvcmUnO1xuaW1wb3J0IHtcbiAgUG9saWN5U3RhdGVtZW50LFxuICBQb2xpY3lEb2N1bWVudCxcbiAgRWZmZWN0LFxuICBSb2xlLFxuICBQb2xpY3ksXG4gIFNlcnZpY2VQcmluY2lwYWwsXG4gIENmblBvbGljeSxcbiAgQ2ZuUm9sZVxufSBmcm9tICdAYXdzLWNkay9hd3MtaWFtJztcbmltcG9ydCB7IE9yY2hlc3RyYXRvck1lbWJlclJvbGUgfSBmcm9tICcuLi8uLi9saWIvb3JjaGVzdHJhdG9yX3JvbGVzLWNvbnN0cnVjdCc7XG5pbXBvcnQgeyBBZG1pbkFjY291bnRQYXJtIH0gZnJvbSAnLi4vLi4vbGliL2FkbWluX2FjY291bnRfcGFybS1jb25zdHJ1Y3QnO1xuaW1wb3J0IHsgUmRzNkVuaGFuY2VkTW9uaXRvcmluZ1JvbGUgfSBmcm9tICcuLi8uLi9yZW1lZGlhdGlvbl9ydW5ib29rcy9yZHM2LXJlbWVkaWF0aW9uLXJlc291cmNlcyc7XG5pbXBvcnQgeyBSdW5ib29rRmFjdG9yeSB9IGZyb20gJy4vcnVuYm9va19mYWN0b3J5JztcbmltcG9ydCB7IFNzbVJvbGUgfSBmcm9tICcuLi8uLi9saWIvc3NtcGxheWJvb2snO1xuXG5leHBvcnQgaW50ZXJmYWNlIE1lbWJlclJvbGVTdGFja1Byb3BzIHtcbiAgICByZWFkb25seSBkZXNjcmlwdGlvbjogc3RyaW5nO1xuICAgIHJlYWRvbmx5IHNvbHV0aW9uSWQ6IHN0cmluZztcbiAgICByZWFkb25seSBzb2x1dGlvblZlcnNpb246IHN0cmluZztcbiAgICByZWFkb25seSBzb2x1dGlvbkRpc3RCdWNrZXQ6IHN0cmluZztcbn1cblxuZXhwb3J0IGNsYXNzIE1lbWJlclJvbGVTdGFjayBleHRlbmRzIGNkay5TdGFjayB7XG4gICAgX29yY2hlc3RyYXRvck1lbWJlclJvbGU6IE9yY2hlc3RyYXRvck1lbWJlclJvbGU7XG5cbiAgY29uc3RydWN0b3Ioc2NvcGU6IGNkay5BcHAsIGlkOiBzdHJpbmcsIHByb3BzOiBNZW1iZXJSb2xlU3RhY2tQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xuICAgIC8qKioqKioqKioqKioqKioqKioqKlxuICAgICoqIFBhcmFtZXRlcnNcbiAgICAqKioqKioqKioqKioqKioqKioqKi9cbiAgICBjb25zdCBSRVNPVVJDRV9QUkVGSVggPSBwcm9wcy5zb2x1dGlvbklkLnJlcGxhY2UoL15ERVYtLywnJyk7IC8vIHByZWZpeCBvbiBldmVyeSByZXNvdXJjZSBuYW1lXG4gICAgY29uc3QgYWRtaW5Sb2xlTmFtZSA9IGAke1JFU09VUkNFX1BSRUZJWH0tU0hBUlItT3JjaGVzdHJhdG9yLUFkbWluYFxuXG4gICAgY29uc3QgYWRtaW5BY2NvdW50ID0gbmV3IEFkbWluQWNjb3VudFBhcm0odGhpcywgJ0FkbWluQWNjb3VudFBhcmFtZXRlcicsIHtcbiAgICAgICAgc29sdXRpb25JZDogcHJvcHMuc29sdXRpb25JZFxuICAgIH0pXG4gICAgdGhpcy5fb3JjaGVzdHJhdG9yTWVtYmVyUm9sZSA9IG5ldyBPcmNoZXN0cmF0b3JNZW1iZXJSb2xlKHRoaXMsICdPcmNoZXN0cmF0b3JNZW1iZXJSb2xlJywge1xuICAgICAgICBzb2x1dGlvbklkOiBwcm9wcy5zb2x1dGlvbklkLFxuICAgICAgICBhZG1pbkFjY291bnRJZDogYWRtaW5BY2NvdW50LmFkbWluQWNjb3VudE51bWJlci52YWx1ZUFzU3RyaW5nLFxuICAgICAgICBhZG1pblJvbGVOYW1lOiBhZG1pblJvbGVOYW1lXG4gICAgfSlcbiAgfVxuXG4gICAgZ2V0T3JjaGVzdHJhdG9yTWVtYmVyUm9sZSgpOiBPcmNoZXN0cmF0b3JNZW1iZXJSb2xlIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX29yY2hlc3RyYXRvck1lbWJlclJvbGU7XG4gICAgfVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIFN0YWNrUHJvcHMge1xuICByZWFkb25seSBkZXNjcmlwdGlvbjogc3RyaW5nO1xuICByZWFkb25seSBzb2x1dGlvbklkOiBzdHJpbmc7XG4gIHJlYWRvbmx5IHNvbHV0aW9uVmVyc2lvbjogc3RyaW5nO1xuICByZWFkb25seSBzb2x1dGlvbkRpc3RCdWNrZXQ6IHN0cmluZztcbiAgc3NtZG9jcz86IHN0cmluZztcbiAgcm9sZVN0YWNrOiBNZW1iZXJSb2xlU3RhY2s7XG59XG5cbmV4cG9ydCBjbGFzcyBSZW1lZGlhdGlvblJ1bmJvb2tTdGFjayBleHRlbmRzIGNkay5TdGFjayB7XG5cbiAgY29uc3RydWN0b3Ioc2NvcGU6IGNkay5BcHAsIGlkOiBzdHJpbmcsIHByb3BzOiBTdGFja1Byb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XG5cbiAgICBsZXQgc3NtZG9jcyA9ICcnXG4gICAgaWYgKHByb3BzLnNzbWRvY3MgPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHNzbWRvY3MgPSAnLi4vcmVtZWRpYXRpb25fcnVuYm9va3MnXG4gICAgfSBlbHNlIHtcbiAgICAgICAgc3NtZG9jcyA9IHByb3BzLnNzbWRvY3NcbiAgICB9XG5cbiAgICBjb25zdCBSRVNPVVJDRV9QUkVGSVggPSBwcm9wcy5zb2x1dGlvbklkLnJlcGxhY2UoL15ERVYtLywnJyk7IC8vIHByZWZpeCBvbiBldmVyeSByZXNvdXJjZSBuYW1lXG4gICAgY29uc3QgcmVtZWRpYXRpb25Sb2xlTmFtZUJhc2UgPSBgJHtSRVNPVVJDRV9QUkVGSVh9LWBcblxuICAgIC8vLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICAvLyBDcmVhdGVDbG91ZFRyYWlsTXVsdGlSZWdpb25UcmFpbFxuICAgIC8vXG4gICAge1xuICAgICAgICBjb25zdCByZW1lZGlhdGlvbk5hbWUgPSAnQ3JlYXRlQ2xvdWRUcmFpbE11bHRpUmVnaW9uVHJhaWwnXG4gICAgICAgIGNvbnN0IGlubGluZVBvbGljeSA9IG5ldyBQb2xpY3kocHJvcHMucm9sZVN0YWNrLCBgU0hBUlItUmVtZWRpYXRpb24tUG9saWN5LSR7cmVtZWRpYXRpb25OYW1lfWApO1xuICAgICAgICBjb25zdCBjbG91ZHRyYWlsUGVybXMgPSBuZXcgUG9saWN5U3RhdGVtZW50KCk7XG4gICAgICAgIGNsb3VkdHJhaWxQZXJtcy5hZGRBY3Rpb25zKFxuICAgICAgICAgICAgXCJjbG91ZHRyYWlsOkNyZWF0ZVRyYWlsXCIsXG4gICAgICAgICAgICBcImNsb3VkdHJhaWw6VXBkYXRlVHJhaWxcIixcbiAgICAgICAgICAgIFwiY2xvdWR0cmFpbDpTdGFydExvZ2dpbmdcIlxuICAgICAgICApXG4gICAgICAgIGNsb3VkdHJhaWxQZXJtcy5lZmZlY3QgPSBFZmZlY3QuQUxMT1dcbiAgICAgICAgY2xvdWR0cmFpbFBlcm1zLmFkZFJlc291cmNlcyhcIipcIik7XG4gICAgICAgIGlubGluZVBvbGljeS5hZGRTdGF0ZW1lbnRzKGNsb3VkdHJhaWxQZXJtcylcblxuICAgICAgICBjb25zdCBzM1Blcm1zID0gbmV3IFBvbGljeVN0YXRlbWVudCgpO1xuICAgICAgICBzM1Blcm1zLmFkZEFjdGlvbnMoXG4gICAgICAgICAgICBcInMzOkNyZWF0ZUJ1Y2tldFwiLFxuICAgICAgICAgICAgXCJzMzpQdXRFbmNyeXB0aW9uQ29uZmlndXJhdGlvblwiLFxuICAgICAgICAgICAgXCJzMzpQdXRCdWNrZXRQdWJsaWNBY2Nlc3NCbG9ja1wiLFxuICAgICAgICAgICAgXCJzMzpQdXRCdWNrZXRMb2dnaW5nXCIsXG4gICAgICAgICAgICBcInMzOlB1dEJ1Y2tldEFjbFwiLFxuICAgICAgICAgICAgXCJzMzpQdXRCdWNrZXRQb2xpY3lcIlxuICAgICAgICApXG4gICAgICAgIHMzUGVybXMuZWZmZWN0ID0gRWZmZWN0LkFMTE9XXG4gICAgICAgIHMzUGVybXMuYWRkUmVzb3VyY2VzKFxuICAgICAgICAgICAgYGFybjoke3RoaXMucGFydGl0aW9ufTpzMzo6OnNvMDExMS0qYFxuICAgICAgICApO1xuICAgICAgICBpbmxpbmVQb2xpY3kuYWRkU3RhdGVtZW50cyhzM1Blcm1zKVxuXG4gICAgICAgIG5ldyBTc21Sb2xlKHByb3BzLnJvbGVTdGFjaywgJ1JlbWVkaWF0aW9uUm9sZSAnICsgcmVtZWRpYXRpb25OYW1lLCB7XG4gICAgICAgICAgICBzb2x1dGlvbklkOiBwcm9wcy5zb2x1dGlvbklkLFxuICAgICAgICAgICAgc3NtRG9jTmFtZTogcmVtZWRpYXRpb25OYW1lLFxuICAgICAgICAgICAgcmVtZWRpYXRpb25Qb2xpY3k6IGlubGluZVBvbGljeSxcbiAgICAgICAgICAgIHJlbWVkaWF0aW9uUm9sZU5hbWU6IGAke3JlbWVkaWF0aW9uUm9sZU5hbWVCYXNlfSR7cmVtZWRpYXRpb25OYW1lfWBcbiAgICAgICAgfSlcblxuICAgICAgICBSdW5ib29rRmFjdG9yeS5jcmVhdGVSZW1lZGlhdGlvblJ1bmJvb2sodGhpcywgJ1NIQVJSICcrIHJlbWVkaWF0aW9uTmFtZSwge1xuICAgICAgICAgICAgc3NtRG9jTmFtZTogcmVtZWRpYXRpb25OYW1lLFxuICAgICAgICAgICAgc3NtRG9jUGF0aDogc3NtZG9jcyxcbiAgICAgICAgICAgIHNzbURvY0ZpbGVOYW1lOiBgJHtyZW1lZGlhdGlvbk5hbWV9LnlhbWxgLFxuICAgICAgICAgICAgc2NyaXB0UGF0aDogYCR7c3NtZG9jc30vc2NyaXB0c2AsXG4gICAgICAgICAgICBzb2x1dGlvblZlcnNpb246IHByb3BzLnNvbHV0aW9uVmVyc2lvbixcbiAgICAgICAgICAgIHNvbHV0aW9uRGlzdEJ1Y2tldDogcHJvcHMuc29sdXRpb25EaXN0QnVja2V0LFxuICAgICAgICAgICAgc29sdXRpb25JZDogcHJvcHMuc29sdXRpb25JZFxuICAgICAgICB9KVxuICAgICAgICAvLyBDRk4tTkFHXG4gICAgICAgIC8vIFdBUk4gVzEyOiBJQU0gcG9saWN5IHNob3VsZCBub3QgYWxsb3cgKiByZXNvdXJjZVxuXG4gICAgICAgIGxldCBjaGlsZFRvTW9kID0gaW5saW5lUG9saWN5Lm5vZGUuZmluZENoaWxkKCdSZXNvdXJjZScpIGFzIENmblBvbGljeTtcbiAgICAgICAgY2hpbGRUb01vZC5jZm5PcHRpb25zLm1ldGFkYXRhID0ge1xuICAgICAgICAgICAgY2ZuX25hZzoge1xuICAgICAgICAgICAgICAgIHJ1bGVzX3RvX3N1cHByZXNzOiBbe1xuICAgICAgICAgICAgICAgICAgICBpZDogJ1cxMicsXG4gICAgICAgICAgICAgICAgICAgIHJlYXNvbjogJ1Jlc291cmNlICogaXMgcmVxdWlyZWQgZm9yIHRvIGFsbG93IHJlbWVkaWF0aW9uLidcbiAgICAgICAgICAgICAgICB9LHtcbiAgICAgICAgICAgICAgICAgICAgaWQ6ICdXMjgnLFxuICAgICAgICAgICAgICAgICAgICByZWFzb246ICdTdGF0aWMgbmFtZXMgY2hvc2VuIGludGVudGlvbmFsbHkgdG8gcHJvdmlkZSBpbnRlZ3JhdGlvbiBpbiBjcm9zcy1hY2NvdW50IHBlcm1pc3Npb25zLidcbiAgICAgICAgICAgICAgICB9XVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuICAgIC8vLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICAvLyBDcmVhdGVMb2dNZXRyaWNBbmRBbGFybVxuICAgIC8vXG4gICAge1xuICAgICAgICBjb25zdCByZW1lZGlhdGlvbk5hbWUgPSAnQ3JlYXRlTG9nTWV0cmljRmlsdGVyQW5kQWxhcm0nXG4gICAgICAgIGNvbnN0IGlubGluZVBvbGljeSA9IG5ldyBQb2xpY3kocHJvcHMucm9sZVN0YWNrLCBgU0hBUlItUmVtZWRpYXRpb24tUG9saWN5LSR7cmVtZWRpYXRpb25OYW1lfWApO1xuXG4gICAgICAgIGNvbnN0IHJlbWVkaWF0aW9uUG9saWN5ID0gbmV3IFBvbGljeVN0YXRlbWVudCgpO1xuICAgICAgICByZW1lZGlhdGlvblBvbGljeS5hZGRBY3Rpb25zKFxuICAgICAgICAgICAgXCJsb2dzOlB1dE1ldHJpY0ZpbHRlclwiLFxuICAgICAgICAgICAgXCJjbG91ZHdhdGNoOlB1dE1ldHJpY0FsYXJtXCJcbiAgICAgICAgICAgIClcbiAgICAgICAgcmVtZWRpYXRpb25Qb2xpY3kuZWZmZWN0ID0gRWZmZWN0LkFMTE9XXG4gICAgICAgIHJlbWVkaWF0aW9uUG9saWN5LmFkZFJlc291cmNlcyhgYXJuOiR7dGhpcy5wYXJ0aXRpb259OmxvZ3M6Kjoke3RoaXMuYWNjb3VudH06bG9nLWdyb3VwOipgKTtcbiAgICAgICAgcmVtZWRpYXRpb25Qb2xpY3kuYWRkUmVzb3VyY2VzKGBhcm46JHt0aGlzLnBhcnRpdGlvbn06Y2xvdWR3YXRjaDoqOiR7dGhpcy5hY2NvdW50fTphbGFybToqYCk7XG5cbiAgICAgICAgaW5saW5lUG9saWN5LmFkZFN0YXRlbWVudHMocmVtZWRpYXRpb25Qb2xpY3kpXG5cbiAgICAgICAge1xuICAgICAgICAgICAgdmFyIHNuc1Blcm1zID0gbmV3IFBvbGljeVN0YXRlbWVudCgpO1xuICAgICAgICAgICAgc25zUGVybXMuYWRkQWN0aW9ucyhcbiAgICAgICAgICAgICAgICBcInNuczpDcmVhdGVUb3BpY1wiLFxuICAgICAgICAgICAgICAgIFwic25zOlNldFRvcGljQXR0cmlidXRlc1wiXG4gICAgICAgICAgICApXG4gICAgICAgICAgICBzbnNQZXJtcy5lZmZlY3QgPSBFZmZlY3QuQUxMT1dcbiAgICAgICAgICAgIHNuc1Blcm1zLmFkZFJlc291cmNlcyhcbiAgICAgICAgICAgICAgICBgYXJuOiR7dGhpcy5wYXJ0aXRpb259OnNuczoqOiR7dGhpcy5hY2NvdW50fTpTTzAxMTEtU0hBUlItTG9jYWxBbGFybU5vdGlmaWNhdGlvbmBcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgICBpbmxpbmVQb2xpY3kuYWRkU3RhdGVtZW50cyhzbnNQZXJtcylcbiAgICAgICAgfVxuXG4gICAgICAgIG5ldyBTc21Sb2xlKHByb3BzLnJvbGVTdGFjaywgJ1JlbWVkaWF0aW9uUm9sZSAnICsgcmVtZWRpYXRpb25OYW1lLCB7XG4gICAgICAgICAgICBzb2x1dGlvbklkOiBwcm9wcy5zb2x1dGlvbklkLFxuICAgICAgICAgICAgc3NtRG9jTmFtZTogcmVtZWRpYXRpb25OYW1lLFxuICAgICAgICAgICAgcmVtZWRpYXRpb25Qb2xpY3k6IGlubGluZVBvbGljeSxcbiAgICAgICAgICAgIHJlbWVkaWF0aW9uUm9sZU5hbWU6IGAke3JlbWVkaWF0aW9uUm9sZU5hbWVCYXNlfSR7cmVtZWRpYXRpb25OYW1lfWBcbiAgICAgICAgfSlcblxuICAgICAgICBSdW5ib29rRmFjdG9yeS5jcmVhdGVSZW1lZGlhdGlvblJ1bmJvb2sodGhpcywgJ1NIQVJSICcrIHJlbWVkaWF0aW9uTmFtZSwge1xuICAgICAgICAgICAgc3NtRG9jTmFtZTogcmVtZWRpYXRpb25OYW1lLFxuICAgICAgICAgICAgc3NtRG9jUGF0aDogc3NtZG9jcyxcbiAgICAgICAgICAgIHNzbURvY0ZpbGVOYW1lOiBgJHtyZW1lZGlhdGlvbk5hbWV9LnlhbWxgLFxuICAgICAgICAgICAgc2NyaXB0UGF0aDogYCR7c3NtZG9jc30vc2NyaXB0c2AsXG4gICAgICAgICAgICBzb2x1dGlvblZlcnNpb246IHByb3BzLnNvbHV0aW9uVmVyc2lvbixcbiAgICAgICAgICAgIHNvbHV0aW9uRGlzdEJ1Y2tldDogcHJvcHMuc29sdXRpb25EaXN0QnVja2V0LFxuICAgICAgICAgICAgc29sdXRpb25JZDogcHJvcHMuc29sdXRpb25JZFxuICAgICAgICB9KVxuICAgIH1cbiAgICAvLy0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAgLy8gRW5hYmxlQXV0b1NjYWxpbmdHcm91cEVMQkhlYWx0aENoZWNrXG4gICAgLy9cbiAgICB7XG4gICAgICAgIGNvbnN0IHJlbWVkaWF0aW9uTmFtZSA9ICdFbmFibGVBdXRvU2NhbGluZ0dyb3VwRUxCSGVhbHRoQ2hlY2snXG4gICAgICAgIGNvbnN0IGlubGluZVBvbGljeSA9IG5ldyBQb2xpY3kocHJvcHMucm9sZVN0YWNrLCBgU0hBUlItUmVtZWRpYXRpb24tUG9saWN5LSR7cmVtZWRpYXRpb25OYW1lfWApO1xuICAgICAgICBjb25zdCBhc1Blcm1zID0gbmV3IFBvbGljeVN0YXRlbWVudCgpO1xuICAgICAgICBhc1Blcm1zLmFkZEFjdGlvbnMoXG4gICAgICAgICAgICBcImF1dG9zY2FsaW5nOlVwZGF0ZUF1dG9TY2FsaW5nR3JvdXBcIixcbiAgICAgICAgICAgIFwiYXV0b3NjYWxpbmc6RGVzY3JpYmVBdXRvU2NhbGluZ0dyb3Vwc1wiXG4gICAgICAgIClcbiAgICAgICAgYXNQZXJtcy5lZmZlY3QgPSBFZmZlY3QuQUxMT1dcbiAgICAgICAgYXNQZXJtcy5hZGRSZXNvdXJjZXMoXCIqXCIpO1xuICAgICAgICBpbmxpbmVQb2xpY3kuYWRkU3RhdGVtZW50cyhhc1Blcm1zKVxuXG4gICAgICAgIG5ldyBTc21Sb2xlKHByb3BzLnJvbGVTdGFjaywgJ1JlbWVkaWF0aW9uUm9sZSAnICsgcmVtZWRpYXRpb25OYW1lLCB7XG4gICAgICAgICAgICBzb2x1dGlvbklkOiBwcm9wcy5zb2x1dGlvbklkLFxuICAgICAgICAgICAgc3NtRG9jTmFtZTogcmVtZWRpYXRpb25OYW1lLFxuICAgICAgICAgICAgcmVtZWRpYXRpb25Qb2xpY3k6IGlubGluZVBvbGljeSxcbiAgICAgICAgICAgIHJlbWVkaWF0aW9uUm9sZU5hbWU6IGAke3JlbWVkaWF0aW9uUm9sZU5hbWVCYXNlfSR7cmVtZWRpYXRpb25OYW1lfWBcbiAgICAgICAgfSlcblxuICAgICAgICBSdW5ib29rRmFjdG9yeS5jcmVhdGVSZW1lZGlhdGlvblJ1bmJvb2sodGhpcywgJ1NIQVJSICcrIHJlbWVkaWF0aW9uTmFtZSwge1xuICAgICAgICAgICAgc3NtRG9jTmFtZTogcmVtZWRpYXRpb25OYW1lLFxuICAgICAgICAgICAgc3NtRG9jUGF0aDogc3NtZG9jcyxcbiAgICAgICAgICAgIHNzbURvY0ZpbGVOYW1lOiBgJHtyZW1lZGlhdGlvbk5hbWV9LnlhbWxgLFxuICAgICAgICAgICAgc2NyaXB0UGF0aDogYCR7c3NtZG9jc30vc2NyaXB0c2AsXG4gICAgICAgICAgICBzb2x1dGlvblZlcnNpb246IHByb3BzLnNvbHV0aW9uVmVyc2lvbixcbiAgICAgICAgICAgIHNvbHV0aW9uRGlzdEJ1Y2tldDogcHJvcHMuc29sdXRpb25EaXN0QnVja2V0LFxuICAgICAgICAgICAgc29sdXRpb25JZDogcHJvcHMuc29sdXRpb25JZFxuICAgICAgICB9KVxuXG4gICAgICAgIGxldCBjaGlsZFRvTW9kID0gaW5saW5lUG9saWN5Lm5vZGUuZmluZENoaWxkKCdSZXNvdXJjZScpIGFzIENmblBvbGljeTtcbiAgICAgICAgY2hpbGRUb01vZC5jZm5PcHRpb25zLm1ldGFkYXRhID0ge1xuICAgICAgICAgICAgY2ZuX25hZzoge1xuICAgICAgICAgICAgICAgIHJ1bGVzX3RvX3N1cHByZXNzOiBbe1xuICAgICAgICAgICAgICAgICAgICBpZDogJ1cxMicsXG4gICAgICAgICAgICAgICAgICAgIHJlYXNvbjogJ1Jlc291cmNlICogaXMgcmVxdWlyZWQgZm9yIHRvIGFsbG93IHJlbWVkaWF0aW9uIGZvciAqYW55KiBBU0cuJ1xuICAgICAgICAgICAgICAgIH1dXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLy0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAgLy8gRW5hYmxlQVdTQ29uZmlnXG4gICAgLy9cbiAgICB7XG4gICAgICAgIGNvbnN0IHJlbWVkaWF0aW9uTmFtZSA9ICdFbmFibGVBV1NDb25maWcnXG4gICAgICAgIGNvbnN0IGlubGluZVBvbGljeSA9IG5ldyBQb2xpY3kocHJvcHMucm9sZVN0YWNrLCBgU0hBUlItUmVtZWRpYXRpb24tUG9saWN5LSR7cmVtZWRpYXRpb25OYW1lfWApO1xuXG4gICAgICAgIHtcbiAgICAgICAgICAgIGxldCBpYW1QZXJtcyA9IG5ldyBQb2xpY3lTdGF0ZW1lbnQoKTtcbiAgICAgICAgICAgIGlhbVBlcm1zLmFkZEFjdGlvbnMoXG4gICAgICAgICAgICAgICAgXCJpYW06R2V0Um9sZVwiLFxuICAgICAgICAgICAgICAgIFwiaWFtOlBhc3NSb2xlXCJcbiAgICAgICAgICAgIClcbiAgICAgICAgICAgIGlhbVBlcm1zLmVmZmVjdCA9IEVmZmVjdC5BTExPV1xuICAgICAgICAgICAgaWFtUGVybXMuYWRkUmVzb3VyY2VzKFxuICAgICAgICAgICAgICAgIGBhcm46JHt0aGlzLnBhcnRpdGlvbn06aWFtOjoke3RoaXMuYWNjb3VudH06cm9sZS9hd3Mtc2VydmljZS1yb2xlL2NvbmZpZy5hbWF6b25hd3MuY29tL0FXU1NlcnZpY2VSb2xlRm9yQ29uZmlnYCxcbiAgICAgICAgICAgICAgICBgYXJuOiR7dGhpcy5wYXJ0aXRpb259OmlhbTo6JHt0aGlzLmFjY291bnR9OnJvbGUvU08wMTExLUNyZWF0ZUFjY2Vzc0xvZ2dpbmdCdWNrZXRgXG4gICAgICAgICAgICApO1xuICAgICAgICAgICAgaW5saW5lUG9saWN5LmFkZFN0YXRlbWVudHMoaWFtUGVybXMpXG4gICAgICAgIH1cbiAgICAgICAge1xuICAgICAgICAgICAgbGV0IHNuc1Blcm1zID0gbmV3IFBvbGljeVN0YXRlbWVudCgpO1xuICAgICAgICAgICAgc25zUGVybXMuYWRkQWN0aW9ucyhcbiAgICAgICAgICAgICAgICBcInNuczpDcmVhdGVUb3BpY1wiLFxuICAgICAgICAgICAgICAgIFwic25zOlNldFRvcGljQXR0cmlidXRlc1wiXG4gICAgICAgICAgICApXG4gICAgICAgICAgICBzbnNQZXJtcy5lZmZlY3QgPSBFZmZlY3QuQUxMT1dcbiAgICAgICAgICAgIHNuc1Blcm1zLmFkZFJlc291cmNlcyhcbiAgICAgICAgICAgICAgICBgYXJuOiR7dGhpcy5wYXJ0aXRpb259OnNuczoqOiR7dGhpcy5hY2NvdW50fTpTTzAxMTEtU0hBUlItQVdTQ29uZmlnTm90aWZpY2F0aW9uYFxuICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIGlubGluZVBvbGljeS5hZGRTdGF0ZW1lbnRzKHNuc1Blcm1zKVxuICAgICAgICB9XG4gICAgICAgIHtcbiAgICAgICAgICAgIHZhciBzc21QZXJtcyA9IG5ldyBQb2xpY3lTdGF0ZW1lbnQoKTtcbiAgICAgICAgICAgIHNzbVBlcm1zLmFkZEFjdGlvbnMoXG4gICAgICAgICAgICAgICAgXCJzc206U3RhcnRBdXRvbWF0aW9uRXhlY3V0aW9uXCJcbiAgICAgICAgICAgIClcbiAgICAgICAgICAgIHNzbVBlcm1zLmVmZmVjdCA9IEVmZmVjdC5BTExPV1xuICAgICAgICAgICAgc3NtUGVybXMuYWRkUmVzb3VyY2VzKFxuICAgICAgICAgICAgICAgIGBhcm46JHt0aGlzLnBhcnRpdGlvbn06c3NtOio6JHt0aGlzLmFjY291bnR9OmF1dG9tYXRpb24tZGVmaW5pdGlvbi9TSEFSUi1DcmVhdGVBY2Nlc3NMb2dnaW5nQnVja2V0OipgXG4gICAgICAgICAgICApO1xuICAgICAgICAgICAgaW5saW5lUG9saWN5LmFkZFN0YXRlbWVudHMoc3NtUGVybXMpXG4gICAgICAgIH1cbiAgICAgICAge1xuICAgICAgICAgICAgdmFyIGNvbmZpZ1Blcm1zID0gbmV3IFBvbGljeVN0YXRlbWVudCgpO1xuICAgICAgICAgICAgY29uZmlnUGVybXMuYWRkQWN0aW9ucyhcbiAgICAgICAgICAgICAgICBcInNzbTpHZXRBdXRvbWF0aW9uRXhlY3V0aW9uXCIsXG4gICAgICAgICAgICAgICAgXCJjb25maWc6UHV0Q29uZmlndXJhdGlvblJlY29yZGVyXCIsXG4gICAgICAgICAgICAgICAgXCJjb25maWc6UHV0RGVsaXZlcnlDaGFubmVsXCIsXG4gICAgICAgICAgICAgICAgXCJjb25maWc6RGVzY3JpYmVDb25maWd1cmF0aW9uUmVjb3JkZXJzXCIsXG4gICAgICAgICAgICAgICAgXCJjb25maWc6U3RhcnRDb25maWd1cmF0aW9uUmVjb3JkZXJcIlxuICAgICAgICAgICAgKVxuICAgICAgICAgICAgY29uZmlnUGVybXMuZWZmZWN0ID0gRWZmZWN0LkFMTE9XXG4gICAgICAgICAgICBjb25maWdQZXJtcy5hZGRSZXNvdXJjZXMoXG4gICAgICAgICAgICAgICAgYCpgXG4gICAgICAgICAgICApO1xuICAgICAgICAgICAgaW5saW5lUG9saWN5LmFkZFN0YXRlbWVudHMoY29uZmlnUGVybXMpXG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBzM1Blcm1zID0gbmV3IFBvbGljeVN0YXRlbWVudCgpO1xuICAgICAgICBzM1Blcm1zLmFkZEFjdGlvbnMoXG4gICAgICAgICAgICBcInMzOkNyZWF0ZUJ1Y2tldFwiLFxuICAgICAgICAgICAgXCJzMzpQdXRFbmNyeXB0aW9uQ29uZmlndXJhdGlvblwiLFxuICAgICAgICAgICAgXCJzMzpQdXRCdWNrZXRQdWJsaWNBY2Nlc3NCbG9ja1wiLFxuICAgICAgICAgICAgXCJzMzpQdXRCdWNrZXRMb2dnaW5nXCIsXG4gICAgICAgICAgICBcInMzOlB1dEJ1Y2tldEFjbFwiLFxuICAgICAgICAgICAgXCJzMzpQdXRCdWNrZXRQb2xpY3lcIlxuICAgICAgICApXG4gICAgICAgIHMzUGVybXMuZWZmZWN0ID0gRWZmZWN0LkFMTE9XXG4gICAgICAgIHMzUGVybXMuYWRkUmVzb3VyY2VzKFxuICAgICAgICAgICAgYGFybjoke3RoaXMucGFydGl0aW9ufTpzMzo6OnNvMDExMS0qYFxuICAgICAgICApO1xuICAgICAgICBpbmxpbmVQb2xpY3kuYWRkU3RhdGVtZW50cyhzM1Blcm1zKVxuXG4gICAgICAgIG5ldyBTc21Sb2xlKHByb3BzLnJvbGVTdGFjaywgJ1JlbWVkaWF0aW9uUm9sZSAnICsgcmVtZWRpYXRpb25OYW1lLCB7XG4gICAgICAgICAgICBzb2x1dGlvbklkOiBwcm9wcy5zb2x1dGlvbklkLFxuICAgICAgICAgICAgc3NtRG9jTmFtZTogcmVtZWRpYXRpb25OYW1lLFxuICAgICAgICAgICAgcmVtZWRpYXRpb25Qb2xpY3k6IGlubGluZVBvbGljeSxcbiAgICAgICAgICAgIHJlbWVkaWF0aW9uUm9sZU5hbWU6IGAke3JlbWVkaWF0aW9uUm9sZU5hbWVCYXNlfSR7cmVtZWRpYXRpb25OYW1lfWBcbiAgICAgICAgfSlcblxuICAgICAgICBSdW5ib29rRmFjdG9yeS5jcmVhdGVSZW1lZGlhdGlvblJ1bmJvb2sodGhpcywgJ1NIQVJSICcrIHJlbWVkaWF0aW9uTmFtZSwge1xuICAgICAgICAgICAgc3NtRG9jTmFtZTogcmVtZWRpYXRpb25OYW1lLFxuICAgICAgICAgICAgc3NtRG9jUGF0aDogc3NtZG9jcyxcbiAgICAgICAgICAgIHNzbURvY0ZpbGVOYW1lOiBgJHtyZW1lZGlhdGlvbk5hbWV9LnlhbWxgLFxuICAgICAgICAgICAgc2NyaXB0UGF0aDogYCR7c3NtZG9jc30vc2NyaXB0c2AsXG4gICAgICAgICAgICBzb2x1dGlvblZlcnNpb246IHByb3BzLnNvbHV0aW9uVmVyc2lvbixcbiAgICAgICAgICAgIHNvbHV0aW9uRGlzdEJ1Y2tldDogcHJvcHMuc29sdXRpb25EaXN0QnVja2V0LFxuICAgICAgICAgICAgc29sdXRpb25JZDogcHJvcHMuc29sdXRpb25JZFxuICAgICAgICB9KVxuXG4gICAgICAgIGxldCBjaGlsZFRvTW9kID0gaW5saW5lUG9saWN5Lm5vZGUuZmluZENoaWxkKCdSZXNvdXJjZScpIGFzIENmblBvbGljeTtcbiAgICAgICAgY2hpbGRUb01vZC5jZm5PcHRpb25zLm1ldGFkYXRhID0ge1xuICAgICAgICAgICAgY2ZuX25hZzoge1xuICAgICAgICAgICAgICAgIHJ1bGVzX3RvX3N1cHByZXNzOiBbe1xuICAgICAgICAgICAgICAgICAgICBpZDogJ1cxMicsXG4gICAgICAgICAgICAgICAgICAgIHJlYXNvbjogJ1Jlc291cmNlICogaXMgcmVxdWlyZWQgZm9yIHRvIGFsbG93IHJlbWVkaWF0aW9uIGZvciAqYW55KiByZXNvdXJjZS4nXG4gICAgICAgICAgICAgICAgfV1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICAvLyBFbmFibGVDbG91ZFRyYWlsVG9DbG91ZFdhdGNoTG9nZ2luZ1xuICAgIC8vXG4gICAge1xuICAgICAgICBjb25zdCByZW1lZGlhdGlvbk5hbWUgPSAnRW5hYmxlQ2xvdWRUcmFpbFRvQ2xvdWRXYXRjaExvZ2dpbmcnXG4gICAgICAgIGNvbnN0IGlubGluZVBvbGljeSA9IG5ldyBQb2xpY3kocHJvcHMucm9sZVN0YWNrLCBgU0hBUlItUmVtZWRpYXRpb24tUG9saWN5LSR7cmVtZWRpYXRpb25OYW1lfWApO1xuXG4gICAgICAgIC8vIFJvbGUgZm9yIENULT5DVyBsb2dnaW5nXG4gICAgICAgIGNvbnN0IGN0Y3dfcmVtZWRpYXRpb25fcG9saWN5X3N0YXRlbWVudF8xID0gbmV3IFBvbGljeVN0YXRlbWVudCgpXG4gICAgICAgIGN0Y3dfcmVtZWRpYXRpb25fcG9saWN5X3N0YXRlbWVudF8xLmFkZEFjdGlvbnMoXCJsb2dzOkNyZWF0ZUxvZ1N0cmVhbVwiKVxuICAgICAgICBjdGN3X3JlbWVkaWF0aW9uX3BvbGljeV9zdGF0ZW1lbnRfMS5lZmZlY3QgPSBFZmZlY3QuQUxMT1dcbiAgICAgICAgY3Rjd19yZW1lZGlhdGlvbl9wb2xpY3lfc3RhdGVtZW50XzEuYWRkUmVzb3VyY2VzKFxuICAgICAgICAgICAgXCJhcm46XCIgKyB0aGlzLnBhcnRpdGlvbiArIFwiOmxvZ3M6KjoqOmxvZy1ncm91cDoqXCJcbiAgICAgICAgKVxuXG4gICAgICAgIGNvbnN0IGN0Y3dfcmVtZWRpYXRpb25fcG9saWN5X3N0YXRlbWVudF8yID0gbmV3IFBvbGljeVN0YXRlbWVudCgpXG4gICAgICAgIGN0Y3dfcmVtZWRpYXRpb25fcG9saWN5X3N0YXRlbWVudF8yLmFkZEFjdGlvbnMoXCJsb2dzOlB1dExvZ0V2ZW50c1wiKVxuICAgICAgICBjdGN3X3JlbWVkaWF0aW9uX3BvbGljeV9zdGF0ZW1lbnRfMi5lZmZlY3QgPSBFZmZlY3QuQUxMT1dcbiAgICAgICAgY3Rjd19yZW1lZGlhdGlvbl9wb2xpY3lfc3RhdGVtZW50XzIuYWRkUmVzb3VyY2VzKFxuICAgICAgICAgICAgXCJhcm46XCIgKyB0aGlzLnBhcnRpdGlvbiArIFwiOmxvZ3M6KjoqOmxvZy1ncm91cDoqOmxvZy1zdHJlYW06KlwiXG4gICAgICAgIClcblxuICAgICAgICBjb25zdCBjdGN3X3JlbWVkaWF0aW9uX3BvbGljeV9kb2MgPSBuZXcgUG9saWN5RG9jdW1lbnQoKVxuICAgICAgICBjdGN3X3JlbWVkaWF0aW9uX3BvbGljeV9kb2MuYWRkU3RhdGVtZW50cyhjdGN3X3JlbWVkaWF0aW9uX3BvbGljeV9zdGF0ZW1lbnRfMSlcbiAgICAgICAgY3Rjd19yZW1lZGlhdGlvbl9wb2xpY3lfZG9jLmFkZFN0YXRlbWVudHMoY3Rjd19yZW1lZGlhdGlvbl9wb2xpY3lfc3RhdGVtZW50XzIpXG5cbiAgICAgICAgY29uc3QgY3Rjd19yZW1lZGlhdGlvbl9yb2xlID0gbmV3IFJvbGUocHJvcHMucm9sZVN0YWNrLCAnY3Rjd3JlbWVkaWF0aW9ucm9sZScsIHtcbiAgICAgICAgICAgIGFzc3VtZWRCeTogbmV3IFNlcnZpY2VQcmluY2lwYWwoYGNsb3VkdHJhaWwuJHt0aGlzLnVybFN1ZmZpeH1gKSxcbiAgICAgICAgICAgIGlubGluZVBvbGljaWVzOiB7XG4gICAgICAgICAgICAgICAgJ2RlZmF1bHRfbGFtYmRhUG9saWN5JzogY3Rjd19yZW1lZGlhdGlvbl9wb2xpY3lfZG9jXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcm9sZU5hbWU6IGAke1JFU09VUkNFX1BSRUZJWH0tQ2xvdWRUcmFpbFRvQ2xvdWRXYXRjaExvZ3NgXG4gICAgICAgIH0pO1xuICAgICAgICBjdGN3X3JlbWVkaWF0aW9uX3JvbGUuYXBwbHlSZW1vdmFsUG9saWN5KGNkay5SZW1vdmFsUG9saWN5LlJFVEFJTilcbiAgICAgICAge1xuICAgICAgICAgICAgbGV0IGNoaWxkVG9Nb2QgPSBjdGN3X3JlbWVkaWF0aW9uX3JvbGUubm9kZS5maW5kQ2hpbGQoJ1Jlc291cmNlJykgYXMgQ2ZuUm9sZTtcbiAgICAgICAgICAgIGNoaWxkVG9Nb2QuY2ZuT3B0aW9ucy5tZXRhZGF0YSA9IHtcbiAgICAgICAgICAgICAgICBjZm5fbmFnOiB7XG4gICAgICAgICAgICAgICAgICAgIHJ1bGVzX3RvX3N1cHByZXNzOiBbe1xuICAgICAgICAgICAgICAgICAgICAgICAgaWQ6ICdXMjgnLFxuICAgICAgICAgICAgICAgICAgICAgICAgcmVhc29uOiAnU3RhdGljIG5hbWVzIGNob3NlbiBpbnRlbnRpb25hbGx5IHRvIHByb3ZpZGUgaW50ZWdyYXRpb24gaW4gY3Jvc3MtYWNjb3VudCBwZXJtaXNzaW9ucydcbiAgICAgICAgICAgICAgICAgICAgfV1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAge1xuICAgICAgICAgICAgY29uc3QgY3RwZXJtcyA9IG5ldyBQb2xpY3lTdGF0ZW1lbnQoKTtcbiAgICAgICAgICAgIGN0cGVybXMuYWRkQWN0aW9ucyhcImNsb3VkdHJhaWw6VXBkYXRlVHJhaWxcIilcblxuICAgICAgICAgICAgY3RwZXJtcy5lZmZlY3QgPSBFZmZlY3QuQUxMT1dcbiAgICAgICAgICAgIGN0cGVybXMuYWRkUmVzb3VyY2VzKFxuICAgICAgICAgICAgICAgIFwiYXJuOlwiICsgdGhpcy5wYXJ0aXRpb24gKyBcIjpjbG91ZHRyYWlsOio6XCIgKyB0aGlzLmFjY291bnQgKyBcIjp0cmFpbC8qXCJcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgICBpbmxpbmVQb2xpY3kuYWRkU3RhdGVtZW50cyhjdHBlcm1zKVxuICAgICAgICB9XG4gICAgICAgIHtcbiAgICAgICAgICAgIGNvbnN0IGN0Y3dpYW0gPSBuZXcgUG9saWN5U3RhdGVtZW50KCk7XG4gICAgICAgICAgICBjdGN3aWFtLmFkZEFjdGlvbnMoXG4gICAgICAgICAgICAgICAgXCJpYW06UGFzc1JvbGVcIlxuICAgICAgICAgICAgKVxuICAgICAgICAgICAgY3Rjd2lhbS5hZGRSZXNvdXJjZXMoXG4gICAgICAgICAgICAgICAgY3Rjd19yZW1lZGlhdGlvbl9yb2xlLnJvbGVBcm5cbiAgICAgICAgICAgICk7XG4gICAgICAgICAgICBpbmxpbmVQb2xpY3kuYWRkU3RhdGVtZW50cyhjdGN3aWFtKVxuICAgICAgICB9XG4gICAgICAgIHtcbiAgICAgICAgICAgIGNvbnN0IGN0Y3dsb2dzID0gbmV3IFBvbGljeVN0YXRlbWVudCgpO1xuICAgICAgICAgICAgY3Rjd2xvZ3MuYWRkQWN0aW9ucyhcbiAgICAgICAgICAgICAgICBcImxvZ3M6Q3JlYXRlTG9nR3JvdXBcIixcbiAgICAgICAgICAgICAgICBcImxvZ3M6RGVzY3JpYmVMb2dHcm91cHNcIlxuICAgICAgICAgICAgKVxuICAgICAgICAgICAgY3Rjd2xvZ3MuZWZmZWN0ID0gRWZmZWN0LkFMTE9XXG4gICAgICAgICAgICBjdGN3bG9ncy5hZGRSZXNvdXJjZXMoXCIqXCIpO1xuICAgICAgICAgICAgaW5saW5lUG9saWN5LmFkZFN0YXRlbWVudHMoY3Rjd2xvZ3MpXG4gICAgICAgIH1cblxuICAgICAgICBuZXcgU3NtUm9sZShwcm9wcy5yb2xlU3RhY2ssICdSZW1lZGlhdGlvblJvbGUgJyArIHJlbWVkaWF0aW9uTmFtZSwge1xuICAgICAgICAgICAgc29sdXRpb25JZDogcHJvcHMuc29sdXRpb25JZCxcbiAgICAgICAgICAgIHNzbURvY05hbWU6IHJlbWVkaWF0aW9uTmFtZSxcbiAgICAgICAgICAgIHJlbWVkaWF0aW9uUG9saWN5OiBpbmxpbmVQb2xpY3ksXG4gICAgICAgICAgICByZW1lZGlhdGlvblJvbGVOYW1lOiBgJHtyZW1lZGlhdGlvblJvbGVOYW1lQmFzZX0ke3JlbWVkaWF0aW9uTmFtZX1gXG4gICAgICAgIH0pXG5cbiAgICAgICAgUnVuYm9va0ZhY3RvcnkuY3JlYXRlUmVtZWRpYXRpb25SdW5ib29rKHRoaXMsICdTSEFSUiAnICsgcmVtZWRpYXRpb25OYW1lLCB7XG4gICAgICAgICAgICBzc21Eb2NOYW1lOiByZW1lZGlhdGlvbk5hbWUsXG4gICAgICAgICAgICBzc21Eb2NQYXRoOiBzc21kb2NzLFxuICAgICAgICAgICAgc3NtRG9jRmlsZU5hbWU6IGAke3JlbWVkaWF0aW9uTmFtZX0ueWFtbGAsXG4gICAgICAgICAgICBzY3JpcHRQYXRoOiBgJHtzc21kb2NzfS9zY3JpcHRzYCxcbiAgICAgICAgICAgIHNvbHV0aW9uVmVyc2lvbjogcHJvcHMuc29sdXRpb25WZXJzaW9uLFxuICAgICAgICAgICAgc29sdXRpb25EaXN0QnVja2V0OiBwcm9wcy5zb2x1dGlvbkRpc3RCdWNrZXQsXG4gICAgICAgICAgICBzb2x1dGlvbklkOiBwcm9wcy5zb2x1dGlvbklkXG4gICAgICAgIH0pXG4gICAgICAgIHtcbiAgICAgICAgICAgIGxldCBjaGlsZFRvTW9kID0gaW5saW5lUG9saWN5Lm5vZGUuZmluZENoaWxkKCdSZXNvdXJjZScpIGFzIENmblBvbGljeTtcbiAgICAgICAgICAgIGNoaWxkVG9Nb2QuY2ZuT3B0aW9ucy5tZXRhZGF0YSA9IHtcbiAgICAgICAgICAgICAgICBjZm5fbmFnOiB7XG4gICAgICAgICAgICAgICAgICAgIHJ1bGVzX3RvX3N1cHByZXNzOiBbe1xuICAgICAgICAgICAgICAgICAgICAgICAgaWQ6ICdXMTInLFxuICAgICAgICAgICAgICAgICAgICAgICAgcmVhc29uOiAnUmVzb3VyY2UgKiBpcyByZXF1aXJlZCBmb3IgdG8gYWxsb3cgY3JlYXRpb24gYW5kIGRlc2NyaXB0aW9uIG9mIGFueSBsb2cgZ3JvdXAnXG4gICAgICAgICAgICAgICAgICAgIH0se1xuICAgICAgICAgICAgICAgICAgICAgICAgaWQ6ICdXMjgnLFxuICAgICAgICAgICAgICAgICAgICAgICAgcmVhc29uOiAnU3RhdGljIHJlc291cmNlIG5hbWVzIGFyZSByZXF1aXJlZCB0byBlbmFibGUgY3Jvc3MtYWNjb3VudCBmdW5jdGlvbmFsaXR5J1xuICAgICAgICAgICAgICAgICAgICB9XVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbiAgICAvLy0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAgLy8gRW5hYmxlQ2xvdWRUcmFpbEVuY3J5cHRpb25cbiAgICAvL1xuICAgIHtcbiAgICAgICAgY29uc3QgcmVtZWRpYXRpb25OYW1lID0gJ0VuYWJsZUNsb3VkVHJhaWxFbmNyeXB0aW9uJ1xuICAgICAgICBjb25zdCBpbmxpbmVQb2xpY3kgPSBuZXcgUG9saWN5KHByb3BzLnJvbGVTdGFjaywgYFNIQVJSLVJlbWVkaWF0aW9uLVBvbGljeS0ke3JlbWVkaWF0aW9uTmFtZX1gKTtcblxuICAgICAgICBjb25zdCBjbG91ZHRyYWlsUGVybXMgPSBuZXcgUG9saWN5U3RhdGVtZW50KCk7XG4gICAgICAgIGNsb3VkdHJhaWxQZXJtcy5hZGRBY3Rpb25zKFwiY2xvdWR0cmFpbDpVcGRhdGVUcmFpbFwiKVxuICAgICAgICBjbG91ZHRyYWlsUGVybXMuZWZmZWN0ID0gRWZmZWN0LkFMTE9XXG4gICAgICAgIGNsb3VkdHJhaWxQZXJtcy5hZGRSZXNvdXJjZXMoXCIqXCIpO1xuICAgICAgICBpbmxpbmVQb2xpY3kuYWRkU3RhdGVtZW50cyhjbG91ZHRyYWlsUGVybXMpXG5cbiAgICAgICAgbmV3IFNzbVJvbGUocHJvcHMucm9sZVN0YWNrLCAnUmVtZWRpYXRpb25Sb2xlICcgKyByZW1lZGlhdGlvbk5hbWUsIHtcbiAgICAgICAgICAgIHNvbHV0aW9uSWQ6IHByb3BzLnNvbHV0aW9uSWQsXG4gICAgICAgICAgICBzc21Eb2NOYW1lOiByZW1lZGlhdGlvbk5hbWUsXG4gICAgICAgICAgICByZW1lZGlhdGlvblBvbGljeTogaW5saW5lUG9saWN5LFxuICAgICAgICAgICAgcmVtZWRpYXRpb25Sb2xlTmFtZTogYCR7cmVtZWRpYXRpb25Sb2xlTmFtZUJhc2V9JHtyZW1lZGlhdGlvbk5hbWV9YFxuICAgICAgICB9KVxuXG4gICAgICAgIFJ1bmJvb2tGYWN0b3J5LmNyZWF0ZVJlbWVkaWF0aW9uUnVuYm9vayh0aGlzLCAnU0hBUlIgJysgcmVtZWRpYXRpb25OYW1lLCB7XG4gICAgICAgICAgICBzc21Eb2NOYW1lOiByZW1lZGlhdGlvbk5hbWUsXG4gICAgICAgICAgICBzc21Eb2NQYXRoOiBzc21kb2NzLFxuICAgICAgICAgICAgc3NtRG9jRmlsZU5hbWU6IGAke3JlbWVkaWF0aW9uTmFtZX0ueWFtbGAsXG4gICAgICAgICAgICBzY3JpcHRQYXRoOiBgJHtzc21kb2NzfS9zY3JpcHRzYCxcbiAgICAgICAgICAgIHNvbHV0aW9uVmVyc2lvbjogcHJvcHMuc29sdXRpb25WZXJzaW9uLFxuICAgICAgICAgICAgc29sdXRpb25EaXN0QnVja2V0OiBwcm9wcy5zb2x1dGlvbkRpc3RCdWNrZXQsXG4gICAgICAgICAgICBzb2x1dGlvbklkOiBwcm9wcy5zb2x1dGlvbklkXG4gICAgICAgIH0pXG4gICAgICAgIC8vIENGTi1OQUdcbiAgICAgICAgLy8gV0FSTiBXMTI6IElBTSBwb2xpY3kgc2hvdWxkIG5vdCBhbGxvdyAqIHJlc291cmNlXG5cbiAgICAgICAgbGV0IGNoaWxkVG9Nb2QgPSBpbmxpbmVQb2xpY3kubm9kZS5maW5kQ2hpbGQoJ1Jlc291cmNlJykgYXMgQ2ZuUG9saWN5O1xuICAgICAgICBjaGlsZFRvTW9kLmNmbk9wdGlvbnMubWV0YWRhdGEgPSB7XG4gICAgICAgICAgICBjZm5fbmFnOiB7XG4gICAgICAgICAgICAgICAgcnVsZXNfdG9fc3VwcHJlc3M6IFt7XG4gICAgICAgICAgICAgICAgICAgIGlkOiAnVzEyJyxcbiAgICAgICAgICAgICAgICAgICAgcmVhc29uOiAnUmVzb3VyY2UgKiBpcyByZXF1aXJlZCBmb3IgdG8gYWxsb3cgcmVtZWRpYXRpb24uJ1xuICAgICAgICAgICAgICAgIH0se1xuICAgICAgICAgICAgICAgICAgICBpZDogJ1cyOCcsXG4gICAgICAgICAgICAgICAgICAgIHJlYXNvbjogJ1N0YXRpYyBuYW1lcyBjaG9zZW4gaW50ZW50aW9uYWxseSB0byBwcm92aWRlIGludGVncmF0aW9uIGluIGNyb3NzLWFjY291bnQgcGVybWlzc2lvbnMuJ1xuICAgICAgICAgICAgICAgIH1dXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLy0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAgLy8gRW5hYmxlRGVmYXVsdEVuY3J5cHRpb25TM1xuICAgIC8vXG4gICAge1xuICAgICAgICBjb25zdCByZW1lZGlhdGlvbk5hbWUgPSAnRW5hYmxlRGVmYXVsdEVuY3J5cHRpb25TMydcbiAgICAgICAgY29uc3QgaW5saW5lUG9saWN5ID0gbmV3IFBvbGljeShwcm9wcy5yb2xlU3RhY2ssIGBTSEFSUi1SZW1lZGlhdGlvbi1Qb2xpY3ktJHtyZW1lZGlhdGlvbk5hbWV9YCk7XG4gICAgICAgIGlubGluZVBvbGljeS5hZGRTdGF0ZW1lbnRzKFxuICAgICAgICAgICAgbmV3IFBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgICAgICAgICAgYWN0aW9uczogW1xuICAgICAgICAgICAgICAgICAgICBcInMzOlB1dEVuY3J5cHRpb25Db25maWd1cmF0aW9uXCIsXG4gICAgICAgICAgICAgICAgICAgIFwia21zOkdlbmVyYXRlRGF0YUtleVwiXG4gICAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgICByZXNvdXJjZXM6IFtcbiAgICAgICAgICAgICAgICAgICAgXCIqXCJcbiAgICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICAgIGVmZmVjdDogRWZmZWN0LkFMTE9XXG4gICAgICAgICAgICB9KVxuICAgICAgICApXG4gICAgICAgIG5ldyBTc21Sb2xlKHByb3BzLnJvbGVTdGFjaywgJ1JlbWVkaWF0aW9uUm9sZSAnICsgcmVtZWRpYXRpb25OYW1lLCB7XG4gICAgICAgICAgICBzb2x1dGlvbklkOiBwcm9wcy5zb2x1dGlvbklkLFxuICAgICAgICAgICAgc3NtRG9jTmFtZTogcmVtZWRpYXRpb25OYW1lLFxuICAgICAgICAgICAgcmVtZWRpYXRpb25Qb2xpY3k6IGlubGluZVBvbGljeSxcbiAgICAgICAgICAgIHJlbWVkaWF0aW9uUm9sZU5hbWU6IGAke3JlbWVkaWF0aW9uUm9sZU5hbWVCYXNlfSR7cmVtZWRpYXRpb25OYW1lfWBcbiAgICAgICAgfSlcblxuICAgICAgICBSdW5ib29rRmFjdG9yeS5jcmVhdGVSZW1lZGlhdGlvblJ1bmJvb2sodGhpcywgJ1NIQVJSICcrIHJlbWVkaWF0aW9uTmFtZSwge1xuICAgICAgICAgICAgc3NtRG9jTmFtZTogcmVtZWRpYXRpb25OYW1lLFxuICAgICAgICAgICAgc3NtRG9jUGF0aDogc3NtZG9jcyxcbiAgICAgICAgICAgIHNzbURvY0ZpbGVOYW1lOiBgJHtyZW1lZGlhdGlvbk5hbWV9LnlhbWxgLFxuICAgICAgICAgICAgc2NyaXB0UGF0aDogYCR7c3NtZG9jc30vc2NyaXB0c2AsXG4gICAgICAgICAgICBzb2x1dGlvblZlcnNpb246IHByb3BzLnNvbHV0aW9uVmVyc2lvbixcbiAgICAgICAgICAgIHNvbHV0aW9uRGlzdEJ1Y2tldDogcHJvcHMuc29sdXRpb25EaXN0QnVja2V0LFxuICAgICAgICAgICAgc29sdXRpb25JZDogcHJvcHMuc29sdXRpb25JZFxuICAgICAgICB9KVxuICAgICAgICAvLyBDRk4tTkFHXG4gICAgICAgIC8vIFdBUk4gVzEyOiBJQU0gcG9saWN5IHNob3VsZCBub3QgYWxsb3cgKiByZXNvdXJjZVxuXG4gICAgICAgIGxldCBjaGlsZFRvTW9kID0gaW5saW5lUG9saWN5Lm5vZGUuZmluZENoaWxkKCdSZXNvdXJjZScpIGFzIENmblBvbGljeTtcbiAgICAgICAgY2hpbGRUb01vZC5jZm5PcHRpb25zLm1ldGFkYXRhID0ge1xuICAgICAgICAgICAgY2ZuX25hZzoge1xuICAgICAgICAgICAgICAgIHJ1bGVzX3RvX3N1cHByZXNzOiBbe1xuICAgICAgICAgICAgICAgICAgICBpZDogJ1cxMicsXG4gICAgICAgICAgICAgICAgICAgIHJlYXNvbjogJ1Jlc291cmNlICogaXMgcmVxdWlyZWQgZm9yIHRvIGFsbG93IHJlbWVkaWF0aW9uLidcbiAgICAgICAgICAgICAgICB9LHtcbiAgICAgICAgICAgICAgICAgICAgaWQ6ICdXMjgnLFxuICAgICAgICAgICAgICAgICAgICByZWFzb246ICdTdGF0aWMgbmFtZXMgY2hvc2VuIGludGVudGlvbmFsbHkgdG8gcHJvdmlkZSBpbnRlZ3JhdGlvbiBpbiBjcm9zcy1hY2NvdW50IHBlcm1pc3Npb25zLidcbiAgICAgICAgICAgICAgICB9XVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuICAgIC8vLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICAvLyBFbmFibGVWUENGbG93TG9nc1xuICAgIC8vXG4gICAge1xuICAgICAgICBjb25zdCByZW1lZGlhdGlvbk5hbWUgPSAnRW5hYmxlVlBDRmxvd0xvZ3MnXG4gICAgICAgIGNvbnN0IGlubGluZVBvbGljeSA9IG5ldyBQb2xpY3kocHJvcHMucm9sZVN0YWNrLCBgU0hBUlItUmVtZWRpYXRpb24tUG9saWN5LSR7cmVtZWRpYXRpb25OYW1lfWApO1xuXG4gICAgICAgIHtcbiAgICAgICAgICAgIGxldCByZW1lZGlhdGlvblBlcm1zID0gbmV3IFBvbGljeVN0YXRlbWVudCgpO1xuICAgICAgICAgICAgcmVtZWRpYXRpb25QZXJtcy5hZGRBY3Rpb25zKFxuICAgICAgICAgICAgICAgIFwiZWMyOkNyZWF0ZUZsb3dMb2dzXCJcbiAgICAgICAgICAgIClcbiAgICAgICAgICAgIHJlbWVkaWF0aW9uUGVybXMuZWZmZWN0ID0gRWZmZWN0LkFMTE9XXG4gICAgICAgICAgICByZW1lZGlhdGlvblBlcm1zLmFkZFJlc291cmNlcyhcbiAgICAgICAgICAgICAgICBgYXJuOiR7dGhpcy5wYXJ0aXRpb259OmVjMjoqOiR7dGhpcy5hY2NvdW50fTp2cGMvKmAsXG4gICAgICAgICAgICAgICAgYGFybjoke3RoaXMucGFydGl0aW9ufTplYzI6Kjoke3RoaXMuYWNjb3VudH06dnBjLWZsb3ctbG9nLypgXG4gICAgICAgICAgICApO1xuICAgICAgICAgICAgaW5saW5lUG9saWN5LmFkZFN0YXRlbWVudHMocmVtZWRpYXRpb25QZXJtcylcbiAgICAgICAgfVxuICAgICAgICB7XG4gICAgICAgICAgICBsZXQgaWFtUGVybXMgPSBuZXcgUG9saWN5U3RhdGVtZW50KClcbiAgICAgICAgICAgIGlhbVBlcm1zLmFkZEFjdGlvbnMoXG4gICAgICAgICAgICAgICAgXCJpYW06UGFzc1JvbGVcIlxuICAgICAgICAgICAgKVxuICAgICAgICAgICAgaWFtUGVybXMuZWZmZWN0ID0gRWZmZWN0LkFMTE9XXG4gICAgICAgICAgICBpYW1QZXJtcy5hZGRSZXNvdXJjZXMoXG4gICAgICAgICAgICAgICAgYGFybjoke3RoaXMucGFydGl0aW9ufTppYW06OiR7dGhpcy5hY2NvdW50fTpyb2xlLyR7UkVTT1VSQ0VfUFJFRklYfS0ke3JlbWVkaWF0aW9uTmFtZX0tcmVtZWRpYXRpb25Sb2xlYFxuICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIGlubGluZVBvbGljeS5hZGRTdGF0ZW1lbnRzKGlhbVBlcm1zKVxuICAgICAgICB9XG4gICAgICAgIHtcbiAgICAgICAgICAgIGxldCBzc21QZXJtcyA9IG5ldyBQb2xpY3lTdGF0ZW1lbnQoKVxuICAgICAgICAgICAgc3NtUGVybXMuYWRkQWN0aW9ucyhcbiAgICAgICAgICAgICAgICBcInNzbTpHZXRQYXJhbWV0ZXJcIlxuICAgICAgICAgICAgKVxuICAgICAgICAgICAgc3NtUGVybXMuZWZmZWN0ID0gRWZmZWN0LkFMTE9XXG4gICAgICAgICAgICBzc21QZXJtcy5hZGRSZXNvdXJjZXMoXG4gICAgICAgICAgICAgICAgYGFybjoke3RoaXMucGFydGl0aW9ufTpzc206Kjoke3RoaXMuYWNjb3VudH06cGFyYW1ldGVyLyR7UkVTT1VSQ0VfUFJFRklYfS9DTUtfUkVNRURJQVRJT05fQVJOYFxuICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIGlubGluZVBvbGljeS5hZGRTdGF0ZW1lbnRzKHNzbVBlcm1zKVxuICAgICAgICB9XG4gICAgICAgIHtcbiAgICAgICAgICAgIGxldCB2YWxpZGF0aW9uUGVybXMgPSBuZXcgUG9saWN5U3RhdGVtZW50KClcbiAgICAgICAgICAgIHZhbGlkYXRpb25QZXJtcy5hZGRBY3Rpb25zKFxuICAgICAgICAgICAgICAgIFwiZWMyOkRlc2NyaWJlRmxvd0xvZ3NcIixcbiAgICAgICAgICAgICAgICBcImxvZ3M6Q3JlYXRlTG9nR3JvdXBcIixcbiAgICAgICAgICAgICAgICBcImxvZ3M6RGVzY3JpYmVMb2dHcm91cHNcIlxuICAgICAgICAgICAgKVxuICAgICAgICAgICAgdmFsaWRhdGlvblBlcm1zLmVmZmVjdCA9IEVmZmVjdC5BTExPV1xuICAgICAgICAgICAgdmFsaWRhdGlvblBlcm1zLmFkZFJlc291cmNlcyhcIipcIik7XG4gICAgICAgICAgICBpbmxpbmVQb2xpY3kuYWRkU3RhdGVtZW50cyh2YWxpZGF0aW9uUGVybXMpXG4gICAgICAgIH1cblxuICAgICAgICAvLyBSZW1lZGlhdGlvbiBSb2xlIC0gdXNlZCBpbiB0aGUgcmVtZWRpYXRpb25cbiAgICAgICAgY29uc3QgcmVtZWRpYXRpb25fcG9saWN5ID0gbmV3IFBvbGljeVN0YXRlbWVudCgpXG4gICAgICAgIHJlbWVkaWF0aW9uX3BvbGljeS5lZmZlY3QgPSBFZmZlY3QuQUxMT1dcbiAgICAgICAgcmVtZWRpYXRpb25fcG9saWN5LmFkZEFjdGlvbnMoXG4gICAgICAgICAgICBcImxvZ3M6Q3JlYXRlTG9nR3JvdXBcIixcbiAgICAgICAgICAgIFwibG9nczpDcmVhdGVMb2dTdHJlYW1cIixcbiAgICAgICAgICAgIFwibG9nczpEZXNjcmliZUxvZ0dyb3Vwc1wiLFxuICAgICAgICAgICAgXCJsb2dzOkRlc2NyaWJlTG9nU3RyZWFtc1wiLFxuICAgICAgICAgICAgXCJsb2dzOlB1dExvZ0V2ZW50c1wiXG4gICAgICAgIClcbiAgICAgICAgcmVtZWRpYXRpb25fcG9saWN5LmFkZFJlc291cmNlcyhcIipcIilcblxuICAgICAgICBjb25zdCByZW1lZGlhdGlvbl9kb2MgPSBuZXcgUG9saWN5RG9jdW1lbnQoKVxuICAgICAgICByZW1lZGlhdGlvbl9kb2MuYWRkU3RhdGVtZW50cyhyZW1lZGlhdGlvbl9wb2xpY3kpXG5cbiAgICAgICAgY29uc3QgcmVtZWRpYXRpb25fcm9sZSA9IG5ldyBSb2xlKHByb3BzLnJvbGVTdGFjaywgJ0VuYWJsZVZQQ0Zsb3dMb2dzLXJlbWVkaWF0aW9ucm9sZScsIHtcbiAgICAgICAgICAgIGFzc3VtZWRCeTogbmV3IFNlcnZpY2VQcmluY2lwYWwoJ3ZwYy1mbG93LWxvZ3MuYW1hem9uYXdzLmNvbScpLFxuICAgICAgICAgICAgaW5saW5lUG9saWNpZXM6IHtcbiAgICAgICAgICAgICAgICAnZGVmYXVsdF9sYW1iZGFQb2xpY3knOiByZW1lZGlhdGlvbl9kb2NcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICByb2xlTmFtZTogYCR7UkVTT1VSQ0VfUFJFRklYfS1FbmFibGVWUENGbG93TG9ncy1yZW1lZGlhdGlvblJvbGVgXG4gICAgICAgIH0pO1xuICAgICAgICByZW1lZGlhdGlvbl9yb2xlLmFwcGx5UmVtb3ZhbFBvbGljeShjZGsuUmVtb3ZhbFBvbGljeS5SRVRBSU4pXG5cbiAgICAgICAgY29uc3Qgcm9sZVJlc291cmNlID0gcmVtZWRpYXRpb25fcm9sZS5ub2RlLmZpbmRDaGlsZCgnUmVzb3VyY2UnKSBhcyBDZm5Sb2xlO1xuXG4gICAgICAgIHJvbGVSZXNvdXJjZS5jZm5PcHRpb25zLm1ldGFkYXRhID0ge1xuICAgICAgICAgICAgY2ZuX25hZzoge1xuICAgICAgICAgICAgICAgIHJ1bGVzX3RvX3N1cHByZXNzOiBbe1xuICAgICAgICAgICAgICAgICAgICBpZDogJ1cxMScsXG4gICAgICAgICAgICAgICAgICAgIHJlYXNvbjogJ1Jlc291cmNlICogaXMgcmVxdWlyZWQgZHVlIHRvIHRoZSBhZG1pbmlzdHJhdGl2ZSBuYXR1cmUgb2YgdGhlIHNvbHV0aW9uLidcbiAgICAgICAgICAgICAgICB9LHtcbiAgICAgICAgICAgICAgICAgICAgaWQ6ICdXMjgnLFxuICAgICAgICAgICAgICAgICAgICByZWFzb246ICdTdGF0aWMgbmFtZXMgY2hvc2VuIGludGVudGlvbmFsbHkgdG8gcHJvdmlkZSBpbnRlZ3JhdGlvbiBpbiBjcm9zcy1hY2NvdW50IHBlcm1pc3Npb25zJ1xuICAgICAgICAgICAgICAgIH1dXG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG5cbiAgICAgICAgbmV3IFNzbVJvbGUocHJvcHMucm9sZVN0YWNrLCAnUmVtZWRpYXRpb25Sb2xlICcgKyByZW1lZGlhdGlvbk5hbWUsIHtcbiAgICAgICAgICAgIHNvbHV0aW9uSWQ6IHByb3BzLnNvbHV0aW9uSWQsXG4gICAgICAgICAgICBzc21Eb2NOYW1lOiByZW1lZGlhdGlvbk5hbWUsXG4gICAgICAgICAgICByZW1lZGlhdGlvblBvbGljeTogaW5saW5lUG9saWN5LFxuICAgICAgICAgICAgcmVtZWRpYXRpb25Sb2xlTmFtZTogYCR7cmVtZWRpYXRpb25Sb2xlTmFtZUJhc2V9JHtyZW1lZGlhdGlvbk5hbWV9YFxuICAgICAgICB9KVxuXG4gICAgICAgIFJ1bmJvb2tGYWN0b3J5LmNyZWF0ZVJlbWVkaWF0aW9uUnVuYm9vayh0aGlzLCAnU0hBUlIgJysgcmVtZWRpYXRpb25OYW1lLCB7XG4gICAgICAgICAgICBzc21Eb2NOYW1lOiByZW1lZGlhdGlvbk5hbWUsXG4gICAgICAgICAgICBzc21Eb2NQYXRoOiBzc21kb2NzLFxuICAgICAgICAgICAgc3NtRG9jRmlsZU5hbWU6IGAke3JlbWVkaWF0aW9uTmFtZX0ueWFtbGAsXG4gICAgICAgICAgICBzY3JpcHRQYXRoOiBgJHtzc21kb2NzfS9zY3JpcHRzYCxcbiAgICAgICAgICAgIHNvbHV0aW9uVmVyc2lvbjogcHJvcHMuc29sdXRpb25WZXJzaW9uLFxuICAgICAgICAgICAgc29sdXRpb25EaXN0QnVja2V0OiBwcm9wcy5zb2x1dGlvbkRpc3RCdWNrZXQsXG4gICAgICAgICAgICBzb2x1dGlvbklkOiBwcm9wcy5zb2x1dGlvbklkXG4gICAgICAgIH0pXG5cbiAgICAgICAgbGV0IGNoaWxkVG9Nb2QgPSBpbmxpbmVQb2xpY3kubm9kZS5maW5kQ2hpbGQoJ1Jlc291cmNlJykgYXMgQ2ZuUG9saWN5O1xuICAgICAgICBjaGlsZFRvTW9kLmNmbk9wdGlvbnMubWV0YWRhdGEgPSB7XG4gICAgICAgICAgICBjZm5fbmFnOiB7XG4gICAgICAgICAgICAgICAgcnVsZXNfdG9fc3VwcHJlc3M6IFt7XG4gICAgICAgICAgICAgICAgICAgIGlkOiAnVzEyJyxcbiAgICAgICAgICAgICAgICAgICAgcmVhc29uOiAnUmVzb3VyY2UgKiBpcyByZXF1aXJlZCBmb3IgdG8gYWxsb3cgcmVtZWRpYXRpb24gZm9yICphbnkqIHJlc291cmNlcy4nXG4gICAgICAgICAgICAgICAgfV1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICAvLyBDcmVhdGVBY2Nlc3NMb2dnaW5nQnVja2V0XG4gICAgLy9cbiAgICB7XG4gICAgICAgIGNvbnN0IHJlbWVkaWF0aW9uTmFtZSA9ICdDcmVhdGVBY2Nlc3NMb2dnaW5nQnVja2V0J1xuICAgICAgICBjb25zdCBpbmxpbmVQb2xpY3kgPSBuZXcgUG9saWN5KHByb3BzLnJvbGVTdGFjaywgYFNIQVJSLVJlbWVkaWF0aW9uLVBvbGljeS0ke3JlbWVkaWF0aW9uTmFtZX1gKTtcbiAgICAgICAgY29uc3QgczNQZXJtcyA9IG5ldyBQb2xpY3lTdGF0ZW1lbnQoKTtcbiAgICAgICAgczNQZXJtcy5hZGRBY3Rpb25zKFxuICAgICAgICAgICAgXCJzMzpDcmVhdGVCdWNrZXRcIixcbiAgICAgICAgICAgIFwiczM6UHV0RW5jcnlwdGlvbkNvbmZpZ3VyYXRpb25cIixcbiAgICAgICAgICAgIFwiczM6UHV0QnVja2V0QWNsXCJcbiAgICAgICAgKVxuICAgICAgICBzM1Blcm1zLmVmZmVjdCA9IEVmZmVjdC5BTExPV1xuICAgICAgICBzM1Blcm1zLmFkZFJlc291cmNlcyhcIipcIik7XG5cbiAgICAgICAgaW5saW5lUG9saWN5LmFkZFN0YXRlbWVudHMoczNQZXJtcylcblxuICAgICAgICBuZXcgU3NtUm9sZShwcm9wcy5yb2xlU3RhY2ssICdSZW1lZGlhdGlvblJvbGUgJyArIHJlbWVkaWF0aW9uTmFtZSwge1xuICAgICAgICAgICAgc29sdXRpb25JZDogcHJvcHMuc29sdXRpb25JZCxcbiAgICAgICAgICAgIHNzbURvY05hbWU6IHJlbWVkaWF0aW9uTmFtZSxcbiAgICAgICAgICAgIHJlbWVkaWF0aW9uUG9saWN5OiBpbmxpbmVQb2xpY3ksXG4gICAgICAgICAgICByZW1lZGlhdGlvblJvbGVOYW1lOiBgJHtyZW1lZGlhdGlvblJvbGVOYW1lQmFzZX0ke3JlbWVkaWF0aW9uTmFtZX1gXG4gICAgICAgIH0pXG5cbiAgICAgICAgUnVuYm9va0ZhY3RvcnkuY3JlYXRlUmVtZWRpYXRpb25SdW5ib29rKHRoaXMsICdTSEFSUiAnKyByZW1lZGlhdGlvbk5hbWUsIHtcbiAgICAgICAgICAgIHNzbURvY05hbWU6IHJlbWVkaWF0aW9uTmFtZSxcbiAgICAgICAgICAgIHNzbURvY1BhdGg6IHNzbWRvY3MsXG4gICAgICAgICAgICBzc21Eb2NGaWxlTmFtZTogYCR7cmVtZWRpYXRpb25OYW1lfS55YW1sYCxcbiAgICAgICAgICAgIHNjcmlwdFBhdGg6IGAke3NzbWRvY3N9L3NjcmlwdHNgLFxuICAgICAgICAgICAgc29sdXRpb25WZXJzaW9uOiBwcm9wcy5zb2x1dGlvblZlcnNpb24sXG4gICAgICAgICAgICBzb2x1dGlvbkRpc3RCdWNrZXQ6IHByb3BzLnNvbHV0aW9uRGlzdEJ1Y2tldCxcbiAgICAgICAgICAgIHNvbHV0aW9uSWQ6IHByb3BzLnNvbHV0aW9uSWRcbiAgICAgICAgfSlcblxuICAgICAgICBsZXQgY2hpbGRUb01vZCA9IGlubGluZVBvbGljeS5ub2RlLmZpbmRDaGlsZCgnUmVzb3VyY2UnKSBhcyBDZm5Qb2xpY3k7XG4gICAgICAgIGNoaWxkVG9Nb2QuY2ZuT3B0aW9ucy5tZXRhZGF0YSA9IHtcbiAgICAgICAgICAgIGNmbl9uYWc6IHtcbiAgICAgICAgICAgICAgICBydWxlc190b19zdXBwcmVzczogW3tcbiAgICAgICAgICAgICAgICAgICAgaWQ6ICdXMTInLFxuICAgICAgICAgICAgICAgICAgICByZWFzb246ICdSZXNvdXJjZSAqIGlzIHJlcXVpcmVkIGZvciB0byBhbGxvdyByZW1lZGlhdGlvbiBmb3IgKmFueSogcmVzb3VyY2VzLidcbiAgICAgICAgICAgICAgICB9XVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgIC8vIE1ha2VFQlNTbmFwc2hvdHNQcml2YXRlXG4gICAgLy9cbiAgICB7XG4gICAgICAgIGNvbnN0IHJlbWVkaWF0aW9uTmFtZSA9ICdNYWtlRUJTU25hcHNob3RzUHJpdmF0ZSdcbiAgICAgICAgY29uc3QgaW5saW5lUG9saWN5ID0gbmV3IFBvbGljeShwcm9wcy5yb2xlU3RhY2ssIGBTSEFSUi1SZW1lZGlhdGlvbi1Qb2xpY3ktJHtyZW1lZGlhdGlvbk5hbWV9YCk7XG4gICAgICAgIGNvbnN0IGVjMlBlcm1zID0gbmV3IFBvbGljeVN0YXRlbWVudCgpO1xuICAgICAgICBlYzJQZXJtcy5hZGRBY3Rpb25zKFxuICAgICAgICAgICAgXCJlYzI6TW9kaWZ5U25hcHNob3RBdHRyaWJ1dGVcIixcbiAgICAgICAgICAgIFwiZWMyOkRlc2NyaWJlU25hcHNob3RzXCJcbiAgICAgICAgICAgIClcbiAgICAgICAgZWMyUGVybXMuZWZmZWN0ID0gRWZmZWN0LkFMTE9XXG4gICAgICAgIGVjMlBlcm1zLmFkZFJlc291cmNlcyhcIipcIik7XG4gICAgICAgIGlubGluZVBvbGljeS5hZGRTdGF0ZW1lbnRzKGVjMlBlcm1zKVxuXG4gICAgICAgIG5ldyBTc21Sb2xlKHByb3BzLnJvbGVTdGFjaywgJ1JlbWVkaWF0aW9uUm9sZSAnICsgcmVtZWRpYXRpb25OYW1lLCB7XG4gICAgICAgICAgICBzb2x1dGlvbklkOiBwcm9wcy5zb2x1dGlvbklkLFxuICAgICAgICAgICAgc3NtRG9jTmFtZTogcmVtZWRpYXRpb25OYW1lLFxuICAgICAgICAgICAgcmVtZWRpYXRpb25Qb2xpY3k6IGlubGluZVBvbGljeSxcbiAgICAgICAgICAgIHJlbWVkaWF0aW9uUm9sZU5hbWU6IGAke3JlbWVkaWF0aW9uUm9sZU5hbWVCYXNlfSR7cmVtZWRpYXRpb25OYW1lfWBcbiAgICAgICAgfSlcblxuICAgICAgICBSdW5ib29rRmFjdG9yeS5jcmVhdGVSZW1lZGlhdGlvblJ1bmJvb2sodGhpcywgJ1NIQVJSICcrIHJlbWVkaWF0aW9uTmFtZSwge1xuICAgICAgICAgICAgc3NtRG9jTmFtZTogcmVtZWRpYXRpb25OYW1lLFxuICAgICAgICAgICAgc3NtRG9jUGF0aDogc3NtZG9jcyxcbiAgICAgICAgICAgIHNzbURvY0ZpbGVOYW1lOiBgJHtyZW1lZGlhdGlvbk5hbWV9LnlhbWxgLFxuICAgICAgICAgICAgc2NyaXB0UGF0aDogYCR7c3NtZG9jc30vc2NyaXB0c2AsXG4gICAgICAgICAgICBzb2x1dGlvblZlcnNpb246IHByb3BzLnNvbHV0aW9uVmVyc2lvbixcbiAgICAgICAgICAgIHNvbHV0aW9uRGlzdEJ1Y2tldDogcHJvcHMuc29sdXRpb25EaXN0QnVja2V0LFxuICAgICAgICAgICAgc29sdXRpb25JZDogcHJvcHMuc29sdXRpb25JZFxuICAgICAgICB9KVxuXG4gICAgICAgIC8vIENGTi1OQUdcbiAgICAgICAgLy8gV0FSTiBXMTI6IElBTSBwb2xpY3kgc2hvdWxkIG5vdCBhbGxvdyAqIHJlc291cmNlXG5cbiAgICAgICAgbGV0IGNoaWxkVG9Nb2QgPSBpbmxpbmVQb2xpY3kubm9kZS5maW5kQ2hpbGQoJ1Jlc291cmNlJykgYXMgQ2ZuUG9saWN5O1xuICAgICAgICBjaGlsZFRvTW9kLmNmbk9wdGlvbnMubWV0YWRhdGEgPSB7XG4gICAgICAgICAgICBjZm5fbmFnOiB7XG4gICAgICAgICAgICAgICAgcnVsZXNfdG9fc3VwcHJlc3M6IFt7XG4gICAgICAgICAgICAgICAgICAgIGlkOiAnVzEyJyxcbiAgICAgICAgICAgICAgICAgICAgcmVhc29uOiAnUmVzb3VyY2UgKiBpcyByZXF1aXJlZCBmb3IgdG8gYWxsb3cgcmVtZWRpYXRpb24gZm9yICphbnkqIHNuYXBzaG90LidcbiAgICAgICAgICAgICAgICB9XVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgIC8vIE1ha2VSRFNTbmFwc2hvdFByaXZhdGVcbiAgICAvL1xuICAgIHtcbiAgICAgICAgY29uc3QgcmVtZWRpYXRpb25OYW1lID0gJ01ha2VSRFNTbmFwc2hvdFByaXZhdGUnXG4gICAgICAgIGNvbnN0IGlubGluZVBvbGljeSA9IG5ldyBQb2xpY3kocHJvcHMucm9sZVN0YWNrLCBgU0hBUlItUmVtZWRpYXRpb24tUG9saWN5LSR7cmVtZWRpYXRpb25OYW1lfWApO1xuICAgICAgICBjb25zdCByZW1lZGlhdGlvblBlcm1zID0gbmV3IFBvbGljeVN0YXRlbWVudCgpO1xuICAgICAgICByZW1lZGlhdGlvblBlcm1zLmFkZEFjdGlvbnMoXG4gICAgICAgICAgICBcInJkczpNb2RpZnlEQlNuYXBzaG90QXR0cmlidXRlXCIsXG4gICAgICAgICAgICBcInJkczpNb2RpZnlEQkNsdXN0ZXJTbmFwc2hvdEF0dHJpYnV0ZVwiXG4gICAgICAgICAgICApXG4gICAgICAgIHJlbWVkaWF0aW9uUGVybXMuZWZmZWN0ID0gRWZmZWN0LkFMTE9XXG4gICAgICAgIHJlbWVkaWF0aW9uUGVybXMuYWRkUmVzb3VyY2VzKFwiKlwiKTtcbiAgICAgICAgaW5saW5lUG9saWN5LmFkZFN0YXRlbWVudHMocmVtZWRpYXRpb25QZXJtcylcblxuICAgICAgICBuZXcgU3NtUm9sZShwcm9wcy5yb2xlU3RhY2ssICdSZW1lZGlhdGlvblJvbGUgJyArIHJlbWVkaWF0aW9uTmFtZSwge1xuICAgICAgICAgICAgc29sdXRpb25JZDogcHJvcHMuc29sdXRpb25JZCxcbiAgICAgICAgICAgIHNzbURvY05hbWU6IHJlbWVkaWF0aW9uTmFtZSxcbiAgICAgICAgICAgIHJlbWVkaWF0aW9uUG9saWN5OiBpbmxpbmVQb2xpY3ksXG4gICAgICAgICAgICByZW1lZGlhdGlvblJvbGVOYW1lOiBgJHtyZW1lZGlhdGlvblJvbGVOYW1lQmFzZX0ke3JlbWVkaWF0aW9uTmFtZX1gXG4gICAgICAgIH0pXG5cbiAgICAgICAgUnVuYm9va0ZhY3RvcnkuY3JlYXRlUmVtZWRpYXRpb25SdW5ib29rKHRoaXMsICdTSEFSUiAnKyByZW1lZGlhdGlvbk5hbWUsIHtcbiAgICAgICAgICAgIHNzbURvY05hbWU6IHJlbWVkaWF0aW9uTmFtZSxcbiAgICAgICAgICAgIHNzbURvY1BhdGg6IHNzbWRvY3MsXG4gICAgICAgICAgICBzc21Eb2NGaWxlTmFtZTogYCR7cmVtZWRpYXRpb25OYW1lfS55YW1sYCxcbiAgICAgICAgICAgIHNjcmlwdFBhdGg6IGAke3NzbWRvY3N9L3NjcmlwdHNgLFxuICAgICAgICAgICAgc29sdXRpb25WZXJzaW9uOiBwcm9wcy5zb2x1dGlvblZlcnNpb24sXG4gICAgICAgICAgICBzb2x1dGlvbkRpc3RCdWNrZXQ6IHByb3BzLnNvbHV0aW9uRGlzdEJ1Y2tldCxcbiAgICAgICAgICAgIHNvbHV0aW9uSWQ6IHByb3BzLnNvbHV0aW9uSWRcbiAgICAgICAgfSlcblxuICAgICAgICAvLyBDRk4tTkFHXG4gICAgICAgIC8vIFdBUk4gVzEyOiBJQU0gcG9saWN5IHNob3VsZCBub3QgYWxsb3cgKiByZXNvdXJjZVxuXG4gICAgICAgIGxldCBjaGlsZFRvTW9kID0gaW5saW5lUG9saWN5Lm5vZGUuZmluZENoaWxkKCdSZXNvdXJjZScpIGFzIENmblBvbGljeTtcbiAgICAgICAgY2hpbGRUb01vZC5jZm5PcHRpb25zLm1ldGFkYXRhID0ge1xuICAgICAgICAgICAgY2ZuX25hZzoge1xuICAgICAgICAgICAgICAgIHJ1bGVzX3RvX3N1cHByZXNzOiBbe1xuICAgICAgICAgICAgICAgICAgICBpZDogJ1cxMicsXG4gICAgICAgICAgICAgICAgICAgIHJlYXNvbjogJ1Jlc291cmNlICogaXMgcmVxdWlyZWQgZm9yIHRvIGFsbG93IHJlbWVkaWF0aW9uIGZvciAqYW55KiBzbmFwc2hvdC4nXG4gICAgICAgICAgICAgICAgfV1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICAvLyBSZW1vdmVMYW1iZGFQdWJsaWNBY2Nlc3NcbiAgICAvL1xuICAgIHtcbiAgICAgICAgY29uc3QgcmVtZWRpYXRpb25OYW1lID0gJ1JlbW92ZUxhbWJkYVB1YmxpY0FjY2VzcydcbiAgICAgICAgY29uc3QgaW5saW5lUG9saWN5ID0gbmV3IFBvbGljeShwcm9wcy5yb2xlU3RhY2ssIGBTSEFSUi1SZW1lZGlhdGlvbi1Qb2xpY3ktJHtyZW1lZGlhdGlvbk5hbWV9YCk7XG5cbiAgICAgICAgY29uc3QgbGFtYmRhUGVybXMgPSBuZXcgUG9saWN5U3RhdGVtZW50KCk7XG4gICAgICAgIGxhbWJkYVBlcm1zLmFkZEFjdGlvbnMoXG4gICAgICAgICAgICBcImxhbWJkYTpHZXRQb2xpY3lcIixcbiAgICAgICAgICAgIFwibGFtYmRhOlJlbW92ZVBlcm1pc3Npb25cIlxuICAgICAgICApXG4gICAgICAgIGxhbWJkYVBlcm1zLmVmZmVjdCA9IEVmZmVjdC5BTExPV1xuICAgICAgICBsYW1iZGFQZXJtcy5hZGRSZXNvdXJjZXMoJyonKVxuICAgICAgICBpbmxpbmVQb2xpY3kuYWRkU3RhdGVtZW50cyhsYW1iZGFQZXJtcylcblxuICAgICAgICBuZXcgU3NtUm9sZShwcm9wcy5yb2xlU3RhY2ssICdSZW1lZGlhdGlvblJvbGUgJyArIHJlbWVkaWF0aW9uTmFtZSwge1xuICAgICAgICAgICAgc29sdXRpb25JZDogcHJvcHMuc29sdXRpb25JZCxcbiAgICAgICAgICAgIHNzbURvY05hbWU6IHJlbWVkaWF0aW9uTmFtZSxcbiAgICAgICAgICAgIHJlbWVkaWF0aW9uUG9saWN5OiBpbmxpbmVQb2xpY3ksXG4gICAgICAgICAgICByZW1lZGlhdGlvblJvbGVOYW1lOiBgJHtyZW1lZGlhdGlvblJvbGVOYW1lQmFzZX0ke3JlbWVkaWF0aW9uTmFtZX1gXG4gICAgICAgIH0pXG5cbiAgICAgICAgUnVuYm9va0ZhY3RvcnkuY3JlYXRlUmVtZWRpYXRpb25SdW5ib29rKHRoaXMsICdTSEFSUiAnKyByZW1lZGlhdGlvbk5hbWUsIHtcbiAgICAgICAgICAgIHNzbURvY05hbWU6IHJlbWVkaWF0aW9uTmFtZSxcbiAgICAgICAgICAgIHNzbURvY1BhdGg6IHNzbWRvY3MsXG4gICAgICAgICAgICBzc21Eb2NGaWxlTmFtZTogYCR7cmVtZWRpYXRpb25OYW1lfS55YW1sYCxcbiAgICAgICAgICAgIHNjcmlwdFBhdGg6IGAke3NzbWRvY3N9L3NjcmlwdHNgLFxuICAgICAgICAgICAgc29sdXRpb25WZXJzaW9uOiBwcm9wcy5zb2x1dGlvblZlcnNpb24sXG4gICAgICAgICAgICBzb2x1dGlvbkRpc3RCdWNrZXQ6IHByb3BzLnNvbHV0aW9uRGlzdEJ1Y2tldCxcbiAgICAgICAgICAgIHNvbHV0aW9uSWQ6IHByb3BzLnNvbHV0aW9uSWRcbiAgICAgICAgfSlcblxuICAgICAgICAvLyBDRk4tTkFHXG4gICAgICAgIC8vIFdBUk4gVzEyOiBJQU0gcG9saWN5IHNob3VsZCBub3QgYWxsb3cgKiByZXNvdXJjZVxuXG4gICAgICAgIGxldCBjaGlsZFRvTW9kID0gaW5saW5lUG9saWN5Lm5vZGUuZmluZENoaWxkKCdSZXNvdXJjZScpIGFzIENmblBvbGljeTtcbiAgICAgICAgY2hpbGRUb01vZC5jZm5PcHRpb25zLm1ldGFkYXRhID0ge1xuICAgICAgICAgICAgY2ZuX25hZzoge1xuICAgICAgICAgICAgICAgIHJ1bGVzX3RvX3N1cHByZXNzOiBbe1xuICAgICAgICAgICAgICAgICAgICBpZDogJ1cxMicsXG4gICAgICAgICAgICAgICAgICAgIHJlYXNvbjogJ1Jlc291cmNlICogaXMgcmVxdWlyZWQgZm9yIHRvIGFsbG93IHJlbWVkaWF0aW9uIGZvciBhbnkgcmVzb3VyY2UuJ1xuICAgICAgICAgICAgICAgIH1dXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLy0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAgLy8gUmV2b2tlVW5yb3RhdGVkS2V5c1xuICAgIC8vXG4gICAge1xuICAgICAgICBjb25zdCByZW1lZGlhdGlvbk5hbWUgPSAnUmV2b2tlVW5yb3RhdGVkS2V5cydcbiAgICAgICAgY29uc3QgaW5saW5lUG9saWN5ID0gbmV3IFBvbGljeShwcm9wcy5yb2xlU3RhY2ssIGBTSEFSUi1SZW1lZGlhdGlvbi1Qb2xpY3ktJHtyZW1lZGlhdGlvbk5hbWV9YCk7XG4gICAgICAgIGNvbnN0IHJlbWVkaWF0aW9uUG9saWN5ID0gbmV3IFBvbGljeVN0YXRlbWVudCgpO1xuICAgICAgICByZW1lZGlhdGlvblBvbGljeS5hZGRBY3Rpb25zKFxuICAgICAgICAgICAgXCJpYW06VXBkYXRlQWNjZXNzS2V5XCIsXG4gICAgICAgICAgICBcImlhbTpMaXN0QWNjZXNzS2V5c1wiLFxuICAgICAgICAgICAgXCJpYW06R2V0QWNjZXNzS2V5TGFzdFVzZWRcIixcbiAgICAgICAgICAgIFwiaWFtOkdldFVzZXJcIlxuICAgICAgICApO1xuICAgICAgICByZW1lZGlhdGlvblBvbGljeS5lZmZlY3QgPSBFZmZlY3QuQUxMT1c7XG4gICAgICAgIHJlbWVkaWF0aW9uUG9saWN5LmFkZFJlc291cmNlcyhcbiAgICAgICAgICAgIFwiYXJuOlwiICsgdGhpcy5wYXJ0aXRpb24gKyBcIjppYW06OlwiICsgdGhpcy5hY2NvdW50ICsgXCI6dXNlci8qXCJcbiAgICAgICAgKTtcbiAgICAgICAgaW5saW5lUG9saWN5LmFkZFN0YXRlbWVudHMocmVtZWRpYXRpb25Qb2xpY3kpXG5cbiAgICAgICAgY29uc3QgY2ZnUGVybXMgPSBuZXcgUG9saWN5U3RhdGVtZW50KCk7XG4gICAgICAgIGNmZ1Blcm1zLmFkZEFjdGlvbnMoXG4gICAgICAgICAgICBcImNvbmZpZzpMaXN0RGlzY292ZXJlZFJlc291cmNlc1wiXG4gICAgICAgIClcbiAgICAgICAgY2ZnUGVybXMuZWZmZWN0ID0gRWZmZWN0LkFMTE9XXG4gICAgICAgIGNmZ1Blcm1zLmFkZFJlc291cmNlcyhcIipcIilcbiAgICAgICAgaW5saW5lUG9saWN5LmFkZFN0YXRlbWVudHMoY2ZnUGVybXMpXG5cbiAgICAgICAgbmV3IFNzbVJvbGUocHJvcHMucm9sZVN0YWNrLCAnUmVtZWRpYXRpb25Sb2xlICcgKyByZW1lZGlhdGlvbk5hbWUsIHtcbiAgICAgICAgICAgIHNvbHV0aW9uSWQ6IHByb3BzLnNvbHV0aW9uSWQsXG4gICAgICAgICAgICBzc21Eb2NOYW1lOiByZW1lZGlhdGlvbk5hbWUsXG4gICAgICAgICAgICByZW1lZGlhdGlvblBvbGljeTogaW5saW5lUG9saWN5LFxuICAgICAgICAgICAgcmVtZWRpYXRpb25Sb2xlTmFtZTogYCR7cmVtZWRpYXRpb25Sb2xlTmFtZUJhc2V9JHtyZW1lZGlhdGlvbk5hbWV9YFxuICAgICAgICB9KVxuXG4gICAgICAgIFJ1bmJvb2tGYWN0b3J5LmNyZWF0ZVJlbWVkaWF0aW9uUnVuYm9vayh0aGlzLCAnU0hBUlIgJysgcmVtZWRpYXRpb25OYW1lLCB7XG4gICAgICAgICAgICBzc21Eb2NOYW1lOiByZW1lZGlhdGlvbk5hbWUsXG4gICAgICAgICAgICBzc21Eb2NQYXRoOiBzc21kb2NzLFxuICAgICAgICAgICAgc3NtRG9jRmlsZU5hbWU6IGAke3JlbWVkaWF0aW9uTmFtZX0ueWFtbGAsXG4gICAgICAgICAgICBzY3JpcHRQYXRoOiBgJHtzc21kb2NzfS9zY3JpcHRzYCxcbiAgICAgICAgICAgIHNvbHV0aW9uVmVyc2lvbjogcHJvcHMuc29sdXRpb25WZXJzaW9uLFxuICAgICAgICAgICAgc29sdXRpb25EaXN0QnVja2V0OiBwcm9wcy5zb2x1dGlvbkRpc3RCdWNrZXQsXG4gICAgICAgICAgICBzb2x1dGlvbklkOiBwcm9wcy5zb2x1dGlvbklkXG4gICAgICAgIH0pXG5cbiAgICAgICAgbGV0IGNoaWxkVG9Nb2QgPSBpbmxpbmVQb2xpY3kubm9kZS5maW5kQ2hpbGQoJ1Jlc291cmNlJykgYXMgQ2ZuUG9saWN5O1xuICAgICAgICBjaGlsZFRvTW9kLmNmbk9wdGlvbnMubWV0YWRhdGEgPSB7XG4gICAgICAgICAgICBjZm5fbmFnOiB7XG4gICAgICAgICAgICAgICAgcnVsZXNfdG9fc3VwcHJlc3M6IFt7XG4gICAgICAgICAgICAgICAgICAgIGlkOiAnVzEyJyxcbiAgICAgICAgICAgICAgICAgICAgcmVhc29uOiAnUmVzb3VyY2UgKiBpcyByZXF1aXJlZCBmb3IgdG8gYWxsb3cgcmVtZWRpYXRpb24gZm9yIGFueSByZXNvdXJjZS4nXG4gICAgICAgICAgICAgICAgfV1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICAvLyBTZXRTU0xCdWNrZXRQb2xpY3lcbiAgICAvL1xuICAgIHtcbiAgICAgICAgY29uc3QgcmVtZWRpYXRpb25OYW1lID0gJ1NldFNTTEJ1Y2tldFBvbGljeSdcbiAgICAgICAgY29uc3QgaW5saW5lUG9saWN5ID0gbmV3IFBvbGljeShwcm9wcy5yb2xlU3RhY2ssIGBTSEFSUi1SZW1lZGlhdGlvbi1Qb2xpY3ktJHtyZW1lZGlhdGlvbk5hbWV9YCk7XG5cbiAgICAgICAge1xuICAgICAgICAgICAgbGV0IHJlbWVkaWF0aW9uUGVybXMgPSBuZXcgUG9saWN5U3RhdGVtZW50KCk7XG4gICAgICAgICAgICByZW1lZGlhdGlvblBlcm1zLmFkZEFjdGlvbnMoXG4gICAgICAgICAgICAgICAgXCJzMzpHZXRCdWNrZXRQb2xpY3lcIixcbiAgICAgICAgICAgICAgICBcInMzOlB1dEJ1Y2tldFBvbGljeVwiXG4gICAgICAgICAgICApXG4gICAgICAgICAgICByZW1lZGlhdGlvblBlcm1zLmVmZmVjdCA9IEVmZmVjdC5BTExPV1xuICAgICAgICAgICAgcmVtZWRpYXRpb25QZXJtcy5hZGRSZXNvdXJjZXMoXCIqXCIpO1xuICAgICAgICAgICAgaW5saW5lUG9saWN5LmFkZFN0YXRlbWVudHMocmVtZWRpYXRpb25QZXJtcylcbiAgICAgICAgfVxuXG4gICAgICAgIG5ldyBTc21Sb2xlKHByb3BzLnJvbGVTdGFjaywgJ1JlbWVkaWF0aW9uUm9sZSAnICsgcmVtZWRpYXRpb25OYW1lLCB7XG4gICAgICAgICAgICBzb2x1dGlvbklkOiBwcm9wcy5zb2x1dGlvbklkLFxuICAgICAgICAgICAgc3NtRG9jTmFtZTogcmVtZWRpYXRpb25OYW1lLFxuICAgICAgICAgICAgcmVtZWRpYXRpb25Qb2xpY3k6IGlubGluZVBvbGljeSxcbiAgICAgICAgICAgIHJlbWVkaWF0aW9uUm9sZU5hbWU6IGAke3JlbWVkaWF0aW9uUm9sZU5hbWVCYXNlfSR7cmVtZWRpYXRpb25OYW1lfWBcbiAgICAgICAgfSlcblxuICAgICAgICBsZXQgY2hpbGRUb01vZCA9IGlubGluZVBvbGljeS5ub2RlLmZpbmRDaGlsZCgnUmVzb3VyY2UnKSBhcyBDZm5Qb2xpY3k7XG4gICAgICAgIGNoaWxkVG9Nb2QuY2ZuT3B0aW9ucy5tZXRhZGF0YSA9IHtcbiAgICAgICAgICAgIGNmbl9uYWc6IHtcbiAgICAgICAgICAgICAgICBydWxlc190b19zdXBwcmVzczogW3tcbiAgICAgICAgICAgICAgICAgICAgaWQ6ICdXMTInLFxuICAgICAgICAgICAgICAgICAgICByZWFzb246ICdSZXNvdXJjZSAqIGlzIHJlcXVpcmVkIGZvciB0byBhbGxvdyByZW1lZGlhdGlvbiBmb3IgKmFueSogcmVzb3VyY2UuJ1xuICAgICAgICAgICAgICAgIH1dXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBSdW5ib29rRmFjdG9yeS5jcmVhdGVSZW1lZGlhdGlvblJ1bmJvb2sodGhpcywgJ1NIQVJSICcrIHJlbWVkaWF0aW9uTmFtZSwge1xuICAgICAgICAgICAgc3NtRG9jTmFtZTogcmVtZWRpYXRpb25OYW1lLFxuICAgICAgICAgICAgc3NtRG9jUGF0aDogc3NtZG9jcyxcbiAgICAgICAgICAgIHNzbURvY0ZpbGVOYW1lOiBgJHtyZW1lZGlhdGlvbk5hbWV9LnlhbWxgLFxuICAgICAgICAgICAgc2NyaXB0UGF0aDogYCR7c3NtZG9jc30vc2NyaXB0c2AsXG4gICAgICAgICAgICBzb2x1dGlvblZlcnNpb246IHByb3BzLnNvbHV0aW9uVmVyc2lvbixcbiAgICAgICAgICAgIHNvbHV0aW9uRGlzdEJ1Y2tldDogcHJvcHMuc29sdXRpb25EaXN0QnVja2V0LFxuICAgICAgICAgICAgc29sdXRpb25JZDogcHJvcHMuc29sdXRpb25JZFxuICAgICAgICB9KVxuICAgIH1cblxuICAgIC8vLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICAvLyBSZXBsYWNlQ29kZUJ1aWxkQ2xlYXJUZXh0Q3JlZGVudGlhbHNcbiAgICAvL1xuICAgIHtcbiAgICAgICAgY29uc3QgcmVtZWRpYXRpb25OYW1lID0gJ1JlcGxhY2VDb2RlQnVpbGRDbGVhclRleHRDcmVkZW50aWFscydcbiAgICAgICAgY29uc3QgaW5saW5lUG9saWN5ID0gbmV3IFBvbGljeShwcm9wcy5yb2xlU3RhY2ssIGBTSEFSUi1SZW1lZGlhdGlvbi1Qb2xpY3ktJHtyZW1lZGlhdGlvbk5hbWV9YCk7XG5cbiAgICAgICAgY29uc3QgcmVtZWRpYXRpb25Qb2xpY3kgPSBuZXcgUG9saWN5U3RhdGVtZW50KCk7XG4gICAgICAgIHJlbWVkaWF0aW9uUG9saWN5LmFkZEFjdGlvbnMoXG4gICAgICAgICAgICBcImNvZGVCdWlsZDpCYXRjaEdldFByb2plY3RzXCIsXG4gICAgICAgICAgICBcImNvZGVCdWlsZDpVcGRhdGVQcm9qZWN0XCIsXG4gICAgICAgICAgICBcInNzbTpQdXRQYXJhbWV0ZXJcIixcbiAgICAgICAgICAgIFwiaWFtOkNyZWF0ZVBvbGljeVwiXG4gICAgICAgICk7XG4gICAgICAgIHJlbWVkaWF0aW9uUG9saWN5LmVmZmVjdCA9IEVmZmVjdC5BTExPV1xuICAgICAgICByZW1lZGlhdGlvblBvbGljeS5hZGRSZXNvdXJjZXMoXCIqXCIpXG4gICAgICAgIGlubGluZVBvbGljeS5hZGRTdGF0ZW1lbnRzKHJlbWVkaWF0aW9uUG9saWN5KVxuXG4gICAgICAgIC8vIENvZGVCdWlsZCBwcm9qZWN0cyBhcmUgYnVpbHQgYnkgc2VydmljZSByb2xlc1xuICAgICAgICBjb25zdCBhdHRhY2hSb2xlUG9saWN5ID0gbmV3IFBvbGljeVN0YXRlbWVudCgpO1xuICAgICAgICBhdHRhY2hSb2xlUG9saWN5LmFkZEFjdGlvbnMoJ2lhbTpBdHRhY2hSb2xlUG9saWN5Jyk7XG4gICAgICAgIGF0dGFjaFJvbGVQb2xpY3kuYWRkUmVzb3VyY2VzKGBhcm46JHt0aGlzLnBhcnRpdGlvbn06aWFtOjoke3RoaXMuYWNjb3VudH06cm9sZS9zZXJ2aWNlLXJvbGUvKmApO1xuICAgICAgICBpbmxpbmVQb2xpY3kuYWRkU3RhdGVtZW50cyhhdHRhY2hSb2xlUG9saWN5KVxuXG4gICAgICAgIC8vIEp1c3QgaW4gY2FzZSwgZXhwbGljaXRseSBkZW55IHBlcm1pc3Npb24gdG8gbW9kaWZ5IG91ciBvd24gcm9sZSBwb2xpY3lcbiAgICAgICAgY29uc3QgYXR0YWNoUm9sZVBvbGljeURlbnkgPSBuZXcgUG9saWN5U3RhdGVtZW50KCk7XG4gICAgICAgIGF0dGFjaFJvbGVQb2xpY3lEZW55LmFkZEFjdGlvbnMoJ2lhbTpBdHRhY2hSb2xlUG9saWN5Jyk7XG4gICAgICAgIGF0dGFjaFJvbGVQb2xpY3lEZW55LmVmZmVjdCA9IEVmZmVjdC5ERU5ZO1xuICAgICAgICBhdHRhY2hSb2xlUG9saWN5RGVueS5hZGRSZXNvdXJjZXMoYGFybjoke3RoaXMucGFydGl0aW9ufTppYW06OiR7dGhpcy5hY2NvdW50fTpyb2xlLyR7cmVtZWRpYXRpb25Sb2xlTmFtZUJhc2V9JHtyZW1lZGlhdGlvbk5hbWV9YCk7XG4gICAgICAgIGlubGluZVBvbGljeS5hZGRTdGF0ZW1lbnRzKGF0dGFjaFJvbGVQb2xpY3lEZW55KTtcblxuICAgICAgICBuZXcgU3NtUm9sZShwcm9wcy5yb2xlU3RhY2ssICdSZW1lZGlhdGlvblJvbGUgJyArIHJlbWVkaWF0aW9uTmFtZSwge1xuICAgICAgICAgICAgc29sdXRpb25JZDogcHJvcHMuc29sdXRpb25JZCxcbiAgICAgICAgICAgIHNzbURvY05hbWU6IHJlbWVkaWF0aW9uTmFtZSxcbiAgICAgICAgICAgIHJlbWVkaWF0aW9uUG9saWN5OiBpbmxpbmVQb2xpY3ksXG4gICAgICAgICAgICByZW1lZGlhdGlvblJvbGVOYW1lOiBgJHtyZW1lZGlhdGlvblJvbGVOYW1lQmFzZX0ke3JlbWVkaWF0aW9uTmFtZX1gXG4gICAgICAgIH0pXG5cbiAgICAgICAgUnVuYm9va0ZhY3RvcnkuY3JlYXRlUmVtZWRpYXRpb25SdW5ib29rKHRoaXMsICdTSEFSUiAnKyByZW1lZGlhdGlvbk5hbWUsIHtcbiAgICAgICAgICAgIHNzbURvY05hbWU6IHJlbWVkaWF0aW9uTmFtZSxcbiAgICAgICAgICAgIHNzbURvY1BhdGg6IHNzbWRvY3MsXG4gICAgICAgICAgICBzc21Eb2NGaWxlTmFtZTogYCR7cmVtZWRpYXRpb25OYW1lfS55YW1sYCxcbiAgICAgICAgICAgIHNjcmlwdFBhdGg6IGAke3NzbWRvY3N9L3NjcmlwdHNgLFxuICAgICAgICAgICAgc29sdXRpb25WZXJzaW9uOiBwcm9wcy5zb2x1dGlvblZlcnNpb24sXG4gICAgICAgICAgICBzb2x1dGlvbkRpc3RCdWNrZXQ6IHByb3BzLnNvbHV0aW9uRGlzdEJ1Y2tldCxcbiAgICAgICAgICAgIHNvbHV0aW9uSWQ6IHByb3BzLnNvbHV0aW9uSWRcbiAgICAgICAgfSlcblxuICAgICAgICBsZXQgY2hpbGRUb01vZCA9IGlubGluZVBvbGljeS5ub2RlLmZpbmRDaGlsZCgnUmVzb3VyY2UnKSBhcyBDZm5Qb2xpY3k7XG4gICAgICAgIGNoaWxkVG9Nb2QuY2ZuT3B0aW9ucy5tZXRhZGF0YSA9IHtcbiAgICAgICAgICAgIGNmbl9uYWc6IHtcbiAgICAgICAgICAgICAgICBydWxlc190b19zdXBwcmVzczogW3tcbiAgICAgICAgICAgICAgICAgICAgaWQ6ICdXMTInLFxuICAgICAgICAgICAgICAgICAgICByZWFzb246ICdSZXNvdXJjZSAqIGlzIHJlcXVpcmVkIGZvciB0byBhbGxvdyByZW1lZGlhdGlvbiBmb3IgKmFueSogcmVzb3VyY2UuJ1xuICAgICAgICAgICAgICAgIH1dXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG4gICAgLy8tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAgLy8gUzNCbG9ja0RlbnlMaXN0XG4gICAgLy9cbiAgICB7XG4gICAgICAgIGNvbnN0IHJlbWVkaWF0aW9uTmFtZSA9ICdTM0Jsb2NrRGVueWxpc3QnXG4gICAgICAgIGNvbnN0IGlubGluZVBvbGljeSA9IG5ldyBQb2xpY3kocHJvcHMucm9sZVN0YWNrLCBgU0hBUlItUmVtZWRpYXRpb24tUG9saWN5LSR7cmVtZWRpYXRpb25OYW1lfWApO1xuXG4gICAgICAgIGNvbnN0IHJlbWVkaWF0aW9uUG9saWN5ID0gbmV3IFBvbGljeVN0YXRlbWVudCgpO1xuICAgICAgICByZW1lZGlhdGlvblBvbGljeS5hZGRBY3Rpb25zKFxuICAgICAgICAgICAgXCJzMzpQdXRCdWNrZXRQb2xpY3lcIixcbiAgICAgICAgICAgIFwiczM6R2V0QnVja2V0UG9saWN5XCJcbiAgICAgICAgKTtcbiAgICAgICAgcmVtZWRpYXRpb25Qb2xpY3kuZWZmZWN0ID0gRWZmZWN0LkFMTE9XXG4gICAgICAgIHJlbWVkaWF0aW9uUG9saWN5LmFkZFJlc291cmNlcyhcIipcIilcbiAgICAgICAgaW5saW5lUG9saWN5LmFkZFN0YXRlbWVudHMocmVtZWRpYXRpb25Qb2xpY3kpXG5cbiAgICAgICAgbmV3IFNzbVJvbGUocHJvcHMucm9sZVN0YWNrLCAnUmVtZWRpYXRpb25Sb2xlICcgKyByZW1lZGlhdGlvbk5hbWUsIHtcbiAgICAgICAgICAgIHNvbHV0aW9uSWQ6IHByb3BzLnNvbHV0aW9uSWQsXG4gICAgICAgICAgICBzc21Eb2NOYW1lOiByZW1lZGlhdGlvbk5hbWUsXG4gICAgICAgICAgICByZW1lZGlhdGlvblBvbGljeTogaW5saW5lUG9saWN5LFxuICAgICAgICAgICAgcmVtZWRpYXRpb25Sb2xlTmFtZTogYCR7cmVtZWRpYXRpb25Sb2xlTmFtZUJhc2V9JHtyZW1lZGlhdGlvbk5hbWV9YFxuICAgICAgICB9KVxuXG4gICAgICAgIFJ1bmJvb2tGYWN0b3J5LmNyZWF0ZVJlbWVkaWF0aW9uUnVuYm9vayh0aGlzLCAnU0hBUlIgJysgcmVtZWRpYXRpb25OYW1lLCB7XG4gICAgICAgICAgICBzc21Eb2NOYW1lOiByZW1lZGlhdGlvbk5hbWUsXG4gICAgICAgICAgICBzc21Eb2NQYXRoOiBzc21kb2NzLFxuICAgICAgICAgICAgc3NtRG9jRmlsZU5hbWU6IGAke3JlbWVkaWF0aW9uTmFtZX0ueWFtbGAsXG4gICAgICAgICAgICBzY3JpcHRQYXRoOiBgJHtzc21kb2NzfS9zY3JpcHRzYCxcbiAgICAgICAgICAgIHNvbHV0aW9uVmVyc2lvbjogcHJvcHMuc29sdXRpb25WZXJzaW9uLFxuICAgICAgICAgICAgc29sdXRpb25EaXN0QnVja2V0OiBwcm9wcy5zb2x1dGlvbkRpc3RCdWNrZXQsXG4gICAgICAgICAgICBzb2x1dGlvbklkOiBwcm9wcy5zb2x1dGlvbklkXG4gICAgICAgIH0pXG5cbiAgICAgICAgbGV0IGNoaWxkVG9Nb2QgPSBpbmxpbmVQb2xpY3kubm9kZS5maW5kQ2hpbGQoJ1Jlc291cmNlJykgYXMgQ2ZuUG9saWN5O1xuICAgICAgICBjaGlsZFRvTW9kLmNmbk9wdGlvbnMubWV0YWRhdGEgPSB7XG4gICAgICAgICAgICBjZm5fbmFnOiB7XG4gICAgICAgICAgICAgICAgcnVsZXNfdG9fc3VwcHJlc3M6IFt7XG4gICAgICAgICAgICAgICAgICAgIGlkOiAnVzEyJyxcbiAgICAgICAgICAgICAgICAgICAgcmVhc29uOiAnUmVzb3VyY2UgKiBpcyByZXF1aXJlZCBmb3IgdG8gYWxsb3cgcmVtZWRpYXRpb24gZm9yICphbnkqIHJlc291cmNlLidcbiAgICAgICAgICAgICAgICB9XVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgIC8vIEFXUy1FbmNyeXB0UmRzU25hcHNob3RcbiAgICAvL1xuICAgIHtcbiAgICAgICAgY29uc3QgcmVtZWRpYXRpb25OYW1lID0gJ0VuY3J5cHRSRFNTbmFwc2hvdCdcbiAgICAgICAgY29uc3QgaW5saW5lUG9saWN5ID0gbmV3IFBvbGljeShwcm9wcy5yb2xlU3RhY2ssIGBTSEFSUi1SZW1lZGlhdGlvbi1Qb2xpY3ktJHtyZW1lZGlhdGlvbk5hbWV9YCk7XG5cbiAgICAgICAgY29uc3QgcmVtZWRpYXRpb25Qb2xpY3kgPSBuZXcgUG9saWN5U3RhdGVtZW50KCk7XG4gICAgICAgIHJlbWVkaWF0aW9uUG9saWN5LmFkZEFjdGlvbnMoXG4gICAgICAgICAgICAncmRzOkNvcHlEQlNuYXBzaG90JyxcbiAgICAgICAgICAgICdyZHM6Q29weURCQ2x1c3RlclNuYXBzaG90JyxcbiAgICAgICAgICAgICdyZHM6RGVzY3JpYmVEQlNuYXBzaG90cycsXG4gICAgICAgICAgICAncmRzOkRlc2NyaWJlREJDbHVzdGVyU25hcHNob3RzJyxcbiAgICAgICAgICAgICdyZHM6RGVsZXRlREJTbmFwc2hvdCcsXG4gICAgICAgICAgICAncmRzOkRlbGV0ZURCQ2x1c3RlclNuYXBzaG90cycpO1xuICAgICAgICByZW1lZGlhdGlvblBvbGljeS5lZmZlY3QgPSBFZmZlY3QuQUxMT1c7XG4gICAgICAgIHJlbWVkaWF0aW9uUG9saWN5LmFkZFJlc291cmNlcygnKicpO1xuICAgICAgICBpbmxpbmVQb2xpY3kuYWRkU3RhdGVtZW50cyhyZW1lZGlhdGlvblBvbGljeSk7XG5cbiAgICAgICAgbmV3IFNzbVJvbGUocHJvcHMucm9sZVN0YWNrLCAnUmVtZWRpYXRpb25Sb2xlICcgKyByZW1lZGlhdGlvbk5hbWUsIHtcbiAgICAgICAgICAgIHNvbHV0aW9uSWQ6IHByb3BzLnNvbHV0aW9uSWQsXG4gICAgICAgICAgICBzc21Eb2NOYW1lOiByZW1lZGlhdGlvbk5hbWUsXG4gICAgICAgICAgICByZW1lZGlhdGlvblBvbGljeTogaW5saW5lUG9saWN5LFxuICAgICAgICAgICAgcmVtZWRpYXRpb25Sb2xlTmFtZTogYCR7cmVtZWRpYXRpb25Sb2xlTmFtZUJhc2V9JHtyZW1lZGlhdGlvbk5hbWV9YFxuICAgICAgICB9KTtcblxuICAgICAgICBSdW5ib29rRmFjdG9yeS5jcmVhdGVSZW1lZGlhdGlvblJ1bmJvb2sodGhpcywgJ1NIQVJSICcrIHJlbWVkaWF0aW9uTmFtZSwge1xuICAgICAgICAgICAgc3NtRG9jTmFtZTogcmVtZWRpYXRpb25OYW1lLFxuICAgICAgICAgICAgc3NtRG9jUGF0aDogc3NtZG9jcyxcbiAgICAgICAgICAgIHNzbURvY0ZpbGVOYW1lOiBgJHtyZW1lZGlhdGlvbk5hbWV9LnlhbWxgLFxuICAgICAgICAgICAgc2NyaXB0UGF0aDogYCR7c3NtZG9jc30vc2NyaXB0c2AsXG4gICAgICAgICAgICBzb2x1dGlvblZlcnNpb246IHByb3BzLnNvbHV0aW9uVmVyc2lvbixcbiAgICAgICAgICAgIHNvbHV0aW9uRGlzdEJ1Y2tldDogcHJvcHMuc29sdXRpb25EaXN0QnVja2V0LFxuICAgICAgICAgICAgc29sdXRpb25JZDogcHJvcHMuc29sdXRpb25JZFxuICAgICAgICB9KTtcblxuICAgICAgICBsZXQgY2hpbGRUb01vZCA9IGlubGluZVBvbGljeS5ub2RlLmZpbmRDaGlsZCgnUmVzb3VyY2UnKSBhcyBDZm5Qb2xpY3k7XG4gICAgICAgIGNoaWxkVG9Nb2QuY2ZuT3B0aW9ucy5tZXRhZGF0YSA9IHtcbiAgICAgICAgICAgIGNmbl9uYWc6IHtcbiAgICAgICAgICAgICAgICBydWxlc190b19zdXBwcmVzczogW1xuICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZDogJ1cxMicsXG4gICAgICAgICAgICAgICAgICAgICAgICByZWFzb246ICdSZXNvdXJjZSAqIGlzIHJlcXVpcmVkIGZvciB0byBhbGxvdyByZW1lZGlhdGlvbiBmb3IgKmFueSogcmVzb3VyY2UuJ1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgIH1cblxuICAgIC8vLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICAvLyBEaXNhYmxlUHVibGljQWNjZXNzVG9SZWRzaGlmdENsdXN0ZXJcbiAgICAvL1xuICAgIHtcbiAgICAgICAgY29uc3QgcmVtZWRpYXRpb25OYW1lID0gJ0Rpc2FibGVQdWJsaWNBY2Nlc3NUb1JlZHNoaWZ0Q2x1c3Rlcic7XG4gICAgICAgIGNvbnN0IGlubGluZVBvbGljeSA9IG5ldyBQb2xpY3kocHJvcHMucm9sZVN0YWNrLCBgU0hBUlItUmVtZWRpYXRpb24tUG9saWN5LSR7cmVtZWRpYXRpb25OYW1lfWApO1xuXG4gICAgICAgIGNvbnN0IHJlbWVkaWF0aW9uUG9saWN5ID0gbmV3IFBvbGljeVN0YXRlbWVudCgpO1xuICAgICAgICByZW1lZGlhdGlvblBvbGljeS5hZGRBY3Rpb25zKFxuICAgICAgICAgICAgJ3JlZHNoaWZ0Ok1vZGlmeUNsdXN0ZXInLFxuICAgICAgICAgICAgJ3JlZHNoaWZ0OkRlc2NyaWJlQ2x1c3RlcnMnKTtcbiAgICAgICAgcmVtZWRpYXRpb25Qb2xpY3kuZWZmZWN0ID0gRWZmZWN0LkFMTE9XO1xuICAgICAgICByZW1lZGlhdGlvblBvbGljeS5hZGRSZXNvdXJjZXMoJyonKTtcbiAgICAgICAgaW5saW5lUG9saWN5LmFkZFN0YXRlbWVudHMocmVtZWRpYXRpb25Qb2xpY3kpO1xuXG4gICAgICAgIG5ldyBTc21Sb2xlKHByb3BzLnJvbGVTdGFjaywgJ1JlbWVkaWF0aW9uUm9sZSAnICsgcmVtZWRpYXRpb25OYW1lLCB7XG4gICAgICAgICAgICBzb2x1dGlvbklkOiBwcm9wcy5zb2x1dGlvbklkLFxuICAgICAgICAgICAgc3NtRG9jTmFtZTogcmVtZWRpYXRpb25OYW1lLFxuICAgICAgICAgICAgcmVtZWRpYXRpb25Qb2xpY3k6IGlubGluZVBvbGljeSxcbiAgICAgICAgICAgIHJlbWVkaWF0aW9uUm9sZU5hbWU6IGAke3JlbWVkaWF0aW9uUm9sZU5hbWVCYXNlfSR7cmVtZWRpYXRpb25OYW1lfWBcbiAgICAgICAgfSk7XG5cbiAgICAgICAgUnVuYm9va0ZhY3RvcnkuY3JlYXRlUmVtZWRpYXRpb25SdW5ib29rKHRoaXMsICdTSEFSUiAnKyByZW1lZGlhdGlvbk5hbWUsIHtcbiAgICAgICAgICAgIHNzbURvY05hbWU6IHJlbWVkaWF0aW9uTmFtZSxcbiAgICAgICAgICAgIHNzbURvY1BhdGg6IHNzbWRvY3MsXG4gICAgICAgICAgICBzc21Eb2NGaWxlTmFtZTogYCR7cmVtZWRpYXRpb25OYW1lfS55YW1sYCxcbiAgICAgICAgICAgIHNjcmlwdFBhdGg6IGAke3NzbWRvY3N9L3NjcmlwdHNgLFxuICAgICAgICAgICAgc29sdXRpb25WZXJzaW9uOiBwcm9wcy5zb2x1dGlvblZlcnNpb24sXG4gICAgICAgICAgICBzb2x1dGlvbkRpc3RCdWNrZXQ6IHByb3BzLnNvbHV0aW9uRGlzdEJ1Y2tldCxcbiAgICAgICAgICAgIHNvbHV0aW9uSWQ6IHByb3BzLnNvbHV0aW9uSWRcbiAgICAgICAgfSk7XG5cbiAgICAgICAgY29uc3QgY2hpbGRUb01vZCA9IGlubGluZVBvbGljeS5ub2RlLmZpbmRDaGlsZCgnUmVzb3VyY2UnKSBhcyBDZm5Qb2xpY3k7XG4gICAgICAgIGNoaWxkVG9Nb2QuY2ZuT3B0aW9ucy5tZXRhZGF0YSA9IHtcbiAgICAgICAgICBjZm5fbmFnOiB7XG4gICAgICAgICAgICBydWxlc190b19zdXBwcmVzczogW1xuICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgaWQ6ICdXMTInLFxuICAgICAgICAgICAgICAgIHJlYXNvbjogJ1Jlc291cmNlICogaXMgcmVxdWlyZWQgZm9yIHRvIGFsbG93IHJlbWVkaWF0aW9uIGZvciBhbnkgcmVzb3VyY2UuJ1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICBdXG4gICAgICAgICAgfVxuICAgICAgICB9O1xuICAgIH1cbiAgICAgICAgLy8tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgIC8vIEVuYWJsZVJlZHNoaWZ0Q2x1c3RlckF1ZGl0TG9nZ2luZ1xuICAgIC8vXG4gICAge1xuICAgICAgICBjb25zdCByZW1lZGlhdGlvbk5hbWUgPSAnRW5hYmxlUmVkc2hpZnRDbHVzdGVyQXVkaXRMb2dnaW5nJztcbiAgICAgICAgY29uc3QgaW5saW5lUG9saWN5ID0gbmV3IFBvbGljeShwcm9wcy5yb2xlU3RhY2ssIGBTSEFSUi1SZW1lZGlhdGlvbi1Qb2xpY3ktJHtyZW1lZGlhdGlvbk5hbWV9YCk7XG5cbiAgICAgICAgY29uc3QgcmVtZWRpYXRpb25Qb2xpY3kgPSBuZXcgUG9saWN5U3RhdGVtZW50KCk7XG4gICAgICAgIHJlbWVkaWF0aW9uUG9saWN5LmFkZEFjdGlvbnMoXG4gICAgICAgICAgICAncmVkc2hpZnQ6RGVzY3JpYmVMb2dnaW5nU3RhdHVzJyxcbiAgICAgICAgICAgICdyZWRzaGlmdDpFbmFibGVMb2dnaW5nJyk7XG4gICAgICAgIHJlbWVkaWF0aW9uUG9saWN5LmVmZmVjdCA9IEVmZmVjdC5BTExPVztcbiAgICAgICAgcmVtZWRpYXRpb25Qb2xpY3kuYWRkUmVzb3VyY2VzKCcqJyk7XG4gICAgICAgIGlubGluZVBvbGljeS5hZGRTdGF0ZW1lbnRzKHJlbWVkaWF0aW9uUG9saWN5KTtcbiAgICAgICAgcmVtZWRpYXRpb25Qb2xpY3kuYWRkQWN0aW9ucyhcbiAgICAgICAgICAgICdzMzpQdXRPYmplY3QnKTtcbiAgICAgICAgcmVtZWRpYXRpb25Qb2xpY3kuZWZmZWN0ID0gRWZmZWN0LkFMTE9XO1xuICAgICAgICByZW1lZGlhdGlvblBvbGljeS5hZGRSZXNvdXJjZXMoJyonKTtcbiAgICAgICAgaW5saW5lUG9saWN5LmFkZFN0YXRlbWVudHMocmVtZWRpYXRpb25Qb2xpY3kpO1xuXG4gICAgICAgIG5ldyBTc21Sb2xlKHByb3BzLnJvbGVTdGFjaywgJ1JlbWVkaWF0aW9uUm9sZSAnICsgcmVtZWRpYXRpb25OYW1lLCB7XG4gICAgICAgICAgICBzb2x1dGlvbklkOiBwcm9wcy5zb2x1dGlvbklkLFxuICAgICAgICAgICAgc3NtRG9jTmFtZTogcmVtZWRpYXRpb25OYW1lLFxuICAgICAgICAgICAgcmVtZWRpYXRpb25Qb2xpY3k6IGlubGluZVBvbGljeSxcbiAgICAgICAgICAgIHJlbWVkaWF0aW9uUm9sZU5hbWU6IGAke3JlbWVkaWF0aW9uUm9sZU5hbWVCYXNlfSR7cmVtZWRpYXRpb25OYW1lfWBcbiAgICAgICAgfSk7XG5cbiAgICAgICAgUnVuYm9va0ZhY3RvcnkuY3JlYXRlUmVtZWRpYXRpb25SdW5ib29rKHRoaXMsICdTSEFSUiAnKyByZW1lZGlhdGlvbk5hbWUsIHtcbiAgICAgICAgICAgIHNzbURvY05hbWU6IHJlbWVkaWF0aW9uTmFtZSxcbiAgICAgICAgICAgIHNzbURvY1BhdGg6IHNzbWRvY3MsXG4gICAgICAgICAgICBzc21Eb2NGaWxlTmFtZTogYCR7cmVtZWRpYXRpb25OYW1lfS55YW1sYCxcbiAgICAgICAgICAgIHNjcmlwdFBhdGg6IGAke3NzbWRvY3N9L3NjcmlwdHNgLFxuICAgICAgICAgICAgc29sdXRpb25WZXJzaW9uOiBwcm9wcy5zb2x1dGlvblZlcnNpb24sXG4gICAgICAgICAgICBzb2x1dGlvbkRpc3RCdWNrZXQ6IHByb3BzLnNvbHV0aW9uRGlzdEJ1Y2tldCxcbiAgICAgICAgICAgIHNvbHV0aW9uSWQ6IHByb3BzLnNvbHV0aW9uSWRcbiAgICAgICAgfSk7XG5cbiAgICAgICAgY29uc3QgY2hpbGRUb01vZCA9IGlubGluZVBvbGljeS5ub2RlLmZpbmRDaGlsZCgnUmVzb3VyY2UnKSBhcyBDZm5Qb2xpY3k7XG4gICAgICAgIGNoaWxkVG9Nb2QuY2ZuT3B0aW9ucy5tZXRhZGF0YSA9IHtcbiAgICAgICAgICBjZm5fbmFnOiB7XG4gICAgICAgICAgICBydWxlc190b19zdXBwcmVzczogW1xuICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgaWQ6ICdXMTInLFxuICAgICAgICAgICAgICAgIHJlYXNvbjogJ1Jlc291cmNlICogaXMgcmVxdWlyZWQgZm9yIHRvIGFsbG93IHJlbWVkaWF0aW9uIGZvciBhbnkgcmVzb3VyY2UuJ1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICBdXG4gICAgICAgICAgfVxuICAgICAgICB9O1xuICAgIH1cblxuICAgIC8vLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICAvLyBFbmFibGVBdXRvbWF0aWNWZXJzaW9uVXBncmFkZU9uUmVkc2hpZnRDbHVzdGVyXG4gICAgLy9cbiAgICB7XG4gICAgICAgIGNvbnN0IHJlbWVkaWF0aW9uTmFtZSA9ICdFbmFibGVBdXRvbWF0aWNWZXJzaW9uVXBncmFkZU9uUmVkc2hpZnRDbHVzdGVyJztcbiAgICAgICAgY29uc3QgaW5saW5lUG9saWN5ID0gbmV3IFBvbGljeShwcm9wcy5yb2xlU3RhY2ssIGBTSEFSUi1SZW1lZGlhdGlvbi1Qb2xpY3ktJHtyZW1lZGlhdGlvbk5hbWV9YCk7XG5cbiAgICAgICAgY29uc3QgcmVtZWRpYXRpb25Qb2xpY3kgPSBuZXcgUG9saWN5U3RhdGVtZW50KCk7XG4gICAgICAgIHJlbWVkaWF0aW9uUG9saWN5LmFkZEFjdGlvbnMoXG4gICAgICAgICAgICAncmVkc2hpZnQ6TW9kaWZ5Q2x1c3RlcicsXG4gICAgICAgICAgICAncmVkc2hpZnQ6RGVzY3JpYmVDbHVzdGVycycpO1xuICAgICAgICByZW1lZGlhdGlvblBvbGljeS5lZmZlY3QgPSBFZmZlY3QuQUxMT1c7XG4gICAgICAgIHJlbWVkaWF0aW9uUG9saWN5LmFkZFJlc291cmNlcygnKicpO1xuICAgICAgICBpbmxpbmVQb2xpY3kuYWRkU3RhdGVtZW50cyhyZW1lZGlhdGlvblBvbGljeSk7XG5cbiAgICAgICAgbmV3IFNzbVJvbGUocHJvcHMucm9sZVN0YWNrLCAnUmVtZWRpYXRpb25Sb2xlICcgKyByZW1lZGlhdGlvbk5hbWUsIHtcbiAgICAgICAgICAgIHNvbHV0aW9uSWQ6IHByb3BzLnNvbHV0aW9uSWQsXG4gICAgICAgICAgICBzc21Eb2NOYW1lOiByZW1lZGlhdGlvbk5hbWUsXG4gICAgICAgICAgICByZW1lZGlhdGlvblBvbGljeTogaW5saW5lUG9saWN5LFxuICAgICAgICAgICAgcmVtZWRpYXRpb25Sb2xlTmFtZTogYCR7cmVtZWRpYXRpb25Sb2xlTmFtZUJhc2V9JHtyZW1lZGlhdGlvbk5hbWV9YFxuICAgICAgICB9KTtcblxuICAgICAgICBSdW5ib29rRmFjdG9yeS5jcmVhdGVSZW1lZGlhdGlvblJ1bmJvb2sodGhpcywgJ1NIQVJSICcrIHJlbWVkaWF0aW9uTmFtZSwge1xuICAgICAgICAgICAgc3NtRG9jTmFtZTogcmVtZWRpYXRpb25OYW1lLFxuICAgICAgICAgICAgc3NtRG9jUGF0aDogc3NtZG9jcyxcbiAgICAgICAgICAgIHNzbURvY0ZpbGVOYW1lOiBgJHtyZW1lZGlhdGlvbk5hbWV9LnlhbWxgLFxuICAgICAgICAgICAgc2NyaXB0UGF0aDogYCR7c3NtZG9jc30vc2NyaXB0c2AsXG4gICAgICAgICAgICBzb2x1dGlvblZlcnNpb246IHByb3BzLnNvbHV0aW9uVmVyc2lvbixcbiAgICAgICAgICAgIHNvbHV0aW9uRGlzdEJ1Y2tldDogcHJvcHMuc29sdXRpb25EaXN0QnVja2V0LFxuICAgICAgICAgICAgc29sdXRpb25JZDogcHJvcHMuc29sdXRpb25JZFxuICAgICAgICB9KTtcblxuICAgICAgICBjb25zdCBjaGlsZFRvTW9kID0gaW5saW5lUG9saWN5Lm5vZGUuZmluZENoaWxkKCdSZXNvdXJjZScpIGFzIENmblBvbGljeTtcbiAgICAgICAgY2hpbGRUb01vZC5jZm5PcHRpb25zLm1ldGFkYXRhID0ge1xuICAgICAgICAgIGNmbl9uYWc6IHtcbiAgICAgICAgICAgIHJ1bGVzX3RvX3N1cHByZXNzOiBbXG4gICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBpZDogJ1cxMicsXG4gICAgICAgICAgICAgICAgcmVhc29uOiAnUmVzb3VyY2UgKiBpcyByZXF1aXJlZCBmb3IgdG8gYWxsb3cgcmVtZWRpYXRpb24gZm9yIGFueSByZXNvdXJjZS4nXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIF1cbiAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgLy8tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgIC8vIEVuYWJsZUF1dG9tYXRpY1NuYXBzaG90c09uUmVkc2hpZnRDbHVzdGVyXG4gICAgLy9cbiAgICB7XG4gICAgICAgIGNvbnN0IHJlbWVkaWF0aW9uTmFtZSA9ICdFbmFibGVBdXRvbWF0aWNTbmFwc2hvdHNPblJlZHNoaWZ0Q2x1c3Rlcic7XG4gICAgICAgIGNvbnN0IGlubGluZVBvbGljeSA9IG5ldyBQb2xpY3kocHJvcHMucm9sZVN0YWNrLCBgU0hBUlItUmVtZWRpYXRpb24tUG9saWN5LSR7cmVtZWRpYXRpb25OYW1lfWApO1xuXG4gICAgICAgIGNvbnN0IHJlbWVkaWF0aW9uUG9saWN5ID0gbmV3IFBvbGljeVN0YXRlbWVudCgpO1xuICAgICAgICByZW1lZGlhdGlvblBvbGljeS5hZGRBY3Rpb25zKFxuICAgICAgICAgICAgJ3JlZHNoaWZ0Ok1vZGlmeUNsdXN0ZXInLFxuICAgICAgICAgICAgJ3JlZHNoaWZ0OkRlc2NyaWJlQ2x1c3RlcnMnKTtcbiAgICAgICAgcmVtZWRpYXRpb25Qb2xpY3kuZWZmZWN0ID0gRWZmZWN0LkFMTE9XO1xuICAgICAgICByZW1lZGlhdGlvblBvbGljeS5hZGRSZXNvdXJjZXMoJyonKTtcbiAgICAgICAgaW5saW5lUG9saWN5LmFkZFN0YXRlbWVudHMocmVtZWRpYXRpb25Qb2xpY3kpO1xuXG4gICAgICAgIG5ldyBTc21Sb2xlKHByb3BzLnJvbGVTdGFjaywgJ1JlbWVkaWF0aW9uUm9sZSAnICsgcmVtZWRpYXRpb25OYW1lLCB7XG4gICAgICAgICAgICBzb2x1dGlvbklkOiBwcm9wcy5zb2x1dGlvbklkLFxuICAgICAgICAgICAgc3NtRG9jTmFtZTogcmVtZWRpYXRpb25OYW1lLFxuICAgICAgICAgICAgcmVtZWRpYXRpb25Qb2xpY3k6IGlubGluZVBvbGljeSxcbiAgICAgICAgICAgIHJlbWVkaWF0aW9uUm9sZU5hbWU6IGAke3JlbWVkaWF0aW9uUm9sZU5hbWVCYXNlfSR7cmVtZWRpYXRpb25OYW1lfWBcbiAgICAgICAgfSk7XG5cbiAgICAgICAgUnVuYm9va0ZhY3RvcnkuY3JlYXRlUmVtZWRpYXRpb25SdW5ib29rKHRoaXMsICdTSEFSUiAnKyByZW1lZGlhdGlvbk5hbWUsIHtcbiAgICAgICAgICAgIHNzbURvY05hbWU6IHJlbWVkaWF0aW9uTmFtZSxcbiAgICAgICAgICAgIHNzbURvY1BhdGg6IHNzbWRvY3MsXG4gICAgICAgICAgICBzc21Eb2NGaWxlTmFtZTogYCR7cmVtZWRpYXRpb25OYW1lfS55YW1sYCxcbiAgICAgICAgICAgIHNjcmlwdFBhdGg6IGAke3NzbWRvY3N9L3NjcmlwdHNgLFxuICAgICAgICAgICAgc29sdXRpb25WZXJzaW9uOiBwcm9wcy5zb2x1dGlvblZlcnNpb24sXG4gICAgICAgICAgICBzb2x1dGlvbkRpc3RCdWNrZXQ6IHByb3BzLnNvbHV0aW9uRGlzdEJ1Y2tldCxcbiAgICAgICAgICAgIHNvbHV0aW9uSWQ6IHByb3BzLnNvbHV0aW9uSWRcbiAgICAgICAgfSk7XG5cbiAgICAgICAgY29uc3QgY2hpbGRUb01vZCA9IGlubGluZVBvbGljeS5ub2RlLmZpbmRDaGlsZCgnUmVzb3VyY2UnKSBhcyBDZm5Qb2xpY3k7XG4gICAgICAgIGNoaWxkVG9Nb2QuY2ZuT3B0aW9ucy5tZXRhZGF0YSA9IHtcbiAgICAgICAgICBjZm5fbmFnOiB7XG4gICAgICAgICAgICBydWxlc190b19zdXBwcmVzczogW1xuICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgaWQ6ICdXMTInLFxuICAgICAgICAgICAgICAgIHJlYXNvbjogJ1Jlc291cmNlICogaXMgcmVxdWlyZWQgZm9yIHRvIGFsbG93IHJlbWVkaWF0aW9uIGZvciBhbnkgcmVzb3VyY2UuJ1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICBdXG4gICAgICAgICAgfVxuICAgICAgICB9O1xuICAgIH1cblxuICAgIC8vPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIC8vIFRoZSBmb2xsb3dpbmcgYXJlIHBlcm1pc3Npb25zIG9ubHkgZm9yIHVzZSB3aXRoIEFXUy1vd25lZCBkb2N1bWVudHMgdGhhdFxuICAgIC8vICAgYXJlIGF2YWlsYWJsZSB0byBHb3ZDbG91ZCBhbmQgQ2hpbmEgcGFydGl0aW9uIGN1c3RvbWVycy5cbiAgICAvLz09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAvLy0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAgLy8gQVdTLUNvbmZpZ3VyZVMzQnVja2V0TG9nZ2luZ1xuICAgIC8vXG4gICAge1xuICAgICAgICBjb25zdCByZW1lZGlhdGlvbk5hbWUgPSAnQ29uZmlndXJlUzNCdWNrZXRMb2dnaW5nJ1xuICAgICAgICBjb25zdCBpbmxpbmVQb2xpY3kgPSBuZXcgUG9saWN5KHByb3BzLnJvbGVTdGFjaywgYFNIQVJSLVJlbWVkaWF0aW9uLVBvbGljeS0ke3JlbWVkaWF0aW9uTmFtZX1gKTtcblxuICAgICAgICBjb25zdCBzM1Blcm1zID0gbmV3IFBvbGljeVN0YXRlbWVudCgpO1xuICAgICAgICBzM1Blcm1zLmFkZEFjdGlvbnMoXG4gICAgICAgICAgICBcInMzOlB1dEJ1Y2tldExvZ2dpbmdcIixcbiAgICAgICAgICAgIFwiczM6Q3JlYXRlQnVja2V0XCIsXG4gICAgICAgICAgICBcInMzOlB1dEVuY3J5cHRpb25Db25maWd1cmF0aW9uXCJcbiAgICAgICAgKVxuICAgICAgICBzM1Blcm1zLmFkZEFjdGlvbnMoXCJzMzpQdXRCdWNrZXRBY2xcIilcbiAgICAgICAgczNQZXJtcy5lZmZlY3QgPSBFZmZlY3QuQUxMT1dcbiAgICAgICAgczNQZXJtcy5hZGRSZXNvdXJjZXMoXCIqXCIpO1xuXG4gICAgICAgIGlubGluZVBvbGljeS5hZGRTdGF0ZW1lbnRzKHMzUGVybXMpXG5cbiAgICAgICAgbmV3IFNzbVJvbGUocHJvcHMucm9sZVN0YWNrLCAnUmVtZWRpYXRpb25Sb2xlICcgKyByZW1lZGlhdGlvbk5hbWUsIHtcbiAgICAgICAgICAgIHNvbHV0aW9uSWQ6IHByb3BzLnNvbHV0aW9uSWQsXG4gICAgICAgICAgICBzc21Eb2NOYW1lOiByZW1lZGlhdGlvbk5hbWUsXG4gICAgICAgICAgICByZW1lZGlhdGlvblBvbGljeTogaW5saW5lUG9saWN5LFxuICAgICAgICAgICAgcmVtZWRpYXRpb25Sb2xlTmFtZTogYCR7cmVtZWRpYXRpb25Sb2xlTmFtZUJhc2V9JHtyZW1lZGlhdGlvbk5hbWV9YFxuICAgICAgICB9KVxuXG4gICAgICAgIGxldCBjaGlsZFRvTW9kID0gaW5saW5lUG9saWN5Lm5vZGUuZmluZENoaWxkKCdSZXNvdXJjZScpIGFzIENmblBvbGljeTtcbiAgICAgICAgY2hpbGRUb01vZC5jZm5PcHRpb25zLm1ldGFkYXRhID0ge1xuICAgICAgICAgICAgY2ZuX25hZzoge1xuICAgICAgICAgICAgICAgIHJ1bGVzX3RvX3N1cHByZXNzOiBbe1xuICAgICAgICAgICAgICAgICAgICBpZDogJ1cxMicsXG4gICAgICAgICAgICAgICAgICAgIHJlYXNvbjogJ1Jlc291cmNlICogaXMgcmVxdWlyZWQgZm9yIHRvIGFsbG93IHJlbWVkaWF0aW9uIGZvciAqYW55KiByZXNvdXJjZS4nXG4gICAgICAgICAgICAgICAgfV1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbiAgICAvLy0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAgLy8gQVdTLURpc2FibGVQdWJsaWNBY2Nlc3NGb3JTZWN1cml0eUdyb3VwXG4gICAgLy9cbiAgICB7XG4gICAgICAgIGNvbnN0IHJlbWVkaWF0aW9uTmFtZSA9ICdEaXNhYmxlUHVibGljQWNjZXNzRm9yU2VjdXJpdHlHcm91cCdcbiAgICAgICAgY29uc3QgaW5saW5lUG9saWN5ID0gbmV3IFBvbGljeShwcm9wcy5yb2xlU3RhY2ssIGBTSEFSUi1SZW1lZGlhdGlvbi1Qb2xpY3ktJHtyZW1lZGlhdGlvbk5hbWV9YCk7XG5cbiAgICAgICAgY29uc3QgcmVtZWRpYXRpb25QZXJtc0VjMiA9IG5ldyBQb2xpY3lTdGF0ZW1lbnQoKTtcbiAgICAgICAgICAgIHJlbWVkaWF0aW9uUGVybXNFYzIuYWRkQWN0aW9ucyhcbiAgICAgICAgICAgICAgICBcImVjMjpEZXNjcmliZVNlY3VyaXR5R3JvdXBSZWZlcmVuY2VzXCIsXG4gICAgICAgICAgICAgICAgXCJlYzI6RGVzY3JpYmVTZWN1cml0eUdyb3Vwc1wiLFxuICAgICAgICAgICAgICAgIFwiZWMyOlVwZGF0ZVNlY3VyaXR5R3JvdXBSdWxlRGVzY3JpcHRpb25zRWdyZXNzXCIsXG4gICAgICAgICAgICAgICAgXCJlYzI6VXBkYXRlU2VjdXJpdHlHcm91cFJ1bGVEZXNjcmlwdGlvbnNJbmdyZXNzXCIsXG4gICAgICAgICAgICAgICAgXCJlYzI6UmV2b2tlU2VjdXJpdHlHcm91cEluZ3Jlc3NcIixcbiAgICAgICAgICAgICAgICBcImVjMjpSZXZva2VTZWN1cml0eUdyb3VwRWdyZXNzXCJcbiAgICAgICAgICAgIClcbiAgICAgICAgICAgIHJlbWVkaWF0aW9uUGVybXNFYzIuZWZmZWN0ID0gRWZmZWN0LkFMTE9XXG4gICAgICAgICAgICByZW1lZGlhdGlvblBlcm1zRWMyLmFkZFJlc291cmNlcyhcIipcIik7XG4gICAgICAgIGlubGluZVBvbGljeS5hZGRTdGF0ZW1lbnRzKHJlbWVkaWF0aW9uUGVybXNFYzIpXG5cbiAgICAgICAgbmV3IFNzbVJvbGUocHJvcHMucm9sZVN0YWNrLCAnUmVtZWRpYXRpb25Sb2xlICcgKyByZW1lZGlhdGlvbk5hbWUsIHtcbiAgICAgICAgICAgIHNvbHV0aW9uSWQ6IHByb3BzLnNvbHV0aW9uSWQsXG4gICAgICAgICAgICBzc21Eb2NOYW1lOiByZW1lZGlhdGlvbk5hbWUsXG4gICAgICAgICAgICByZW1lZGlhdGlvblBvbGljeTogaW5saW5lUG9saWN5LFxuICAgICAgICAgICAgcmVtZWRpYXRpb25Sb2xlTmFtZTogYCR7cmVtZWRpYXRpb25Sb2xlTmFtZUJhc2V9JHtyZW1lZGlhdGlvbk5hbWV9YFxuICAgICAgICB9KVxuXG4gICAgICAgIGxldCBjaGlsZFRvTW9kID0gaW5saW5lUG9saWN5Lm5vZGUuZmluZENoaWxkKCdSZXNvdXJjZScpIGFzIENmblBvbGljeTtcbiAgICAgICAgY2hpbGRUb01vZC5jZm5PcHRpb25zLm1ldGFkYXRhID0ge1xuICAgICAgICAgICAgY2ZuX25hZzoge1xuICAgICAgICAgICAgICAgIHJ1bGVzX3RvX3N1cHByZXNzOiBbe1xuICAgICAgICAgICAgICAgICAgICBpZDogJ1cxMicsXG4gICAgICAgICAgICAgICAgICAgIHJlYXNvbjogJ1Jlc291cmNlICogaXMgcmVxdWlyZWQgZm9yIHRvIGFsbG93IHJlbWVkaWF0aW9uIGZvciAqYW55KiByZXNvdXJjZS4nXG4gICAgICAgICAgICAgICAgfV1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIC8vIFRoZSBmb2xsb3dpbmcgcnVuYm9va3MgYXJlIGNvcGllZCBmcm9tIEFXUy1vd25lZCBkb2N1bWVudHMgdG8gbWFrZSB0aGVtXG4gICAgLy8gICBhdmFpbGFibGUgdG8gR292Q2xvdWQgYW5kIENoaW5hIHBhcnRpdGlvbiBjdXN0b21lcnMuIFRoZVxuICAgIC8vICAgU3NtUmVtZWRpYXRpb25SdW5ib29rIHNob3VsZCBiZSByZW1vdmVkIHdoZW4gdGhleSBiZWNvbWUgYXZhaWxhYmxlIGluXG4gICAgLy8gICBhd3MtY24gYW5kIGF3cy11cy1nb3YuIFRoZSBTc21Sb2xlIG11c3QgYmUgcmV0YWluZWQuXG4gICAgLy89PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgLy8tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgIC8vIEFXU0NvbmZpZ1JlbWVkaWF0aW9uLUNvbmZpZ3VyZVMzQnVja2V0UHVibGljQWNjZXNzQmxvY2tcbiAgICAvL1xuICAgIHtcbiAgICAgICAgY29uc3QgcmVtZWRpYXRpb25OYW1lID0gJ0NvbmZpZ3VyZVMzQnVja2V0UHVibGljQWNjZXNzQmxvY2snXG4gICAgICAgIGNvbnN0IGlubGluZVBvbGljeSA9IG5ldyBQb2xpY3kocHJvcHMucm9sZVN0YWNrLCBgU0hBUlItUmVtZWRpYXRpb24tUG9saWN5LSR7cmVtZWRpYXRpb25OYW1lfWApO1xuXG4gICAgICAgIGNvbnN0IHJlbWVkaWF0aW9uUG9saWN5ID0gbmV3IFBvbGljeVN0YXRlbWVudCgpO1xuICAgICAgICByZW1lZGlhdGlvblBvbGljeS5hZGRBY3Rpb25zKFxuICAgICAgICAgICAgXCJzMzpQdXRCdWNrZXRQdWJsaWNBY2Nlc3NCbG9ja1wiLFxuICAgICAgICAgICAgXCJzMzpHZXRCdWNrZXRQdWJsaWNBY2Nlc3NCbG9ja1wiXG4gICAgICAgICk7XG4gICAgICAgIHJlbWVkaWF0aW9uUG9saWN5LmVmZmVjdCA9IEVmZmVjdC5BTExPV1xuICAgICAgICByZW1lZGlhdGlvblBvbGljeS5hZGRSZXNvdXJjZXMoXCIqXCIpXG4gICAgICAgIGlubGluZVBvbGljeS5hZGRTdGF0ZW1lbnRzKHJlbWVkaWF0aW9uUG9saWN5KVxuXG4gICAgICAgIG5ldyBTc21Sb2xlKHByb3BzLnJvbGVTdGFjaywgJ1JlbWVkaWF0aW9uUm9sZSAnICsgcmVtZWRpYXRpb25OYW1lLCB7XG4gICAgICAgICAgICBzb2x1dGlvbklkOiBwcm9wcy5zb2x1dGlvbklkLFxuICAgICAgICAgICAgc3NtRG9jTmFtZTogcmVtZWRpYXRpb25OYW1lLFxuICAgICAgICAgICAgcmVtZWRpYXRpb25Qb2xpY3k6IGlubGluZVBvbGljeSxcbiAgICAgICAgICAgIHJlbWVkaWF0aW9uUm9sZU5hbWU6IGAke3JlbWVkaWF0aW9uUm9sZU5hbWVCYXNlfSR7cmVtZWRpYXRpb25OYW1lfWBcbiAgICAgICAgfSlcblxuICAgICAgICBSdW5ib29rRmFjdG9yeS5jcmVhdGVSZW1lZGlhdGlvblJ1bmJvb2sodGhpcywgJ1NIQVJSICcrIHJlbWVkaWF0aW9uTmFtZSwge1xuICAgICAgICAgICAgc3NtRG9jTmFtZTogcmVtZWRpYXRpb25OYW1lLFxuICAgICAgICAgICAgc3NtRG9jUGF0aDogc3NtZG9jcyxcbiAgICAgICAgICAgIHNzbURvY0ZpbGVOYW1lOiBgJHtyZW1lZGlhdGlvbk5hbWV9LnlhbWxgLFxuICAgICAgICAgICAgc2NyaXB0UGF0aDogYCR7c3NtZG9jc30vc2NyaXB0c2AsXG4gICAgICAgICAgICBzb2x1dGlvblZlcnNpb246IHByb3BzLnNvbHV0aW9uVmVyc2lvbixcbiAgICAgICAgICAgIHNvbHV0aW9uRGlzdEJ1Y2tldDogcHJvcHMuc29sdXRpb25EaXN0QnVja2V0LFxuICAgICAgICAgICAgc29sdXRpb25JZDogcHJvcHMuc29sdXRpb25JZFxuICAgICAgICB9KVxuXG4gICAgICAgIGxldCBjaGlsZFRvTW9kID0gaW5saW5lUG9saWN5Lm5vZGUuZmluZENoaWxkKCdSZXNvdXJjZScpIGFzIENmblBvbGljeTtcbiAgICAgICAgY2hpbGRUb01vZC5jZm5PcHRpb25zLm1ldGFkYXRhID0ge1xuICAgICAgICAgICAgY2ZuX25hZzoge1xuICAgICAgICAgICAgICAgIHJ1bGVzX3RvX3N1cHByZXNzOiBbe1xuICAgICAgICAgICAgICAgICAgICBpZDogJ1cxMicsXG4gICAgICAgICAgICAgICAgICAgIHJlYXNvbjogJ1Jlc291cmNlICogaXMgcmVxdWlyZWQgZm9yIHRvIGFsbG93IHJlbWVkaWF0aW9uIGZvciAqYW55KiByZXNvdXJjZS4nXG4gICAgICAgICAgICAgICAgfV1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbiAgICAvLy0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAgLy8gQVdTQ29uZmlnUmVtZWRpYXRpb24tQ29uZmlndXJlUzNQdWJsaWNBY2Nlc3NCbG9ja1xuICAgIC8vXG4gICAge1xuICAgICAgICBjb25zdCByZW1lZGlhdGlvbk5hbWUgPSAnQ29uZmlndXJlUzNQdWJsaWNBY2Nlc3NCbG9jaydcbiAgICAgICAgY29uc3QgaW5saW5lUG9saWN5ID0gbmV3IFBvbGljeShwcm9wcy5yb2xlU3RhY2ssIGBTSEFSUi1SZW1lZGlhdGlvbi1Qb2xpY3ktJHtyZW1lZGlhdGlvbk5hbWV9YCk7XG5cbiAgICAgICAgY29uc3QgcmVtZWRpYXRpb25Qb2xpY3kgPSBuZXcgUG9saWN5U3RhdGVtZW50KCk7XG4gICAgICAgIHJlbWVkaWF0aW9uUG9saWN5LmFkZEFjdGlvbnMoXG4gICAgICAgICAgICBcInMzOlB1dEFjY291bnRQdWJsaWNBY2Nlc3NCbG9ja1wiLFxuICAgICAgICAgICAgXCJzMzpHZXRBY2NvdW50UHVibGljQWNjZXNzQmxvY2tcIlxuICAgICAgICApO1xuICAgICAgICByZW1lZGlhdGlvblBvbGljeS5lZmZlY3QgPSBFZmZlY3QuQUxMT1dcbiAgICAgICAgcmVtZWRpYXRpb25Qb2xpY3kuYWRkUmVzb3VyY2VzKFwiKlwiKVxuICAgICAgICBpbmxpbmVQb2xpY3kuYWRkU3RhdGVtZW50cyhyZW1lZGlhdGlvblBvbGljeSlcblxuICAgICAgICBuZXcgU3NtUm9sZShwcm9wcy5yb2xlU3RhY2ssICdSZW1lZGlhdGlvblJvbGUgJyArIHJlbWVkaWF0aW9uTmFtZSwge1xuICAgICAgICAgICAgc29sdXRpb25JZDogcHJvcHMuc29sdXRpb25JZCxcbiAgICAgICAgICAgIHNzbURvY05hbWU6IHJlbWVkaWF0aW9uTmFtZSxcbiAgICAgICAgICAgIHJlbWVkaWF0aW9uUG9saWN5OiBpbmxpbmVQb2xpY3ksXG4gICAgICAgICAgICByZW1lZGlhdGlvblJvbGVOYW1lOiBgJHtyZW1lZGlhdGlvblJvbGVOYW1lQmFzZX0ke3JlbWVkaWF0aW9uTmFtZX1gXG4gICAgICAgIH0pXG5cbiAgICAgICAgUnVuYm9va0ZhY3RvcnkuY3JlYXRlUmVtZWRpYXRpb25SdW5ib29rKHRoaXMsICdTSEFSUiAnKyByZW1lZGlhdGlvbk5hbWUsIHtcbiAgICAgICAgICAgIHNzbURvY05hbWU6IHJlbWVkaWF0aW9uTmFtZSxcbiAgICAgICAgICAgIHNzbURvY1BhdGg6IHNzbWRvY3MsXG4gICAgICAgICAgICBzc21Eb2NGaWxlTmFtZTogYCR7cmVtZWRpYXRpb25OYW1lfS55YW1sYCxcbiAgICAgICAgICAgIHNjcmlwdFBhdGg6IGAke3NzbWRvY3N9L3NjcmlwdHNgLFxuICAgICAgICAgICAgc29sdXRpb25WZXJzaW9uOiBwcm9wcy5zb2x1dGlvblZlcnNpb24sXG4gICAgICAgICAgICBzb2x1dGlvbkRpc3RCdWNrZXQ6IHByb3BzLnNvbHV0aW9uRGlzdEJ1Y2tldCxcbiAgICAgICAgICAgIHNvbHV0aW9uSWQ6IHByb3BzLnNvbHV0aW9uSWRcbiAgICAgICAgfSlcblxuICAgICAgICBsZXQgY2hpbGRUb01vZCA9IGlubGluZVBvbGljeS5ub2RlLmZpbmRDaGlsZCgnUmVzb3VyY2UnKSBhcyBDZm5Qb2xpY3k7XG4gICAgICAgIGNoaWxkVG9Nb2QuY2ZuT3B0aW9ucy5tZXRhZGF0YSA9IHtcbiAgICAgICAgICAgIGNmbl9uYWc6IHtcbiAgICAgICAgICAgICAgICBydWxlc190b19zdXBwcmVzczogW3tcbiAgICAgICAgICAgICAgICAgICAgaWQ6ICdXMTInLFxuICAgICAgICAgICAgICAgICAgICByZWFzb246ICdSZXNvdXJjZSAqIGlzIHJlcXVpcmVkIGZvciB0byBhbGxvdyByZW1lZGlhdGlvbiBmb3IgKmFueSogcmVzb3VyY2UuJ1xuICAgICAgICAgICAgICAgIH1dXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG4gICAgLy8tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgIC8vIEFXU0NvbmZpZ1JlbWVkaWF0aW9uLUVuYWJsZUNsb3VkVHJhaWxMb2dGaWxlVmFsaWRhdGlvblxuICAgIC8vXG4gICAge1xuICAgICAgICBjb25zdCByZW1lZGlhdGlvbk5hbWUgPSAnRW5hYmxlQ2xvdWRUcmFpbExvZ0ZpbGVWYWxpZGF0aW9uJ1xuICAgICAgICBjb25zdCBpbmxpbmVQb2xpY3kgPSBuZXcgUG9saWN5KHByb3BzLnJvbGVTdGFjaywgYFNIQVJSLVJlbWVkaWF0aW9uLVBvbGljeS0ke3JlbWVkaWF0aW9uTmFtZX1gKTtcbiAgICAgICAgY29uc3QgcmVtZWRpYXRpb25Qb2xpY3kgPSBuZXcgUG9saWN5U3RhdGVtZW50KCk7XG4gICAgICAgIHJlbWVkaWF0aW9uUG9saWN5LmFkZEFjdGlvbnMoXG4gICAgICAgICAgICBcImNsb3VkdHJhaWw6VXBkYXRlVHJhaWxcIixcbiAgICAgICAgICAgIFwiY2xvdWR0cmFpbDpHZXRUcmFpbFwiXG4gICAgICAgIClcbiAgICAgICAgcmVtZWRpYXRpb25Qb2xpY3kuZWZmZWN0ID0gRWZmZWN0LkFMTE9XXG4gICAgICAgIHJlbWVkaWF0aW9uUG9saWN5LmFkZFJlc291cmNlcyhcbiAgICAgICAgICAgIFwiYXJuOlwiICsgdGhpcy5wYXJ0aXRpb24gKyBcIjpjbG91ZHRyYWlsOio6XCIgKyB0aGlzLmFjY291bnQgKyBcIjp0cmFpbC8qXCJcbiAgICAgICAgKTtcbiAgICAgICAgaW5saW5lUG9saWN5LmFkZFN0YXRlbWVudHMocmVtZWRpYXRpb25Qb2xpY3kpXG5cbiAgICAgICAgbmV3IFNzbVJvbGUocHJvcHMucm9sZVN0YWNrLCAnUmVtZWRpYXRpb25Sb2xlICcgKyByZW1lZGlhdGlvbk5hbWUsIHtcbiAgICAgICAgICAgIHNvbHV0aW9uSWQ6IHByb3BzLnNvbHV0aW9uSWQsXG4gICAgICAgICAgICBzc21Eb2NOYW1lOiByZW1lZGlhdGlvbk5hbWUsXG4gICAgICAgICAgICByZW1lZGlhdGlvblBvbGljeTogaW5saW5lUG9saWN5LFxuICAgICAgICAgICAgcmVtZWRpYXRpb25Sb2xlTmFtZTogYCR7cmVtZWRpYXRpb25Sb2xlTmFtZUJhc2V9JHtyZW1lZGlhdGlvbk5hbWV9YFxuICAgICAgICB9KVxuXG4gICAgICAgIFJ1bmJvb2tGYWN0b3J5LmNyZWF0ZVJlbWVkaWF0aW9uUnVuYm9vayh0aGlzLCAnU0hBUlIgJysgcmVtZWRpYXRpb25OYW1lLCB7XG4gICAgICAgICAgICBzc21Eb2NOYW1lOiByZW1lZGlhdGlvbk5hbWUsXG4gICAgICAgICAgICBzc21Eb2NQYXRoOiBzc21kb2NzLFxuICAgICAgICAgICAgc3NtRG9jRmlsZU5hbWU6IGAke3JlbWVkaWF0aW9uTmFtZX0ueWFtbGAsXG4gICAgICAgICAgICBzY3JpcHRQYXRoOiBgJHtzc21kb2NzfS9zY3JpcHRzYCxcbiAgICAgICAgICAgIHNvbHV0aW9uVmVyc2lvbjogcHJvcHMuc29sdXRpb25WZXJzaW9uLFxuICAgICAgICAgICAgc29sdXRpb25EaXN0QnVja2V0OiBwcm9wcy5zb2x1dGlvbkRpc3RCdWNrZXQsXG4gICAgICAgICAgICBzb2x1dGlvbklkOiBwcm9wcy5zb2x1dGlvbklkXG4gICAgICAgIH0pXG4gICAgfVxuXG4gICAgLy8tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgIC8vIEFXU0NvbmZpZ1JlbWVkaWF0aW9uLUVuYWJsZUVic0VuY3J5cHRpb25CeURlZmF1bHRcbiAgICAvL1xuICAgIHtcbiAgICAgICAgY29uc3QgcmVtZWRpYXRpb25OYW1lID0gJ0VuYWJsZUVic0VuY3J5cHRpb25CeURlZmF1bHQnXG4gICAgICAgIGNvbnN0IGlubGluZVBvbGljeSA9IG5ldyBQb2xpY3kocHJvcHMucm9sZVN0YWNrLCBgU0hBUlItUmVtZWRpYXRpb24tUG9saWN5LSR7cmVtZWRpYXRpb25OYW1lfWApO1xuICAgICAgICBjb25zdCBlYzJQZXJtcyA9IG5ldyBQb2xpY3lTdGF0ZW1lbnQoKTtcbiAgICAgICAgZWMyUGVybXMuYWRkQWN0aW9ucyhcbiAgICAgICAgICAgIFwiZWMyOkVuYWJsZUVCU0VuY3J5cHRpb25CeURlZmF1bHRcIixcbiAgICAgICAgICAgIFwiZWMyOkdldEVic0VuY3J5cHRpb25CeURlZmF1bHRcIlxuICAgICAgICApXG4gICAgICAgIGVjMlBlcm1zLmVmZmVjdCA9IEVmZmVjdC5BTExPV1xuICAgICAgICBlYzJQZXJtcy5hZGRSZXNvdXJjZXMoXCIqXCIpO1xuICAgICAgICBpbmxpbmVQb2xpY3kuYWRkU3RhdGVtZW50cyhlYzJQZXJtcylcblxuICAgICAgICBuZXcgU3NtUm9sZShwcm9wcy5yb2xlU3RhY2ssICdSZW1lZGlhdGlvblJvbGUgJyArIHJlbWVkaWF0aW9uTmFtZSwge1xuICAgICAgICAgICAgc29sdXRpb25JZDogcHJvcHMuc29sdXRpb25JZCxcbiAgICAgICAgICAgIHNzbURvY05hbWU6IHJlbWVkaWF0aW9uTmFtZSxcbiAgICAgICAgICAgIHJlbWVkaWF0aW9uUG9saWN5OiBpbmxpbmVQb2xpY3ksXG4gICAgICAgICAgICByZW1lZGlhdGlvblJvbGVOYW1lOiBgJHtyZW1lZGlhdGlvblJvbGVOYW1lQmFzZX0ke3JlbWVkaWF0aW9uTmFtZX1gXG4gICAgICAgIH0pXG5cbiAgICAgICAgUnVuYm9va0ZhY3RvcnkuY3JlYXRlUmVtZWRpYXRpb25SdW5ib29rKHRoaXMsICdTSEFSUiAnKyByZW1lZGlhdGlvbk5hbWUsIHtcbiAgICAgICAgICAgIHNzbURvY05hbWU6IHJlbWVkaWF0aW9uTmFtZSxcbiAgICAgICAgICAgIHNzbURvY1BhdGg6IHNzbWRvY3MsXG4gICAgICAgICAgICBzc21Eb2NGaWxlTmFtZTogYCR7cmVtZWRpYXRpb25OYW1lfS55YW1sYCxcbiAgICAgICAgICAgIHNjcmlwdFBhdGg6IGAke3NzbWRvY3N9L3NjcmlwdHNgLFxuICAgICAgICAgICAgc29sdXRpb25WZXJzaW9uOiBwcm9wcy5zb2x1dGlvblZlcnNpb24sXG4gICAgICAgICAgICBzb2x1dGlvbkRpc3RCdWNrZXQ6IHByb3BzLnNvbHV0aW9uRGlzdEJ1Y2tldCxcbiAgICAgICAgICAgIHNvbHV0aW9uSWQ6IHByb3BzLnNvbHV0aW9uSWRcbiAgICAgICAgfSlcbiAgICAgICAgLy8gQ0ZOLU5BR1xuICAgICAgICAvLyBXQVJOIFcxMjogSUFNIHBvbGljeSBzaG91bGQgbm90IGFsbG93ICogcmVzb3VyY2VcblxuICAgICAgICBsZXQgY2hpbGRUb01vZCA9IGlubGluZVBvbGljeS5ub2RlLmZpbmRDaGlsZCgnUmVzb3VyY2UnKSBhcyBDZm5Qb2xpY3k7XG4gICAgICAgIGNoaWxkVG9Nb2QuY2ZuT3B0aW9ucy5tZXRhZGF0YSA9IHtcbiAgICAgICAgICAgIGNmbl9uYWc6IHtcbiAgICAgICAgICAgICAgICBydWxlc190b19zdXBwcmVzczogW3tcbiAgICAgICAgICAgICAgICAgICAgaWQ6ICdXMTInLFxuICAgICAgICAgICAgICAgICAgICByZWFzb246ICdSZXNvdXJjZSAqIGlzIHJlcXVpcmVkIGZvciB0byBhbGxvdyByZW1lZGlhdGlvbiBmb3IgKmFueSogcmVzb3VyY2UuJ1xuICAgICAgICAgICAgICAgIH1dXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLy0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAgLy8gQVdTQ29uZmlnUmVtZWRpYXRpb24tRW5hYmxlRW5oYW5jZWRNb25pdG9yaW5nT25SRFNJbnN0YW5jZVxuICAgIC8vXG4gICAge1xuICAgICAgICBjb25zdCByZW1lZGlhdGlvbk5hbWUgPSAnRW5hYmxlRW5oYW5jZWRNb25pdG9yaW5nT25SRFNJbnN0YW5jZSdcbiAgICAgICAgY29uc3QgaW5saW5lUG9saWN5ID0gbmV3IFBvbGljeShwcm9wcy5yb2xlU3RhY2ssIGBTSEFSUi1SZW1lZGlhdGlvbi1Qb2xpY3ktJHtyZW1lZGlhdGlvbk5hbWV9YCk7XG4gICAgICAgIHtcbiAgICAgICAgICAgIGxldCBpYW1QZXJtcyA9IG5ldyBQb2xpY3lTdGF0ZW1lbnQoKVxuICAgICAgICAgICAgaWFtUGVybXMuYWRkQWN0aW9ucyhcbiAgICAgICAgICAgICAgICBcImlhbTpHZXRSb2xlXCIsXG4gICAgICAgICAgICAgICAgXCJpYW06UGFzc1JvbGVcIlxuICAgICAgICAgICAgKVxuICAgICAgICAgICAgaWFtUGVybXMuZWZmZWN0ID0gRWZmZWN0LkFMTE9XXG4gICAgICAgICAgICBpYW1QZXJtcy5hZGRSZXNvdXJjZXMoXG4gICAgICAgICAgICAgICAgYGFybjoke3RoaXMucGFydGl0aW9ufTppYW06OiR7dGhpcy5hY2NvdW50fTpyb2xlLyR7UkVTT1VSQ0VfUFJFRklYfS1SRFNNb25pdG9yaW5nLXJlbWVkaWF0aW9uUm9sZWBcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgICBpbmxpbmVQb2xpY3kuYWRkU3RhdGVtZW50cyhpYW1QZXJtcylcbiAgICAgICAgfVxuICAgICAgICB7XG4gICAgICAgICAgICBjb25zdCByZHNQZXJtcyA9IG5ldyBQb2xpY3lTdGF0ZW1lbnQoKTtcbiAgICAgICAgICAgIHJkc1Blcm1zLmFkZEFjdGlvbnMoXG4gICAgICAgICAgICAgICAgXCJyZHM6RGVzY3JpYmVEQkluc3RhbmNlc1wiLFxuICAgICAgICAgICAgICAgIFwicmRzOk1vZGlmeURCSW5zdGFuY2VcIlxuICAgICAgICAgICAgKVxuICAgICAgICAgICAgcmRzUGVybXMuZWZmZWN0ID0gRWZmZWN0LkFMTE9XXG4gICAgICAgICAgICByZHNQZXJtcy5hZGRSZXNvdXJjZXMoXCIqXCIpO1xuICAgICAgICAgICAgaW5saW5lUG9saWN5LmFkZFN0YXRlbWVudHMocmRzUGVybXMpXG4gICAgICAgIH1cblxuICAgICAgICBuZXcgU3NtUm9sZShwcm9wcy5yb2xlU3RhY2ssICdSZW1lZGlhdGlvblJvbGUgJyArIHJlbWVkaWF0aW9uTmFtZSwge1xuICAgICAgICAgICAgc29sdXRpb25JZDogcHJvcHMuc29sdXRpb25JZCxcbiAgICAgICAgICAgIHNzbURvY05hbWU6IHJlbWVkaWF0aW9uTmFtZSxcbiAgICAgICAgICAgIHJlbWVkaWF0aW9uUG9saWN5OiBpbmxpbmVQb2xpY3ksXG4gICAgICAgICAgICByZW1lZGlhdGlvblJvbGVOYW1lOiBgJHtyZW1lZGlhdGlvblJvbGVOYW1lQmFzZX0ke3JlbWVkaWF0aW9uTmFtZX1gXG4gICAgICAgIH0pXG5cbiAgICAgICAgUnVuYm9va0ZhY3RvcnkuY3JlYXRlUmVtZWRpYXRpb25SdW5ib29rKHRoaXMsICdTSEFSUiAnKyByZW1lZGlhdGlvbk5hbWUsIHtcbiAgICAgICAgICAgIHNzbURvY05hbWU6IHJlbWVkaWF0aW9uTmFtZSxcbiAgICAgICAgICAgIHNzbURvY1BhdGg6IHNzbWRvY3MsXG4gICAgICAgICAgICBzc21Eb2NGaWxlTmFtZTogYCR7cmVtZWRpYXRpb25OYW1lfS55YW1sYCxcbiAgICAgICAgICAgIHNjcmlwdFBhdGg6IGAke3NzbWRvY3N9L3NjcmlwdHNgLFxuICAgICAgICAgICAgc29sdXRpb25WZXJzaW9uOiBwcm9wcy5zb2x1dGlvblZlcnNpb24sXG4gICAgICAgICAgICBzb2x1dGlvbkRpc3RCdWNrZXQ6IHByb3BzLnNvbHV0aW9uRGlzdEJ1Y2tldCxcbiAgICAgICAgICAgIHNvbHV0aW9uSWQ6IHByb3BzLnNvbHV0aW9uSWRcbiAgICAgICAgfSlcblxuICAgICAgICAvLyBDRk4tTkFHXG4gICAgICAgIC8vIFdBUk4gVzEyOiBJQU0gcG9saWN5IHNob3VsZCBub3QgYWxsb3cgKiByZXNvdXJjZVxuXG4gICAgICAgIGxldCBjaGlsZFRvTW9kID0gaW5saW5lUG9saWN5Lm5vZGUuZmluZENoaWxkKCdSZXNvdXJjZScpIGFzIENmblBvbGljeTtcbiAgICAgICAgY2hpbGRUb01vZC5jZm5PcHRpb25zLm1ldGFkYXRhID0ge1xuICAgICAgICAgICAgY2ZuX25hZzoge1xuICAgICAgICAgICAgICAgIHJ1bGVzX3RvX3N1cHByZXNzOiBbe1xuICAgICAgICAgICAgICAgICAgICBpZDogJ1cxMicsXG4gICAgICAgICAgICAgICAgICAgIHJlYXNvbjogJ1Jlc291cmNlICogaXMgcmVxdWlyZWQgZm9yIHRvIGFsbG93IHJlbWVkaWF0aW9uIGZvciAqYW55KiBSRFMgZGF0YWJhc2UuJ1xuICAgICAgICAgICAgICAgIH1dXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBuZXcgUmRzNkVuaGFuY2VkTW9uaXRvcmluZ1JvbGUocHJvcHMucm9sZVN0YWNrLCAnUmRzNkVuaGFuY2VkTW9uaXRvcmluZ1JvbGUnLCAge1xuICAgICAgICAgICAgcm9sZU5hbWU6IGAke1JFU09VUkNFX1BSRUZJWH0tUkRTTW9uaXRvcmluZy1yZW1lZGlhdGlvblJvbGVgXG4gICAgICAgIH0pXG4gICAgfVxuICAgIC8vLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICAvLyBBV1NDb25maWdSZW1lZGlhdGlvbi1FbmFibGVLZXlSb3RhdGlvblxuICAgIC8vXG4gICAge1xuICAgICAgICBjb25zdCByZW1lZGlhdGlvbk5hbWUgPSAnRW5hYmxlS2V5Um90YXRpb24nXG4gICAgICAgIGNvbnN0IGlubGluZVBvbGljeSA9IG5ldyBQb2xpY3kocHJvcHMucm9sZVN0YWNrLCBgU0hBUlItUmVtZWRpYXRpb24tUG9saWN5LSR7cmVtZWRpYXRpb25OYW1lfWApO1xuICAgICAgICBjb25zdCByZW1lZGlhdGlvblBlcm1zID0gbmV3IFBvbGljeVN0YXRlbWVudCgpO1xuICAgICAgICByZW1lZGlhdGlvblBlcm1zLmFkZEFjdGlvbnMoXG4gICAgICAgICAgICBcImttczpFbmFibGVLZXlSb3RhdGlvblwiLFxuICAgICAgICAgICAgXCJrbXM6R2V0S2V5Um90YXRpb25TdGF0dXNcIlxuICAgICAgICApXG4gICAgICAgIHJlbWVkaWF0aW9uUGVybXMuZWZmZWN0ID0gRWZmZWN0LkFMTE9XXG4gICAgICAgIHJlbWVkaWF0aW9uUGVybXMuYWRkUmVzb3VyY2VzKFwiKlwiKTtcbiAgICAgICAgaW5saW5lUG9saWN5LmFkZFN0YXRlbWVudHMocmVtZWRpYXRpb25QZXJtcylcblxuICAgICAgICBuZXcgU3NtUm9sZShwcm9wcy5yb2xlU3RhY2ssICdSZW1lZGlhdGlvblJvbGUgJyArIHJlbWVkaWF0aW9uTmFtZSwge1xuICAgICAgICAgICAgc29sdXRpb25JZDogcHJvcHMuc29sdXRpb25JZCxcbiAgICAgICAgICAgIHNzbURvY05hbWU6IHJlbWVkaWF0aW9uTmFtZSxcbiAgICAgICAgICAgIHJlbWVkaWF0aW9uUG9saWN5OiBpbmxpbmVQb2xpY3ksXG4gICAgICAgICAgICByZW1lZGlhdGlvblJvbGVOYW1lOiBgJHtyZW1lZGlhdGlvblJvbGVOYW1lQmFzZX0ke3JlbWVkaWF0aW9uTmFtZX1gXG4gICAgICAgIH0pXG5cbiAgICAgICAgUnVuYm9va0ZhY3RvcnkuY3JlYXRlUmVtZWRpYXRpb25SdW5ib29rKHRoaXMsICdTSEFSUiAnKyByZW1lZGlhdGlvbk5hbWUsIHtcbiAgICAgICAgICAgIHNzbURvY05hbWU6IHJlbWVkaWF0aW9uTmFtZSxcbiAgICAgICAgICAgIHNzbURvY1BhdGg6IHNzbWRvY3MsXG4gICAgICAgICAgICBzc21Eb2NGaWxlTmFtZTogYCR7cmVtZWRpYXRpb25OYW1lfS55YW1sYCxcbiAgICAgICAgICAgIHNjcmlwdFBhdGg6IGAke3NzbWRvY3N9L3NjcmlwdHNgLFxuICAgICAgICAgICAgc29sdXRpb25WZXJzaW9uOiBwcm9wcy5zb2x1dGlvblZlcnNpb24sXG4gICAgICAgICAgICBzb2x1dGlvbkRpc3RCdWNrZXQ6IHByb3BzLnNvbHV0aW9uRGlzdEJ1Y2tldCxcbiAgICAgICAgICAgIHNvbHV0aW9uSWQ6IHByb3BzLnNvbHV0aW9uSWRcbiAgICAgICAgfSlcbiAgICAgICAgLy8gQ0ZOLU5BR1xuICAgICAgICAvLyBXQVJOIFcxMjogSUFNIHBvbGljeSBzaG91bGQgbm90IGFsbG93ICogcmVzb3VyY2VcblxuICAgICAgICBsZXQgY2hpbGRUb01vZCA9IGlubGluZVBvbGljeS5ub2RlLmZpbmRDaGlsZCgnUmVzb3VyY2UnKSBhcyBDZm5Qb2xpY3k7XG4gICAgICAgIGNoaWxkVG9Nb2QuY2ZuT3B0aW9ucy5tZXRhZGF0YSA9IHtcbiAgICAgICAgICAgIGNmbl9uYWc6IHtcbiAgICAgICAgICAgICAgICBydWxlc190b19zdXBwcmVzczogW3tcbiAgICAgICAgICAgICAgICAgICAgaWQ6ICdXMTInLFxuICAgICAgICAgICAgICAgICAgICByZWFzb246ICdSZXNvdXJjZSAqIGlzIHJlcXVpcmVkIGZvciB0byBhbGxvdyByZW1lZGlhdGlvbiBmb3IgKmFueSogcmVzb3VyY2UuJ1xuICAgICAgICAgICAgICAgIH1dXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLy0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAgLy8gQVdTQ29uZmlnUmVtZWRpYXRpb24tRW5hYmxlUkRTQ2x1c3RlckRlbGV0aW9uUHJvdGVjdGlvblxuICAgIC8vXG4gICAge1xuICAgICAgICBjb25zdCByZW1lZGlhdGlvbk5hbWUgPSAnRW5hYmxlUkRTQ2x1c3RlckRlbGV0aW9uUHJvdGVjdGlvbidcbiAgICAgICAgY29uc3QgaW5saW5lUG9saWN5ID0gbmV3IFBvbGljeShwcm9wcy5yb2xlU3RhY2ssIGBTSEFSUi1SZW1lZGlhdGlvbi1Qb2xpY3ktJHtyZW1lZGlhdGlvbk5hbWV9YCk7XG5cbiAgICAgICAgY29uc3QgaWFtUGVybXMgPSBuZXcgUG9saWN5U3RhdGVtZW50KCk7XG4gICAgICAgIGlhbVBlcm1zLmFkZEFjdGlvbnMoXCJpYW06R2V0Um9sZVwiKVxuICAgICAgICBpYW1QZXJtcy5lZmZlY3QgPSBFZmZlY3QuQUxMT1dcbiAgICAgICAgaWFtUGVybXMuYWRkUmVzb3VyY2VzKFxuICAgICAgICAgICAgJ2FybjonICsgdGhpcy5wYXJ0aXRpb24gKyAnOmlhbTo6JyArIHRoaXMuYWNjb3VudCArICc6cm9sZS9SRFNFbmhhbmNlZE1vbml0b3JpbmdSb2xlJ1xuICAgICAgICApO1xuICAgICAgICBpbmxpbmVQb2xpY3kuYWRkU3RhdGVtZW50cyhpYW1QZXJtcylcblxuICAgICAgICBjb25zdCBjb25maWdQZXJtcyA9IG5ldyBQb2xpY3lTdGF0ZW1lbnQoKTtcbiAgICAgICAgY29uZmlnUGVybXMuYWRkQWN0aW9ucyhcImNvbmZpZzpHZXRSZXNvdXJjZUNvbmZpZ0hpc3RvcnlcIilcbiAgICAgICAgY29uZmlnUGVybXMuZWZmZWN0ID0gRWZmZWN0LkFMTE9XXG4gICAgICAgIGNvbmZpZ1Blcm1zLmFkZFJlc291cmNlcyhcIipcIik7XG4gICAgICAgIGlubGluZVBvbGljeS5hZGRTdGF0ZW1lbnRzKGNvbmZpZ1Blcm1zKVxuXG4gICAgICAgIGNvbnN0IHJkc1Blcm1zID0gbmV3IFBvbGljeVN0YXRlbWVudCgpO1xuICAgICAgICByZHNQZXJtcy5hZGRBY3Rpb25zKFxuICAgICAgICAgICAgXCJyZHM6RGVzY3JpYmVEQkNsdXN0ZXJzXCIsXG4gICAgICAgICAgICBcInJkczpNb2RpZnlEQkNsdXN0ZXJcIlxuICAgICAgICApXG4gICAgICAgIHJkc1Blcm1zLmVmZmVjdCA9IEVmZmVjdC5BTExPV1xuICAgICAgICByZHNQZXJtcy5hZGRSZXNvdXJjZXMoXCIqXCIpO1xuICAgICAgICBpbmxpbmVQb2xpY3kuYWRkU3RhdGVtZW50cyhyZHNQZXJtcylcblxuICAgICAgICBuZXcgU3NtUm9sZShwcm9wcy5yb2xlU3RhY2ssICdSZW1lZGlhdGlvblJvbGUgJyArIHJlbWVkaWF0aW9uTmFtZSwge1xuICAgICAgICAgICAgc29sdXRpb25JZDogcHJvcHMuc29sdXRpb25JZCxcbiAgICAgICAgICAgIHNzbURvY05hbWU6IHJlbWVkaWF0aW9uTmFtZSxcbiAgICAgICAgICAgIHJlbWVkaWF0aW9uUG9saWN5OiBpbmxpbmVQb2xpY3ksXG4gICAgICAgICAgICByZW1lZGlhdGlvblJvbGVOYW1lOiBgJHtyZW1lZGlhdGlvblJvbGVOYW1lQmFzZX0ke3JlbWVkaWF0aW9uTmFtZX1gXG4gICAgICAgIH0pXG5cbiAgICAgICAgUnVuYm9va0ZhY3RvcnkuY3JlYXRlUmVtZWRpYXRpb25SdW5ib29rKHRoaXMsICdTSEFSUiAnKyByZW1lZGlhdGlvbk5hbWUsIHtcbiAgICAgICAgICAgIHNzbURvY05hbWU6IHJlbWVkaWF0aW9uTmFtZSxcbiAgICAgICAgICAgIHNzbURvY1BhdGg6IHNzbWRvY3MsXG4gICAgICAgICAgICBzc21Eb2NGaWxlTmFtZTogYCR7cmVtZWRpYXRpb25OYW1lfS55YW1sYCxcbiAgICAgICAgICAgIHNjcmlwdFBhdGg6IGAke3NzbWRvY3N9L3NjcmlwdHNgLFxuICAgICAgICAgICAgc29sdXRpb25WZXJzaW9uOiBwcm9wcy5zb2x1dGlvblZlcnNpb24sXG4gICAgICAgICAgICBzb2x1dGlvbkRpc3RCdWNrZXQ6IHByb3BzLnNvbHV0aW9uRGlzdEJ1Y2tldCxcbiAgICAgICAgICAgIHNvbHV0aW9uSWQ6IHByb3BzLnNvbHV0aW9uSWRcbiAgICAgICAgfSlcblxuICAgICAgICAvLyBDRk4tTkFHXG4gICAgICAgIC8vIFdBUk4gVzEyOiBJQU0gcG9saWN5IHNob3VsZCBub3QgYWxsb3cgKiByZXNvdXJjZVxuXG4gICAgICAgIGxldCBjaGlsZFRvTW9kID0gaW5saW5lUG9saWN5Lm5vZGUuZmluZENoaWxkKCdSZXNvdXJjZScpIGFzIENmblBvbGljeTtcbiAgICAgICAgY2hpbGRUb01vZC5jZm5PcHRpb25zLm1ldGFkYXRhID0ge1xuICAgICAgICAgICAgY2ZuX25hZzoge1xuICAgICAgICAgICAgICAgIHJ1bGVzX3RvX3N1cHByZXNzOiBbe1xuICAgICAgICAgICAgICAgICAgICBpZDogJ1cxMicsXG4gICAgICAgICAgICAgICAgICAgIHJlYXNvbjogJ1Jlc291cmNlICogaXMgcmVxdWlyZWQgZm9yIHRvIGFsbG93IHJlbWVkaWF0aW9uIGZvciAqYW55KiBSRFMgZGF0YWJhc2UuJ1xuICAgICAgICAgICAgICAgIH1dXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLy0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAgLy8gQVdTQ29uZmlnUmVtZWRpYXRpb24tRW5hYmxlQ29weVRhZ3NUb1NuYXBzaG90T25SRFNDbHVzdGVyXG4gICAgLy9cbiAgICB7XG4gICAgICAgIGNvbnN0IHJlbWVkaWF0aW9uTmFtZSA9ICdFbmFibGVDb3B5VGFnc1RvU25hcHNob3RPblJEU0NsdXN0ZXInXG4gICAgICAgIGNvbnN0IGlubGluZVBvbGljeSA9IG5ldyBQb2xpY3kocHJvcHMucm9sZVN0YWNrLCBgU0hBUlItUmVtZWRpYXRpb24tUG9saWN5LSR7cmVtZWRpYXRpb25OYW1lfWApO1xuXG4gICAgICAgIGNvbnN0IGlhbVBlcm1zID0gbmV3IFBvbGljeVN0YXRlbWVudCgpO1xuICAgICAgICBpYW1QZXJtcy5hZGRBY3Rpb25zKFwiaWFtOkdldFJvbGVcIilcbiAgICAgICAgaWFtUGVybXMuZWZmZWN0ID0gRWZmZWN0LkFMTE9XXG4gICAgICAgIGlhbVBlcm1zLmFkZFJlc291cmNlcyhcbiAgICAgICAgICAgICdhcm46JyArIHRoaXMucGFydGl0aW9uICsgJzppYW06OicgKyB0aGlzLmFjY291bnQgKyAnOnJvbGUvUkRTRW5oYW5jZWRNb25pdG9yaW5nUm9sZSdcbiAgICAgICAgKTtcbiAgICAgICAgaW5saW5lUG9saWN5LmFkZFN0YXRlbWVudHMoaWFtUGVybXMpXG5cbiAgICAgICAgY29uc3QgY29uZmlnUGVybXMgPSBuZXcgUG9saWN5U3RhdGVtZW50KCk7XG4gICAgICAgIGNvbmZpZ1Blcm1zLmFkZEFjdGlvbnMoXCJjb25maWc6R2V0UmVzb3VyY2VDb25maWdIaXN0b3J5XCIpXG4gICAgICAgIGNvbmZpZ1Blcm1zLmVmZmVjdCA9IEVmZmVjdC5BTExPV1xuICAgICAgICBjb25maWdQZXJtcy5hZGRSZXNvdXJjZXMoXCIqXCIpO1xuICAgICAgICBpbmxpbmVQb2xpY3kuYWRkU3RhdGVtZW50cyhjb25maWdQZXJtcylcblxuICAgICAgICBjb25zdCByZHNQZXJtcyA9IG5ldyBQb2xpY3lTdGF0ZW1lbnQoKTtcbiAgICAgICAgcmRzUGVybXMuYWRkQWN0aW9ucyhcbiAgICAgICAgICAgIFwicmRzOkRlc2NyaWJlREJDbHVzdGVyc1wiLFxuICAgICAgICAgICAgXCJyZHM6TW9kaWZ5REJDbHVzdGVyXCJcbiAgICAgICAgKVxuICAgICAgICByZHNQZXJtcy5lZmZlY3QgPSBFZmZlY3QuQUxMT1dcbiAgICAgICAgcmRzUGVybXMuYWRkUmVzb3VyY2VzKFwiKlwiKTtcbiAgICAgICAgaW5saW5lUG9saWN5LmFkZFN0YXRlbWVudHMocmRzUGVybXMpXG5cbiAgICAgICAgbmV3IFNzbVJvbGUocHJvcHMucm9sZVN0YWNrLCAnUmVtZWRpYXRpb25Sb2xlICcgKyByZW1lZGlhdGlvbk5hbWUsIHtcbiAgICAgICAgICAgIHNvbHV0aW9uSWQ6IHByb3BzLnNvbHV0aW9uSWQsXG4gICAgICAgICAgICBzc21Eb2NOYW1lOiByZW1lZGlhdGlvbk5hbWUsXG4gICAgICAgICAgICByZW1lZGlhdGlvblBvbGljeTogaW5saW5lUG9saWN5LFxuICAgICAgICAgICAgcmVtZWRpYXRpb25Sb2xlTmFtZTogYCR7cmVtZWRpYXRpb25Sb2xlTmFtZUJhc2V9JHtyZW1lZGlhdGlvbk5hbWV9YFxuICAgICAgICB9KVxuXG4gICAgICAgIFJ1bmJvb2tGYWN0b3J5LmNyZWF0ZVJlbWVkaWF0aW9uUnVuYm9vayh0aGlzLCAnU0hBUlIgJysgcmVtZWRpYXRpb25OYW1lLCB7XG4gICAgICAgICAgICBzc21Eb2NOYW1lOiByZW1lZGlhdGlvbk5hbWUsXG4gICAgICAgICAgICBzc21Eb2NQYXRoOiBzc21kb2NzLFxuICAgICAgICAgICAgc3NtRG9jRmlsZU5hbWU6IGAke3JlbWVkaWF0aW9uTmFtZX0ueWFtbGAsXG4gICAgICAgICAgICBzY3JpcHRQYXRoOiBgJHtzc21kb2NzfS9zY3JpcHRzYCxcbiAgICAgICAgICAgIHNvbHV0aW9uVmVyc2lvbjogcHJvcHMuc29sdXRpb25WZXJzaW9uLFxuICAgICAgICAgICAgc29sdXRpb25EaXN0QnVja2V0OiBwcm9wcy5zb2x1dGlvbkRpc3RCdWNrZXQsXG4gICAgICAgICAgICBzb2x1dGlvbklkOiBwcm9wcy5zb2x1dGlvbklkXG4gICAgICAgIH0pXG5cbiAgICAgICAgLy8gQ0ZOLU5BR1xuICAgICAgICAvLyBXQVJOIFcxMjogSUFNIHBvbGljeSBzaG91bGQgbm90IGFsbG93ICogcmVzb3VyY2VcblxuICAgICAgICBsZXQgY2hpbGRUb01vZCA9IGlubGluZVBvbGljeS5ub2RlLmZpbmRDaGlsZCgnUmVzb3VyY2UnKSBhcyBDZm5Qb2xpY3k7XG4gICAgICAgIGNoaWxkVG9Nb2QuY2ZuT3B0aW9ucy5tZXRhZGF0YSA9IHtcbiAgICAgICAgICAgIGNmbl9uYWc6IHtcbiAgICAgICAgICAgICAgICBydWxlc190b19zdXBwcmVzczogW3tcbiAgICAgICAgICAgICAgICAgICAgaWQ6ICdXMTInLFxuICAgICAgICAgICAgICAgICAgICByZWFzb246ICdSZXNvdXJjZSAqIGlzIHJlcXVpcmVkIGZvciB0byBhbGxvdyByZW1lZGlhdGlvbiBmb3IgKmFueSogUkRTIGRhdGFiYXNlLidcbiAgICAgICAgICAgICAgICB9XVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgIC8vIEVuYWJsZVJEU0luc3RhbmNlRGVsZXRpb25Qcm90ZWN0aW9uXG4gICAgLy9cbiAgICB7XG4gICAgICAgIGNvbnN0IHJlbWVkaWF0aW9uTmFtZSA9ICdFbmFibGVSRFNJbnN0YW5jZURlbGV0aW9uUHJvdGVjdGlvbic7XG4gICAgICAgIGNvbnN0IGlubGluZVBvbGljeSA9IG5ldyBQb2xpY3kocHJvcHMucm9sZVN0YWNrLCBgU0hBUlItUmVtZWRpYXRpb24tUG9saWN5LSR7cmVtZWRpYXRpb25OYW1lfWApO1xuXG4gICAgICAgIGNvbnN0IHJkc1Blcm1zID0gbmV3IFBvbGljeVN0YXRlbWVudCgpO1xuICAgICAgICByZHNQZXJtcy5hZGRBY3Rpb25zKFxuICAgICAgICAgICAgJ3JkczpEZXNjcmliZURCSW5zdGFuY2VzJyxcbiAgICAgICAgICAgICdyZHM6TW9kaWZ5REJJbnN0YW5jZSdcbiAgICAgICAgKTtcbiAgICAgICAgcmRzUGVybXMuYWRkUmVzb3VyY2VzKCcqJyk7XG4gICAgICAgIGlubGluZVBvbGljeS5hZGRTdGF0ZW1lbnRzKHJkc1Blcm1zKTtcblxuICAgICAgICBuZXcgU3NtUm9sZShwcm9wcy5yb2xlU3RhY2ssICdSZW1lZGlhdGlvblJvbGUgJyArIHJlbWVkaWF0aW9uTmFtZSwge1xuICAgICAgICAgICAgc29sdXRpb25JZDogcHJvcHMuc29sdXRpb25JZCxcbiAgICAgICAgICAgIHNzbURvY05hbWU6IHJlbWVkaWF0aW9uTmFtZSxcbiAgICAgICAgICAgIHJlbWVkaWF0aW9uUG9saWN5OiBpbmxpbmVQb2xpY3ksXG4gICAgICAgICAgICByZW1lZGlhdGlvblJvbGVOYW1lOiBgJHtyZW1lZGlhdGlvblJvbGVOYW1lQmFzZX0ke3JlbWVkaWF0aW9uTmFtZX1gXG4gICAgICAgIH0pO1xuXG4gICAgICAgIFJ1bmJvb2tGYWN0b3J5LmNyZWF0ZVJlbWVkaWF0aW9uUnVuYm9vayh0aGlzLCAnU0hBUlIgJysgcmVtZWRpYXRpb25OYW1lLCB7XG4gICAgICAgICAgICBzc21Eb2NOYW1lOiByZW1lZGlhdGlvbk5hbWUsXG4gICAgICAgICAgICBzc21Eb2NQYXRoOiBzc21kb2NzLFxuICAgICAgICAgICAgc3NtRG9jRmlsZU5hbWU6IGAke3JlbWVkaWF0aW9uTmFtZX0ueWFtbGAsXG4gICAgICAgICAgICBzY3JpcHRQYXRoOiBgJHtzc21kb2NzfS9zY3JpcHRzYCxcbiAgICAgICAgICAgIHNvbHV0aW9uVmVyc2lvbjogcHJvcHMuc29sdXRpb25WZXJzaW9uLFxuICAgICAgICAgICAgc29sdXRpb25EaXN0QnVja2V0OiBwcm9wcy5zb2x1dGlvbkRpc3RCdWNrZXQsXG4gICAgICAgICAgICBzb2x1dGlvbklkOiBwcm9wcy5zb2x1dGlvbklkXG4gICAgICAgIH0pO1xuXG4gICAgICAgIGxldCBjaGlsZFRvTW9kID0gaW5saW5lUG9saWN5Lm5vZGUuZmluZENoaWxkKCdSZXNvdXJjZScpIGFzIENmblBvbGljeTtcbiAgICAgICAgY2hpbGRUb01vZC5jZm5PcHRpb25zLm1ldGFkYXRhID0ge1xuICAgICAgICAgICAgY2ZuX25hZzoge1xuICAgICAgICAgICAgICAgIHJ1bGVzX3RvX3N1cHByZXNzOiBbe1xuICAgICAgICAgICAgICAgICAgICBpZDogJ1cxMicsXG4gICAgICAgICAgICAgICAgICAgIHJlYXNvbjogJ1Jlc291cmNlICogaXMgcmVxdWlyZWQgZm9yIHRvIGFsbG93IHJlbWVkaWF0aW9uIGZvciAqYW55KiBSRFMgZGF0YWJhc2UuJ1xuICAgICAgICAgICAgICAgIH1dXG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgLy8tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgIC8vIEVuYWJsZU11bHRpQVpPblJEU0luc3RhbmNlXG4gICAgLy9cbiAgICB7XG4gICAgICAgIGNvbnN0IHJlbWVkaWF0aW9uTmFtZSA9ICdFbmFibGVNdWx0aUFaT25SRFNJbnN0YW5jZSc7XG4gICAgICAgIGNvbnN0IGlubGluZVBvbGljeSA9IG5ldyBQb2xpY3kocHJvcHMucm9sZVN0YWNrLCBgU0hBUlItUmVtZWRpYXRpb24tUG9saWN5LSR7cmVtZWRpYXRpb25OYW1lfWApO1xuXG4gICAgICAgIGNvbnN0IHJkc1Blcm1zID0gbmV3IFBvbGljeVN0YXRlbWVudCgpO1xuICAgICAgICByZHNQZXJtcy5hZGRBY3Rpb25zKFxuICAgICAgICAgICAgJ3JkczpEZXNjcmliZURCSW5zdGFuY2VzJyxcbiAgICAgICAgICAgICdyZHM6TW9kaWZ5REJJbnN0YW5jZSdcbiAgICAgICAgKTtcbiAgICAgICAgcmRzUGVybXMuYWRkUmVzb3VyY2VzKCcqJyk7XG4gICAgICAgIGlubGluZVBvbGljeS5hZGRTdGF0ZW1lbnRzKHJkc1Blcm1zKTtcblxuICAgICAgICBuZXcgU3NtUm9sZShwcm9wcy5yb2xlU3RhY2ssICdSZW1lZGlhdGlvblJvbGUgJyArIHJlbWVkaWF0aW9uTmFtZSwge1xuICAgICAgICAgICAgc29sdXRpb25JZDogcHJvcHMuc29sdXRpb25JZCxcbiAgICAgICAgICAgIHNzbURvY05hbWU6IHJlbWVkaWF0aW9uTmFtZSxcbiAgICAgICAgICAgIHJlbWVkaWF0aW9uUG9saWN5OiBpbmxpbmVQb2xpY3ksXG4gICAgICAgICAgICByZW1lZGlhdGlvblJvbGVOYW1lOiBgJHtyZW1lZGlhdGlvblJvbGVOYW1lQmFzZX0ke3JlbWVkaWF0aW9uTmFtZX1gXG4gICAgICAgIH0pO1xuXG4gICAgICAgIFJ1bmJvb2tGYWN0b3J5LmNyZWF0ZVJlbWVkaWF0aW9uUnVuYm9vayh0aGlzLCAnU0hBUlIgJysgcmVtZWRpYXRpb25OYW1lLCB7XG4gICAgICAgICAgICBzc21Eb2NOYW1lOiByZW1lZGlhdGlvbk5hbWUsXG4gICAgICAgICAgICBzc21Eb2NQYXRoOiBzc21kb2NzLFxuICAgICAgICAgICAgc3NtRG9jRmlsZU5hbWU6IGAke3JlbWVkaWF0aW9uTmFtZX0ueWFtbGAsXG4gICAgICAgICAgICBzY3JpcHRQYXRoOiBgJHtzc21kb2NzfS9zY3JpcHRzYCxcbiAgICAgICAgICAgIHNvbHV0aW9uVmVyc2lvbjogcHJvcHMuc29sdXRpb25WZXJzaW9uLFxuICAgICAgICAgICAgc29sdXRpb25EaXN0QnVja2V0OiBwcm9wcy5zb2x1dGlvbkRpc3RCdWNrZXQsXG4gICAgICAgICAgICBzb2x1dGlvbklkOiBwcm9wcy5zb2x1dGlvbklkXG4gICAgICAgIH0pO1xuXG4gICAgICAgIGxldCBjaGlsZFRvTW9kID0gaW5saW5lUG9saWN5Lm5vZGUuZmluZENoaWxkKCdSZXNvdXJjZScpIGFzIENmblBvbGljeTtcbiAgICAgICAgY2hpbGRUb01vZC5jZm5PcHRpb25zLm1ldGFkYXRhID0ge1xuICAgICAgICAgICAgY2ZuX25hZzoge1xuICAgICAgICAgICAgICAgIHJ1bGVzX3RvX3N1cHByZXNzOiBbe1xuICAgICAgICAgICAgICAgICAgICBpZDogJ1cxMicsXG4gICAgICAgICAgICAgICAgICAgIHJlYXNvbjogJ1Jlc291cmNlICogaXMgcmVxdWlyZWQgZm9yIHRvIGFsbG93IHJlbWVkaWF0aW9uIGZvciAqYW55KiBSRFMgZGF0YWJhc2UuJ1xuICAgICAgICAgICAgICAgIH1dXG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgLy8tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgIC8vIEFXU0NvbmZpZ1JlbWVkaWF0aW9uLVJlbW92ZVZQQ0RlZmF1bHRTZWN1cml0eUdyb3VwUnVsZXNcbiAgICAvL1xuICAgIHtcbiAgICAgICAgY29uc3QgcmVtZWRpYXRpb25OYW1lID0gJ1JlbW92ZVZQQ0RlZmF1bHRTZWN1cml0eUdyb3VwUnVsZXMnXG4gICAgICAgIGNvbnN0IGlubGluZVBvbGljeSA9IG5ldyBQb2xpY3kocHJvcHMucm9sZVN0YWNrLCBgU0hBUlItUmVtZWRpYXRpb24tUG9saWN5LSR7cmVtZWRpYXRpb25OYW1lfWApO1xuXG4gICAgICAgIGNvbnN0IHJlbWVkaWF0aW9uUG9saWN5MSA9IG5ldyBQb2xpY3lTdGF0ZW1lbnQoKTtcbiAgICAgICAgcmVtZWRpYXRpb25Qb2xpY3kxLmFkZEFjdGlvbnMoXG4gICAgICAgICAgICBcImVjMjpVcGRhdGVTZWN1cml0eUdyb3VwUnVsZURlc2NyaXB0aW9uc0VncmVzc1wiLFxuICAgICAgICAgICAgXCJlYzI6VXBkYXRlU2VjdXJpdHlHcm91cFJ1bGVEZXNjcmlwdGlvbnNJbmdyZXNzXCIsXG4gICAgICAgICAgICBcImVjMjpSZXZva2VTZWN1cml0eUdyb3VwSW5ncmVzc1wiLFxuICAgICAgICAgICAgXCJlYzI6UmV2b2tlU2VjdXJpdHlHcm91cEVncmVzc1wiXG4gICAgICAgICAgICApXG4gICAgICAgIHJlbWVkaWF0aW9uUG9saWN5MS5lZmZlY3QgPSBFZmZlY3QuQUxMT1dcbiAgICAgICAgcmVtZWRpYXRpb25Qb2xpY3kxLmFkZFJlc291cmNlcyhcImFybjpcIiArIHRoaXMucGFydGl0aW9uICsgXCI6ZWMyOio6XCIrdGhpcy5hY2NvdW50K1wiOnNlY3VyaXR5LWdyb3VwLypcIik7XG5cbiAgICAgICAgY29uc3QgcmVtZWRpYXRpb25Qb2xpY3kyID0gbmV3IFBvbGljeVN0YXRlbWVudCgpO1xuICAgICAgICByZW1lZGlhdGlvblBvbGljeTIuYWRkQWN0aW9ucyhcbiAgICAgICAgICAgIFwiZWMyOkRlc2NyaWJlU2VjdXJpdHlHcm91cFJlZmVyZW5jZXNcIixcbiAgICAgICAgICAgIFwiZWMyOkRlc2NyaWJlU2VjdXJpdHlHcm91cHNcIlxuICAgICAgICAgICAgKVxuICAgICAgICByZW1lZGlhdGlvblBvbGljeTIuZWZmZWN0ID0gRWZmZWN0LkFMTE9XXG4gICAgICAgIHJlbWVkaWF0aW9uUG9saWN5Mi5hZGRSZXNvdXJjZXMoXCIqXCIpXG5cbiAgICAgICAgaW5saW5lUG9saWN5LmFkZFN0YXRlbWVudHMocmVtZWRpYXRpb25Qb2xpY3kxLCByZW1lZGlhdGlvblBvbGljeTIpXG5cbiAgICAgICAgbmV3IFNzbVJvbGUocHJvcHMucm9sZVN0YWNrLCAnUmVtZWRpYXRpb25Sb2xlICcgKyByZW1lZGlhdGlvbk5hbWUsIHtcbiAgICAgICAgICAgIHNvbHV0aW9uSWQ6IHByb3BzLnNvbHV0aW9uSWQsXG4gICAgICAgICAgICBzc21Eb2NOYW1lOiByZW1lZGlhdGlvbk5hbWUsXG4gICAgICAgICAgICByZW1lZGlhdGlvblBvbGljeTogaW5saW5lUG9saWN5LFxuICAgICAgICAgICAgcmVtZWRpYXRpb25Sb2xlTmFtZTogYCR7cmVtZWRpYXRpb25Sb2xlTmFtZUJhc2V9JHtyZW1lZGlhdGlvbk5hbWV9YFxuICAgICAgICB9KVxuXG4gICAgICAgIFJ1bmJvb2tGYWN0b3J5LmNyZWF0ZVJlbWVkaWF0aW9uUnVuYm9vayh0aGlzLCAnU0hBUlIgJysgcmVtZWRpYXRpb25OYW1lLCB7XG4gICAgICAgICAgICBzc21Eb2NOYW1lOiByZW1lZGlhdGlvbk5hbWUsXG4gICAgICAgICAgICBzc21Eb2NQYXRoOiBzc21kb2NzLFxuICAgICAgICAgICAgc3NtRG9jRmlsZU5hbWU6IGAke3JlbWVkaWF0aW9uTmFtZX0ueWFtbGAsXG4gICAgICAgICAgICBzY3JpcHRQYXRoOiBgJHtzc21kb2NzfS9zY3JpcHRzYCxcbiAgICAgICAgICAgIHNvbHV0aW9uVmVyc2lvbjogcHJvcHMuc29sdXRpb25WZXJzaW9uLFxuICAgICAgICAgICAgc29sdXRpb25EaXN0QnVja2V0OiBwcm9wcy5zb2x1dGlvbkRpc3RCdWNrZXQsXG4gICAgICAgICAgICBzb2x1dGlvbklkOiBwcm9wcy5zb2x1dGlvbklkXG4gICAgICAgIH0pXG5cbiAgICAgICAgbGV0IGNoaWxkVG9Nb2QgPSBpbmxpbmVQb2xpY3kubm9kZS5maW5kQ2hpbGQoJ1Jlc291cmNlJykgYXMgQ2ZuUG9saWN5O1xuICAgICAgICBjaGlsZFRvTW9kLmNmbk9wdGlvbnMubWV0YWRhdGEgPSB7XG4gICAgICAgICAgICBjZm5fbmFnOiB7XG4gICAgICAgICAgICAgICAgcnVsZXNfdG9fc3VwcHJlc3M6IFt7XG4gICAgICAgICAgICAgICAgICAgIGlkOiAnVzEyJyxcbiAgICAgICAgICAgICAgICAgICAgcmVhc29uOiAnUmVzb3VyY2UgKiBpcyByZXF1aXJlZCBmb3IgdG8gYWxsb3cgcmVtZWRpYXRpb24gZm9yIGFueSByZXNvdXJjZS4nXG4gICAgICAgICAgICAgICAgfSx7XG4gICAgICAgICAgICAgICAgICAgIGlkOiAnVzI4JyxcbiAgICAgICAgICAgICAgICAgICAgcmVhc29uOiAnU3RhdGljIG5hbWVzIGNob3NlbiBpbnRlbnRpb25hbGx5IHRvIHByb3ZpZGUgaW50ZWdyYXRpb24gaW4gY3Jvc3MtYWNjb3VudCBwZXJtaXNzaW9ucydcbiAgICAgICAgICAgICAgICB9XVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuICAgIC8vLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICAvLyBBV1NDb25maWdSZW1lZGlhdGlvbi1SZXZva2VVbnVzZWRJQU1Vc2VyQ3JlZGVudGlhbHNcbiAgICAvL1xuICAgIHtcbiAgICAgICAgY29uc3QgcmVtZWRpYXRpb25OYW1lID0gJ1Jldm9rZVVudXNlZElBTVVzZXJDcmVkZW50aWFscydcbiAgICAgICAgY29uc3QgaW5saW5lUG9saWN5ID0gbmV3IFBvbGljeShwcm9wcy5yb2xlU3RhY2ssIGBTSEFSUi1SZW1lZGlhdGlvbi1Qb2xpY3ktJHtyZW1lZGlhdGlvbk5hbWV9YCk7XG4gICAgICAgIGNvbnN0IHJlbWVkaWF0aW9uUG9saWN5ID0gbmV3IFBvbGljeVN0YXRlbWVudCgpO1xuICAgICAgICByZW1lZGlhdGlvblBvbGljeS5hZGRBY3Rpb25zKFxuICAgICAgICAgICAgXCJpYW06VXBkYXRlQWNjZXNzS2V5XCIsXG4gICAgICAgICAgICBcImlhbTpMaXN0QWNjZXNzS2V5c1wiLFxuICAgICAgICAgICAgXCJpYW06R2V0QWNjZXNzS2V5TGFzdFVzZWRcIixcbiAgICAgICAgICAgIFwiaWFtOkdldFVzZXJcIixcbiAgICAgICAgICAgIFwiaWFtOkdldExvZ2luUHJvZmlsZVwiLFxuICAgICAgICAgICAgXCJpYW06RGVsZXRlTG9naW5Qcm9maWxlXCJcbiAgICAgICAgKTtcbiAgICAgICAgcmVtZWRpYXRpb25Qb2xpY3kuZWZmZWN0ID0gRWZmZWN0LkFMTE9XO1xuICAgICAgICByZW1lZGlhdGlvblBvbGljeS5hZGRSZXNvdXJjZXMoXG4gICAgICAgICAgICBcImFybjpcIiArIHRoaXMucGFydGl0aW9uICsgXCI6aWFtOjpcIiArIHRoaXMuYWNjb3VudCArIFwiOnVzZXIvKlwiXG4gICAgICAgICk7XG4gICAgICAgIGlubGluZVBvbGljeS5hZGRTdGF0ZW1lbnRzKHJlbWVkaWF0aW9uUG9saWN5KVxuXG4gICAgICAgIGNvbnN0IGNmZ1Blcm1zID0gbmV3IFBvbGljeVN0YXRlbWVudCgpO1xuICAgICAgICBjZmdQZXJtcy5hZGRBY3Rpb25zKFxuICAgICAgICAgICAgXCJjb25maWc6TGlzdERpc2NvdmVyZWRSZXNvdXJjZXNcIlxuICAgICAgICApXG4gICAgICAgIGNmZ1Blcm1zLmVmZmVjdCA9IEVmZmVjdC5BTExPV1xuICAgICAgICBjZmdQZXJtcy5hZGRSZXNvdXJjZXMoXCIqXCIpXG4gICAgICAgIGlubGluZVBvbGljeS5hZGRTdGF0ZW1lbnRzKGNmZ1Blcm1zKVxuXG4gICAgICAgIG5ldyBTc21Sb2xlKHByb3BzLnJvbGVTdGFjaywgJ1JlbWVkaWF0aW9uUm9sZSAnICsgcmVtZWRpYXRpb25OYW1lLCB7XG4gICAgICAgICAgICBzb2x1dGlvbklkOiBwcm9wcy5zb2x1dGlvbklkLFxuICAgICAgICAgICAgc3NtRG9jTmFtZTogcmVtZWRpYXRpb25OYW1lLFxuICAgICAgICAgICAgcmVtZWRpYXRpb25Qb2xpY3k6IGlubGluZVBvbGljeSxcbiAgICAgICAgICAgIHJlbWVkaWF0aW9uUm9sZU5hbWU6IGAke3JlbWVkaWF0aW9uUm9sZU5hbWVCYXNlfSR7cmVtZWRpYXRpb25OYW1lfWBcbiAgICAgICAgfSlcblxuICAgICAgICBSdW5ib29rRmFjdG9yeS5jcmVhdGVSZW1lZGlhdGlvblJ1bmJvb2sodGhpcywgJ1NIQVJSICcrIHJlbWVkaWF0aW9uTmFtZSwge1xuICAgICAgICAgICAgc3NtRG9jTmFtZTogcmVtZWRpYXRpb25OYW1lLFxuICAgICAgICAgICAgc3NtRG9jUGF0aDogc3NtZG9jcyxcbiAgICAgICAgICAgIHNzbURvY0ZpbGVOYW1lOiBgJHtyZW1lZGlhdGlvbk5hbWV9LnlhbWxgLFxuICAgICAgICAgICAgc2NyaXB0UGF0aDogYCR7c3NtZG9jc30vc2NyaXB0c2AsXG4gICAgICAgICAgICBzb2x1dGlvblZlcnNpb246IHByb3BzLnNvbHV0aW9uVmVyc2lvbixcbiAgICAgICAgICAgIHNvbHV0aW9uRGlzdEJ1Y2tldDogcHJvcHMuc29sdXRpb25EaXN0QnVja2V0LFxuICAgICAgICAgICAgc29sdXRpb25JZDogcHJvcHMuc29sdXRpb25JZFxuICAgICAgICB9KVxuXG4gICAgICAgIGxldCBjaGlsZFRvTW9kID0gaW5saW5lUG9saWN5Lm5vZGUuZmluZENoaWxkKCdSZXNvdXJjZScpIGFzIENmblBvbGljeTtcbiAgICAgICAgY2hpbGRUb01vZC5jZm5PcHRpb25zLm1ldGFkYXRhID0ge1xuICAgICAgICAgICAgY2ZuX25hZzoge1xuICAgICAgICAgICAgICAgIHJ1bGVzX3RvX3N1cHByZXNzOiBbe1xuICAgICAgICAgICAgICAgICAgICBpZDogJ1cxMicsXG4gICAgICAgICAgICAgICAgICAgIHJlYXNvbjogJ1Jlc291cmNlICogaXMgcmVxdWlyZWQgZm9yIHRvIGFsbG93IHJlbWVkaWF0aW9uIGZvciBhbnkgcmVzb3VyY2UuJ1xuICAgICAgICAgICAgICAgIH1dXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG4gICAgLy8tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgIC8vIEFXU0NvbmZpZ1JlbWVkaWF0aW9uLVNldElBTVBhc3N3b3JkUG9saWN5XG4gICAgLy9cbiAgICB7XG4gICAgICAgIGNvbnN0IHJlbWVkaWF0aW9uTmFtZSA9ICdTZXRJQU1QYXNzd29yZFBvbGljeSdcbiAgICAgICAgY29uc3QgaW5saW5lUG9saWN5ID0gbmV3IFBvbGljeShwcm9wcy5yb2xlU3RhY2ssIGBTSEFSUi1SZW1lZGlhdGlvbi1Qb2xpY3ktJHtyZW1lZGlhdGlvbk5hbWV9YCk7XG5cbiAgICAgICAgY29uc3QgcmVtZWRpYXRpb25Qb2xpY3kgPSBuZXcgUG9saWN5U3RhdGVtZW50KCk7XG4gICAgICAgIHJlbWVkaWF0aW9uUG9saWN5LmFkZEFjdGlvbnMoXG4gICAgICAgICAgICBcImlhbTpVcGRhdGVBY2NvdW50UGFzc3dvcmRQb2xpY3lcIixcbiAgICAgICAgICAgIFwiaWFtOkdldEFjY291bnRQYXNzd29yZFBvbGljeVwiLFxuICAgICAgICAgICAgXCJlYzI6VXBkYXRlU2VjdXJpdHlHcm91cFJ1bGVEZXNjcmlwdGlvbnNJbmdyZXNzXCIsXG4gICAgICAgICAgICBcImVjMjpSZXZva2VTZWN1cml0eUdyb3VwSW5ncmVzc1wiLFxuICAgICAgICAgICAgXCJlYzI6UmV2b2tlU2VjdXJpdHlHcm91cEVncmVzc1wiXG4gICAgICAgICAgICApXG4gICAgICAgIHJlbWVkaWF0aW9uUG9saWN5LmVmZmVjdCA9IEVmZmVjdC5BTExPV1xuICAgICAgICByZW1lZGlhdGlvblBvbGljeS5hZGRSZXNvdXJjZXMoXCIqXCIpXG4gICAgICAgIGlubGluZVBvbGljeS5hZGRTdGF0ZW1lbnRzKHJlbWVkaWF0aW9uUG9saWN5KVxuXG4gICAgICAgIG5ldyBTc21Sb2xlKHByb3BzLnJvbGVTdGFjaywgJ1JlbWVkaWF0aW9uUm9sZSAnICsgcmVtZWRpYXRpb25OYW1lLCB7XG4gICAgICAgICAgICBzb2x1dGlvbklkOiBwcm9wcy5zb2x1dGlvbklkLFxuICAgICAgICAgICAgc3NtRG9jTmFtZTogcmVtZWRpYXRpb25OYW1lLFxuICAgICAgICAgICAgcmVtZWRpYXRpb25Qb2xpY3k6IGlubGluZVBvbGljeSxcbiAgICAgICAgICAgIHJlbWVkaWF0aW9uUm9sZU5hbWU6IGAke3JlbWVkaWF0aW9uUm9sZU5hbWVCYXNlfSR7cmVtZWRpYXRpb25OYW1lfWBcbiAgICAgICAgfSlcblxuICAgICAgICBSdW5ib29rRmFjdG9yeS5jcmVhdGVSZW1lZGlhdGlvblJ1bmJvb2sodGhpcywgJ1NIQVJSICcrIHJlbWVkaWF0aW9uTmFtZSwge1xuICAgICAgICAgICAgc3NtRG9jTmFtZTogcmVtZWRpYXRpb25OYW1lLFxuICAgICAgICAgICAgc3NtRG9jUGF0aDogc3NtZG9jcyxcbiAgICAgICAgICAgIHNzbURvY0ZpbGVOYW1lOiBgJHtyZW1lZGlhdGlvbk5hbWV9LnlhbWxgLFxuICAgICAgICAgICAgc2NyaXB0UGF0aDogYCR7c3NtZG9jc30vc2NyaXB0c2AsXG4gICAgICAgICAgICBzb2x1dGlvblZlcnNpb246IHByb3BzLnNvbHV0aW9uVmVyc2lvbixcbiAgICAgICAgICAgIHNvbHV0aW9uRGlzdEJ1Y2tldDogcHJvcHMuc29sdXRpb25EaXN0QnVja2V0LFxuICAgICAgICAgICAgc29sdXRpb25JZDogcHJvcHMuc29sdXRpb25JZFxuICAgICAgICB9KVxuICAgICAgICBsZXQgY2hpbGRUb01vZCA9IGlubGluZVBvbGljeS5ub2RlLmZpbmRDaGlsZCgnUmVzb3VyY2UnKSBhcyBDZm5Qb2xpY3k7XG4gICAgICAgIGNoaWxkVG9Nb2QuY2ZuT3B0aW9ucy5tZXRhZGF0YSA9IHtcbiAgICAgICAgICAgIGNmbl9uYWc6IHtcbiAgICAgICAgICAgICAgICBydWxlc190b19zdXBwcmVzczogW3tcbiAgICAgICAgICAgICAgICAgICAgaWQ6ICdXMTInLFxuICAgICAgICAgICAgICAgICAgICByZWFzb246ICdSZXNvdXJjZSAqIGlzIHJlcXVpcmVkIGZvciB0byBhbGxvdyByZW1lZGlhdGlvbiBmb3IgYW55IHJlc291cmNlLidcbiAgICAgICAgICAgICAgICB9XVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgIC8vIEFXU0NvbmZpZ1JlbWVkaWF0aW9uLURpc2FibGVQdWJsaWNBY2Nlc3NUb1JEU0luc3RhbmNlXG4gICAgLy9cbiAgICB7XG4gICAgICBjb25zdCByZW1lZGlhdGlvbk5hbWUgPSAnRGlzYWJsZVB1YmxpY0FjY2Vzc1RvUkRTSW5zdGFuY2UnO1xuICAgICAgY29uc3QgaW5saW5lUG9saWN5ID0gbmV3IFBvbGljeShwcm9wcy5yb2xlU3RhY2ssIGBTSEFSUi1SZW1lZGlhdGlvbi1Qb2xpY3ktJHtyZW1lZGlhdGlvbk5hbWV9YCk7XG5cbiAgICAgIGNvbnN0IHJlbWVkaWF0aW9uUG9saWN5ID0gbmV3IFBvbGljeVN0YXRlbWVudCgpO1xuICAgICAgcmVtZWRpYXRpb25Qb2xpY3kuYWRkQWN0aW9ucyhcbiAgICAgICAgJ3JkczpEZXNjcmliZURCSW5zdGFuY2VzJyxcbiAgICAgICAgJ3JkczpNb2RpZnlEQkluc3RhbmNlJyk7XG4gICAgICByZW1lZGlhdGlvblBvbGljeS5lZmZlY3QgPSBFZmZlY3QuQUxMT1c7XG4gICAgICByZW1lZGlhdGlvblBvbGljeS5hZGRSZXNvdXJjZXMoXCIqXCIpO1xuICAgICAgaW5saW5lUG9saWN5LmFkZFN0YXRlbWVudHMocmVtZWRpYXRpb25Qb2xpY3kpO1xuXG4gICAgICBuZXcgU3NtUm9sZShwcm9wcy5yb2xlU3RhY2ssICdSZW1lZGlhdGlvblJvbGUgJyArIHJlbWVkaWF0aW9uTmFtZSwge1xuICAgICAgICBzb2x1dGlvbklkOiBwcm9wcy5zb2x1dGlvbklkLFxuICAgICAgICBzc21Eb2NOYW1lOiByZW1lZGlhdGlvbk5hbWUsXG4gICAgICAgIHJlbWVkaWF0aW9uUG9saWN5OiBpbmxpbmVQb2xpY3ksXG4gICAgICAgIHJlbWVkaWF0aW9uUm9sZU5hbWU6IGAke3JlbWVkaWF0aW9uUm9sZU5hbWVCYXNlfSR7cmVtZWRpYXRpb25OYW1lfWBcbiAgICAgIH0pO1xuXG4gICAgICBSdW5ib29rRmFjdG9yeS5jcmVhdGVSZW1lZGlhdGlvblJ1bmJvb2sodGhpcywgJ1NIQVJSICcrIHJlbWVkaWF0aW9uTmFtZSwge1xuICAgICAgICBzc21Eb2NOYW1lOiByZW1lZGlhdGlvbk5hbWUsXG4gICAgICAgIHNzbURvY1BhdGg6IHNzbWRvY3MsXG4gICAgICAgIHNzbURvY0ZpbGVOYW1lOiBgJHtyZW1lZGlhdGlvbk5hbWV9LnlhbWxgLFxuICAgICAgICBzY3JpcHRQYXRoOiBgJHtzc21kb2NzfS9zY3JpcHRzYCxcbiAgICAgICAgc29sdXRpb25WZXJzaW9uOiBwcm9wcy5zb2x1dGlvblZlcnNpb24sXG4gICAgICAgIHNvbHV0aW9uRGlzdEJ1Y2tldDogcHJvcHMuc29sdXRpb25EaXN0QnVja2V0LFxuICAgICAgICBzb2x1dGlvbklkOiBwcm9wcy5zb2x1dGlvbklkXG4gICAgICB9KTtcbiAgICAgIGxldCBjaGlsZFRvTW9kID0gaW5saW5lUG9saWN5Lm5vZGUuZmluZENoaWxkKCdSZXNvdXJjZScpIGFzIENmblBvbGljeTtcbiAgICAgIGNoaWxkVG9Nb2QuY2ZuT3B0aW9ucy5tZXRhZGF0YSA9IHtcbiAgICAgICAgY2ZuX25hZzoge1xuICAgICAgICAgIHJ1bGVzX3RvX3N1cHByZXNzOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIGlkOiAnVzEyJyxcbiAgICAgICAgICAgICAgcmVhc29uOiAnUmVzb3VyY2UgKiBpcyByZXF1aXJlZCBmb3IgdG8gYWxsb3cgcmVtZWRpYXRpb24gZm9yIGFueSByZXNvdXJjZS4nXG4gICAgICAgICAgICB9XG4gICAgICAgICAgXVxuICAgICAgICB9XG4gICAgICB9O1xuICAgIH1cblxuICAgIC8vLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICAvLyBBV1NDb25maWdSZW1lZGlhdGlvbi1FbmFibGVNaW5vclZlcnNpb25VcGdyYWRlT25SRFNEQkluc3RhbmNlXG4gICAgLy9cbiAgICB7XG4gICAgICBjb25zdCByZW1lZGlhdGlvbk5hbWUgPSAnRW5hYmxlTWlub3JWZXJzaW9uVXBncmFkZU9uUkRTREJJbnN0YW5jZSc7XG4gICAgICBjb25zdCBpbmxpbmVQb2xpY3kgPSBuZXcgUG9saWN5KHByb3BzLnJvbGVTdGFjaywgYFNIQVJSLVJlbWVkaWF0aW9uLVBvbGljeS0ke3JlbWVkaWF0aW9uTmFtZX1gKTtcblxuICAgICAgY29uc3QgcmVtZWRpYXRpb25Qb2xpY3kgPSBuZXcgUG9saWN5U3RhdGVtZW50KCk7XG4gICAgICByZW1lZGlhdGlvblBvbGljeS5hZGRBY3Rpb25zKFxuICAgICAgICAncmRzOkRlc2NyaWJlREJJbnN0YW5jZXMnLFxuICAgICAgICAncmRzOk1vZGlmeURCSW5zdGFuY2UnKTtcbiAgICAgIHJlbWVkaWF0aW9uUG9saWN5LmVmZmVjdCA9IEVmZmVjdC5BTExPVztcbiAgICAgIHJlbWVkaWF0aW9uUG9saWN5LmFkZFJlc291cmNlcyhcIipcIik7XG4gICAgICBpbmxpbmVQb2xpY3kuYWRkU3RhdGVtZW50cyhyZW1lZGlhdGlvblBvbGljeSk7XG5cbiAgICAgIG5ldyBTc21Sb2xlKHByb3BzLnJvbGVTdGFjaywgJ1JlbWVkaWF0aW9uUm9sZSAnICsgcmVtZWRpYXRpb25OYW1lLCB7XG4gICAgICAgIHNvbHV0aW9uSWQ6IHByb3BzLnNvbHV0aW9uSWQsXG4gICAgICAgIHNzbURvY05hbWU6IHJlbWVkaWF0aW9uTmFtZSxcbiAgICAgICAgcmVtZWRpYXRpb25Qb2xpY3k6IGlubGluZVBvbGljeSxcbiAgICAgICAgcmVtZWRpYXRpb25Sb2xlTmFtZTogYCR7cmVtZWRpYXRpb25Sb2xlTmFtZUJhc2V9JHtyZW1lZGlhdGlvbk5hbWV9YFxuICAgICAgfSk7XG5cbiAgICAgIFJ1bmJvb2tGYWN0b3J5LmNyZWF0ZVJlbWVkaWF0aW9uUnVuYm9vayh0aGlzLCAnU0hBUlIgJysgcmVtZWRpYXRpb25OYW1lLCB7XG4gICAgICAgIHNzbURvY05hbWU6IHJlbWVkaWF0aW9uTmFtZSxcbiAgICAgICAgc3NtRG9jUGF0aDogc3NtZG9jcyxcbiAgICAgICAgc3NtRG9jRmlsZU5hbWU6IGAke3JlbWVkaWF0aW9uTmFtZX0ueWFtbGAsXG4gICAgICAgIHNjcmlwdFBhdGg6IGAke3NzbWRvY3N9L3NjcmlwdHNgLFxuICAgICAgICBzb2x1dGlvblZlcnNpb246IHByb3BzLnNvbHV0aW9uVmVyc2lvbixcbiAgICAgICAgc29sdXRpb25EaXN0QnVja2V0OiBwcm9wcy5zb2x1dGlvbkRpc3RCdWNrZXQsXG4gICAgICAgIHNvbHV0aW9uSWQ6IHByb3BzLnNvbHV0aW9uSWRcbiAgICAgIH0pO1xuICAgICAgbGV0IGNoaWxkVG9Nb2QgPSBpbmxpbmVQb2xpY3kubm9kZS5maW5kQ2hpbGQoJ1Jlc291cmNlJykgYXMgQ2ZuUG9saWN5O1xuICAgICAgY2hpbGRUb01vZC5jZm5PcHRpb25zLm1ldGFkYXRhID0ge1xuICAgICAgICBjZm5fbmFnOiB7XG4gICAgICAgICAgcnVsZXNfdG9fc3VwcHJlc3M6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgaWQ6ICdXMTInLFxuICAgICAgICAgICAgICByZWFzb246ICdSZXNvdXJjZSAqIGlzIHJlcXVpcmVkIGZvciB0byBhbGxvdyByZW1lZGlhdGlvbiBmb3IgYW55IHJlc291cmNlLidcbiAgICAgICAgICAgIH1cbiAgICAgICAgICBdXG4gICAgICAgIH1cbiAgICAgIH07XG4gICAgfVxuICB9XG59XG4iXX0=