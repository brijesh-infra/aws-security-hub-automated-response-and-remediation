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
exports.OrchestratorConstruct = void 0;
const cdk_nag = require("cdk-nag");
const cdk = require("@aws-cdk/core");
const sfn = require("@aws-cdk/aws-stepfunctions");
const aws_stepfunctions_tasks_1 = require("@aws-cdk/aws-stepfunctions-tasks");
const lambda = require("@aws-cdk/aws-lambda");
const aws_iam_1 = require("@aws-cdk/aws-iam");
const aws_ssm_1 = require("@aws-cdk/aws-ssm");
class OrchestratorConstruct extends cdk.Construct {
    constructor(scope, id, props) {
        super(scope, id);
        const stack = cdk.Stack.of(this);
        const RESOURCE_PREFIX = props.solutionId.replace(/^DEV-/, ''); // prefix on every resource name
        const extractFindings = new sfn.Pass(this, 'Get Finding Data from Input', {
            comment: 'Extract top-level data needed for remediation',
            parameters: {
                "EventType.$": "$.detail-type",
                "Findings.$": "$.detail.findings"
            }
        });
        const reuseOrchLogGroup = new cdk.CfnParameter(this, 'Reuse Log Group', {
            type: "String",
            description: `Reuse existing Orchestrator Log Group? Choose "yes" if the log group already exists, else "no"`,
            default: "no",
            allowedValues: ["yes", "no"],
        });
        reuseOrchLogGroup.overrideLogicalId(`ReuseOrchestratorLogGroup`);
        const nestedLogStack = new cdk.CfnStack(this, "NestedLogStack", {
            parameters: {
                KmsKeyArn: props.kmsKeyParm.stringValue,
                ReuseOrchestratorLogGroup: reuseOrchLogGroup.valueAsString
            },
            templateUrl: "https://" + cdk.Fn.findInMap("SourceCode", "General", "S3Bucket") +
                "-reference.s3.amazonaws.com/" + cdk.Fn.findInMap("SourceCode", "General", "KeyPrefix") +
                "/aws-sharr-orchestrator-log.template"
        });
        let getDocStateFunc = lambda.Function.fromFunctionAttributes(this, 'getDocStateFunc', {
            functionArn: props.ssmDocStateLambda
        });
        let execRemediationFunc = lambda.Function.fromFunctionAttributes(this, 'execRemediationFunc', {
            functionArn: props.ssmExecDocLambda
        });
        let execMonFunc = lambda.Function.fromFunctionAttributes(this, 'getExecStatusFunc', {
            functionArn: props.ssmExecMonitorLambda
        });
        let notifyFunc = lambda.Function.fromFunctionAttributes(this, 'notifyFunc', {
            functionArn: props.notifyLambda
        });
        let getApprovalRequirementFunc = lambda.Function.fromFunctionAttributes(this, 'getRequirementFunc', {
            functionArn: props.getApprovalRequirementLambda
        });
        const orchestratorFailed = new sfn.Pass(this, 'Orchestrator Failed', {
            parameters: {
                "Notification": {
                    "Message.$": "States.Format('Orchestrator failed: {}', $.Error)",
                    "State.$": "States.Format('LAMBDAERROR')",
                    "Details.$": "States.Format('Cause: {}', $.Cause)"
                },
                "Payload.$": "$"
            }
        });
        const getDocState = new aws_stepfunctions_tasks_1.LambdaInvoke(this, 'Get Automation Document State', {
            comment: "Get the status of the remediation automation document in the target account",
            lambdaFunction: getDocStateFunc,
            timeout: cdk.Duration.minutes(1),
            resultSelector: {
                "DocState.$": "$.Payload.status",
                "Message.$": "$.Payload.message",
                "SecurityStandard.$": "$.Payload.securitystandard",
                "SecurityStandardVersion.$": "$.Payload.securitystandardversion",
                "SecurityStandardSupported.$": "$.Payload.standardsupported",
                "ControlId.$": "$.Payload.controlid",
                "AccountId.$": "$.Payload.accountid",
                "RemediationRole.$": "$.Payload.remediationrole",
                "AutomationDocId.$": "$.Payload.automationdocid",
                "ResourceRegion.$": "$.Payload.resourceregion"
            },
            resultPath: "$.AutomationDocument"
        });
        getDocState.addCatch(orchestratorFailed);
        const getApprovalRequirement = new aws_stepfunctions_tasks_1.LambdaInvoke(this, 'Get Remediation Approval Requirement', {
            comment: "Determine whether the selected remediation requires manual approval",
            lambdaFunction: getApprovalRequirementFunc,
            timeout: cdk.Duration.minutes(5),
            resultSelector: {
                "WorkflowDocument.$": "$.Payload.workflowdoc",
                "WorkflowAccount.$": "$.Payload.workflowaccount",
                "WorkflowRole.$": "$.Payload.workflowrole",
                "WorkflowConfig.$": "$.Payload.workflow_data"
            },
            resultPath: "$.Workflow"
        });
        getApprovalRequirement.addCatch(orchestratorFailed);
        const remediateFinding = new aws_stepfunctions_tasks_1.LambdaInvoke(this, 'Execute Remediation', {
            comment: "Execute the SSM Automation Document in the target account",
            lambdaFunction: execRemediationFunc,
            heartbeat: cdk.Duration.seconds(60),
            timeout: cdk.Duration.minutes(5),
            resultSelector: {
                "ExecState.$": "$.Payload.status",
                "Message.$": "$.Payload.message",
                "ExecId.$": "$.Payload.executionid",
                "Account.$": "$.Payload.executionaccount",
                "Region.$": "$.Payload.executionregion"
            },
            resultPath: "$.SSMExecution"
        });
        remediateFinding.addCatch(orchestratorFailed);
        const execMonitor = new aws_stepfunctions_tasks_1.LambdaInvoke(this, 'execMonitor', {
            comment: "Monitor the remediation execution until done",
            lambdaFunction: execMonFunc,
            heartbeat: cdk.Duration.seconds(60),
            timeout: cdk.Duration.minutes(5),
            resultSelector: {
                "ExecState.$": "$.Payload.status",
                "ExecId.$": "$.Payload.executionid",
                "RemediationState.$": "$.Payload.remediation_status",
                "Message.$": "$.Payload.message",
                "LogData.$": "$.Payload.logdata",
                "AffectedObject.$": "$.Payload.affected_object",
            },
            resultPath: "$.Remediation"
        });
        execMonitor.addCatch(orchestratorFailed);
        const notify = new aws_stepfunctions_tasks_1.LambdaInvoke(this, 'notify', {
            comment: "Send notifications",
            lambdaFunction: notifyFunc,
            heartbeat: cdk.Duration.seconds(60),
            timeout: cdk.Duration.minutes(5)
        });
        const notifyQueued = new aws_stepfunctions_tasks_1.LambdaInvoke(this, 'Queued Notification', {
            comment: "Send notification that a remediation has queued",
            lambdaFunction: notifyFunc,
            heartbeat: cdk.Duration.seconds(60),
            timeout: cdk.Duration.minutes(5),
            resultPath: "$.notificationResult"
        });
        new sfn.Fail(this, 'Job Failed', {
            cause: 'AWS Batch Job Failed',
            error: 'DescribeJob returned FAILED',
        });
        const eoj = new sfn.Pass(this, 'EOJ', {
            comment: 'END-OF-JOB'
        });
        const processFindings = new sfn.Map(this, 'Process Findings', {
            comment: 'Process all findings in CloudWatch Event',
            parameters: {
                "Finding.$": "$$.Map.Item.Value",
                "EventType.$": "$.EventType"
            },
            itemsPath: '$.Findings'
        });
        // Set notification. If the when is not matched then this will be the notification sent
        const checkWorkflowNew = new sfn.Choice(this, 'Finding Workflow State NEW?');
        const docNotNew = new sfn.Pass(this, 'Finding Workflow State is not NEW', {
            parameters: {
                "Notification": {
                    "Message.$": "States.Format('Finding Workflow State is not NEW ({}).', $.Finding.Workflow.Status)",
                    "State.$": "States.Format('NOTNEW')"
                },
                "EventType.$": "$.EventType",
                "Finding.$": "$.Finding"
            }
        });
        const checkDocState = new sfn.Choice(this, 'Automation Doc Active?');
        const docStateNotActive = new sfn.Pass(this, 'Automation Document is not Active', {
            parameters: {
                "Notification": {
                    "Message.$": "States.Format('Automation Document ({}) is not active ({}) in the member account({}).', $.AutomationDocId, $.AutomationDocument.DocState, $.Finding.AwsAccountId)",
                    "State.$": "States.Format('REMEDIATIONNOTACTIVE')",
                    "updateSecHub": "yes"
                },
                "EventType.$": "$.EventType",
                "Finding.$": "$.Finding",
                "AccountId.$": "$.AutomationDocument.AccountId",
                "AutomationDocId.$": "$.AutomationDocument.AutomationDocId",
                "RemediationRole.$": "$.AutomationDocument.RemediationRole",
                "ControlId.$": "$.AutomationDocument.ControlId",
                "SecurityStandard.$": "$.AutomationDocument.SecurityStandard",
                "SecurityStandardVersion.$": "$.AutomationDocument.SecurityStandardVersion"
            }
        });
        const controlNoRemediation = new sfn.Pass(this, 'No Remediation for Control', {
            parameters: {
                "Notification": {
                    "Message.$": "States.Format('Security Standard {} v{} control {} has no automated remediation.', $.AutomationDocument.SecurityStandard, $.AutomationDocument.SecurityStandardVersion, $.AutomationDocument.ControlId)",
                    "State.$": "States.Format('NOREMEDIATION')",
                    "updateSecHub": "yes"
                },
                "EventType.$": "$.EventType",
                "Finding.$": "$.Finding",
                "AccountId.$": "$.AutomationDocument.AccountId",
                "AutomationDocId.$": "$.AutomationDocument.AutomationDocId",
                "RemediationRole.$": "$.AutomationDocument.RemediationRole",
                "ControlId.$": "$.AutomationDocument.ControlId",
                "SecurityStandard.$": "$.AutomationDocument.SecurityStandard",
                "SecurityStandardVersion.$": "$.AutomationDocument.SecurityStandardVersion"
            }
        });
        const standardNotEnabled = new sfn.Pass(this, 'Security Standard is not enabled', {
            parameters: {
                "Notification": {
                    "Message.$": "States.Format('Security Standard ({}) v{} is not enabled.', $.AutomationDocument.SecurityStandard, $.AutomationDocument.SecurityStandardVersion)",
                    "State.$": "States.Format('STANDARDNOTENABLED')",
                    "updateSecHub": "yes"
                },
                "EventType.$": "$.EventType",
                "Finding.$": "$.Finding",
                "AccountId.$": "$.AutomationDocument.AccountId",
                "AutomationDocId.$": "$.AutomationDocument.AutomationDocId",
                "RemediationRole.$": "$.AutomationDocument.RemediationRole",
                "ControlId.$": "$.AutomationDocument.ControlId",
                "SecurityStandard.$": "$.AutomationDocument.SecurityStandard",
                "SecurityStandardVersion.$": "$.AutomationDocument.SecurityStandardVersion"
            }
        });
        const docStateError = new sfn.Pass(this, 'check_ssm_doc_state Error', {
            parameters: {
                "Notification": {
                    "Message.$": "States.Format('check_ssm_doc_state returned an error: {}', $.AutomationDocument.Message)",
                    "State.$": "States.Format('LAMBDAERROR')"
                },
                "EventType.$": "$.EventType",
                "Finding.$": "$.Finding"
            }
        });
        const isdone = new sfn.Choice(this, 'Remediation completed?');
        const waitForRemediation = new sfn.Wait(this, 'Wait for Remediation', {
            time: sfn.WaitTime.duration(cdk.Duration.seconds(15))
        });
        const remediationFailed = new sfn.Pass(this, 'Remediation Failed', {
            comment: 'Set parameters for notification',
            parameters: {
                "EventType.$": "$.EventType",
                "Finding.$": "$.Finding",
                "SSMExecution.$": "$.SSMExecution",
                "AutomationDocument.$": "$.AutomationDocument",
                "Notification": {
                    "Message.$": "States.Format('Remediation failed for {} control {} in account {}: {}', $.AutomationDocument.SecurityStandard, $.AutomationDocument.ControlId, $.AutomationDocument.AccountId, $.Remediation.Message)",
                    "State.$": "$.Remediation.ExecState",
                    "Details.$": "$.Remediation.LogData",
                    "ExecId.$": "$.Remediation.ExecId",
                    "AffectedObject.$": "$.Remediation.AffectedObject",
                }
            }
        });
        const remediationSucceeded = new sfn.Pass(this, 'Remediation Succeeded', {
            comment: 'Set parameters for notification',
            parameters: {
                "EventType.$": "$.EventType",
                "Finding.$": "$.Finding",
                "AccountId.$": "$.AutomationDocument.AccountId",
                "AutomationDocId.$": "$.AutomationDocument.AutomationDocId",
                "RemediationRole.$": "$.AutomationDocument.RemediationRole",
                "ControlId.$": "$.AutomationDocument.ControlId",
                "SecurityStandard.$": "$.AutomationDocument.SecurityStandard",
                "SecurityStandardVersion.$": "$.AutomationDocument.SecurityStandardVersion",
                "Notification": {
                    "Message.$": "States.Format('Remediation succeeded for {} control {} in account {}: {}', $.AutomationDocument.SecurityStandard, $.AutomationDocument.ControlId, $.AutomationDocument.AccountId, $.Remediation.Message)",
                    "State.$": "States.Format('SUCCESS')",
                    "Details.$": "$.Remediation.LogData",
                    "ExecId.$": "$.Remediation.ExecId",
                    "AffectedObject.$": "$.Remediation.AffectedObject",
                }
            }
        });
        const remediationQueued = new sfn.Pass(this, 'Remediation Queued', {
            comment: 'Set parameters for notification',
            parameters: {
                "EventType.$": "$.EventType",
                "Finding.$": "$.Finding",
                "AutomationDocument.$": "$.AutomationDocument",
                "SSMExecution.$": "$.SSMExecution",
                "Notification": {
                    "Message.$": "States.Format('Remediation queued for {} control {} in account {}', $.AutomationDocument.SecurityStandard, $.AutomationDocument.ControlId, $.AutomationDocument.AccountId)",
                    "State.$": "States.Format('QUEUED')",
                    "ExecId.$": "$.SSMExecution.ExecId"
                }
            }
        });
        //-----------------------------------------------------------------
        // State Machine
        //
        extractFindings.next(processFindings);
        checkWorkflowNew.when(sfn.Condition.or(sfn.Condition.stringEquals('$.EventType', 'Security Hub Findings - Custom Action'), sfn.Condition.and(sfn.Condition.stringEquals('$.Finding.Workflow.Status', 'NEW'), sfn.Condition.stringEquals('$.EventType', 'Security Hub Findings - Imported'))), getApprovalRequirement);
        checkWorkflowNew.otherwise(docNotNew);
        docNotNew.next(notify);
        // Call Lambda to get status of the automation document in the target account
        getDocState.next(checkDocState);
        getApprovalRequirement.next(getDocState);
        checkDocState.when(sfn.Condition.stringEquals('$.AutomationDocument.DocState', 'ACTIVE'), remediateFinding);
        checkDocState.when(sfn.Condition.stringEquals('$.AutomationDocument.DocState', 'NOTACTIVE'), docStateNotActive);
        checkDocState.when(sfn.Condition.stringEquals('$.AutomationDocument.DocState', 'NOTENABLED'), standardNotEnabled);
        checkDocState.when(sfn.Condition.stringEquals('$.AutomationDocument.DocState', 'NOTFOUND'), controlNoRemediation);
        checkDocState.otherwise(docStateError);
        docStateNotActive.next(notify);
        standardNotEnabled.next(notify);
        controlNoRemediation.next(notify);
        docStateError.next(notify);
        // Execute the remediation
        // remediateFinding.next(execMonitor)
        // Send a notification
        remediateFinding.next(remediationQueued);
        remediationQueued.next(notifyQueued);
        notifyQueued.next(execMonitor);
        execMonitor.next(isdone);
        isdone.when(sfn.Condition.stringEquals('$.Remediation.RemediationState', 'Failed'), remediationFailed);
        isdone.when(sfn.Condition.stringEquals('$.Remediation.ExecState', 'Success'), remediationSucceeded);
        isdone.when(sfn.Condition.stringEquals('$.Remediation.ExecState', 'TimedOut'), remediationFailed);
        isdone.when(sfn.Condition.stringEquals('$.Remediation.ExecState', 'Cancelling'), remediationFailed);
        isdone.when(sfn.Condition.stringEquals('$.Remediation.ExecState', 'Cancelled'), remediationFailed);
        isdone.when(sfn.Condition.stringEquals('$.Remediation.ExecState', 'Failed'), remediationFailed);
        isdone.otherwise(waitForRemediation);
        waitForRemediation.next(execMonitor);
        orchestratorFailed.next(notify);
        remediationFailed.next(notify);
        remediationSucceeded.next(notify);
        processFindings.iterator(checkWorkflowNew).next(eoj);
        const orchestratorPolicy = new aws_iam_1.PolicyDocument();
        orchestratorPolicy.addStatements(new aws_iam_1.PolicyStatement({
            actions: [
                "logs:CreateLogDelivery",
                "logs:GetLogDelivery",
                "logs:UpdateLogDelivery",
                "logs:DeleteLogDelivery",
                "logs:ListLogDeliveries",
                "logs:PutResourcePolicy",
                "logs:DescribeResourcePolicies",
                "logs:DescribeLogGroups"
            ],
            effect: aws_iam_1.Effect.ALLOW,
            resources: ['*']
        }));
        orchestratorPolicy.addStatements(new aws_iam_1.PolicyStatement({
            actions: ["lambda:InvokeFunction"],
            effect: aws_iam_1.Effect.ALLOW,
            resources: [
                `arn:${stack.partition}:lambda:${stack.region}:${stack.account}:function:${getDocStateFunc.functionName}`,
                `arn:${stack.partition}:lambda:${stack.region}:${stack.account}:function:${execRemediationFunc.functionName}`,
                `arn:${stack.partition}:lambda:${stack.region}:${stack.account}:function:${execMonFunc.functionName}`,
                `arn:${stack.partition}:lambda:${stack.region}:${stack.account}:function:${notifyFunc.functionName}`,
                `arn:${stack.partition}:lambda:${stack.region}:${stack.account}:function:${getApprovalRequirementFunc.functionName}`
            ]
        }));
        orchestratorPolicy.addStatements(new aws_iam_1.PolicyStatement({
            actions: [
                "kms:Encrypt",
                "kms:Decrypt",
                "kms:GenerateDataKey"
            ],
            effect: aws_iam_1.Effect.ALLOW,
            resources: [
                `arn:${stack.partition}:kms:${stack.region}:${stack.account}:alias/${RESOURCE_PREFIX}-SHARR-Key`
            ]
        }));
        const principal = new aws_iam_1.ServicePrincipal(`states.amazonaws.com`);
        const orchestratorRole = new aws_iam_1.Role(this, 'Role', {
            assumedBy: principal,
            inlinePolicies: {
                'BasePolicy': orchestratorPolicy
            }
        });
        orchestratorRole.applyRemovalPolicy(cdk.RemovalPolicy.RETAIN);
        {
            let childToMod = orchestratorRole.node.defaultChild;
            childToMod.cfnOptions.metadata = {
                cfn_nag: {
                    rules_to_suppress: [{
                            id: 'W11',
                            reason: 'CloudWatch Logs permissions require resource * except for DescribeLogGroups, except for GovCloud, which only works with resource *'
                        }]
                }
            };
        }
        cdk_nag.NagSuppressions.addResourceSuppressions(orchestratorRole, [
            { id: 'AwsSolutions-IAM5', reason: 'CloudWatch Logs permissions require resource * except for DescribeLogGroups, except for GovCloud, which only works with resource *' }
        ]);
        const orchestratorStateMachine = new sfn.StateMachine(this, 'StateMachine', {
            definition: extractFindings,
            stateMachineName: `${RESOURCE_PREFIX}-SHARR-Orchestrator`,
            timeout: cdk.Duration.minutes(15),
            role: orchestratorRole
        });
        new aws_ssm_1.StringParameter(this, 'SHARR_Orchestrator_Arn', {
            description: 'Arn of the SHARR Orchestrator Step Function. This step function routes findings to remediation runbooks.',
            parameterName: '/Solutions/' + RESOURCE_PREFIX + '/OrchestratorArn',
            stringValue: orchestratorStateMachine.stateMachineArn
        });
        // The arn for the CloudWatch logs group will be the same, regardless of encryption or not,
        // regardless of reuse or not. Set it here:
        const orchestratorLogGroupArn = `arn:${stack.partition}:logs:${stack.region}:${stack.account}:log-group:${props.orchLogGroup}:*`;
        // Use an escape hatch to handle conditionally using the encrypted or unencrypted CW LogsGroup
        const stateMachineConstruct = orchestratorStateMachine.node.defaultChild;
        stateMachineConstruct.addOverride('Properties.LoggingConfiguration', {
            "Destinations": [
                {
                    "CloudWatchLogsLogGroup": {
                        "LogGroupArn": orchestratorLogGroupArn
                    }
                }
            ],
            "IncludeExecutionData": true,
            "Level": "ALL"
        });
        stateMachineConstruct.addDependsOn(nestedLogStack);
        // Remove the unnecessary Policy created by the L2 StateMachine construct
        let roleToModify = this.node.findChild('Role');
        if (roleToModify) {
            roleToModify.node.tryRemoveChild('DefaultPolicy');
        }
        cdk_nag.NagSuppressions.addResourceSuppressions(orchestratorStateMachine, [
            { id: 'AwsSolutions-SF1', reason: 'False alarm. Logging configuration is overridden to log ALL.' },
            { id: 'AwsSolutions-SF2', reason: 'X-Ray is not needed for this use case.' }
        ]);
    }
}
exports.OrchestratorConstruct = OrchestratorConstruct;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tbW9uLW9yY2hlc3RyYXRvci1jb25zdHJ1Y3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJjb21tb24tb3JjaGVzdHJhdG9yLWNvbnN0cnVjdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUNBOzs7Ozs7Ozs7Ozs7OytFQWErRTs7O0FBRS9FLG1DQUFtQztBQUNuQyxxQ0FBcUM7QUFDckMsa0RBQWtEO0FBQ2xELDhFQUFnRTtBQUNoRSw4Q0FBOEM7QUFDOUMsOENBTzBCO0FBQzFCLDhDQUFtRDtBQWdCbkQsTUFBYSxxQkFBc0IsU0FBUSxHQUFHLENBQUMsU0FBUztJQUV0RCxZQUFZLEtBQW9CLEVBQUUsRUFBVSxFQUFFLEtBQXFCO1FBQ2pFLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFFakIsTUFBTSxLQUFLLEdBQUcsR0FBRyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDakMsTUFBTSxlQUFlLEdBQUcsS0FBSyxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsZ0NBQWdDO1FBRTlGLE1BQU0sZUFBZSxHQUFHLElBQUksR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsNkJBQTZCLEVBQUU7WUFDdEUsT0FBTyxFQUFFLCtDQUErQztZQUN4RCxVQUFVLEVBQUU7Z0JBQ1IsYUFBYSxFQUFFLGVBQWU7Z0JBQzlCLFlBQVksRUFBRSxtQkFBbUI7YUFDcEM7U0FDSixDQUFDLENBQUE7UUFFRixNQUFNLGlCQUFpQixHQUFHLElBQUksR0FBRyxDQUFDLFlBQVksQ0FBQyxJQUFJLEVBQUUsaUJBQWlCLEVBQUU7WUFDcEUsSUFBSSxFQUFFLFFBQVE7WUFDZCxXQUFXLEVBQUUsZ0dBQWdHO1lBQzdHLE9BQU8sRUFBRSxJQUFJO1lBQ2IsYUFBYSxFQUFFLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQztTQUMvQixDQUFDLENBQUE7UUFDRixp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QyxZQUFtQyxDQUFBO1FBQy9GLHFCQUFxQixDQUFDLFdBQVcsQ0FBQyxpQ0FBaUMsRUFBRTtZQUNqRSxjQUFjLEVBQUU7Z0JBQ1o7b0JBQ0ksd0JBQXdCLEVBQUU7d0JBQ3RCLGFBQWEsRUFBRSx1QkFBdUI7cUJBQ3pDO2lCQUNKO2FBQ0o7WUFDRCxzQkFBc0IsRUFBRSxJQUFJO1lBQzVCLE9BQU8sRUFBRSxLQUFLO1NBQ2pCLENBQUMsQ0FBQTtRQUNGLHFCQUFxQixDQUFDLFlBQVksQ0FBQyxjQUFjLENBQUMsQ0FBQTtRQUVsRCx5RUFBeUU7UUFDekUsSUFBSSxZQUFZLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFZLENBQUM7UUFDMUQsSUFBSSxZQUFZLEVBQUU7WUFDZCxZQUFZLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxlQUFlLENBQUMsQ0FBQTtTQUNwRDtRQUVELE9BQU8sQ0FBQyxlQUFlLENBQUMsdUJBQXVCLENBQUMsd0JBQXdCLEVBQUU7WUFDdEUsRUFBQyxFQUFFLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSxFQUFFLDhEQUE4RCxFQUFDO1lBQ2hHLEVBQUMsRUFBRSxFQUFFLGtCQUFrQixFQUFFLE1BQU0sRUFBRSx3Q0FBd0MsRUFBQztTQUM3RSxDQUFDLENBQUM7SUFDTCxDQUFDO0NBQ0Y7QUFqaUJELHNEQWlpQkMiLCJzb3VyY2VzQ29udGVudCI6WyIjIS91c3IvYmluL2VudiBub2RlXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAqICBDb3B5cmlnaHQgQW1hem9uLmNvbSwgSW5jLiBvciBpdHMgYWZmaWxpYXRlcy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC4gICAqXG4gKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAqXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZSBMaWNlbnNlLCBWZXJzaW9uIDIuMCAodGhlIFwiTGljZW5zZVwiKS4gWW91IG1heSAgICpcbiAqICBub3QgdXNlIHRoaXMgZmlsZSBleGNlcHQgaW4gY29tcGxpYW5jZSB3aXRoIHRoZSBMaWNlbnNlLiBBIGNvcHkgb2YgdGhlICAgICpcbiAqICBMaWNlbnNlIGlzIGxvY2F0ZWQgYXQgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICpcbiAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICpcbiAqICAgICAgaHR0cDovL3d3dy5hcGFjaGUub3JnL2xpY2Vuc2VzL0xJQ0VOU0UtMi4wICAgICAgICAgICAgICAgICAgICAgICAgICAgICpcbiAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICpcbiAqICBvciBpbiB0aGUgJ2xpY2Vuc2UnIGZpbGUgYWNjb21wYW55aW5nIHRoaXMgZmlsZS4gVGhpcyBmaWxlIGlzIGRpc3RyaWJ1dGVkICpcbiAqICBvbiBhbiAnQVMgSVMnIEJBU0lTLCBXSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTlkgS0lORCwgICAgICAgICpcbiAqICBleHByZXNzIG9yIGltcGxpZWQuIFNlZSB0aGUgTGljZW5zZSBmb3IgdGhlIHNwZWNpZmljIGxhbmd1YWdlIGdvdmVybmluZyAgICpcbiAqICBwZXJtaXNzaW9ucyBhbmQgbGltaXRhdGlvbnMgdW5kZXIgdGhlIExpY2Vuc2UuICAgICAgICAgICAgICAgICAgICAgICAgICAgICpcbiAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuaW1wb3J0ICogYXMgY2RrX25hZyBmcm9tICdjZGstbmFnJztcbmltcG9ydCAqIGFzIGNkayBmcm9tICdAYXdzLWNkay9jb3JlJztcbmltcG9ydCAqIGFzIHNmbiBmcm9tICdAYXdzLWNkay9hd3Mtc3RlcGZ1bmN0aW9ucyc7XG5pbXBvcnQgeyBMYW1iZGFJbnZva2UgfSBmcm9tICdAYXdzLWNkay9hd3Mtc3RlcGZ1bmN0aW9ucy10YXNrcyc7XG5pbXBvcnQgKiBhcyBsYW1iZGEgZnJvbSAnQGF3cy1jZGsvYXdzLWxhbWJkYSc7XG5pbXBvcnQge1xuICAgIFBvbGljeURvY3VtZW50LFxuICAgIFBvbGljeVN0YXRlbWVudCxcbiAgICBSb2xlLFxuICAgIEVmZmVjdCxcbiAgICBTZXJ2aWNlUHJpbmNpcGFsLFxuICAgIENmblJvbGVcbn0gZnJvbSAnQGF3cy1jZGsvYXdzLWlhbSc7XG5pbXBvcnQgeyBTdHJpbmdQYXJhbWV0ZXIgfSBmcm9tICdAYXdzLWNkay9hd3Mtc3NtJztcblxuZXhwb3J0IGludGVyZmFjZSBDb25zdHJ1Y3RQcm9wcyB7XG4gICAgcm9sZUFybjogc3RyaW5nO1xuICAgIHNzbURvY1N0YXRlTGFtYmRhOiBzdHJpbmc7XG4gICAgc3NtRXhlY0RvY0xhbWJkYTogc3RyaW5nO1xuICAgIHNzbUV4ZWNNb25pdG9yTGFtYmRhOiBzdHJpbmc7XG4gICAgbm90aWZ5TGFtYmRhOiBzdHJpbmc7XG4gICAgZ2V0QXBwcm92YWxSZXF1aXJlbWVudExhbWJkYTogc3RyaW5nO1xuICAgIHNvbHV0aW9uSWQ6IHN0cmluZztcbiAgICBzb2x1dGlvbk5hbWU6IHN0cmluZztcbiAgICBzb2x1dGlvblZlcnNpb246IHN0cmluZztcbiAgICBvcmNoTG9nR3JvdXA6IHN0cmluZztcbiAgICBrbXNLZXlQYXJtOiBTdHJpbmdQYXJhbWV0ZXI7IC8vIHRvIGZvcmNlIGRlcGVuZGVuY3lcbn1cblxuZXhwb3J0IGNsYXNzIE9yY2hlc3RyYXRvckNvbnN0cnVjdCBleHRlbmRzIGNkay5Db25zdHJ1Y3Qge1xuICBwdWJsaWMgcmVhZG9ubHkgb3JjaEFyblBhcm06IFN0cmluZ1BhcmFtZXRlclxuICBjb25zdHJ1Y3RvcihzY29wZTogY2RrLkNvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IENvbnN0cnVjdFByb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkKTtcblxuICAgIGNvbnN0IHN0YWNrID0gY2RrLlN0YWNrLm9mKHRoaXMpO1xuICAgIGNvbnN0IFJFU09VUkNFX1BSRUZJWCA9IHByb3BzLnNvbHV0aW9uSWQucmVwbGFjZSgvXkRFVi0vLCcnKTsgLy8gcHJlZml4IG9uIGV2ZXJ5IHJlc291cmNlIG5hbWVcblxuICAgIGNvbnN0IGV4dHJhY3RGaW5kaW5ncyA9IG5ldyBzZm4uUGFzcyh0aGlzLCAnR2V0IEZpbmRpbmcgRGF0YSBmcm9tIElucHV0Jywge1xuICAgICAgICBjb21tZW50OiAnRXh0cmFjdCB0b3AtbGV2ZWwgZGF0YSBuZWVkZWQgZm9yIHJlbWVkaWF0aW9uJyxcbiAgICAgICAgcGFyYW1ldGVyczoge1xuICAgICAgICAgICAgXCJFdmVudFR5cGUuJFwiOiBcIiQuZGV0YWlsLXR5cGVcIixcbiAgICAgICAgICAgIFwiRmluZGluZ3MuJFwiOiBcIiQuZGV0YWlsLmZpbmRpbmdzXCJcbiAgICAgICAgfVxuICAgIH0pXG5cbiAgICBjb25zdCByZXVzZU9yY2hMb2dHcm91cCA9IG5ldyBjZGsuQ2ZuUGFyYW1ldGVyKHRoaXMsICdSZXVzZSBMb2cgR3JvdXAnLCB7XG4gICAgICAgIHR5cGU6IFwiU3RyaW5nXCIsXG4gICAgICAgIGRlc2NyaXB0aW9uOiBgUmV1c2UgZXhpc3RpbmcgT3JjaGVzdHJhdG9yIExvZyBHcm91cD8gQ2hvb3NlIFwieWVzXCIgaWYgdGhlIGxvZyBncm91cCBhbHJlYWR5IGV4aXN0cywgZWxzZSBcIm5vXCJgLFxuICAgICAgICBkZWZhdWx0OiBcIm5vXCIsXG4gICAgICAgIGFsbG93ZWRWYWx1ZXM6IFtcInllc1wiLCBcIm5vXCJdLFxuICAgIH0pXG4gICAgcmV1c2VPcmNoTG9nR3JvdXAub3ZlcnJpZGVMb2dpY2FsSWQoYFJldXNlT3JjaGVzdHJhdG9yTG9nR3JvdXBgKVxuXG4gICAgY29uc3QgbmVzdGVkTG9nU3RhY2sgPSBuZXcgY2RrLkNmblN0YWNrKHRoaXMsIFwiTmVzdGVkTG9nU3RhY2tcIiwge1xuICAgICAgICBwYXJhbWV0ZXJzOiB7XG4gICAgICAgICAgICBLbXNLZXlBcm46IHByb3BzLmttc0tleVBhcm0uc3RyaW5nVmFsdWUsXG4gICAgICAgICAgICBSZXVzZU9yY2hlc3RyYXRvckxvZ0dyb3VwOiByZXVzZU9yY2hMb2dHcm91cC52YWx1ZUFzU3RyaW5nXG4gICAgICAgIH0sXG4gICAgICAgIHRlbXBsYXRlVXJsOiBcImh0dHBzOi8vXCIgKyBjZGsuRm4uZmluZEluTWFwKFwiU291cmNlQ29kZVwiLCBcIkdlbmVyYWxcIiwgXCJTM0J1Y2tldFwiKSArXG4gICAgICAgIFwiLXJlZmVyZW5jZS5zMy5hbWF6b25hd3MuY29tL1wiICsgY2RrLkZuLmZpbmRJbk1hcChcIlNvdXJjZUNvZGVcIiwgXCJHZW5lcmFsXCIsIFwiS2V5UHJlZml4XCIpICtcbiAgICAgICAgXCIvYXdzLXNoYXJyLW9yY2hlc3RyYXRvci1sb2cudGVtcGxhdGVcIlxuICAgIH0pXG5cbiAgICBsZXQgZ2V0RG9jU3RhdGVGdW5jOiBsYW1iZGEuSUZ1bmN0aW9uID0gbGFtYmRhLkZ1bmN0aW9uLmZyb21GdW5jdGlvbkF0dHJpYnV0ZXModGhpcywgJ2dldERvY1N0YXRlRnVuYycse1xuICAgICAgICBmdW5jdGlvbkFybjogcHJvcHMuc3NtRG9jU3RhdGVMYW1iZGFcbiAgICB9KVxuXG4gICAgbGV0IGV4ZWNSZW1lZGlhdGlvbkZ1bmM6IGxhbWJkYS5JRnVuY3Rpb24gPSBsYW1iZGEuRnVuY3Rpb24uZnJvbUZ1bmN0aW9uQXR0cmlidXRlcyh0aGlzLCAnZXhlY1JlbWVkaWF0aW9uRnVuYycse1xuICAgICAgICBmdW5jdGlvbkFybjogcHJvcHMuc3NtRXhlY0RvY0xhbWJkYVxuICAgIH0pXG5cbiAgICBsZXQgZXhlY01vbkZ1bmM6IGxhbWJkYS5JRnVuY3Rpb24gPSBsYW1iZGEuRnVuY3Rpb24uZnJvbUZ1bmN0aW9uQXR0cmlidXRlcyh0aGlzLCAnZ2V0RXhlY1N0YXR1c0Z1bmMnLHtcbiAgICAgICAgZnVuY3Rpb25Bcm46IHByb3BzLnNzbUV4ZWNNb25pdG9yTGFtYmRhXG4gICAgfSlcblxuICAgIGxldCBub3RpZnlGdW5jOiBsYW1iZGEuSUZ1bmN0aW9uID0gbGFtYmRhLkZ1bmN0aW9uLmZyb21GdW5jdGlvbkF0dHJpYnV0ZXModGhpcywgJ25vdGlmeUZ1bmMnLHtcbiAgICAgICAgZnVuY3Rpb25Bcm46IHByb3BzLm5vdGlmeUxhbWJkYVxuICAgIH0pXG5cbiAgICBsZXQgZ2V0QXBwcm92YWxSZXF1aXJlbWVudEZ1bmM6IGxhbWJkYS5JRnVuY3Rpb24gPSBsYW1iZGEuRnVuY3Rpb24uZnJvbUZ1bmN0aW9uQXR0cmlidXRlcyh0aGlzLCAnZ2V0UmVxdWlyZW1lbnRGdW5jJyx7XG4gICAgICAgIGZ1bmN0aW9uQXJuOiBwcm9wcy5nZXRBcHByb3ZhbFJlcXVpcmVtZW50TGFtYmRhXG4gICAgfSlcblxuICAgIGNvbnN0IG9yY2hlc3RyYXRvckZhaWxlZCA9IG5ldyBzZm4uUGFzcyh0aGlzLCAnT3JjaGVzdHJhdG9yIEZhaWxlZCcsIHtcbiAgICAgICAgcGFyYW1ldGVyczoge1xuICAgICAgICAgICAgXCJOb3RpZmljYXRpb25cIjoge1xuICAgICAgICAgICAgICAgIFwiTWVzc2FnZS4kXCI6IFwiU3RhdGVzLkZvcm1hdCgnT3JjaGVzdHJhdG9yIGZhaWxlZDoge30nLCAkLkVycm9yKVwiLFxuICAgICAgICAgICAgICAgIFwiU3RhdGUuJFwiOiBcIlN0YXRlcy5Gb3JtYXQoJ0xBTUJEQUVSUk9SJylcIixcbiAgICAgICAgICAgICAgICBcIkRldGFpbHMuJFwiOiBcIlN0YXRlcy5Gb3JtYXQoJ0NhdXNlOiB7fScsICQuQ2F1c2UpXCJcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBcIlBheWxvYWQuJFwiOiBcIiRcIlxuICAgICAgICB9XG4gICAgfSlcblxuICAgIGNvbnN0IGdldERvY1N0YXRlID0gbmV3IExhbWJkYUludm9rZSh0aGlzLCAnR2V0IEF1dG9tYXRpb24gRG9jdW1lbnQgU3RhdGUnLCB7XG4gICAgICAgIGNvbW1lbnQ6ICBcIkdldCB0aGUgc3RhdHVzIG9mIHRoZSByZW1lZGlhdGlvbiBhdXRvbWF0aW9uIGRvY3VtZW50IGluIHRoZSB0YXJnZXQgYWNjb3VudFwiLFxuICAgICAgICBsYW1iZGFGdW5jdGlvbjogZ2V0RG9jU3RhdGVGdW5jLFxuICAgICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24ubWludXRlcygxKSxcbiAgICAgICAgcmVzdWx0U2VsZWN0b3I6IHtcbiAgICAgICAgICAgIFwiRG9jU3RhdGUuJFwiOiBcIiQuUGF5bG9hZC5zdGF0dXNcIixcbiAgICAgICAgICAgIFwiTWVzc2FnZS4kXCI6IFwiJC5QYXlsb2FkLm1lc3NhZ2VcIixcbiAgICAgICAgICAgIFwiU2VjdXJpdHlTdGFuZGFyZC4kXCI6IFwiJC5QYXlsb2FkLnNlY3VyaXR5c3RhbmRhcmRcIixcbiAgICAgICAgICAgIFwiU2VjdXJpdHlTdGFuZGFyZFZlcnNpb24uJFwiOiBcIiQuUGF5bG9hZC5zZWN1cml0eXN0YW5kYXJkdmVyc2lvblwiLFxuICAgICAgICAgICAgXCJTZWN1cml0eVN0YW5kYXJkU3VwcG9ydGVkLiRcIjogXCIkLlBheWxvYWQuc3RhbmRhcmRzdXBwb3J0ZWRcIixcbiAgICAgICAgICAgIFwiQ29udHJvbElkLiRcIjogXCIkLlBheWxvYWQuY29udHJvbGlkXCIsXG4gICAgICAgICAgICBcIkFjY291bnRJZC4kXCI6IFwiJC5QYXlsb2FkLmFjY291bnRpZFwiLFxuICAgICAgICAgICAgXCJSZW1lZGlhdGlvblJvbGUuJFwiOiBcIiQuUGF5bG9hZC5yZW1lZGlhdGlvbnJvbGVcIixcbiAgICAgICAgICAgIFwiQXV0b21hdGlvbkRvY0lkLiRcIjogXCIkLlBheWxvYWQuYXV0b21hdGlvbmRvY2lkXCIsXG4gICAgICAgICAgICBcIlJlc291cmNlUmVnaW9uLiRcIjogXCIkLlBheWxvYWQucmVzb3VyY2VyZWdpb25cIlxuICAgICAgICB9LFxuICAgICAgICByZXN1bHRQYXRoOiBcIiQuQXV0b21hdGlvbkRvY3VtZW50XCJcbiAgICB9KVxuICAgIGdldERvY1N0YXRlLmFkZENhdGNoKG9yY2hlc3RyYXRvckZhaWxlZClcblxuICAgIGNvbnN0IGdldEFwcHJvdmFsUmVxdWlyZW1lbnQgPSBuZXcgTGFtYmRhSW52b2tlKHRoaXMsICdHZXQgUmVtZWRpYXRpb24gQXBwcm92YWwgUmVxdWlyZW1lbnQnLCB7XG4gICAgICAgIGNvbW1lbnQ6ICBcIkRldGVybWluZSB3aGV0aGVyIHRoZSBzZWxlY3RlZCByZW1lZGlhdGlvbiByZXF1aXJlcyBtYW51YWwgYXBwcm92YWxcIixcbiAgICAgICAgbGFtYmRhRnVuY3Rpb246IGdldEFwcHJvdmFsUmVxdWlyZW1lbnRGdW5jLFxuICAgICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICAgICAgcmVzdWx0U2VsZWN0b3I6IHtcbiAgICAgICAgICAgIFwiV29ya2Zsb3dEb2N1bWVudC4kXCI6IFwiJC5QYXlsb2FkLndvcmtmbG93ZG9jXCIsXG4gICAgICAgICAgICBcIldvcmtmbG93QWNjb3VudC4kXCI6IFwiJC5QYXlsb2FkLndvcmtmbG93YWNjb3VudFwiLFxuICAgICAgICAgICAgXCJXb3JrZmxvd1JvbGUuJFwiOiBcIiQuUGF5bG9hZC53b3JrZmxvd3JvbGVcIixcbiAgICAgICAgICAgIFwiV29ya2Zsb3dDb25maWcuJFwiOiBcIiQuUGF5bG9hZC53b3JrZmxvd19kYXRhXCJcbiAgICAgICAgfSxcbiAgICAgICAgcmVzdWx0UGF0aDogXCIkLldvcmtmbG93XCJcbiAgICB9KVxuICAgIGdldEFwcHJvdmFsUmVxdWlyZW1lbnQuYWRkQ2F0Y2gob3JjaGVzdHJhdG9yRmFpbGVkKVxuXG4gICAgY29uc3QgcmVtZWRpYXRlRmluZGluZyA9IG5ldyBMYW1iZGFJbnZva2UodGhpcywgJ0V4ZWN1dGUgUmVtZWRpYXRpb24nLCB7XG4gICAgICAgIGNvbW1lbnQ6IFwiRXhlY3V0ZSB0aGUgU1NNIEF1dG9tYXRpb24gRG9jdW1lbnQgaW4gdGhlIHRhcmdldCBhY2NvdW50XCIsXG4gICAgICAgIGxhbWJkYUZ1bmN0aW9uOiBleGVjUmVtZWRpYXRpb25GdW5jLFxuICAgICAgICBoZWFydGJlYXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDYwKSxcbiAgICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgICAgIHJlc3VsdFNlbGVjdG9yOiB7XG4gICAgICAgICAgICBcIkV4ZWNTdGF0ZS4kXCI6IFwiJC5QYXlsb2FkLnN0YXR1c1wiLFxuICAgICAgICAgICAgXCJNZXNzYWdlLiRcIjogXCIkLlBheWxvYWQubWVzc2FnZVwiLFxuICAgICAgICAgICAgXCJFeGVjSWQuJFwiOiBcIiQuUGF5bG9hZC5leGVjdXRpb25pZFwiLFxuICAgICAgICAgICAgXCJBY2NvdW50LiRcIjogXCIkLlBheWxvYWQuZXhlY3V0aW9uYWNjb3VudFwiLFxuICAgICAgICAgICAgXCJSZWdpb24uJFwiOiBcIiQuUGF5bG9hZC5leGVjdXRpb25yZWdpb25cIlxuICAgICAgICB9LFxuICAgICAgICByZXN1bHRQYXRoOiBcIiQuU1NNRXhlY3V0aW9uXCJcbiAgICB9KVxuICAgIHJlbWVkaWF0ZUZpbmRpbmcuYWRkQ2F0Y2gob3JjaGVzdHJhdG9yRmFpbGVkKVxuXG4gICAgY29uc3QgZXhlY01vbml0b3IgPSBuZXcgTGFtYmRhSW52b2tlKHRoaXMsICdleGVjTW9uaXRvcicsIHtcbiAgICAgICAgY29tbWVudDogXCJNb25pdG9yIHRoZSByZW1lZGlhdGlvbiBleGVjdXRpb24gdW50aWwgZG9uZVwiLFxuICAgICAgICBsYW1iZGFGdW5jdGlvbjogZXhlY01vbkZ1bmMsXG4gICAgICAgIGhlYXJ0YmVhdDogY2RrLkR1cmF0aW9uLnNlY29uZHMoNjApLFxuICAgICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICAgICAgcmVzdWx0U2VsZWN0b3I6IHtcbiAgICAgICAgICAgIFwiRXhlY1N0YXRlLiRcIjogXCIkLlBheWxvYWQuc3RhdHVzXCIsXG4gICAgICAgICAgICBcIkV4ZWNJZC4kXCI6IFwiJC5QYXlsb2FkLmV4ZWN1dGlvbmlkXCIsXG4gICAgICAgICAgICBcIlJlbWVkaWF0aW9uU3RhdGUuJFwiOiBcIiQuUGF5bG9hZC5yZW1lZGlhdGlvbl9zdGF0dXNcIixcbiAgICAgICAgICAgIFwiTWVzc2FnZS4kXCI6IFwiJC5QYXlsb2FkLm1lc3NhZ2VcIixcbiAgICAgICAgICAgIFwiTG9nRGF0YS4kXCI6IFwiJC5QYXlsb2FkLmxvZ2RhdGFcIixcbiAgICAgICAgICAgIFwiQWZmZWN0ZWRPYmplY3QuJFwiOiBcIiQuUGF5bG9hZC5hZmZlY3RlZF9vYmplY3RcIixcbiAgICAgICAgfSxcbiAgICAgICAgcmVzdWx0UGF0aDogXCIkLlJlbWVkaWF0aW9uXCJcbiAgICB9KVxuICAgIGV4ZWNNb25pdG9yLmFkZENhdGNoKG9yY2hlc3RyYXRvckZhaWxlZClcblxuICAgIGNvbnN0IG5vdGlmeSA9IG5ldyBMYW1iZGFJbnZva2UodGhpcywgJ25vdGlmeScsIHtcbiAgICAgICAgY29tbWVudDogXCJTZW5kIG5vdGlmaWNhdGlvbnNcIixcbiAgICAgICAgbGFtYmRhRnVuY3Rpb246IG5vdGlmeUZ1bmMsXG4gICAgICAgIGhlYXJ0YmVhdDogY2RrLkR1cmF0aW9uLnNlY29uZHMoNjApLFxuICAgICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24ubWludXRlcyg1KVxuICAgIH0pXG5cbiAgICBjb25zdCBub3RpZnlRdWV1ZWQgPSBuZXcgTGFtYmRhSW52b2tlKHRoaXMsICdRdWV1ZWQgTm90aWZpY2F0aW9uJywge1xuICAgICAgICBjb21tZW50OiBcIlNlbmQgbm90aWZpY2F0aW9uIHRoYXQgYSByZW1lZGlhdGlvbiBoYXMgcXVldWVkXCIsXG4gICAgICAgIGxhbWJkYUZ1bmN0aW9uOiBub3RpZnlGdW5jLFxuICAgICAgICBoZWFydGJlYXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDYwKSxcbiAgICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgICAgIHJlc3VsdFBhdGg6IFwiJC5ub3RpZmljYXRpb25SZXN1bHRcIlxuICAgIH0pXG5cbiAgICBuZXcgc2ZuLkZhaWwodGhpcywgJ0pvYiBGYWlsZWQnLCB7XG4gICAgICAgIGNhdXNlOiAnQVdTIEJhdGNoIEpvYiBGYWlsZWQnLFxuICAgICAgICBlcnJvcjogJ0Rlc2NyaWJlSm9iIHJldHVybmVkIEZBSUxFRCcsXG4gICAgfSk7XG5cbiAgICBjb25zdCBlb2ogPSBuZXcgc2ZuLlBhc3ModGhpcywgJ0VPSicsIHtcbiAgICAgICAgY29tbWVudDogJ0VORC1PRi1KT0InXG4gICAgfSlcblxuICAgIGNvbnN0IHByb2Nlc3NGaW5kaW5ncyA9IG5ldyBzZm4uTWFwKHRoaXMsICdQcm9jZXNzIEZpbmRpbmdzJywge1xuICAgICAgICBjb21tZW50OiAnUHJvY2VzcyBhbGwgZmluZGluZ3MgaW4gQ2xvdWRXYXRjaCBFdmVudCcsXG4gICAgICAgIHBhcmFtZXRlcnM6IHtcbiAgICAgICAgICAgIFwiRmluZGluZy4kXCI6IFwiJCQuTWFwLkl0ZW0uVmFsdWVcIixcbiAgICAgICAgICAgIFwiRXZlbnRUeXBlLiRcIjogXCIkLkV2ZW50VHlwZVwiXG4gICAgICAgIH0sXG4gICAgICAgIGl0ZW1zUGF0aDogJyQuRmluZGluZ3MnXG4gICAgfSlcblxuICAgIC8vIFNldCBub3RpZmljYXRpb24uIElmIHRoZSB3aGVuIGlzIG5vdCBtYXRjaGVkIHRoZW4gdGhpcyB3aWxsIGJlIHRoZSBub3RpZmljYXRpb24gc2VudFxuICAgIGNvbnN0IGNoZWNrV29ya2Zsb3dOZXcgPSBuZXcgc2ZuLkNob2ljZSh0aGlzLCAnRmluZGluZyBXb3JrZmxvdyBTdGF0ZSBORVc/JylcblxuICAgIGNvbnN0IGRvY05vdE5ldyA9IG5ldyBzZm4uUGFzcyh0aGlzLCAnRmluZGluZyBXb3JrZmxvdyBTdGF0ZSBpcyBub3QgTkVXJywge1xuICAgICAgICBwYXJhbWV0ZXJzOiB7XG4gICAgICAgICAgICBcIk5vdGlmaWNhdGlvblwiOiB7XG4gICAgICAgICAgICAgICAgXCJNZXNzYWdlLiRcIjogXCJTdGF0ZXMuRm9ybWF0KCdGaW5kaW5nIFdvcmtmbG93IFN0YXRlIGlzIG5vdCBORVcgKHt9KS4nLCAkLkZpbmRpbmcuV29ya2Zsb3cuU3RhdHVzKVwiLFxuICAgICAgICAgICAgICAgIFwiU3RhdGUuJFwiOiBcIlN0YXRlcy5Gb3JtYXQoJ05PVE5FVycpXCJcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBcIkV2ZW50VHlwZS4kXCI6IFwiJC5FdmVudFR5cGVcIixcbiAgICAgICAgICAgIFwiRmluZGluZy4kXCI6IFwiJC5GaW5kaW5nXCJcbiAgICAgICAgfVxuICAgIH0pXG5cbiAgICBjb25zdCBjaGVja0RvY1N0YXRlID0gbmV3IHNmbi5DaG9pY2UodGhpcywgJ0F1dG9tYXRpb24gRG9jIEFjdGl2ZT8nKVxuXG4gICAgY29uc3QgZG9jU3RhdGVOb3RBY3RpdmUgPSBuZXcgc2ZuLlBhc3ModGhpcywgJ0F1dG9tYXRpb24gRG9jdW1lbnQgaXMgbm90IEFjdGl2ZScsIHtcbiAgICAgICAgcGFyYW1ldGVyczoge1xuICAgICAgICAgICAgXCJOb3RpZmljYXRpb25cIjoge1xuICAgICAgICAgICAgICAgIFwiTWVzc2FnZS4kXCI6IFwiU3RhdGVzLkZvcm1hdCgnQXV0b21hdGlvbiBEb2N1bWVudCAoe30pIGlzIG5vdCBhY3RpdmUgKHt9KSBpbiB0aGUgbWVtYmVyIGFjY291bnQoe30pLicsICQuQXV0b21hdGlvbkRvY0lkLCAkLkF1dG9tYXRpb25Eb2N1bWVudC5Eb2NTdGF0ZSwgJC5GaW5kaW5nLkF3c0FjY291bnRJZClcIixcbiAgICAgICAgICAgICAgICBcIlN0YXRlLiRcIjogXCJTdGF0ZXMuRm9ybWF0KCdSRU1FRElBVElPTk5PVEFDVElWRScpXCIsXG4gICAgICAgICAgICAgICAgXCJ1cGRhdGVTZWNIdWJcIjogXCJ5ZXNcIlxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIFwiRXZlbnRUeXBlLiRcIjogXCIkLkV2ZW50VHlwZVwiLFxuICAgICAgICAgICAgXCJGaW5kaW5nLiRcIjogXCIkLkZpbmRpbmdcIixcbiAgICAgICAgICAgIFwiQWNjb3VudElkLiRcIjogXCIkLkF1dG9tYXRpb25Eb2N1bWVudC5BY2NvdW50SWRcIixcbiAgICAgICAgICAgIFwiQXV0b21hdGlvbkRvY0lkLiRcIjogXCIkLkF1dG9tYXRpb25Eb2N1bWVudC5BdXRvbWF0aW9uRG9jSWRcIixcbiAgICAgICAgICAgIFwiUmVtZWRpYXRpb25Sb2xlLiRcIjogXCIkLkF1dG9tYXRpb25Eb2N1bWVudC5SZW1lZGlhdGlvblJvbGVcIixcbiAgICAgICAgICAgIFwiQ29udHJvbElkLiRcIjogXCIkLkF1dG9tYXRpb25Eb2N1bWVudC5Db250cm9sSWRcIixcbiAgICAgICAgICAgIFwiU2VjdXJpdHlTdGFuZGFyZC4kXCI6IFwiJC5BdXRvbWF0aW9uRG9jdW1lbnQuU2VjdXJpdHlTdGFuZGFyZFwiLFxuICAgICAgICAgICAgXCJTZWN1cml0eVN0YW5kYXJkVmVyc2lvbi4kXCI6IFwiJC5BdXRvbWF0aW9uRG9jdW1lbnQuU2VjdXJpdHlTdGFuZGFyZFZlcnNpb25cIlxuICAgICAgICB9XG4gICAgfSlcblxuICAgIGNvbnN0IGNvbnRyb2xOb1JlbWVkaWF0aW9uID0gbmV3IHNmbi5QYXNzKHRoaXMsICdObyBSZW1lZGlhdGlvbiBmb3IgQ29udHJvbCcsIHtcbiAgICAgICAgcGFyYW1ldGVyczoge1xuICAgICAgICAgICAgXCJOb3RpZmljYXRpb25cIjoge1xuICAgICAgICAgICAgICAgIFwiTWVzc2FnZS4kXCI6IFwiU3RhdGVzLkZvcm1hdCgnU2VjdXJpdHkgU3RhbmRhcmQge30gdnt9IGNvbnRyb2wge30gaGFzIG5vIGF1dG9tYXRlZCByZW1lZGlhdGlvbi4nLCAkLkF1dG9tYXRpb25Eb2N1bWVudC5TZWN1cml0eVN0YW5kYXJkLCAkLkF1dG9tYXRpb25Eb2N1bWVudC5TZWN1cml0eVN0YW5kYXJkVmVyc2lvbiwgJC5BdXRvbWF0aW9uRG9jdW1lbnQuQ29udHJvbElkKVwiLFxuICAgICAgICAgICAgICAgIFwiU3RhdGUuJFwiOiBcIlN0YXRlcy5Gb3JtYXQoJ05PUkVNRURJQVRJT04nKVwiLFxuICAgICAgICAgICAgICAgIFwidXBkYXRlU2VjSHViXCI6IFwieWVzXCJcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBcIkV2ZW50VHlwZS4kXCI6IFwiJC5FdmVudFR5cGVcIixcbiAgICAgICAgICAgIFwiRmluZGluZy4kXCI6IFwiJC5GaW5kaW5nXCIsXG4gICAgICAgICAgICBcIkFjY291bnRJZC4kXCI6IFwiJC5BdXRvbWF0aW9uRG9jdW1lbnQuQWNjb3VudElkXCIsXG4gICAgICAgICAgICBcIkF1dG9tYXRpb25Eb2NJZC4kXCI6IFwiJC5BdXRvbWF0aW9uRG9jdW1lbnQuQXV0b21hdGlvbkRvY0lkXCIsXG4gICAgICAgICAgICBcIlJlbWVkaWF0aW9uUm9sZS4kXCI6IFwiJC5BdXRvbWF0aW9uRG9jdW1lbnQuUmVtZWRpYXRpb25Sb2xlXCIsXG4gICAgICAgICAgICBcIkNvbnRyb2xJZC4kXCI6IFwiJC5BdXRvbWF0aW9uRG9jdW1lbnQuQ29udHJvbElkXCIsXG4gICAgICAgICAgICBcIlNlY3VyaXR5U3RhbmRhcmQuJFwiOiBcIiQuQXV0b21hdGlvbkRvY3VtZW50LlNlY3VyaXR5U3RhbmRhcmRcIixcbiAgICAgICAgICAgIFwiU2VjdXJpdHlTdGFuZGFyZFZlcnNpb24uJFwiOiBcIiQuQXV0b21hdGlvbkRvY3VtZW50LlNlY3VyaXR5U3RhbmRhcmRWZXJzaW9uXCJcbiAgICAgICAgfVxuICAgIH0pXG5cbiAgICBjb25zdCBzdGFuZGFyZE5vdEVuYWJsZWQgPSBuZXcgc2ZuLlBhc3ModGhpcywgJ1NlY3VyaXR5IFN0YW5kYXJkIGlzIG5vdCBlbmFibGVkJywge1xuICAgICAgICBwYXJhbWV0ZXJzOiB7XG4gICAgICAgICAgICBcIk5vdGlmaWNhdGlvblwiOiB7XG4gICAgICAgICAgICAgICAgXCJNZXNzYWdlLiRcIjogXCJTdGF0ZXMuRm9ybWF0KCdTZWN1cml0eSBTdGFuZGFyZCAoe30pIHZ7fSBpcyBub3QgZW5hYmxlZC4nLCAkLkF1dG9tYXRpb25Eb2N1bWVudC5TZWN1cml0eVN0YW5kYXJkLCAkLkF1dG9tYXRpb25Eb2N1bWVudC5TZWN1cml0eVN0YW5kYXJkVmVyc2lvbilcIixcbiAgICAgICAgICAgICAgICBcIlN0YXRlLiRcIjogXCJTdGF0ZXMuRm9ybWF0KCdTVEFOREFSRE5PVEVOQUJMRUQnKVwiLFxuICAgICAgICAgICAgICAgIFwidXBkYXRlU2VjSHViXCI6IFwieWVzXCJcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBcIkV2ZW50VHlwZS4kXCI6IFwiJC5FdmVudFR5cGVcIixcbiAgICAgICAgICAgIFwiRmluZGluZy4kXCI6IFwiJC5GaW5kaW5nXCIsXG4gICAgICAgICAgICBcIkFjY291bnRJZC4kXCI6IFwiJC5BdXRvbWF0aW9uRG9jdW1lbnQuQWNjb3VudElkXCIsXG4gICAgICAgICAgICBcIkF1dG9tYXRpb25Eb2NJZC4kXCI6IFwiJC5BdXRvbWF0aW9uRG9jdW1lbnQuQXV0b21hdGlvbkRvY0lkXCIsXG4gICAgICAgICAgICBcIlJlbWVkaWF0aW9uUm9sZS4kXCI6IFwiJC5BdXRvbWF0aW9uRG9jdW1lbnQuUmVtZWRpYXRpb25Sb2xlXCIsXG4gICAgICAgICAgICBcIkNvbnRyb2xJZC4kXCI6IFwiJC5BdXRvbWF0aW9uRG9jdW1lbnQuQ29udHJvbElkXCIsXG4gICAgICAgICAgICBcIlNlY3VyaXR5U3RhbmRhcmQuJFwiOiBcIiQuQXV0b21hdGlvbkRvY3VtZW50LlNlY3VyaXR5U3RhbmRhcmRcIixcbiAgICAgICAgICAgIFwiU2VjdXJpdHlTdGFuZGFyZFZlcnNpb24uJFwiOiBcIiQuQXV0b21hdGlvbkRvY3VtZW50LlNlY3VyaXR5U3RhbmRhcmRWZXJzaW9uXCJcbiAgICAgICAgfVxuICAgIH0pXG5cbiAgICBjb25zdCBkb2NTdGF0ZUVycm9yID0gbmV3IHNmbi5QYXNzKHRoaXMsICdjaGVja19zc21fZG9jX3N0YXRlIEVycm9yJywge1xuICAgICAgICBwYXJhbWV0ZXJzOiB7XG4gICAgICAgICAgICBcIk5vdGlmaWNhdGlvblwiOiB7XG4gICAgICAgICAgICAgICAgXCJNZXNzYWdlLiRcIjogXCJTdGF0ZXMuRm9ybWF0KCdjaGVja19zc21fZG9jX3N0YXRlIHJldHVybmVkIGFuIGVycm9yOiB7fScsICQuQXV0b21hdGlvbkRvY3VtZW50Lk1lc3NhZ2UpXCIsXG4gICAgICAgICAgICAgICAgXCJTdGF0ZS4kXCI6IFwiU3RhdGVzLkZvcm1hdCgnTEFNQkRBRVJST1InKVwiXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgXCJFdmVudFR5cGUuJFwiOiBcIiQuRXZlbnRUeXBlXCIsXG4gICAgICAgICAgICBcIkZpbmRpbmcuJFwiOiBcIiQuRmluZGluZ1wiXG4gICAgICAgIH1cbiAgICB9KVxuXG4gICAgY29uc3QgaXNkb25lID0gbmV3IHNmbi5DaG9pY2UodGhpcywgJ1JlbWVkaWF0aW9uIGNvbXBsZXRlZD8nKVxuXG4gICAgY29uc3Qgd2FpdEZvclJlbWVkaWF0aW9uID0gbmV3IHNmbi5XYWl0KHRoaXMsICdXYWl0IGZvciBSZW1lZGlhdGlvbicsIHtcbiAgICAgICAgdGltZTogc2ZuLldhaXRUaW1lLmR1cmF0aW9uKGNkay5EdXJhdGlvbi5zZWNvbmRzKDE1KSlcbiAgICB9KVxuXG4gICAgY29uc3QgcmVtZWRpYXRpb25GYWlsZWQgPSBuZXcgc2ZuLlBhc3ModGhpcywgJ1JlbWVkaWF0aW9uIEZhaWxlZCcsIHtcbiAgICAgICAgY29tbWVudDogJ1NldCBwYXJhbWV0ZXJzIGZvciBub3RpZmljYXRpb24nLFxuICAgICAgICBwYXJhbWV0ZXJzOiB7XG4gICAgICAgICAgICBcIkV2ZW50VHlwZS4kXCI6IFwiJC5FdmVudFR5cGVcIixcbiAgICAgICAgICAgIFwiRmluZGluZy4kXCI6IFwiJC5GaW5kaW5nXCIsXG4gICAgICAgICAgICBcIlNTTUV4ZWN1dGlvbi4kXCI6IFwiJC5TU01FeGVjdXRpb25cIixcbiAgICAgICAgICAgIFwiQXV0b21hdGlvbkRvY3VtZW50LiRcIjogXCIkLkF1dG9tYXRpb25Eb2N1bWVudFwiLFxuICAgICAgICAgICAgXCJOb3RpZmljYXRpb25cIjoge1xuICAgICAgICAgICAgICAgIFwiTWVzc2FnZS4kXCI6IFwiU3RhdGVzLkZvcm1hdCgnUmVtZWRpYXRpb24gZmFpbGVkIGZvciB7fSBjb250cm9sIHt9IGluIGFjY291bnQge306IHt9JywgJC5BdXRvbWF0aW9uRG9jdW1lbnQuU2VjdXJpdHlTdGFuZGFyZCwgJC5BdXRvbWF0aW9uRG9jdW1lbnQuQ29udHJvbElkLCAkLkF1dG9tYXRpb25Eb2N1bWVudC5BY2NvdW50SWQsICQuUmVtZWRpYXRpb24uTWVzc2FnZSlcIixcbiAgICAgICAgICAgICAgICBcIlN0YXRlLiRcIjogXCIkLlJlbWVkaWF0aW9uLkV4ZWNTdGF0ZVwiLFxuICAgICAgICAgICAgICAgIFwiRGV0YWlscy4kXCI6IFwiJC5SZW1lZGlhdGlvbi5Mb2dEYXRhXCIsXG4gICAgICAgICAgICAgICAgXCJFeGVjSWQuJFwiOiBcIiQuUmVtZWRpYXRpb24uRXhlY0lkXCIsXG4gICAgICAgICAgICAgICAgXCJBZmZlY3RlZE9iamVjdC4kXCI6IFwiJC5SZW1lZGlhdGlvbi5BZmZlY3RlZE9iamVjdFwiLFxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSlcblxuICAgIGNvbnN0IHJlbWVkaWF0aW9uU3VjY2VlZGVkID0gbmV3IHNmbi5QYXNzKHRoaXMsICdSZW1lZGlhdGlvbiBTdWNjZWVkZWQnLCB7XG4gICAgICAgIGNvbW1lbnQ6ICdTZXQgcGFyYW1ldGVycyBmb3Igbm90aWZpY2F0aW9uJyxcbiAgICAgICAgcGFyYW1ldGVyczoge1xuICAgICAgICAgICAgXCJFdmVudFR5cGUuJFwiOiBcIiQuRXZlbnRUeXBlXCIsXG4gICAgICAgICAgICBcIkZpbmRpbmcuJFwiOiBcIiQuRmluZGluZ1wiLFxuICAgICAgICAgICAgXCJBY2NvdW50SWQuJFwiOiBcIiQuQXV0b21hdGlvbkRvY3VtZW50LkFjY291bnRJZFwiLFxuICAgICAgICAgICAgXCJBdXRvbWF0aW9uRG9jSWQuJFwiOiBcIiQuQXV0b21hdGlvbkRvY3VtZW50LkF1dG9tYXRpb25Eb2NJZFwiLFxuICAgICAgICAgICAgXCJSZW1lZGlhdGlvblJvbGUuJFwiOiBcIiQuQXV0b21hdGlvbkRvY3VtZW50LlJlbWVkaWF0aW9uUm9sZVwiLFxuICAgICAgICAgICAgXCJDb250cm9sSWQuJFwiOiBcIiQuQXV0b21hdGlvbkRvY3VtZW50LkNvbnRyb2xJZFwiLFxuICAgICAgICAgICAgXCJTZWN1cml0eVN0YW5kYXJkLiRcIjogXCIkLkF1dG9tYXRpb25Eb2N1bWVudC5TZWN1cml0eVN0YW5kYXJkXCIsXG4gICAgICAgICAgICBcIlNlY3VyaXR5U3RhbmRhcmRWZXJzaW9uLiRcIjogXCIkLkF1dG9tYXRpb25Eb2N1bWVudC5TZWN1cml0eVN0YW5kYXJkVmVyc2lvblwiLFxuICAgICAgICAgICAgXCJOb3RpZmljYXRpb25cIjoge1xuICAgICAgICAgICAgICAgIFwiTWVzc2FnZS4kXCI6IFwiU3RhdGVzLkZvcm1hdCgnUmVtZWRpYXRpb24gc3VjY2VlZGVkIGZvciB7fSBjb250cm9sIHt9IGluIGFjY291bnQge306IHt9JywgJC5BdXRvbWF0aW9uRG9jdW1lbnQuU2VjdXJpdHlTdGFuZGFyZCwgJC5BdXRvbWF0aW9uRG9jdW1lbnQuQ29udHJvbElkLCAkLkF1dG9tYXRpb25Eb2N1bWVudC5BY2NvdW50SWQsICQuUmVtZWRpYXRpb24uTWVzc2FnZSlcIixcbiAgICAgICAgICAgICAgICBcIlN0YXRlLiRcIjogXCJTdGF0ZXMuRm9ybWF0KCdTVUNDRVNTJylcIixcbiAgICAgICAgICAgICAgICBcIkRldGFpbHMuJFwiOiBcIiQuUmVtZWRpYXRpb24uTG9nRGF0YVwiLFxuICAgICAgICAgICAgICAgIFwiRXhlY0lkLiRcIjogXCIkLlJlbWVkaWF0aW9uLkV4ZWNJZFwiLFxuICAgICAgICAgICAgICAgIFwiQWZmZWN0ZWRPYmplY3QuJFwiOiBcIiQuUmVtZWRpYXRpb24uQWZmZWN0ZWRPYmplY3RcIixcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0pXG5cbiAgICBjb25zdCByZW1lZGlhdGlvblF1ZXVlZCA9IG5ldyBzZm4uUGFzcyh0aGlzLCAnUmVtZWRpYXRpb24gUXVldWVkJywge1xuICAgICAgICBjb21tZW50OiAnU2V0IHBhcmFtZXRlcnMgZm9yIG5vdGlmaWNhdGlvbicsXG4gICAgICAgIHBhcmFtZXRlcnM6IHtcbiAgICAgICAgICAgIFwiRXZlbnRUeXBlLiRcIjogXCIkLkV2ZW50VHlwZVwiLFxuICAgICAgICAgICAgXCJGaW5kaW5nLiRcIjogXCIkLkZpbmRpbmdcIixcbiAgICAgICAgICAgIFwiQXV0b21hdGlvbkRvY3VtZW50LiRcIjogXCIkLkF1dG9tYXRpb25Eb2N1bWVudFwiLFxuICAgICAgICAgICAgXCJTU01FeGVjdXRpb24uJFwiOiBcIiQuU1NNRXhlY3V0aW9uXCIsXG4gICAgICAgICAgICBcIk5vdGlmaWNhdGlvblwiOiB7XG4gICAgICAgICAgICAgICAgXCJNZXNzYWdlLiRcIjogXCJTdGF0ZXMuRm9ybWF0KCdSZW1lZGlhdGlvbiBxdWV1ZWQgZm9yIHt9IGNvbnRyb2wge30gaW4gYWNjb3VudCB7fScsICQuQXV0b21hdGlvbkRvY3VtZW50LlNlY3VyaXR5U3RhbmRhcmQsICQuQXV0b21hdGlvbkRvY3VtZW50LkNvbnRyb2xJZCwgJC5BdXRvbWF0aW9uRG9jdW1lbnQuQWNjb3VudElkKVwiLFxuICAgICAgICAgICAgICAgIFwiU3RhdGUuJFwiOiBcIlN0YXRlcy5Gb3JtYXQoJ1FVRVVFRCcpXCIsXG4gICAgICAgICAgICAgICAgXCJFeGVjSWQuJFwiOiBcIiQuU1NNRXhlY3V0aW9uLkV4ZWNJZFwiXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9KVxuXG4gICAgLy8tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgIC8vIFN0YXRlIE1hY2hpbmVcbiAgICAvL1xuICAgIGV4dHJhY3RGaW5kaW5ncy5uZXh0KHByb2Nlc3NGaW5kaW5ncylcblxuICAgIGNoZWNrV29ya2Zsb3dOZXcud2hlbihcbiAgICAgICAgc2ZuLkNvbmRpdGlvbi5vcihcbiAgICAgICAgICAgIHNmbi5Db25kaXRpb24uc3RyaW5nRXF1YWxzKFxuICAgICAgICAgICAgICAgICckLkV2ZW50VHlwZScsXG4gICAgICAgICAgICAgICAgJ1NlY3VyaXR5IEh1YiBGaW5kaW5ncyAtIEN1c3RvbSBBY3Rpb24nXG4gICAgICAgICAgICApLFxuICAgICAgICAgICAgc2ZuLkNvbmRpdGlvbi5hbmQoXG4gICAgICAgICAgICAgICAgc2ZuLkNvbmRpdGlvbi5zdHJpbmdFcXVhbHMoXG4gICAgICAgICAgICAgICAgICAgICckLkZpbmRpbmcuV29ya2Zsb3cuU3RhdHVzJyxcbiAgICAgICAgICAgICAgICAgICAgJ05FVydcbiAgICAgICAgICAgICAgICApLFxuICAgICAgICAgICAgICAgIHNmbi5Db25kaXRpb24uc3RyaW5nRXF1YWxzKFxuICAgICAgICAgICAgICAgICAgICAnJC5FdmVudFR5cGUnLFxuICAgICAgICAgICAgICAgICAgICAnU2VjdXJpdHkgSHViIEZpbmRpbmdzIC0gSW1wb3J0ZWQnXG4gICAgICAgICAgICAgICAgKSxcbiAgICAgICAgICAgIClcbiAgICAgICAgKSxcbiAgICAgICAgZ2V0QXBwcm92YWxSZXF1aXJlbWVudFxuICAgIClcbiAgICBjaGVja1dvcmtmbG93TmV3Lm90aGVyd2lzZShkb2NOb3ROZXcpXG5cbiAgICBkb2NOb3ROZXcubmV4dChub3RpZnkpXG5cbiAgICAvLyBDYWxsIExhbWJkYSB0byBnZXQgc3RhdHVzIG9mIHRoZSBhdXRvbWF0aW9uIGRvY3VtZW50IGluIHRoZSB0YXJnZXQgYWNjb3VudFxuICAgIGdldERvY1N0YXRlLm5leHQoY2hlY2tEb2NTdGF0ZSlcblxuICAgIGdldEFwcHJvdmFsUmVxdWlyZW1lbnQubmV4dChnZXREb2NTdGF0ZSlcblxuICAgIGNoZWNrRG9jU3RhdGUud2hlbihcbiAgICAgICAgc2ZuLkNvbmRpdGlvbi5zdHJpbmdFcXVhbHMoXG4gICAgICAgICAgICAnJC5BdXRvbWF0aW9uRG9jdW1lbnQuRG9jU3RhdGUnLFxuICAgICAgICAgICAgJ0FDVElWRScpLFxuICAgICAgICByZW1lZGlhdGVGaW5kaW5nXG4gICAgKVxuICAgIGNoZWNrRG9jU3RhdGUud2hlbihcbiAgICAgICAgc2ZuLkNvbmRpdGlvbi5zdHJpbmdFcXVhbHMoXG4gICAgICAgICAgICAnJC5BdXRvbWF0aW9uRG9jdW1lbnQuRG9jU3RhdGUnLFxuICAgICAgICAgICAgJ05PVEFDVElWRScpLFxuICAgICAgICBkb2NTdGF0ZU5vdEFjdGl2ZVxuICAgIClcbiAgICBjaGVja0RvY1N0YXRlLndoZW4oXG4gICAgICAgIHNmbi5Db25kaXRpb24uc3RyaW5nRXF1YWxzKFxuICAgICAgICAgICAgJyQuQXV0b21hdGlvbkRvY3VtZW50LkRvY1N0YXRlJyxcbiAgICAgICAgICAgICdOT1RFTkFCTEVEJyksXG4gICAgICAgIHN0YW5kYXJkTm90RW5hYmxlZFxuICAgIClcbiAgICBjaGVja0RvY1N0YXRlLndoZW4oXG4gICAgICAgIHNmbi5Db25kaXRpb24uc3RyaW5nRXF1YWxzKFxuICAgICAgICAgICAgJyQuQXV0b21hdGlvbkRvY3VtZW50LkRvY1N0YXRlJyxcbiAgICAgICAgICAgICdOT1RGT1VORCcpLFxuICAgICAgICBjb250cm9sTm9SZW1lZGlhdGlvblxuICAgIClcbiAgICBjaGVja0RvY1N0YXRlLm90aGVyd2lzZShkb2NTdGF0ZUVycm9yKVxuXG4gICAgZG9jU3RhdGVOb3RBY3RpdmUubmV4dChub3RpZnkpXG5cbiAgICBzdGFuZGFyZE5vdEVuYWJsZWQubmV4dChub3RpZnkpXG5cbiAgICBjb250cm9sTm9SZW1lZGlhdGlvbi5uZXh0KG5vdGlmeSlcblxuICAgIGRvY1N0YXRlRXJyb3IubmV4dChub3RpZnkpXG5cbiAgICAvLyBFeGVjdXRlIHRoZSByZW1lZGlhdGlvblxuICAgIC8vIHJlbWVkaWF0ZUZpbmRpbmcubmV4dChleGVjTW9uaXRvcilcblxuICAgIC8vIFNlbmQgYSBub3RpZmljYXRpb25cbiAgICByZW1lZGlhdGVGaW5kaW5nLm5leHQocmVtZWRpYXRpb25RdWV1ZWQpXG5cbiAgICByZW1lZGlhdGlvblF1ZXVlZC5uZXh0KG5vdGlmeVF1ZXVlZClcblxuICAgIG5vdGlmeVF1ZXVlZC5uZXh0KGV4ZWNNb25pdG9yKVxuXG4gICAgZXhlY01vbml0b3IubmV4dChpc2RvbmUpXG5cbiAgICBpc2RvbmUud2hlbihcbiAgICAgICAgc2ZuLkNvbmRpdGlvbi5zdHJpbmdFcXVhbHMoXG4gICAgICAgICAgICAnJC5SZW1lZGlhdGlvbi5SZW1lZGlhdGlvblN0YXRlJyxcbiAgICAgICAgICAgICdGYWlsZWQnXG4gICAgICAgICAgICApLFxuICAgICAgICByZW1lZGlhdGlvbkZhaWxlZFxuICAgIClcbiAgICBpc2RvbmUud2hlbihcbiAgICAgICAgc2ZuLkNvbmRpdGlvbi5zdHJpbmdFcXVhbHMoXG4gICAgICAgICAgICAnJC5SZW1lZGlhdGlvbi5FeGVjU3RhdGUnLFxuICAgICAgICAgICAgJ1N1Y2Nlc3MnKSxcbiAgICAgICAgcmVtZWRpYXRpb25TdWNjZWVkZWRcbiAgICApXG4gICAgaXNkb25lLndoZW4oXG4gICAgICAgIHNmbi5Db25kaXRpb24uc3RyaW5nRXF1YWxzKFxuICAgICAgICAgICAgJyQuUmVtZWRpYXRpb24uRXhlY1N0YXRlJyxcbiAgICAgICAgICAgICdUaW1lZE91dCcpLFxuICAgICAgICByZW1lZGlhdGlvbkZhaWxlZFxuICAgIClcbiAgICBpc2RvbmUud2hlbihcbiAgICAgICAgc2ZuLkNvbmRpdGlvbi5zdHJpbmdFcXVhbHMoXG4gICAgICAgICAgICAnJC5SZW1lZGlhdGlvbi5FeGVjU3RhdGUnLFxuICAgICAgICAgICAgJ0NhbmNlbGxpbmcnKSxcbiAgICAgICAgcmVtZWRpYXRpb25GYWlsZWRcbiAgICApXG4gICAgaXNkb25lLndoZW4oXG4gICAgICAgIHNmbi5Db25kaXRpb24uc3RyaW5nRXF1YWxzKFxuICAgICAgICAgICAgJyQuUmVtZWRpYXRpb24uRXhlY1N0YXRlJyxcbiAgICAgICAgICAgICdDYW5jZWxsZWQnKSxcbiAgICAgICAgcmVtZWRpYXRpb25GYWlsZWRcbiAgICApXG4gICAgaXNkb25lLndoZW4oXG4gICAgICAgIHNmbi5Db25kaXRpb24uc3RyaW5nRXF1YWxzKFxuICAgICAgICAgICAgJyQuUmVtZWRpYXRpb24uRXhlY1N0YXRlJyxcbiAgICAgICAgICAgICdGYWlsZWQnKSxcbiAgICAgICAgcmVtZWRpYXRpb25GYWlsZWRcbiAgICApXG4gICAgaXNkb25lLm90aGVyd2lzZSh3YWl0Rm9yUmVtZWRpYXRpb24pXG5cbiAgICB3YWl0Rm9yUmVtZWRpYXRpb24ubmV4dChleGVjTW9uaXRvcilcblxuICAgIG9yY2hlc3RyYXRvckZhaWxlZC5uZXh0KG5vdGlmeSlcblxuICAgIHJlbWVkaWF0aW9uRmFpbGVkLm5leHQobm90aWZ5KVxuXG4gICAgcmVtZWRpYXRpb25TdWNjZWVkZWQubmV4dChub3RpZnkpXG5cbiAgICBwcm9jZXNzRmluZGluZ3MuaXRlcmF0b3IoY2hlY2tXb3JrZmxvd05ldykubmV4dChlb2opO1xuXG4gICAgY29uc3Qgb3JjaGVzdHJhdG9yUG9saWN5ID0gbmV3IFBvbGljeURvY3VtZW50KCk7XG4gICAgb3JjaGVzdHJhdG9yUG9saWN5LmFkZFN0YXRlbWVudHMoXG4gICAgICAgIG5ldyBQb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICAgICAgYWN0aW9uczogW1xuICAgICAgICAgICAgICAgIFwibG9nczpDcmVhdGVMb2dEZWxpdmVyeVwiLFxuICAgICAgICAgICAgICAgIFwibG9nczpHZXRMb2dEZWxpdmVyeVwiLFxuICAgICAgICAgICAgICAgIFwibG9nczpVcGRhdGVMb2dEZWxpdmVyeVwiLFxuICAgICAgICAgICAgICAgIFwibG9nczpEZWxldGVMb2dEZWxpdmVyeVwiLFxuICAgICAgICAgICAgICAgIFwibG9nczpMaXN0TG9nRGVsaXZlcmllc1wiLFxuICAgICAgICAgICAgICAgIFwibG9nczpQdXRSZXNvdXJjZVBvbGljeVwiLFxuICAgICAgICAgICAgICAgIFwibG9nczpEZXNjcmliZVJlc291cmNlUG9saWNpZXNcIixcbiAgICAgICAgICAgICAgICBcImxvZ3M6RGVzY3JpYmVMb2dHcm91cHNcIlxuICAgICAgICAgICAgXSxcbiAgICAgICAgICAgIGVmZmVjdDogRWZmZWN0LkFMTE9XLFxuICAgICAgICAgICAgcmVzb3VyY2VzOiBbICcqJyBdXG4gICAgICAgIH0pXG4gICAgKVxuICAgIG9yY2hlc3RyYXRvclBvbGljeS5hZGRTdGF0ZW1lbnRzKFxuICAgICAgICBuZXcgUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgICAgIGFjdGlvbnM6IFsgXCJsYW1iZGE6SW52b2tlRnVuY3Rpb25cIiBdLFxuICAgICAgICAgICAgZWZmZWN0OiBFZmZlY3QuQUxMT1csXG4gICAgICAgICAgICByZXNvdXJjZXM6IFtcbiAgICAgICAgICAgICAgICBgYXJuOiR7c3RhY2sucGFydGl0aW9ufTpsYW1iZGE6JHtzdGFjay5yZWdpb259OiR7c3RhY2suYWNjb3VudH06ZnVuY3Rpb246JHtnZXREb2NTdGF0ZUZ1bmMuZnVuY3Rpb25OYW1lfWAsXG4gICAgICAgICAgICAgICAgYGFybjoke3N0YWNrLnBhcnRpdGlvbn06bGFtYmRhOiR7c3RhY2sucmVnaW9ufToke3N0YWNrLmFjY291bnR9OmZ1bmN0aW9uOiR7ZXhlY1JlbWVkaWF0aW9uRnVuYy5mdW5jdGlvbk5hbWV9YCxcbiAgICAgICAgICAgICAgICBgYXJuOiR7c3RhY2sucGFydGl0aW9ufTpsYW1iZGE6JHtzdGFjay5yZWdpb259OiR7c3RhY2suYWNjb3VudH06ZnVuY3Rpb246JHtleGVjTW9uRnVuYy5mdW5jdGlvbk5hbWV9YCxcbiAgICAgICAgICAgICAgICBgYXJuOiR7c3RhY2sucGFydGl0aW9ufTpsYW1iZGE6JHtzdGFjay5yZWdpb259OiR7c3RhY2suYWNjb3VudH06ZnVuY3Rpb246JHtub3RpZnlGdW5jLmZ1bmN0aW9uTmFtZX1gLFxuICAgICAgICAgICAgICAgIGBhcm46JHtzdGFjay5wYXJ0aXRpb259OmxhbWJkYToke3N0YWNrLnJlZ2lvbn06JHtzdGFjay5hY2NvdW50fTpmdW5jdGlvbjoke2dldEFwcHJvdmFsUmVxdWlyZW1lbnRGdW5jLmZ1bmN0aW9uTmFtZX1gXG4gICAgICAgICAgICBdXG4gICAgICAgIH0pXG4gICAgKVxuICAgIG9yY2hlc3RyYXRvclBvbGljeS5hZGRTdGF0ZW1lbnRzKFxuICAgICAgICBuZXcgUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgICAgICAgICBcImttczpFbmNyeXB0XCIsXG4gICAgICAgICAgICAgICAgXCJrbXM6RGVjcnlwdFwiLFxuICAgICAgICAgICAgICAgIFwia21zOkdlbmVyYXRlRGF0YUtleVwiXG4gICAgICAgICAgICBdLFxuICAgICAgICAgICAgZWZmZWN0OiBFZmZlY3QuQUxMT1csXG4gICAgICAgICAgICByZXNvdXJjZXM6IFtcbiAgICAgICAgICAgICAgICBgYXJuOiR7c3RhY2sucGFydGl0aW9ufTprbXM6JHtzdGFjay5yZWdpb259OiR7c3RhY2suYWNjb3VudH06YWxpYXMvJHtSRVNPVVJDRV9QUkVGSVh9LVNIQVJSLUtleWBcbiAgICAgICAgICAgIF1cbiAgICAgICAgfSlcbiAgICApXG5cbiAgICBjb25zdCBwcmluY2lwYWwgPSBuZXcgU2VydmljZVByaW5jaXBhbChgc3RhdGVzLmFtYXpvbmF3cy5jb21gKTtcbiAgICBjb25zdCBvcmNoZXN0cmF0b3JSb2xlID0gbmV3IFJvbGUodGhpcywgJ1JvbGUnLCB7XG4gICAgICAgIGFzc3VtZWRCeTogcHJpbmNpcGFsLFxuICAgICAgICBpbmxpbmVQb2xpY2llczoge1xuICAgICAgICAgICAgJ0Jhc2VQb2xpY3knOiBvcmNoZXN0cmF0b3JQb2xpY3lcbiAgICAgICAgfVxuICAgIH0pO1xuICAgIG9yY2hlc3RyYXRvclJvbGUuYXBwbHlSZW1vdmFsUG9saWN5KGNkay5SZW1vdmFsUG9saWN5LlJFVEFJTilcblxuICAgIHtcbiAgICAgICAgbGV0IGNoaWxkVG9Nb2QgPSBvcmNoZXN0cmF0b3JSb2xlLm5vZGUuZGVmYXVsdENoaWxkIGFzIENmblJvbGVcbiAgICAgICAgY2hpbGRUb01vZC5jZm5PcHRpb25zLm1ldGFkYXRhID0ge1xuICAgICAgICAgICAgY2ZuX25hZzoge1xuICAgICAgICAgICAgICAgIHJ1bGVzX3RvX3N1cHByZXNzOiBbe1xuICAgICAgICAgICAgICAgICAgICBpZDogJ1cxMScsXG4gICAgICAgICAgICAgICAgICAgIHJlYXNvbjogJ0Nsb3VkV2F0Y2ggTG9ncyBwZXJtaXNzaW9ucyByZXF1aXJlIHJlc291cmNlICogZXhjZXB0IGZvciBEZXNjcmliZUxvZ0dyb3VwcywgZXhjZXB0IGZvciBHb3ZDbG91ZCwgd2hpY2ggb25seSB3b3JrcyB3aXRoIHJlc291cmNlIConXG4gICAgICAgICAgICAgICAgfV1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICBjZGtfbmFnLk5hZ1N1cHByZXNzaW9ucy5hZGRSZXNvdXJjZVN1cHByZXNzaW9ucyhvcmNoZXN0cmF0b3JSb2xlLCBbXG4gICAgICAgIHtpZDogJ0F3c1NvbHV0aW9ucy1JQU01JywgcmVhc29uOiAnQ2xvdWRXYXRjaCBMb2dzIHBlcm1pc3Npb25zIHJlcXVpcmUgcmVzb3VyY2UgKiBleGNlcHQgZm9yIERlc2NyaWJlTG9nR3JvdXBzLCBleGNlcHQgZm9yIEdvdkNsb3VkLCB3aGljaCBvbmx5IHdvcmtzIHdpdGggcmVzb3VyY2UgKid9XG4gICAgXSk7XG5cbiAgICBjb25zdCBvcmNoZXN0cmF0b3JTdGF0ZU1hY2hpbmUgPSBuZXcgc2ZuLlN0YXRlTWFjaGluZSh0aGlzLCAnU3RhdGVNYWNoaW5lJywge1xuICAgICAgICBkZWZpbml0aW9uOiBleHRyYWN0RmluZGluZ3MsXG4gICAgICAgIHN0YXRlTWFjaGluZU5hbWU6IGAke1JFU09VUkNFX1BSRUZJWH0tU0hBUlItT3JjaGVzdHJhdG9yYCxcbiAgICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoMTUpLFxuICAgICAgICByb2xlOiBvcmNoZXN0cmF0b3JSb2xlXG4gICAgfSk7XG5cbiAgICBuZXcgU3RyaW5nUGFyYW1ldGVyKHRoaXMsICdTSEFSUl9PcmNoZXN0cmF0b3JfQXJuJywge1xuICAgICAgICBkZXNjcmlwdGlvbjogJ0FybiBvZiB0aGUgU0hBUlIgT3JjaGVzdHJhdG9yIFN0ZXAgRnVuY3Rpb24uIFRoaXMgc3RlcCBmdW5jdGlvbiByb3V0ZXMgZmluZGluZ3MgdG8gcmVtZWRpYXRpb24gcnVuYm9va3MuJyxcbiAgICAgICAgcGFyYW1ldGVyTmFtZTogJy9Tb2x1dGlvbnMvJyArIFJFU09VUkNFX1BSRUZJWCArICcvT3JjaGVzdHJhdG9yQXJuJyxcbiAgICAgICAgc3RyaW5nVmFsdWU6IG9yY2hlc3RyYXRvclN0YXRlTWFjaGluZS5zdGF0ZU1hY2hpbmVBcm5cbiAgICB9KTtcblxuICAgIC8vIFRoZSBhcm4gZm9yIHRoZSBDbG91ZFdhdGNoIGxvZ3MgZ3JvdXAgd2lsbCBiZSB0aGUgc2FtZSwgcmVnYXJkbGVzcyBvZiBlbmNyeXB0aW9uIG9yIG5vdCxcbiAgICAvLyByZWdhcmRsZXNzIG9mIHJldXNlIG9yIG5vdC4gU2V0IGl0IGhlcmU6XG4gICAgY29uc3Qgb3JjaGVzdHJhdG9yTG9nR3JvdXBBcm4gPSBgYXJuOiR7c3RhY2sucGFydGl0aW9ufTpsb2dzOiR7c3RhY2sucmVnaW9ufToke3N0YWNrLmFjY291bnR9OmxvZy1ncm91cDoke3Byb3BzLm9yY2hMb2dHcm91cH06KmBcblxuICAgIC8vIFVzZSBhbiBlc2NhcGUgaGF0Y2ggdG8gaGFuZGxlIGNvbmRpdGlvbmFsbHkgdXNpbmcgdGhlIGVuY3J5cHRlZCBvciB1bmVuY3J5cHRlZCBDVyBMb2dzR3JvdXBcbiAgICBjb25zdCBzdGF0ZU1hY2hpbmVDb25zdHJ1Y3QgPSBvcmNoZXN0cmF0b3JTdGF0ZU1hY2hpbmUubm9kZS5kZWZhdWx0Q2hpbGQgYXMgc2ZuLkNmblN0YXRlTWFjaGluZVxuICAgIHN0YXRlTWFjaGluZUNvbnN0cnVjdC5hZGRPdmVycmlkZSgnUHJvcGVydGllcy5Mb2dnaW5nQ29uZmlndXJhdGlvbicsIHtcbiAgICAgICAgXCJEZXN0aW5hdGlvbnNcIjogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIFwiQ2xvdWRXYXRjaExvZ3NMb2dHcm91cFwiOiB7XG4gICAgICAgICAgICAgICAgICAgIFwiTG9nR3JvdXBBcm5cIjogb3JjaGVzdHJhdG9yTG9nR3JvdXBBcm5cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIF0sXG4gICAgICAgIFwiSW5jbHVkZUV4ZWN1dGlvbkRhdGFcIjogdHJ1ZSxcbiAgICAgICAgXCJMZXZlbFwiOiBcIkFMTFwiXG4gICAgfSlcbiAgICBzdGF0ZU1hY2hpbmVDb25zdHJ1Y3QuYWRkRGVwZW5kc09uKG5lc3RlZExvZ1N0YWNrKVxuXG4gICAgLy8gUmVtb3ZlIHRoZSB1bm5lY2Vzc2FyeSBQb2xpY3kgY3JlYXRlZCBieSB0aGUgTDIgU3RhdGVNYWNoaW5lIGNvbnN0cnVjdFxuICAgIGxldCByb2xlVG9Nb2RpZnkgPSB0aGlzLm5vZGUuZmluZENoaWxkKCdSb2xlJykgYXMgQ2ZuUm9sZTtcbiAgICBpZiAocm9sZVRvTW9kaWZ5KSB7XG4gICAgICAgIHJvbGVUb01vZGlmeS5ub2RlLnRyeVJlbW92ZUNoaWxkKCdEZWZhdWx0UG9saWN5JylcbiAgICB9XG5cbiAgICBjZGtfbmFnLk5hZ1N1cHByZXNzaW9ucy5hZGRSZXNvdXJjZVN1cHByZXNzaW9ucyhvcmNoZXN0cmF0b3JTdGF0ZU1hY2hpbmUsIFtcbiAgICAgICAge2lkOiAnQXdzU29sdXRpb25zLVNGMScsIHJlYXNvbjogJ0ZhbHNlIGFsYXJtLiBMb2dnaW5nIGNvbmZpZ3VyYXRpb24gaXMgb3ZlcnJpZGRlbiB0byBsb2cgQUxMLid9LFxuICAgICAgICB7aWQ6ICdBd3NTb2x1dGlvbnMtU0YyJywgcmVhc29uOiAnWC1SYXkgaXMgbm90IG5lZWRlZCBmb3IgdGhpcyB1c2UgY2FzZS4nfVxuICAgIF0pO1xuICB9XG59Il19