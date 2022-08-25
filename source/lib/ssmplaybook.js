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
exports.SsmRemediationRunbook = exports.SsmRole = exports.OneTrigger = exports.Trigger = exports.SsmPlaybook = void 0;
const cdk = require("@aws-cdk/core");
const ssm = require("@aws-cdk/aws-ssm");
const fs = require("fs");
const yaml = require("js-yaml");
const sfn = require("@aws-cdk/aws-stepfunctions");
const events = require("@aws-cdk/aws-events");
const aws_iam_1 = require("@aws-cdk/aws-iam");
const aws_stepfunctions_1 = require("@aws-cdk/aws-stepfunctions");
const aws_events_1 = require("@aws-cdk/aws-events");
const remediation_runbook_stack_1 = require("../solution_deploy/lib/remediation_runbook-stack");
class SsmPlaybook extends cdk.Construct {
    constructor(scope, id, props) {
        super(scope, id);
        let scriptPath = '';
        if (props.scriptPath == undefined) {
            scriptPath = `${props.ssmDocPath}/scripts`;
        }
        else {
            scriptPath = props.scriptPath;
        }
        let commonScripts = '';
        if (props.commonScripts == undefined) {
            commonScripts = '../common';
        }
        else {
            commonScripts = props.commonScripts;
        }
        const enableParam = new cdk.CfnParameter(this, 'Enable ' + props.controlId, {
            type: "String",
            description: `Enable/disable availability of remediation for ${props.securityStandard} version ${props.securityStandardVersion} Control ${props.controlId} in Security Hub Console Custom Actions. If NOT Available the remediation cannot be triggered from the Security Hub console in the Security Hub Admin account.`,
            default: "Available",
            allowedValues: ["Available", "NOT Available"]
        });
        const installSsmDoc = new cdk.CfnCondition(this, 'Enable ' + props.controlId + ' Condition', {
            expression: cdk.Fn.conditionEquals(enableParam, "Available")
        });
        let ssmDocName = `SHARR-${props.securityStandard}_${props.securityStandardVersion}_${props.controlId}`;
        let ssmDocFQFileName = `${props.ssmDocPath}/${props.ssmDocFileName}`;
        let ssmDocType = props.ssmDocFileName.substring(props.ssmDocFileName.length - 4).toLowerCase();
        let ssmDocIn = fs.readFileSync(ssmDocFQFileName, 'utf8');
        let ssmDocOut = '';
        const re = /^(?<padding>\s+)%%SCRIPT=(?<script>.*)%%/;
        for (let line of ssmDocIn.split('\n')) {
            let foundMatch = re.exec(line);
            if (foundMatch && foundMatch.groups && foundMatch.groups.script) {
                let pathAndFileToInsert = foundMatch.groups.script;
                // If a relative path is provided then use it
                if (pathAndFileToInsert.substring(0, 7) === 'common/') {
                    pathAndFileToInsert = `${commonScripts}/${pathAndFileToInsert.substring(7)}`;
                }
                else {
                    pathAndFileToInsert = `${scriptPath}/${pathAndFileToInsert}`;
                }
                let scriptIn = fs.readFileSync(pathAndFileToInsert, 'utf8');
                for (let scriptLine of scriptIn.split('\n')) {
                    ssmDocOut += foundMatch.groups.padding + scriptLine + '\n';
                }
            }
            else {
                ssmDocOut += line + '\n';
            }
        }
        let ssmDocSource = undefined;
        if (ssmDocType == 'json') {
            ssmDocSource = JSON.parse(ssmDocOut);
        }
        else if (ssmDocType == 'yaml') {
            ssmDocSource = yaml.load(ssmDocOut);
        }
        const AutoDoc = new ssm.CfnDocument(this, 'Automation Document', {
            content: ssmDocSource,
            documentType: 'Automation',
            name: ssmDocName,
            versionName: props.solutionVersion
        });
        AutoDoc.cfnOptions.condition = installSsmDoc;
    }
}
exports.SsmPlaybook = SsmPlaybook;
class Trigger extends cdk.Construct {
    constructor(scope, id, props) {
        super(scope, id);
        let illegalChars = /[\.]/g;
        // Event to Step Function
        // ----------------------
        // Create CWE rule
        // Create custom action
        let description = `Remediate ${props.securityStandard} ${props.controlId}`;
        if (props.description) {
            description = props.description;
        }
        let workflowStatusFilter = {
            "Status": ["NEW"]
        };
        let complianceStatusFilter = {
            "Status": ["FAILED", "WARNING"]
        };
        const recordStateFilter = [
            'ACTIVE'
        ];
        const stateMachine = sfn.StateMachine.fromStateMachineArn(this, 'orchestrator', props.targetArn);
        // Create an IAM role for Events to start the State Machine
        const eventsRole = new aws_iam_1.Role(this, 'EventsRuleRole', {
            assumedBy: new aws_iam_1.ServicePrincipal('events.amazonaws.com')
        });
        // Grant the start execution permission to the Events service
        stateMachine.grantStartExecution(eventsRole);
        // Create an event rule to trigger the step function
        const stateMachineTarget = {
            bind: () => ({
                id: '',
                arn: props.targetArn,
                role: eventsRole
            })
        };
        const enable_auto_remediation_param = new cdk.CfnParameter(this, 'AutoEnable', {
            description: "This will fully enable automated remediation for " + props.securityStandard + ' ' + props.controlId,
            type: "String",
            allowedValues: ["ENABLED", "DISABLED"],
            default: "DISABLED"
        });
        enable_auto_remediation_param.overrideLogicalId(`${props.securityStandard}${props.controlId.replace(illegalChars, '')}AutoTrigger`);
        let eventPattern = {
            source: ["aws.securityhub"],
            detailType: ["Security Hub Findings - Imported"],
            detail: {
                findings: {
                    // GeneratorId includes both standard and control/rule ID
                    GeneratorId: [props.generatorId],
                    Workflow: workflowStatusFilter,
                    Compliance: complianceStatusFilter,
                    RecordState: recordStateFilter
                }
            }
        };
        let triggerPattern = eventPattern;
        // Adding an automated even rule for the playbook
        const eventRule_auto = new events.Rule(this, 'AutoEventRule', {
            description: description + ' automatic remediation trigger event rule.',
            ruleName: `${props.securityStandard}_${props.controlId}_AutoTrigger`,
            targets: [stateMachineTarget],
            eventPattern: triggerPattern
        });
        const cfnEventRule_auto = eventRule_auto.node.defaultChild;
        cfnEventRule_auto.addPropertyOverride('State', enable_auto_remediation_param.valueAsString);
    }
}
exports.Trigger = Trigger;
class OneTrigger extends cdk.Construct {
    // used in place of Trigger. Sends all finding events for which the
    // SHARR custom action is initiated to the Step Function
    constructor(scope, id, props) {
        super(scope, id);
        const stack = cdk.Stack.of(this);
        // Event to Step Function
        // ----------------------
        // Create CWE rule
        // Create custom action
        let description = `Remediate with SHARR`;
        if (props.description) {
            description = props.description;
        }
        let complianceStatusFilter = {
            "Status": ["FAILED", "WARNING"]
        };
        const stateMachine = aws_stepfunctions_1.StateMachine.fromStateMachineArn(this, 'orchestrator', props.targetArn);
        // Note: Id is max 20 characters
        const customAction = new cdk.CustomResource(this, 'Custom Action', {
            serviceToken: props.serviceToken,
            resourceType: 'Custom::ActionTarget',
            properties: {
                Name: 'Remediate with SHARR',
                Description: 'Submit the finding to AWS Security Hub Automated Response and Remediation',
                Id: 'SHARRRemediation'
            }
        });
        {
            let child = customAction.node.defaultChild;
            for (var prereq of props.prereq) {
                child.addDependsOn(prereq);
            }
        }
        // Create an IAM role for Events to start the State Machine
        const eventsRole = new aws_iam_1.Role(this, 'EventsRuleRole', {
            assumedBy: new aws_iam_1.ServicePrincipal('events.amazonaws.com')
        });
        // Grant the start execution permission to the Events service
        stateMachine.grantStartExecution(eventsRole);
        // Create an event rule to trigger the step function
        const stateMachineTarget = {
            bind: () => ({
                id: '',
                arn: props.targetArn,
                role: eventsRole
            })
        };
        let eventPattern = {
            source: ["aws.securityhub"],
            detailType: ["Security Hub Findings - Custom Action"],
            resources: [customAction.getAttString('Arn')],
            detail: {
                findings: {
                    Compliance: complianceStatusFilter
                }
            }
        };
        new aws_events_1.Rule(this, 'Remediate Custom Action', {
            description: description,
            enabled: true,
            eventPattern: eventPattern,
            ruleName: `Remediate_with_SHARR_CustomAction`,
            targets: [stateMachineTarget]
        });
    }
}
exports.OneTrigger = OneTrigger;
;
class SsmRole extends cdk.Construct {
    constructor(scope, id, props) {
        super(scope, id);
        const stack = cdk.Stack.of(this);
        const roleStack = remediation_runbook_stack_1.MemberRoleStack.of(this);
        const basePolicy = new aws_iam_1.Policy(this, 'SHARR-Member-Base-Policy');
        const adminAccount = roleStack.node.findChild('AdminAccountParameter').node.findChild('Admin Account Number');
        basePolicy.addStatements(new aws_iam_1.PolicyStatement({
            actions: [
                "ssm:GetParameters",
                "ssm:GetParameter",
                "ssm:PutParameter"
            ],
            resources: [
                `arn:${stack.partition}:ssm:*:${stack.account}:parameter/Solutions/SO0111/*`
            ],
            effect: aws_iam_1.Effect.ALLOW
        }), new aws_iam_1.PolicyStatement({
            actions: [
                "iam:PassRole"
            ],
            resources: [
                `arn:${stack.partition}:iam::${stack.account}:role/${props.remediationRoleName}`
            ],
            effect: aws_iam_1.Effect.ALLOW
        }), new aws_iam_1.PolicyStatement({
            actions: [
                "ssm:StartAutomationExecution",
                "ssm:GetAutomationExecution",
                "ssm:DescribeAutomationStepExecutions"
            ],
            resources: [
                `arn:${stack.partition}:ssm:*:${stack.account}:document/Solutions/SHARR-${props.remediationRoleName}`,
                `arn:${stack.partition}:ssm:*:${stack.account}:automation-definition/*`,
                `arn:${stack.partition}:ssm:*::automation-definition/*`,
                `arn:${stack.partition}:ssm:*:${stack.account}:automation-execution/*`
            ],
            effect: aws_iam_1.Effect.ALLOW
        }), new aws_iam_1.PolicyStatement({
            actions: [
                "sts:AssumeRole"
            ],
            resources: [
                `arn:${stack.partition}:iam::${stack.account}:role/${props.remediationRoleName}`
            ],
            effect: aws_iam_1.Effect.ALLOW
        }));
        // AssumeRole Policy
        let principalPolicyStatement = new aws_iam_1.PolicyStatement();
        principalPolicyStatement.addActions("sts:AssumeRole");
        principalPolicyStatement.effect = aws_iam_1.Effect.ALLOW;
        const RESOURCE_PREFIX = props.solutionId.replace(/^DEV-/, '');
        let roleprincipal = new aws_iam_1.ArnPrincipal(`arn:${stack.partition}:iam::${stack.account}:role/${RESOURCE_PREFIX}-SHARR-Orchestrator-Member`);
        let principals = new aws_iam_1.CompositePrincipal(roleprincipal);
        principals.addToPolicy(principalPolicyStatement);
        let serviceprincipal = new aws_iam_1.ServicePrincipal('ssm.amazonaws.com');
        principals.addPrincipals(serviceprincipal);
        // Multi-account/region automations must be able to assume the remediation role
        const accountPrincipal = new aws_iam_1.AccountPrincipal(stack.account);
        principals.addPrincipals(accountPrincipal);
        let memberRole = new aws_iam_1.Role(this, 'MemberAccountRole', {
            assumedBy: principals,
            roleName: props.remediationRoleName
        });
        memberRole.attachInlinePolicy(basePolicy);
        memberRole.attachInlinePolicy(props.remediationPolicy);
        memberRole.applyRemovalPolicy(cdk.RemovalPolicy.RETAIN);
        memberRole.node.addDependency(roleStack.getOrchestratorMemberRole());
        const memberRoleResource = memberRole.node.findChild('Resource');
        memberRoleResource.cfnOptions.metadata = {
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
    }
}
exports.SsmRole = SsmRole;
class SsmRemediationRunbook extends cdk.Construct {
    constructor(scope, id, props) {
        super(scope, id);
        // Add prefix to ssmDocName
        let ssmDocName = `SHARR-${props.ssmDocName}`;
        let scriptPath = '';
        if (props.scriptPath == undefined) {
            scriptPath = 'ssmdocs/scripts';
        }
        else {
            scriptPath = props.scriptPath;
        }
        let ssmDocFQFileName = `${props.ssmDocPath}/${props.ssmDocFileName}`;
        let ssmDocType = props.ssmDocFileName.substr(props.ssmDocFileName.length - 4).toLowerCase();
        let ssmDocIn = fs.readFileSync(ssmDocFQFileName, 'utf8');
        let ssmDocOut = '';
        const re = /^(?<padding>\s+)%%SCRIPT=(?<script>.*)%%/;
        for (let line of ssmDocIn.split('\n')) {
            let foundMatch = re.exec(line);
            if (foundMatch && foundMatch.groups && foundMatch.groups.script) {
                let scriptIn = fs.readFileSync(`${scriptPath}/${foundMatch.groups.script}`, 'utf8');
                for (let scriptLine of scriptIn.split('\n')) {
                    ssmDocOut += foundMatch.groups.padding + scriptLine + '\n';
                }
            }
            else {
                ssmDocOut += line + '\n';
            }
        }
        let ssmDocSource = undefined;
        if (ssmDocType == 'json') {
            ssmDocSource = JSON.parse(ssmDocOut);
        }
        else if (ssmDocType == 'yaml') {
            ssmDocSource = yaml.load(ssmDocOut);
        }
        new ssm.CfnDocument(this, 'Automation Document', {
            content: ssmDocSource,
            documentType: 'Automation',
            name: ssmDocName
        });
    }
}
exports.SsmRemediationRunbook = SsmRemediationRunbook;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3NtcGxheWJvb2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJzc21wbGF5Ym9vay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUNBOzs7Ozs7Ozs7Ozs7OytFQWErRTs7O0FBRS9FLHFDQUFxQztBQUNyQyx3Q0FBd0M7QUFDeEMseUJBQXlCO0FBQ3pCLGdDQUFnQztBQUNoQyxrREFBa0Q7QUFDbEQsOENBQThDO0FBQzlDLDhDQVUwQjtBQUMxQixrRUFBMEQ7QUFDMUQsb0RBQXNFO0FBQ3RFLGdHQUFtRjtBQXdCbkYsTUFBYSxXQUFZLFNBQVEsR0FBRyxDQUFDLFNBQVM7SUFFNUMsWUFBWSxLQUFvQixFQUFFLEVBQVUsRUFBRSxLQUF3QjtRQUNwRSxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBRWpCLElBQUksVUFBVSxHQUFHLEVBQUUsQ0FBQTtRQUNuQixJQUFJLEtBQUssQ0FBQyxVQUFVLElBQUksU0FBUyxFQUFHO1lBQ2hDLFVBQVUsR0FBRyxHQUFHLEtBQUssQ0FBQyxVQUFVLFVBQVUsQ0FBQTtTQUM3QzthQUFNO1lBQ0gsVUFBVSxHQUFHLEtBQUssQ0FBQyxVQUFVLENBQUE7U0FDaEM7UUFFRCxJQUFJLGFBQWEsR0FBRyxFQUFFLENBQUE7UUFDdEIsSUFBSSxLQUFLLENBQUMsYUFBYSxJQUFJLFNBQVMsRUFBRztZQUNuQyxhQUFhLEdBQUcsV0FBVyxDQUFBO1NBQzlCO2FBQU07WUFDSCxhQUFhLEdBQUcsS0FBSyxDQUFDLGFBQWEsQ0FBQTtTQUN0QztRQUVELE1BQU0sV0FBVyxHQUFHLElBQUksR0FBRyxDQUFDLFlBQVksQ0FBQyxJQUFJLEVBQUUsU0FBUyxHQUFHLEtBQUssQ0FBQyxTQUFTLEVBQUU7WUFDeEUsSUFBSSxFQUFFLFFBQVE7WUFDZCxXQUFXLEVBQUUsa0RBQWtELEtBQUssQ0FBQyxnQkFBZ0IsWUFBWSxLQUFLLENBQUMsdUJBQXVCLFlBQVksS0FBSyxDQUFDLFNBQVMsZ0tBQWdLO1lBQ3pULE9BQU8sRUFBRSxXQUFXO1lBQ3BCLGFBQWEsRUFBRSxDQUFDLFdBQVcsRUFBRSxlQUFlLENBQUM7U0FDaEQsQ0FBQyxDQUFBO1FBRUYsTUFBTSxhQUFhLEdBQUcsSUFBSSxHQUFHLENBQUMsWUFBWSxDQUFDLElBQUksRUFBRSxTQUFTLEdBQUcsS0FBSyxDQUFDLFNBQVMsR0FBRyxZQUFZLEVBQUU7WUFDekYsVUFBVSxFQUFFLEdBQUcsQ0FBQyxFQUFFLENBQUMsZUFBZSxDQUFDLFdBQVcsRUFBRSxXQUFXLENBQUM7U0FDL0QsQ0FBQyxDQUFBO1FBRUYsSUFBSSxVQUFVLEdBQUcsU0FBUyxLQUFLLENBQUMsZ0JBQWdCLElBQUksS0FBSyxDQUFDLHVCQUF1QixJQUFJLEtBQUssQ0FBQyxTQUFTLEVBQUUsQ0FBQTtRQUN0RyxJQUFJLGdCQUFnQixHQUFHLEdBQUcsS0FBSyxDQUFDLFVBQVUsSUFBSSxLQUFLLENBQUMsY0FBYyxFQUFFLENBQUE7UUFDcEUsSUFBSSxVQUFVLEdBQUcsS0FBSyxDQUFDLGNBQWMsQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLGNBQWMsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUMsV0FBVyxFQUFFLENBQUE7UUFFOUYsSUFBSSxRQUFRLEdBQUcsRUFBRSxDQUFDLFlBQVksQ0FBQyxnQkFBZ0IsRUFBRSxNQUFNLENBQUMsQ0FBQTtRQUV4RCxJQUFJLFNBQVMsR0FBVyxFQUFFLENBQUE7UUFDMUIsTUFBTSxFQUFFLEdBQUcsMENBQTBDLENBQUE7UUFFckQsS0FBSyxJQUFJLElBQUksSUFBSSxRQUFRLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxFQUFFO1lBQ25DLElBQUksVUFBVSxHQUFHLEVBQUUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUE7WUFDOUIsSUFBSSxVQUFVLElBQUksVUFBVSxDQUFDLE1BQU0sSUFBSSxVQUFVLENBQUMsTUFBTSxDQUFDLE1BQU0sRUFBRTtnQkFDN0QsSUFBSSxtQkFBbUIsR0FBRyxVQUFVLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQTtnQkFDbEQsNkNBQTZDO2dCQUM3QyxJQUFJLG1CQUFtQixDQUFDLFNBQVMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDLEtBQUssU0FBUyxFQUFFO29CQUNsRCxtQkFBbUIsR0FBRyxHQUFHLGFBQWEsSUFBSSxtQkFBbUIsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQTtpQkFDL0U7cUJBQU07b0JBQ0gsbUJBQW1CLEdBQUcsR0FBRyxVQUFVLElBQUksbUJBQW1CLEVBQUUsQ0FBQTtpQkFDL0Q7Z0JBQ0QsSUFBSSxRQUFRLEdBQUcsRUFBRSxDQUFDLFlBQVksQ0FBQyxtQkFBbUIsRUFBRSxNQUFNLENBQUMsQ0FBQTtnQkFDM0QsS0FBSyxJQUFJLFVBQVUsSUFBSSxRQUFRLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxFQUFFO29CQUN6QyxTQUFTLElBQUksVUFBVSxDQUFDLE1BQU0sQ0FBQyxPQUFPLEdBQUcsVUFBVSxHQUFHLElBQUksQ0FBQTtpQkFDN0Q7YUFDSjtpQkFBTTtnQkFDSCxTQUFTLElBQUksSUFBSSxHQUFHLElBQUksQ0FBQTthQUMzQjtTQUNKO1FBRUQsSUFBSSxZQUFZLEdBQUcsU0FBUyxDQUFBO1FBQzVCLElBQUksVUFBVSxJQUFJLE1BQU0sRUFBRTtZQUN0QixZQUFZLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsQ0FBQTtTQUN2QzthQUFNLElBQUksVUFBVSxJQUFJLE1BQU0sRUFBRTtZQUM3QixZQUFZLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQTtTQUN0QztRQUVELE1BQU0sT0FBTyxHQUFHLElBQUksR0FBRyxDQUFDLFdBQVcsQ0FBQyxJQUFJLEVBQUUscUJBQXFCLEVBQUU7WUFDN0QsT0FBTyxFQUFFLFlBQVk7WUFDckIsWUFBWSxFQUFFLFlBQVk7WUFDMUIsSUFBSSxFQUFFLFVBQVU7WUFDaEIsV0FBVyxFQUFFLEtBQUssQ0FBQyxlQUFlO1NBQ3JDLENBQUMsQ0FBQTtRQUNGLE9BQU8sQ0FBQyxVQUFVLENBQUMsU0FBUyxHQUFHLGFBQWEsQ0FBQTtJQUM5QyxDQUFDO0NBQ0Y7QUF6RUQsa0NBeUVDO0FBZUQsTUFBYSxPQUFRLFNBQVEsR0FBRyxDQUFDLFNBQVM7SUFFeEMsWUFBWSxLQUFvQixFQUFFLEVBQVUsRUFBRSxLQUFvQjtRQUNoRSxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBQ2pCLElBQUksWUFBWSxHQUFHLE9BQU8sQ0FBQztRQUUzQix5QkFBeUI7UUFDekIseUJBQXlCO1FBQ3pCLGtCQUFrQjtRQUNsQix1QkFBdUI7UUFFdkIsSUFBSSxXQUFXLEdBQUcsYUFBYSxLQUFLLENBQUMsZ0JBQWdCLElBQUksS0FBSyxDQUFDLFNBQVMsRUFBRSxDQUFBO1FBQzFFLElBQUksS0FBSyxDQUFDLFdBQVcsRUFBRTtZQUNuQixXQUFXLEdBQUcsS0FBSyxDQUFDLFdBQVcsQ0FBQTtTQUNsQztRQUVELElBQUksb0JBQW9CLEdBQUc7WUFDdkIsUUFBUSxFQUFFLENBQUUsS0FBSyxDQUFFO1NBQ3RCLENBQUE7UUFDRCxJQUFJLHNCQUFzQixHQUFHO1lBQ3pCLFFBQVEsRUFBRSxDQUFFLFFBQVEsRUFBRSxTQUFTLENBQUU7U0FDcEMsQ0FBQTtRQUNELE1BQU0saUJBQWlCLEdBQWE7WUFDaEMsUUFBUTtTQUNYLENBQUM7UUFFRixNQUFNLFlBQVksR0FBRyxHQUFHLENBQUMsWUFBWSxDQUFDLG1CQUFtQixDQUFDLElBQUksRUFBRSxjQUFjLEVBQUUsS0FBSyxDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBRWpHLDJEQUEyRDtRQUMzRCxNQUFNLFVBQVUsR0FBRyxJQUFJLGNBQUksQ0FBQyxJQUFJLEVBQUUsZ0JBQWdCLEVBQUU7WUFDbEQsU0FBUyxFQUFFLElBQUksMEJBQWdCLENBQUMsc0JBQXNCLENBQUM7U0FDeEQsQ0FBQyxDQUFDO1FBRUgsNkRBQTZEO1FBQzdELFlBQVksQ0FBQyxtQkFBbUIsQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUU3QyxvREFBb0Q7UUFDcEQsTUFBTSxrQkFBa0IsR0FBdUI7WUFDN0MsSUFBSSxFQUFFLEdBQUcsRUFBRSxDQUFDLENBQUM7Z0JBQ1gsRUFBRSxFQUFFLEVBQUU7Z0JBQ04sR0FBRyxFQUFFLEtBQUssQ0FBQyxTQUFTO2dCQUNwQixJQUFJLEVBQUUsVUFBVTthQUNqQixDQUFDO1NBQ0gsQ0FBQztRQUVGLE1BQU0sNkJBQTZCLEdBQUcsSUFBSSxHQUFHLENBQUMsWUFBWSxDQUFDLElBQUksRUFBRSxZQUFZLEVBQUU7WUFDM0UsV0FBVyxFQUFFLG1EQUFtRCxHQUFFLEtBQUssQ0FBQyxnQkFBZ0IsR0FBRyxHQUFHLEdBQUcsS0FBSyxDQUFDLFNBQVM7WUFDaEgsSUFBSSxFQUFFLFFBQVE7WUFDZCxhQUFhLEVBQUUsQ0FBQyxTQUFTLEVBQUUsVUFBVSxDQUFDO1lBQ3RDLE9BQU8sRUFBRSxVQUFVO1NBQ3RCLENBQUMsQ0FBQztRQUVILDZCQUE2QixDQUFDLGlCQUFpQixDQUFDLEdBQUcsS0FBSyxDQUFDLGdCQUFnQixHQUFHLEtBQUssQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLFlBQVksRUFBRSxFQUFFLENBQUMsYUFBYSxDQUFDLENBQUE7UUFPbkksSUFBSSxZQUFZLEdBQWE7WUFDekIsTUFBTSxFQUFFLENBQUMsaUJBQWlCLENBQUM7WUFDM0IsVUFBVSxFQUFFLENBQUMsa0NBQWtDLENBQUM7WUFDaEQsTUFBTSxFQUFFO2dCQUNKLFFBQVEsRUFBRTtvQkFDTix5REFBeUQ7b0JBQ3pELFdBQVcsRUFBRSxDQUFDLEtBQUssQ0FBQyxXQUFXLENBQUM7b0JBQ2hDLFFBQVEsRUFBRSxvQkFBb0I7b0JBQzlCLFVBQVUsRUFBRSxzQkFBc0I7b0JBQ2xDLFdBQVcsRUFBRSxpQkFBaUI7aUJBQ2pDO2FBQ0o7U0FDSixDQUFBO1FBRUQsSUFBSSxjQUFjLEdBQXdCLFlBQVksQ0FBQTtRQUV0RCxpREFBaUQ7UUFDakQsTUFBTSxjQUFjLEdBQUcsSUFBSSxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxlQUFlLEVBQUU7WUFDMUQsV0FBVyxFQUFFLFdBQVcsR0FBRyw0Q0FBNEM7WUFDdkUsUUFBUSxFQUFFLEdBQUcsS0FBSyxDQUFDLGdCQUFnQixJQUFJLEtBQUssQ0FBQyxTQUFTLGNBQWM7WUFDcEUsT0FBTyxFQUFFLENBQUMsa0JBQWtCLENBQUM7WUFDN0IsWUFBWSxFQUFFLGNBQWM7U0FDL0IsQ0FBQyxDQUFDO1FBRUgsTUFBTSxpQkFBaUIsR0FBRyxjQUFjLENBQUMsSUFBSSxDQUFDLFlBQThCLENBQUM7UUFDN0UsaUJBQWlCLENBQUMsbUJBQW1CLENBQUMsT0FBTyxFQUFFLDZCQUE2QixDQUFDLGFBQWEsQ0FBQyxDQUFDO0lBQzlGLENBQUM7Q0FDRjtBQXRGRCwwQkFzRkM7QUFRRCxNQUFhLFVBQVcsU0FBUSxHQUFHLENBQUMsU0FBUztJQUM3QyxtRUFBbUU7SUFDbkUsd0RBQXdEO0lBRXRELFlBQVksS0FBb0IsRUFBRSxFQUFVLEVBQUUsS0FBdUI7UUFDbkUsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUMsQ0FBQztRQUNqQixNQUFNLEtBQUssR0FBRyxHQUFHLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQTtRQUVoQyx5QkFBeUI7UUFDekIseUJBQXlCO1FBQ3pCLGtCQUFrQjtRQUNsQix1QkFBdUI7UUFFdkIsSUFBSSxXQUFXLEdBQUcsc0JBQXNCLENBQUE7UUFDeEMsSUFBSSxLQUFLLENBQUMsV0FBVyxFQUFFO1lBQ25CLFdBQVcsR0FBRyxLQUFLLENBQUMsV0FBVyxDQUFBO1NBQ2xDO1FBRUQsSUFBSSxzQkFBc0IsR0FBRztZQUN6QixRQUFRLEVBQUUsQ0FBRSxRQUFRLEVBQUUsU0FBUyxDQUFFO1NBQ3BDLENBQUE7UUFFRCxNQUFNLFlBQVksR0FBRyxnQ0FBWSxDQUFDLG1CQUFtQixDQUFDLElBQUksRUFBRSxjQUFjLEVBQUUsS0FBSyxDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBRTdGLGdDQUFnQztRQUNoQyxNQUFNLFlBQVksR0FBRyxJQUFJLEdBQUcsQ0FBQyxjQUFjLENBQUMsSUFBSSxFQUFFLGVBQWUsRUFBRTtZQUMvRCxZQUFZLEVBQUUsS0FBSyxDQUFDLFlBQVk7WUFDaEMsWUFBWSxFQUFFLHNCQUFzQjtZQUNwQyxVQUFVLEVBQUU7Z0JBQ1IsSUFBSSxFQUFFLHNCQUFzQjtnQkFDNUIsV0FBVyxFQUFFLDJFQUEyRTtnQkFDeEYsRUFBRSxFQUFFLGtCQUFrQjthQUN6QjtTQUNKLENBQUMsQ0FBQztRQUNIO1lBQ0ksSUFBSSxLQUFLLEdBQUcsWUFBWSxDQUFDLElBQUksQ0FBQyxZQUFxQyxDQUFBO1lBQ25FLEtBQUssSUFBSSxNQUFNLElBQUksS0FBSyxDQUFDLE1BQU0sRUFBRTtnQkFDN0IsS0FBSyxDQUFDLFlBQVksQ0FBQyxNQUFNLENBQUMsQ0FBQTthQUM3QjtTQUNKO1FBRUQsMkRBQTJEO1FBQzNELE1BQU0sVUFBVSxHQUFHLElBQUksY0FBSSxDQUFDLElBQUksRUFBRSxnQkFBZ0IsRUFBRTtZQUNwRCxTQUFTLEVBQUUsSUFBSSwwQkFBZ0IsQ0FBQyxzQkFBc0IsQ0FBQztTQUN0RCxDQUFDLENBQUM7UUFFSCw2REFBNkQ7UUFDN0QsWUFBWSxDQUFDLG1CQUFtQixDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBRTdDLG9EQUFvRDtRQUNwRCxNQUFNLGtCQUFrQixHQUFnQjtZQUNwQyxJQUFJLEVBQUUsR0FBRyxFQUFFLENBQUMsQ0FBQztnQkFDVCxFQUFFLEVBQUUsRUFBRTtnQkFDTixHQUFHLEVBQUUsS0FBSyxDQUFDLFNBQVM7Z0JBQ3BCLElBQUksRUFBRSxVQUFVO2FBQ25CLENBQUM7U0FDTCxDQUFDO1FBRUYsSUFBSSxZQUFZLEdBQWlCO1lBQzdCLE1BQU0sRUFBRSxDQUFDLGlCQUFpQixDQUFDO1lBQzNCLFVBQVUsRUFBRSxDQUFDLHVDQUF1QyxDQUFDO1lBQ3JELFNBQVMsRUFBRSxDQUFFLFlBQVksQ0FBQyxZQUFZLENBQUMsS0FBSyxDQUFDLENBQUU7WUFDL0MsTUFBTSxFQUFFO2dCQUNKLFFBQVEsRUFBRTtvQkFDTixVQUFVLEVBQUUsc0JBQXNCO2lCQUNyQzthQUNKO1NBQ0osQ0FBQTtRQUVELElBQUksaUJBQUksQ0FBQyxJQUFJLEVBQUUseUJBQXlCLEVBQUU7WUFDdEMsV0FBVyxFQUFFLFdBQVc7WUFDeEIsT0FBTyxFQUFFLElBQUk7WUFDYixZQUFZLEVBQUUsWUFBWTtZQUMxQixRQUFRLEVBQUUsbUNBQW1DO1lBQzdDLE9BQU8sRUFBRSxDQUFDLGtCQUFrQixDQUFDO1NBQ2hDLENBQUMsQ0FBQTtJQUNKLENBQUM7Q0FDRjtBQTdFRCxnQ0E2RUM7QUFPQSxDQUFDO0FBRUYsTUFBYSxPQUFRLFNBQVEsR0FBRyxDQUFDLFNBQVM7SUFFeEMsWUFBWSxLQUFvQixFQUFFLEVBQVUsRUFBRSxLQUFnQjtRQUM1RCxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBQ2pCLE1BQU0sS0FBSyxHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFBO1FBQ2hDLE1BQU0sU0FBUyxHQUFHLDJDQUFlLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBb0IsQ0FBQztRQUM5RCxNQUFNLFVBQVUsR0FBRyxJQUFJLGdCQUFNLENBQUMsSUFBSSxFQUFFLDBCQUEwQixDQUFDLENBQUE7UUFDL0QsTUFBTSxZQUFZLEdBQUcsU0FBUyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsdUJBQXVCLENBQUMsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLHNCQUFzQixDQUFxQixDQUFDO1FBRWxJLFVBQVUsQ0FBQyxhQUFhLENBQ3BCLElBQUkseUJBQWUsQ0FBQztZQUNoQixPQUFPLEVBQUU7Z0JBQ0wsbUJBQW1CO2dCQUNuQixrQkFBa0I7Z0JBQ2xCLGtCQUFrQjthQUNyQjtZQUNELFNBQVMsRUFBRTtnQkFDUCxPQUFPLEtBQUssQ0FBQyxTQUFTLFVBQVUsS0FBSyxDQUFDLE9BQU8sK0JBQStCO2FBQy9FO1lBQ0QsTUFBTSxFQUFFLGdCQUFNLENBQUMsS0FBSztTQUN2QixDQUFDLEVBQ0YsSUFBSSx5QkFBZSxDQUFDO1lBQ2hCLE9BQU8sRUFBRTtnQkFDTCxjQUFjO2FBQ2pCO1lBQ0QsU0FBUyxFQUFFO2dCQUNQLE9BQU8sS0FBSyxDQUFDLFNBQVMsU0FBUyxLQUFLLENBQUMsT0FBTyxTQUFTLEtBQUssQ0FBQyxtQkFBbUIsRUFBRTthQUNuRjtZQUNELE1BQU0sRUFBRSxnQkFBTSxDQUFDLEtBQUs7U0FDdkIsQ0FBQyxFQUNGLElBQUkseUJBQWUsQ0FBQztZQUNoQixPQUFPLEVBQUU7Z0JBQ0wsOEJBQThCO2dCQUM5Qiw0QkFBNEI7Z0JBQzVCLHNDQUFzQzthQUN6QztZQUNELFNBQVMsRUFBRTtnQkFDUCxPQUFPLEtBQUssQ0FBQyxTQUFTLFVBQVUsS0FBSyxDQUFDLE9BQU8sNkJBQTZCLEtBQUssQ0FBQyxtQkFBbUIsRUFBRTtnQkFDckcsT0FBTyxLQUFLLENBQUMsU0FBUyxVQUFVLEtBQUssQ0FBQyxPQUFPLDBCQUEwQjtnQkFDdkUsT0FBTyxLQUFLLENBQUMsU0FBUyxpQ0FBaUM7Z0JBQ3ZELE9BQU8sS0FBSyxDQUFDLFNBQVMsVUFBVSxLQUFLLENBQUMsT0FBTyx5QkFBeUI7YUFDekU7WUFDRCxNQUFNLEVBQUUsZ0JBQU0sQ0FBQyxLQUFLO1NBQ3ZCLENBQUMsRUFDRixJQUFJLHlCQUFlLENBQUM7WUFDaEIsT0FBTyxFQUFFO2dCQUNMLGdCQUFnQjthQUNuQjtZQUNELFNBQVMsRUFBRTtnQkFDUCxPQUFPLEtBQUssQ0FBQyxTQUFTLFNBQVMsS0FBSyxDQUFDLE9BQU8sU0FBUyxLQUFLLENBQUMsbUJBQW1CLEVBQUU7YUFDbkY7WUFDRCxNQUFNLEVBQUUsZ0JBQU0sQ0FBQyxLQUFLO1NBQ3ZCLENBQUMsQ0FDTCxDQUFBO1FBRUQsb0JBQW9CO1FBQ3BCLElBQUksd0JBQXdCLEdBQUcsSUFBSSx5QkFBZSxFQUFFLENBQUM7UUFDckQsd0JBQXdCLENBQUMsVUFBVSxDQUFDLGdCQUFnQixDQUFDLENBQUM7UUFDdEQsd0JBQXdCLENBQUMsTUFBTSxHQUFHLGdCQUFNLENBQUMsS0FBSyxDQUFDO1FBRS9DLE1BQU0sZUFBZSxHQUFHLEtBQUssQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBQyxFQUFFLENBQUMsQ0FBQztRQUM3RCxJQUFJLGFBQWEsR0FBRyxJQUFJLHNCQUFZLENBQ2hDLE9BQU8sS0FBSyxDQUFDLFNBQVMsU0FBUyxLQUFLLENBQUMsT0FBTyxTQUFTLGVBQWUsNEJBQTRCLENBQ25HLENBQUM7UUFFRixJQUFJLFVBQVUsR0FBRyxJQUFJLDRCQUFrQixDQUFDLGFBQWEsQ0FBQyxDQUFDO1FBQ3ZELFVBQVUsQ0FBQyxXQUFXLENBQUMsd0JBQXdCLENBQUMsQ0FBQztRQUVqRCxJQUFJLGdCQUFnQixHQUFHLElBQUksMEJBQWdCLENBQUMsbUJBQW1CLENBQUMsQ0FBQTtRQUNoRSxVQUFVLENBQUMsYUFBYSxDQUFDLGdCQUFnQixDQUFDLENBQUM7UUFFM0MsK0VBQStFO1FBQy9FLE1BQU0sZ0JBQWdCLEdBQUcsSUFBSSwwQkFBZ0IsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDN0QsVUFBVSxDQUFDLGFBQWEsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDO1FBRTNDLElBQUksVUFBVSxHQUFHLElBQUksY0FBSSxDQUFDLElBQUksRUFBRSxtQkFBbUIsRUFBRTtZQUNqRCxTQUFTLEVBQUUsVUFBVTtZQUNyQixRQUFRLEVBQUUsS0FBSyxDQUFDLG1CQUFtQjtTQUN0QyxDQUFDLENBQUM7UUFFSCxVQUFVLENBQUMsa0JBQWtCLENBQUMsVUFBVSxDQUFDLENBQUE7UUFDekMsVUFBVSxDQUFDLGtCQUFrQixDQUFDLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxDQUFBO1FBQ3RELFVBQVUsQ0FBQyxrQkFBa0IsQ0FBQyxHQUFHLENBQUMsYUFBYSxDQUFDLE1BQU0sQ0FBQyxDQUFBO1FBQ3ZELFVBQVUsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLFNBQVMsQ0FBQyx5QkFBeUIsRUFBRSxDQUFDLENBQUM7UUFFckUsTUFBTSxrQkFBa0IsR0FBRyxVQUFVLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxVQUFVLENBQVksQ0FBQztRQUU1RSxrQkFBa0IsQ0FBQyxVQUFVLENBQUMsUUFBUSxHQUFHO1lBQ3JDLE9BQU8sRUFBRTtnQkFDTCxpQkFBaUIsRUFBRSxDQUFDO3dCQUNoQixFQUFFLEVBQUUsS0FBSzt3QkFDVCxNQUFNLEVBQUUsMEVBQTBFO3FCQUNyRixFQUFDO3dCQUNFLEVBQUUsRUFBRSxLQUFLO3dCQUNULE1BQU0sRUFBRSx1RkFBdUY7cUJBQ2xHLENBQUM7YUFDTDtTQUNKLENBQUM7SUFDSixDQUFDO0NBQ0Y7QUFuR0QsMEJBbUdDO0FBYUQsTUFBYSxxQkFBc0IsU0FBUSxHQUFHLENBQUMsU0FBUztJQUV0RCxZQUFZLEtBQW9CLEVBQUUsRUFBVSxFQUFFLEtBQThCO1FBQzFFLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFFakIsMkJBQTJCO1FBQzNCLElBQUksVUFBVSxHQUFHLFNBQVMsS0FBSyxDQUFDLFVBQVUsRUFBRSxDQUFBO1FBRTVDLElBQUksVUFBVSxHQUFHLEVBQUUsQ0FBQTtRQUNuQixJQUFJLEtBQUssQ0FBQyxVQUFVLElBQUksU0FBUyxFQUFFO1lBQy9CLFVBQVUsR0FBRyxpQkFBaUIsQ0FBQTtTQUNqQzthQUFNO1lBQ0gsVUFBVSxHQUFHLEtBQUssQ0FBQyxVQUFVLENBQUE7U0FDaEM7UUFFRCxJQUFJLGdCQUFnQixHQUFHLEdBQUcsS0FBSyxDQUFDLFVBQVUsSUFBSSxLQUFLLENBQUMsY0FBYyxFQUFFLENBQUE7UUFDcEUsSUFBSSxVQUFVLEdBQUcsS0FBSyxDQUFDLGNBQWMsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLGNBQWMsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUMsV0FBVyxFQUFFLENBQUE7UUFFM0YsSUFBSSxRQUFRLEdBQUcsRUFBRSxDQUFDLFlBQVksQ0FBQyxnQkFBZ0IsRUFBRSxNQUFNLENBQUMsQ0FBQTtRQUV4RCxJQUFJLFNBQVMsR0FBVyxFQUFFLENBQUE7UUFDMUIsTUFBTSxFQUFFLEdBQUcsMENBQTBDLENBQUE7UUFFckQsS0FBSyxJQUFJLElBQUksSUFBSSxRQUFRLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxFQUFFO1lBQ25DLElBQUksVUFBVSxHQUFHLEVBQUUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUE7WUFDOUIsSUFBSSxVQUFVLElBQUksVUFBVSxDQUFDLE1BQU0sSUFBSSxVQUFVLENBQUMsTUFBTSxDQUFDLE1BQU0sRUFBRTtnQkFDN0QsSUFBSSxRQUFRLEdBQUcsRUFBRSxDQUFDLFlBQVksQ0FBQyxHQUFHLFVBQVUsSUFBSSxVQUFVLENBQUMsTUFBTSxDQUFDLE1BQU0sRUFBRSxFQUFFLE1BQU0sQ0FBQyxDQUFBO2dCQUNuRixLQUFLLElBQUksVUFBVSxJQUFJLFFBQVEsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEVBQUU7b0JBQ3pDLFNBQVMsSUFBSSxVQUFVLENBQUMsTUFBTSxDQUFDLE9BQU8sR0FBRyxVQUFVLEdBQUcsSUFBSSxDQUFBO2lCQUM3RDthQUNKO2lCQUFNO2dCQUNILFNBQVMsSUFBSSxJQUFJLEdBQUcsSUFBSSxDQUFBO2FBQzNCO1NBQ0o7UUFFRCxJQUFJLFlBQVksR0FBRyxTQUFTLENBQUE7UUFDNUIsSUFBSSxVQUFVLElBQUksTUFBTSxFQUFFO1lBQ3RCLFlBQVksR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxDQUFBO1NBQ3ZDO2FBQU0sSUFBSSxVQUFVLElBQUksTUFBTSxFQUFFO1lBQzdCLFlBQVksR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFBO1NBQ3RDO1FBRUQsSUFBSSxHQUFHLENBQUMsV0FBVyxDQUFDLElBQUksRUFBRSxxQkFBcUIsRUFBRTtZQUM3QyxPQUFPLEVBQUUsWUFBWTtZQUNyQixZQUFZLEVBQUUsWUFBWTtZQUMxQixJQUFJLEVBQUUsVUFBVTtTQUNuQixDQUFDLENBQUE7SUFDSixDQUFDO0NBQ0Y7QUFoREQsc0RBZ0RDIiwic291cmNlc0NvbnRlbnQiOlsiIyEvdXNyL2Jpbi9lbnYgbm9kZVxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gKiAgQ29weXJpZ2h0IEFtYXpvbi5jb20sIEluYy4gb3IgaXRzIGFmZmlsaWF0ZXMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuICAgKlxuICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUgTGljZW5zZSwgVmVyc2lvbiAyLjAgKHRoZSBcIkxpY2Vuc2VcIikuIFlvdSBtYXkgICAqXG4gKiAgbm90IHVzZSB0aGlzIGZpbGUgZXhjZXB0IGluIGNvbXBsaWFuY2Ugd2l0aCB0aGUgTGljZW5zZS4gQSBjb3B5IG9mIHRoZSAgICAqXG4gKiAgTGljZW5zZSBpcyBsb2NhdGVkIGF0ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAqXG4gKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAqXG4gKiAgICAgIGh0dHA6Ly93d3cuYXBhY2hlLm9yZy9saWNlbnNlcy9MSUNFTlNFLTIuMCAgICAgICAgICAgICAgICAgICAgICAgICAgICAqXG4gKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAqXG4gKiAgb3IgaW4gdGhlICdsaWNlbnNlJyBmaWxlIGFjY29tcGFueWluZyB0aGlzIGZpbGUuIFRoaXMgZmlsZSBpcyBkaXN0cmlidXRlZCAqXG4gKiAgb24gYW4gJ0FTIElTJyBCQVNJUywgV0lUSE9VVCBXQVJSQU5USUVTIE9SIENPTkRJVElPTlMgT0YgQU5ZIEtJTkQsICAgICAgICAqXG4gKiAgZXhwcmVzcyBvciBpbXBsaWVkLiBTZWUgdGhlIExpY2Vuc2UgZm9yIHRoZSBzcGVjaWZpYyBsYW5ndWFnZSBnb3Zlcm5pbmcgICAqXG4gKiAgcGVybWlzc2lvbnMgYW5kIGxpbWl0YXRpb25zIHVuZGVyIHRoZSBMaWNlbnNlLiAgICAgICAgICAgICAgICAgICAgICAgICAgICAqXG4gKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbmltcG9ydCAqIGFzIGNkayBmcm9tICdAYXdzLWNkay9jb3JlJztcbmltcG9ydCAqIGFzIHNzbSBmcm9tICdAYXdzLWNkay9hd3Mtc3NtJztcbmltcG9ydCAqIGFzIGZzIGZyb20gJ2ZzJztcbmltcG9ydCAqIGFzIHlhbWwgZnJvbSAnanMteWFtbCc7XG5pbXBvcnQgKiBhcyBzZm4gZnJvbSAnQGF3cy1jZGsvYXdzLXN0ZXBmdW5jdGlvbnMnO1xuaW1wb3J0ICogYXMgZXZlbnRzIGZyb20gJ0Bhd3MtY2RrL2F3cy1ldmVudHMnO1xuaW1wb3J0IHtcbiAgICBFZmZlY3QsXG4gICAgUG9saWN5U3RhdGVtZW50LFxuICAgIFNlcnZpY2VQcmluY2lwYWwsXG4gICAgUG9saWN5LFxuICAgIFJvbGUsXG4gICAgQ2ZuUm9sZSxcbiAgICBBcm5QcmluY2lwYWwsXG4gICAgQ29tcG9zaXRlUHJpbmNpcGFsLFxuICAgIEFjY291bnRQcmluY2lwYWxcbn0gZnJvbSAnQGF3cy1jZGsvYXdzLWlhbSc7XG5pbXBvcnQgeyBTdGF0ZU1hY2hpbmUgfSBmcm9tICdAYXdzLWNkay9hd3Mtc3RlcGZ1bmN0aW9ucyc7XG5pbXBvcnQgeyBJUnVsZVRhcmdldCwgRXZlbnRQYXR0ZXJuLCBSdWxlIH0gZnJvbSAnQGF3cy1jZGsvYXdzLWV2ZW50cyc7XG5pbXBvcnQgeyBNZW1iZXJSb2xlU3RhY2sgfSBmcm9tICcuLi9zb2x1dGlvbl9kZXBsb3kvbGliL3JlbWVkaWF0aW9uX3J1bmJvb2stc3RhY2snO1xuXG4vKlxuICogQGF1dGhvciBBV1MgU29sdXRpb25zIERldmVsb3BtZW50XG4gKiBAZGVzY3JpcHRpb24gU1NNLWJhc2VkIHJlbWVkaWF0aW9uIHBhcmFtZXRlcnNcbiAqIEB0eXBlIHtwbGF5Ym9va0NvbnN0cnVjdH1cbiAqL1xuXG5leHBvcnQgaW50ZXJmYWNlIElzc21QbGF5Ym9va1Byb3BzIHtcbiAgc2VjdXJpdHlTdGFuZGFyZDogc3RyaW5nOyAvLyBleC4gQUZTQlBcbiAgc2VjdXJpdHlTdGFuZGFyZFZlcnNpb246IHN0cmluZztcbiAgY29udHJvbElkOiBzdHJpbmc7XG4gIHNzbURvY1BhdGg6IHN0cmluZztcbiAgc3NtRG9jRmlsZU5hbWU6IHN0cmluZztcbiAgc29sdXRpb25WZXJzaW9uOiBzdHJpbmc7XG4gIHNvbHV0aW9uRGlzdEJ1Y2tldDogc3RyaW5nO1xuICBhZG1pblJvbGVOYW1lPzogc3RyaW5nO1xuICByZW1lZGlhdGlvblBvbGljeT86IFBvbGljeTtcbiAgYWRtaW5BY2NvdW50TnVtYmVyPzogc3RyaW5nO1xuICBzb2x1dGlvbklkOiBzdHJpbmc7XG4gIHNjcmlwdFBhdGg/OiBzdHJpbmc7XG4gIGNvbW1vblNjcmlwdHM/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjbGFzcyBTc21QbGF5Ym9vayBleHRlbmRzIGNkay5Db25zdHJ1Y3Qge1xuXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBjZGsuQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczogSXNzbVBsYXlib29rUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQpO1xuXG4gICAgbGV0IHNjcmlwdFBhdGggPSAnJ1xuICAgIGlmIChwcm9wcy5zY3JpcHRQYXRoID09IHVuZGVmaW5lZCApIHtcbiAgICAgICAgc2NyaXB0UGF0aCA9IGAke3Byb3BzLnNzbURvY1BhdGh9L3NjcmlwdHNgXG4gICAgfSBlbHNlIHtcbiAgICAgICAgc2NyaXB0UGF0aCA9IHByb3BzLnNjcmlwdFBhdGhcbiAgICB9XG5cbiAgICBsZXQgY29tbW9uU2NyaXB0cyA9ICcnXG4gICAgaWYgKHByb3BzLmNvbW1vblNjcmlwdHMgPT0gdW5kZWZpbmVkICkge1xuICAgICAgICBjb21tb25TY3JpcHRzID0gJy4uL2NvbW1vbidcbiAgICB9IGVsc2Uge1xuICAgICAgICBjb21tb25TY3JpcHRzID0gcHJvcHMuY29tbW9uU2NyaXB0c1xuICAgIH1cblxuICAgIGNvbnN0IGVuYWJsZVBhcmFtID0gbmV3IGNkay5DZm5QYXJhbWV0ZXIodGhpcywgJ0VuYWJsZSAnICsgcHJvcHMuY29udHJvbElkLCB7XG4gICAgICAgIHR5cGU6IFwiU3RyaW5nXCIsXG4gICAgICAgIGRlc2NyaXB0aW9uOiBgRW5hYmxlL2Rpc2FibGUgYXZhaWxhYmlsaXR5IG9mIHJlbWVkaWF0aW9uIGZvciAke3Byb3BzLnNlY3VyaXR5U3RhbmRhcmR9IHZlcnNpb24gJHtwcm9wcy5zZWN1cml0eVN0YW5kYXJkVmVyc2lvbn0gQ29udHJvbCAke3Byb3BzLmNvbnRyb2xJZH0gaW4gU2VjdXJpdHkgSHViIENvbnNvbGUgQ3VzdG9tIEFjdGlvbnMuIElmIE5PVCBBdmFpbGFibGUgdGhlIHJlbWVkaWF0aW9uIGNhbm5vdCBiZSB0cmlnZ2VyZWQgZnJvbSB0aGUgU2VjdXJpdHkgSHViIGNvbnNvbGUgaW4gdGhlIFNlY3VyaXR5IEh1YiBBZG1pbiBhY2NvdW50LmAsXG4gICAgICAgIGRlZmF1bHQ6IFwiQXZhaWxhYmxlXCIsXG4gICAgICAgIGFsbG93ZWRWYWx1ZXM6IFtcIkF2YWlsYWJsZVwiLCBcIk5PVCBBdmFpbGFibGVcIl1cbiAgICB9KVxuXG4gICAgY29uc3QgaW5zdGFsbFNzbURvYyA9IG5ldyBjZGsuQ2ZuQ29uZGl0aW9uKHRoaXMsICdFbmFibGUgJyArIHByb3BzLmNvbnRyb2xJZCArICcgQ29uZGl0aW9uJywge1xuICAgICAgICBleHByZXNzaW9uOiBjZGsuRm4uY29uZGl0aW9uRXF1YWxzKGVuYWJsZVBhcmFtLCBcIkF2YWlsYWJsZVwiKVxuICAgIH0pXG5cbiAgICBsZXQgc3NtRG9jTmFtZSA9IGBTSEFSUi0ke3Byb3BzLnNlY3VyaXR5U3RhbmRhcmR9XyR7cHJvcHMuc2VjdXJpdHlTdGFuZGFyZFZlcnNpb259XyR7cHJvcHMuY29udHJvbElkfWBcbiAgICBsZXQgc3NtRG9jRlFGaWxlTmFtZSA9IGAke3Byb3BzLnNzbURvY1BhdGh9LyR7cHJvcHMuc3NtRG9jRmlsZU5hbWV9YFxuICAgIGxldCBzc21Eb2NUeXBlID0gcHJvcHMuc3NtRG9jRmlsZU5hbWUuc3Vic3RyaW5nKHByb3BzLnNzbURvY0ZpbGVOYW1lLmxlbmd0aCAtIDQpLnRvTG93ZXJDYXNlKClcblxuICAgIGxldCBzc21Eb2NJbiA9IGZzLnJlYWRGaWxlU3luYyhzc21Eb2NGUUZpbGVOYW1lLCAndXRmOCcpXG5cbiAgICBsZXQgc3NtRG9jT3V0OiBzdHJpbmcgPSAnJ1xuICAgIGNvbnN0IHJlID0gL14oPzxwYWRkaW5nPlxccyspJSVTQ1JJUFQ9KD88c2NyaXB0Pi4qKSUlL1xuXG4gICAgZm9yIChsZXQgbGluZSBvZiBzc21Eb2NJbi5zcGxpdCgnXFxuJykpIHtcbiAgICAgICAgbGV0IGZvdW5kTWF0Y2ggPSByZS5leGVjKGxpbmUpXG4gICAgICAgIGlmIChmb3VuZE1hdGNoICYmIGZvdW5kTWF0Y2guZ3JvdXBzICYmIGZvdW5kTWF0Y2guZ3JvdXBzLnNjcmlwdCkge1xuICAgICAgICAgICAgbGV0IHBhdGhBbmRGaWxlVG9JbnNlcnQgPSBmb3VuZE1hdGNoLmdyb3Vwcy5zY3JpcHRcbiAgICAgICAgICAgIC8vIElmIGEgcmVsYXRpdmUgcGF0aCBpcyBwcm92aWRlZCB0aGVuIHVzZSBpdFxuICAgICAgICAgICAgaWYgKHBhdGhBbmRGaWxlVG9JbnNlcnQuc3Vic3RyaW5nKDAsNykgPT09ICdjb21tb24vJykge1xuICAgICAgICAgICAgICAgIHBhdGhBbmRGaWxlVG9JbnNlcnQgPSBgJHtjb21tb25TY3JpcHRzfS8ke3BhdGhBbmRGaWxlVG9JbnNlcnQuc3Vic3RyaW5nKDcpfWBcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcGF0aEFuZEZpbGVUb0luc2VydCA9IGAke3NjcmlwdFBhdGh9LyR7cGF0aEFuZEZpbGVUb0luc2VydH1gXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBsZXQgc2NyaXB0SW4gPSBmcy5yZWFkRmlsZVN5bmMocGF0aEFuZEZpbGVUb0luc2VydCwgJ3V0ZjgnKVxuICAgICAgICAgICAgZm9yIChsZXQgc2NyaXB0TGluZSBvZiBzY3JpcHRJbi5zcGxpdCgnXFxuJykpIHtcbiAgICAgICAgICAgICAgICBzc21Eb2NPdXQgKz0gZm91bmRNYXRjaC5ncm91cHMucGFkZGluZyArIHNjcmlwdExpbmUgKyAnXFxuJ1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgc3NtRG9jT3V0ICs9IGxpbmUgKyAnXFxuJ1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgbGV0IHNzbURvY1NvdXJjZSA9IHVuZGVmaW5lZFxuICAgIGlmIChzc21Eb2NUeXBlID09ICdqc29uJykge1xuICAgICAgICBzc21Eb2NTb3VyY2UgPSBKU09OLnBhcnNlKHNzbURvY091dClcbiAgICB9IGVsc2UgaWYgKHNzbURvY1R5cGUgPT0gJ3lhbWwnKSB7XG4gICAgICAgIHNzbURvY1NvdXJjZSA9IHlhbWwubG9hZChzc21Eb2NPdXQpXG4gICAgfVxuXG4gICAgY29uc3QgQXV0b0RvYyA9IG5ldyBzc20uQ2ZuRG9jdW1lbnQodGhpcywgJ0F1dG9tYXRpb24gRG9jdW1lbnQnLCB7XG4gICAgICAgIGNvbnRlbnQ6IHNzbURvY1NvdXJjZSxcbiAgICAgICAgZG9jdW1lbnRUeXBlOiAnQXV0b21hdGlvbicsXG4gICAgICAgIG5hbWU6IHNzbURvY05hbWUsXG4gICAgICAgIHZlcnNpb25OYW1lOiBwcm9wcy5zb2x1dGlvblZlcnNpb25cbiAgICB9KVxuICAgIEF1dG9Eb2MuY2ZuT3B0aW9ucy5jb25kaXRpb24gPSBpbnN0YWxsU3NtRG9jXG4gIH1cbn1cblxuLypcbiAqIEBhdXRob3IgQVdTIFNvbHV0aW9ucyBEZXZlbG9wbWVudFxuICogQGRlc2NyaXB0aW9uIFNTTS1iYXNlZCByZW1lZGlhdGlvbiB0cmlnZ2VyXG4gKiBAdHlwZSB7dHJpZ2dlcn1cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBJVHJpZ2dlclByb3BzIHtcbiAgICBkZXNjcmlwdGlvbj86IHN0cmluZyxcbiAgICBzZWN1cml0eVN0YW5kYXJkOiBzdHJpbmc7ICAgICAvLyBleC4gQUZTQlBcbiAgICBnZW5lcmF0b3JJZDogc3RyaW5nOyAgICAvLyBleC4gXCJhcm46YXdzLWNuOnNlY3VyaXR5aHViOjo6cnVsZXNldC9jaXMtYXdzLWZvdW5kYXRpb25zLWJlbmNobWFyay92LzEuMi4wXCJcbiAgICBjb250cm9sSWQ6IHN0cmluZztcbiAgICB0YXJnZXRBcm46IHN0cmluZztcbn1cblxuZXhwb3J0IGNsYXNzIFRyaWdnZXIgZXh0ZW5kcyBjZGsuQ29uc3RydWN0IHtcblxuICBjb25zdHJ1Y3RvcihzY29wZTogY2RrLkNvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IElUcmlnZ2VyUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQpO1xuICAgIGxldCBpbGxlZ2FsQ2hhcnMgPSAvW1xcLl0vZztcblxuICAgIC8vIEV2ZW50IHRvIFN0ZXAgRnVuY3Rpb25cbiAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAgLy8gQ3JlYXRlIENXRSBydWxlXG4gICAgLy8gQ3JlYXRlIGN1c3RvbSBhY3Rpb25cblxuICAgIGxldCBkZXNjcmlwdGlvbiA9IGBSZW1lZGlhdGUgJHtwcm9wcy5zZWN1cml0eVN0YW5kYXJkfSAke3Byb3BzLmNvbnRyb2xJZH1gXG4gICAgaWYgKHByb3BzLmRlc2NyaXB0aW9uKSB7XG4gICAgICAgIGRlc2NyaXB0aW9uID0gcHJvcHMuZGVzY3JpcHRpb25cbiAgICB9XG5cbiAgICBsZXQgd29ya2Zsb3dTdGF0dXNGaWx0ZXIgPSB7XG4gICAgICAgIFwiU3RhdHVzXCI6IFsgXCJORVdcIiBdXG4gICAgfVxuICAgIGxldCBjb21wbGlhbmNlU3RhdHVzRmlsdGVyID0ge1xuICAgICAgICBcIlN0YXR1c1wiOiBbIFwiRkFJTEVEXCIsIFwiV0FSTklOR1wiIF1cbiAgICB9XG4gICAgY29uc3QgcmVjb3JkU3RhdGVGaWx0ZXI6IHN0cmluZ1tdID0gW1xuICAgICAgICAnQUNUSVZFJ1xuICAgIF07XG5cbiAgICBjb25zdCBzdGF0ZU1hY2hpbmUgPSBzZm4uU3RhdGVNYWNoaW5lLmZyb21TdGF0ZU1hY2hpbmVBcm4odGhpcywgJ29yY2hlc3RyYXRvcicsIHByb3BzLnRhcmdldEFybik7XG5cbiAgICAvLyBDcmVhdGUgYW4gSUFNIHJvbGUgZm9yIEV2ZW50cyB0byBzdGFydCB0aGUgU3RhdGUgTWFjaGluZVxuICAgIGNvbnN0IGV2ZW50c1JvbGUgPSBuZXcgUm9sZSh0aGlzLCAnRXZlbnRzUnVsZVJvbGUnLCB7XG4gICAgICBhc3N1bWVkQnk6IG5ldyBTZXJ2aWNlUHJpbmNpcGFsKCdldmVudHMuYW1hem9uYXdzLmNvbScpXG4gICAgfSk7XG5cbiAgICAvLyBHcmFudCB0aGUgc3RhcnQgZXhlY3V0aW9uIHBlcm1pc3Npb24gdG8gdGhlIEV2ZW50cyBzZXJ2aWNlXG4gICAgc3RhdGVNYWNoaW5lLmdyYW50U3RhcnRFeGVjdXRpb24oZXZlbnRzUm9sZSk7XG5cbiAgICAvLyBDcmVhdGUgYW4gZXZlbnQgcnVsZSB0byB0cmlnZ2VyIHRoZSBzdGVwIGZ1bmN0aW9uXG4gICAgY29uc3Qgc3RhdGVNYWNoaW5lVGFyZ2V0OiBldmVudHMuSVJ1bGVUYXJnZXQgPSB7XG4gICAgICBiaW5kOiAoKSA9PiAoe1xuICAgICAgICBpZDogJycsXG4gICAgICAgIGFybjogcHJvcHMudGFyZ2V0QXJuLFxuICAgICAgICByb2xlOiBldmVudHNSb2xlXG4gICAgICB9KVxuICAgIH07XG5cbiAgICBjb25zdCBlbmFibGVfYXV0b19yZW1lZGlhdGlvbl9wYXJhbSA9IG5ldyBjZGsuQ2ZuUGFyYW1ldGVyKHRoaXMsICdBdXRvRW5hYmxlJywge1xuICAgICAgICBkZXNjcmlwdGlvbjogXCJUaGlzIHdpbGwgZnVsbHkgZW5hYmxlIGF1dG9tYXRlZCByZW1lZGlhdGlvbiBmb3IgXCIrIHByb3BzLnNlY3VyaXR5U3RhbmRhcmQgKyAnICcgKyBwcm9wcy5jb250cm9sSWQsXG4gICAgICAgIHR5cGU6IFwiU3RyaW5nXCIsXG4gICAgICAgIGFsbG93ZWRWYWx1ZXM6IFtcIkVOQUJMRURcIiwgXCJESVNBQkxFRFwiXSxcbiAgICAgICAgZGVmYXVsdDogXCJESVNBQkxFRFwiXG4gICAgfSk7XG5cbiAgICBlbmFibGVfYXV0b19yZW1lZGlhdGlvbl9wYXJhbS5vdmVycmlkZUxvZ2ljYWxJZChgJHtwcm9wcy5zZWN1cml0eVN0YW5kYXJkfSR7cHJvcHMuY29udHJvbElkLnJlcGxhY2UoaWxsZWdhbENoYXJzLCAnJyl9QXV0b1RyaWdnZXJgKVxuXG4gICAgaW50ZXJmYWNlIElQYXR0ZXJuIHtcbiAgICAgICAgc291cmNlOiBhbnksXG4gICAgICAgIGRldGFpbFR5cGU6IGFueVxuICAgICAgICBkZXRhaWw6IGFueVxuICAgIH1cbiAgICBsZXQgZXZlbnRQYXR0ZXJuOiBJUGF0dGVybiA9IHtcbiAgICAgICAgc291cmNlOiBbXCJhd3Muc2VjdXJpdHlodWJcIl0sXG4gICAgICAgIGRldGFpbFR5cGU6IFtcIlNlY3VyaXR5IEh1YiBGaW5kaW5ncyAtIEltcG9ydGVkXCJdLFxuICAgICAgICBkZXRhaWw6IHtcbiAgICAgICAgICAgIGZpbmRpbmdzOiB7XG4gICAgICAgICAgICAgICAgLy8gR2VuZXJhdG9ySWQgaW5jbHVkZXMgYm90aCBzdGFuZGFyZCBhbmQgY29udHJvbC9ydWxlIElEXG4gICAgICAgICAgICAgICAgR2VuZXJhdG9ySWQ6IFtwcm9wcy5nZW5lcmF0b3JJZF0sXG4gICAgICAgICAgICAgICAgV29ya2Zsb3c6IHdvcmtmbG93U3RhdHVzRmlsdGVyLFxuICAgICAgICAgICAgICAgIENvbXBsaWFuY2U6IGNvbXBsaWFuY2VTdGF0dXNGaWx0ZXIsXG4gICAgICAgICAgICAgICAgUmVjb3JkU3RhdGU6IHJlY29yZFN0YXRlRmlsdGVyXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBsZXQgdHJpZ2dlclBhdHRlcm46IGV2ZW50cy5FdmVudFBhdHRlcm4gPSBldmVudFBhdHRlcm5cblxuICAgIC8vIEFkZGluZyBhbiBhdXRvbWF0ZWQgZXZlbiBydWxlIGZvciB0aGUgcGxheWJvb2tcbiAgICBjb25zdCBldmVudFJ1bGVfYXV0byA9IG5ldyBldmVudHMuUnVsZSh0aGlzLCAnQXV0b0V2ZW50UnVsZScsIHtcbiAgICAgICAgZGVzY3JpcHRpb246IGRlc2NyaXB0aW9uICsgJyBhdXRvbWF0aWMgcmVtZWRpYXRpb24gdHJpZ2dlciBldmVudCBydWxlLicsXG4gICAgICAgIHJ1bGVOYW1lOiBgJHtwcm9wcy5zZWN1cml0eVN0YW5kYXJkfV8ke3Byb3BzLmNvbnRyb2xJZH1fQXV0b1RyaWdnZXJgLFxuICAgICAgICB0YXJnZXRzOiBbc3RhdGVNYWNoaW5lVGFyZ2V0XSxcbiAgICAgICAgZXZlbnRQYXR0ZXJuOiB0cmlnZ2VyUGF0dGVyblxuICAgIH0pO1xuXG4gICAgY29uc3QgY2ZuRXZlbnRSdWxlX2F1dG8gPSBldmVudFJ1bGVfYXV0by5ub2RlLmRlZmF1bHRDaGlsZCBhcyBldmVudHMuQ2ZuUnVsZTtcbiAgICBjZm5FdmVudFJ1bGVfYXV0by5hZGRQcm9wZXJ0eU92ZXJyaWRlKCdTdGF0ZScsIGVuYWJsZV9hdXRvX3JlbWVkaWF0aW9uX3BhcmFtLnZhbHVlQXNTdHJpbmcpO1xuICB9XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSU9uZVRyaWdnZXJQcm9wcyB7XG4gICAgZGVzY3JpcHRpb24/OiBzdHJpbmcsXG4gICAgdGFyZ2V0QXJuOiBzdHJpbmc7XG4gICAgc2VydmljZVRva2VuOiBzdHJpbmc7XG4gICAgcHJlcmVxOiBjZGsuQ2ZuUmVzb3VyY2VbXTtcbn1cbmV4cG9ydCBjbGFzcyBPbmVUcmlnZ2VyIGV4dGVuZHMgY2RrLkNvbnN0cnVjdCB7XG4vLyB1c2VkIGluIHBsYWNlIG9mIFRyaWdnZXIuIFNlbmRzIGFsbCBmaW5kaW5nIGV2ZW50cyBmb3Igd2hpY2ggdGhlXG4vLyBTSEFSUiBjdXN0b20gYWN0aW9uIGlzIGluaXRpYXRlZCB0byB0aGUgU3RlcCBGdW5jdGlvblxuXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBjZGsuQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczogSU9uZVRyaWdnZXJQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCk7XG4gICAgY29uc3Qgc3RhY2sgPSBjZGsuU3RhY2sub2YodGhpcylcblxuICAgIC8vIEV2ZW50IHRvIFN0ZXAgRnVuY3Rpb25cbiAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAgLy8gQ3JlYXRlIENXRSBydWxlXG4gICAgLy8gQ3JlYXRlIGN1c3RvbSBhY3Rpb25cblxuICAgIGxldCBkZXNjcmlwdGlvbiA9IGBSZW1lZGlhdGUgd2l0aCBTSEFSUmBcbiAgICBpZiAocHJvcHMuZGVzY3JpcHRpb24pIHtcbiAgICAgICAgZGVzY3JpcHRpb24gPSBwcm9wcy5kZXNjcmlwdGlvblxuICAgIH1cblxuICAgIGxldCBjb21wbGlhbmNlU3RhdHVzRmlsdGVyID0ge1xuICAgICAgICBcIlN0YXR1c1wiOiBbIFwiRkFJTEVEXCIsIFwiV0FSTklOR1wiIF1cbiAgICB9XG5cbiAgICBjb25zdCBzdGF0ZU1hY2hpbmUgPSBTdGF0ZU1hY2hpbmUuZnJvbVN0YXRlTWFjaGluZUFybih0aGlzLCAnb3JjaGVzdHJhdG9yJywgcHJvcHMudGFyZ2V0QXJuKTtcblxuICAgIC8vIE5vdGU6IElkIGlzIG1heCAyMCBjaGFyYWN0ZXJzXG4gICAgY29uc3QgY3VzdG9tQWN0aW9uID0gbmV3IGNkay5DdXN0b21SZXNvdXJjZSh0aGlzLCAnQ3VzdG9tIEFjdGlvbicsIHtcbiAgICAgICAgc2VydmljZVRva2VuOiBwcm9wcy5zZXJ2aWNlVG9rZW4sXG4gICAgICAgIHJlc291cmNlVHlwZTogJ0N1c3RvbTo6QWN0aW9uVGFyZ2V0JyxcbiAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgTmFtZTogJ1JlbWVkaWF0ZSB3aXRoIFNIQVJSJyxcbiAgICAgICAgICAgIERlc2NyaXB0aW9uOiAnU3VibWl0IHRoZSBmaW5kaW5nIHRvIEFXUyBTZWN1cml0eSBIdWIgQXV0b21hdGVkIFJlc3BvbnNlIGFuZCBSZW1lZGlhdGlvbicsXG4gICAgICAgICAgICBJZDogJ1NIQVJSUmVtZWRpYXRpb24nXG4gICAgICAgIH1cbiAgICB9KTtcbiAgICB7XG4gICAgICAgIGxldCBjaGlsZCA9IGN1c3RvbUFjdGlvbi5ub2RlLmRlZmF1bHRDaGlsZCBhcyBjZGsuQ2ZuQ3VzdG9tUmVzb3VyY2VcbiAgICAgICAgZm9yICh2YXIgcHJlcmVxIG9mIHByb3BzLnByZXJlcSkge1xuICAgICAgICAgICAgY2hpbGQuYWRkRGVwZW5kc09uKHByZXJlcSlcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIENyZWF0ZSBhbiBJQU0gcm9sZSBmb3IgRXZlbnRzIHRvIHN0YXJ0IHRoZSBTdGF0ZSBNYWNoaW5lXG4gICAgY29uc3QgZXZlbnRzUm9sZSA9IG5ldyBSb2xlKHRoaXMsICdFdmVudHNSdWxlUm9sZScsIHtcbiAgICBhc3N1bWVkQnk6IG5ldyBTZXJ2aWNlUHJpbmNpcGFsKCdldmVudHMuYW1hem9uYXdzLmNvbScpXG4gICAgfSk7XG5cbiAgICAvLyBHcmFudCB0aGUgc3RhcnQgZXhlY3V0aW9uIHBlcm1pc3Npb24gdG8gdGhlIEV2ZW50cyBzZXJ2aWNlXG4gICAgc3RhdGVNYWNoaW5lLmdyYW50U3RhcnRFeGVjdXRpb24oZXZlbnRzUm9sZSk7XG5cbiAgICAvLyBDcmVhdGUgYW4gZXZlbnQgcnVsZSB0byB0cmlnZ2VyIHRoZSBzdGVwIGZ1bmN0aW9uXG4gICAgY29uc3Qgc3RhdGVNYWNoaW5lVGFyZ2V0OiBJUnVsZVRhcmdldCA9IHtcbiAgICAgICAgYmluZDogKCkgPT4gKHtcbiAgICAgICAgICAgIGlkOiAnJyxcbiAgICAgICAgICAgIGFybjogcHJvcHMudGFyZ2V0QXJuLFxuICAgICAgICAgICAgcm9sZTogZXZlbnRzUm9sZVxuICAgICAgICB9KVxuICAgIH07XG5cbiAgICBsZXQgZXZlbnRQYXR0ZXJuOiBFdmVudFBhdHRlcm4gPSB7XG4gICAgICAgIHNvdXJjZTogW1wiYXdzLnNlY3VyaXR5aHViXCJdLFxuICAgICAgICBkZXRhaWxUeXBlOiBbXCJTZWN1cml0eSBIdWIgRmluZGluZ3MgLSBDdXN0b20gQWN0aW9uXCJdLFxuICAgICAgICByZXNvdXJjZXM6IFsgY3VzdG9tQWN0aW9uLmdldEF0dFN0cmluZygnQXJuJykgXSxcbiAgICAgICAgZGV0YWlsOiB7XG4gICAgICAgICAgICBmaW5kaW5nczoge1xuICAgICAgICAgICAgICAgIENvbXBsaWFuY2U6IGNvbXBsaWFuY2VTdGF0dXNGaWx0ZXJcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIG5ldyBSdWxlKHRoaXMsICdSZW1lZGlhdGUgQ3VzdG9tIEFjdGlvbicsIHtcbiAgICAgICAgZGVzY3JpcHRpb246IGRlc2NyaXB0aW9uLFxuICAgICAgICBlbmFibGVkOiB0cnVlLFxuICAgICAgICBldmVudFBhdHRlcm46IGV2ZW50UGF0dGVybixcbiAgICAgICAgcnVsZU5hbWU6IGBSZW1lZGlhdGVfd2l0aF9TSEFSUl9DdXN0b21BY3Rpb25gLFxuICAgICAgICB0YXJnZXRzOiBbc3RhdGVNYWNoaW5lVGFyZ2V0XVxuICAgIH0pXG4gIH1cbn1cblxuZXhwb3J0IGludGVyZmFjZSBSb2xlUHJvcHMge1xuICAgIHJlYWRvbmx5IHNvbHV0aW9uSWQ6IHN0cmluZztcbiAgICByZWFkb25seSBzc21Eb2NOYW1lOiBzdHJpbmc7XG4gICAgcmVhZG9ubHkgcmVtZWRpYXRpb25Qb2xpY3k6IFBvbGljeTtcbiAgICByZWFkb25seSByZW1lZGlhdGlvblJvbGVOYW1lOiBzdHJpbmc7XG59O1xuXG5leHBvcnQgY2xhc3MgU3NtUm9sZSBleHRlbmRzIGNkay5Db25zdHJ1Y3Qge1xuXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBjZGsuQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczogUm9sZVByb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkKTtcbiAgICBjb25zdCBzdGFjayA9IGNkay5TdGFjay5vZih0aGlzKVxuICAgIGNvbnN0IHJvbGVTdGFjayA9IE1lbWJlclJvbGVTdGFjay5vZih0aGlzKSBhcyBNZW1iZXJSb2xlU3RhY2s7XG4gICAgY29uc3QgYmFzZVBvbGljeSA9IG5ldyBQb2xpY3kodGhpcywgJ1NIQVJSLU1lbWJlci1CYXNlLVBvbGljeScpXG4gICAgY29uc3QgYWRtaW5BY2NvdW50ID0gcm9sZVN0YWNrLm5vZGUuZmluZENoaWxkKCdBZG1pbkFjY291bnRQYXJhbWV0ZXInKS5ub2RlLmZpbmRDaGlsZCgnQWRtaW4gQWNjb3VudCBOdW1iZXInKSBhcyBjZGsuQ2ZuUGFyYW1ldGVyO1xuXG4gICAgYmFzZVBvbGljeS5hZGRTdGF0ZW1lbnRzKFxuICAgICAgICBuZXcgUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgICAgICAgICBcInNzbTpHZXRQYXJhbWV0ZXJzXCIsXG4gICAgICAgICAgICAgICAgXCJzc206R2V0UGFyYW1ldGVyXCIsXG4gICAgICAgICAgICAgICAgXCJzc206UHV0UGFyYW1ldGVyXCJcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgICByZXNvdXJjZXM6IFtcbiAgICAgICAgICAgICAgICBgYXJuOiR7c3RhY2sucGFydGl0aW9ufTpzc206Kjoke3N0YWNrLmFjY291bnR9OnBhcmFtZXRlci9Tb2x1dGlvbnMvU08wMTExLypgXG4gICAgICAgICAgICBdLFxuICAgICAgICAgICAgZWZmZWN0OiBFZmZlY3QuQUxMT1dcbiAgICAgICAgfSksXG4gICAgICAgIG5ldyBQb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICAgICAgYWN0aW9uczogW1xuICAgICAgICAgICAgICAgIFwiaWFtOlBhc3NSb2xlXCJcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgICByZXNvdXJjZXM6IFtcbiAgICAgICAgICAgICAgICBgYXJuOiR7c3RhY2sucGFydGl0aW9ufTppYW06OiR7c3RhY2suYWNjb3VudH06cm9sZS8ke3Byb3BzLnJlbWVkaWF0aW9uUm9sZU5hbWV9YFxuICAgICAgICAgICAgXSxcbiAgICAgICAgICAgIGVmZmVjdDogRWZmZWN0LkFMTE9XXG4gICAgICAgIH0pLFxuICAgICAgICBuZXcgUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgICAgICAgICBcInNzbTpTdGFydEF1dG9tYXRpb25FeGVjdXRpb25cIixcbiAgICAgICAgICAgICAgICBcInNzbTpHZXRBdXRvbWF0aW9uRXhlY3V0aW9uXCIsXG4gICAgICAgICAgICAgICAgXCJzc206RGVzY3JpYmVBdXRvbWF0aW9uU3RlcEV4ZWN1dGlvbnNcIlxuICAgICAgICAgICAgXSxcbiAgICAgICAgICAgIHJlc291cmNlczogW1xuICAgICAgICAgICAgICAgIGBhcm46JHtzdGFjay5wYXJ0aXRpb259OnNzbToqOiR7c3RhY2suYWNjb3VudH06ZG9jdW1lbnQvU29sdXRpb25zL1NIQVJSLSR7cHJvcHMucmVtZWRpYXRpb25Sb2xlTmFtZX1gLFxuICAgICAgICAgICAgICAgIGBhcm46JHtzdGFjay5wYXJ0aXRpb259OnNzbToqOiR7c3RhY2suYWNjb3VudH06YXV0b21hdGlvbi1kZWZpbml0aW9uLypgLFxuICAgICAgICAgICAgICAgIGBhcm46JHtzdGFjay5wYXJ0aXRpb259OnNzbToqOjphdXRvbWF0aW9uLWRlZmluaXRpb24vKmAsXG4gICAgICAgICAgICAgICAgYGFybjoke3N0YWNrLnBhcnRpdGlvbn06c3NtOio6JHtzdGFjay5hY2NvdW50fTphdXRvbWF0aW9uLWV4ZWN1dGlvbi8qYFxuICAgICAgICAgICAgXSxcbiAgICAgICAgICAgIGVmZmVjdDogRWZmZWN0LkFMTE9XXG4gICAgICAgIH0pLFxuICAgICAgICBuZXcgUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgICAgICAgICBcInN0czpBc3N1bWVSb2xlXCJcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgICByZXNvdXJjZXM6IFtcbiAgICAgICAgICAgICAgICBgYXJuOiR7c3RhY2sucGFydGl0aW9ufTppYW06OiR7c3RhY2suYWNjb3VudH06cm9sZS8ke3Byb3BzLnJlbWVkaWF0aW9uUm9sZU5hbWV9YFxuICAgICAgICAgICAgXSxcbiAgICAgICAgICAgIGVmZmVjdDogRWZmZWN0LkFMTE9XXG4gICAgICAgIH0pXG4gICAgKVxuXG4gICAgLy8gQXNzdW1lUm9sZSBQb2xpY3lcbiAgICBsZXQgcHJpbmNpcGFsUG9saWN5U3RhdGVtZW50ID0gbmV3IFBvbGljeVN0YXRlbWVudCgpO1xuICAgIHByaW5jaXBhbFBvbGljeVN0YXRlbWVudC5hZGRBY3Rpb25zKFwic3RzOkFzc3VtZVJvbGVcIik7XG4gICAgcHJpbmNpcGFsUG9saWN5U3RhdGVtZW50LmVmZmVjdCA9IEVmZmVjdC5BTExPVztcblxuICAgIGNvbnN0IFJFU09VUkNFX1BSRUZJWCA9IHByb3BzLnNvbHV0aW9uSWQucmVwbGFjZSgvXkRFVi0vLCcnKTtcbiAgICBsZXQgcm9sZXByaW5jaXBhbCA9IG5ldyBBcm5QcmluY2lwYWwoXG4gICAgICAgIGBhcm46JHtzdGFjay5wYXJ0aXRpb259OmlhbTo6JHtzdGFjay5hY2NvdW50fTpyb2xlLyR7UkVTT1VSQ0VfUFJFRklYfS1TSEFSUi1PcmNoZXN0cmF0b3ItTWVtYmVyYFxuICAgICk7XG5cbiAgICBsZXQgcHJpbmNpcGFscyA9IG5ldyBDb21wb3NpdGVQcmluY2lwYWwocm9sZXByaW5jaXBhbCk7XG4gICAgcHJpbmNpcGFscy5hZGRUb1BvbGljeShwcmluY2lwYWxQb2xpY3lTdGF0ZW1lbnQpO1xuXG4gICAgbGV0IHNlcnZpY2VwcmluY2lwYWwgPSBuZXcgU2VydmljZVByaW5jaXBhbCgnc3NtLmFtYXpvbmF3cy5jb20nKVxuICAgIHByaW5jaXBhbHMuYWRkUHJpbmNpcGFscyhzZXJ2aWNlcHJpbmNpcGFsKTtcblxuICAgIC8vIE11bHRpLWFjY291bnQvcmVnaW9uIGF1dG9tYXRpb25zIG11c3QgYmUgYWJsZSB0byBhc3N1bWUgdGhlIHJlbWVkaWF0aW9uIHJvbGVcbiAgICBjb25zdCBhY2NvdW50UHJpbmNpcGFsID0gbmV3IEFjY291bnRQcmluY2lwYWwoc3RhY2suYWNjb3VudCk7XG4gICAgcHJpbmNpcGFscy5hZGRQcmluY2lwYWxzKGFjY291bnRQcmluY2lwYWwpO1xuXG4gICAgbGV0IG1lbWJlclJvbGUgPSBuZXcgUm9sZSh0aGlzLCAnTWVtYmVyQWNjb3VudFJvbGUnLCB7XG4gICAgICAgIGFzc3VtZWRCeTogcHJpbmNpcGFscyxcbiAgICAgICAgcm9sZU5hbWU6IHByb3BzLnJlbWVkaWF0aW9uUm9sZU5hbWVcbiAgICB9KTtcblxuICAgIG1lbWJlclJvbGUuYXR0YWNoSW5saW5lUG9saWN5KGJhc2VQb2xpY3kpXG4gICAgbWVtYmVyUm9sZS5hdHRhY2hJbmxpbmVQb2xpY3kocHJvcHMucmVtZWRpYXRpb25Qb2xpY3kpXG4gICAgbWVtYmVyUm9sZS5hcHBseVJlbW92YWxQb2xpY3koY2RrLlJlbW92YWxQb2xpY3kuUkVUQUlOKVxuICAgIG1lbWJlclJvbGUubm9kZS5hZGREZXBlbmRlbmN5KHJvbGVTdGFjay5nZXRPcmNoZXN0cmF0b3JNZW1iZXJSb2xlKCkpO1xuXG4gICAgY29uc3QgbWVtYmVyUm9sZVJlc291cmNlID0gbWVtYmVyUm9sZS5ub2RlLmZpbmRDaGlsZCgnUmVzb3VyY2UnKSBhcyBDZm5Sb2xlO1xuXG4gICAgbWVtYmVyUm9sZVJlc291cmNlLmNmbk9wdGlvbnMubWV0YWRhdGEgPSB7XG4gICAgICAgIGNmbl9uYWc6IHtcbiAgICAgICAgICAgIHJ1bGVzX3RvX3N1cHByZXNzOiBbe1xuICAgICAgICAgICAgICAgIGlkOiAnVzExJyxcbiAgICAgICAgICAgICAgICByZWFzb246ICdSZXNvdXJjZSAqIGlzIHJlcXVpcmVkIGR1ZSB0byB0aGUgYWRtaW5pc3RyYXRpdmUgbmF0dXJlIG9mIHRoZSBzb2x1dGlvbi4nXG4gICAgICAgICAgICB9LHtcbiAgICAgICAgICAgICAgICBpZDogJ1cyOCcsXG4gICAgICAgICAgICAgICAgcmVhc29uOiAnU3RhdGljIG5hbWVzIGNob3NlbiBpbnRlbnRpb25hbGx5IHRvIHByb3ZpZGUgaW50ZWdyYXRpb24gaW4gY3Jvc3MtYWNjb3VudCBwZXJtaXNzaW9ucydcbiAgICAgICAgICAgIH1dXG4gICAgICAgIH1cbiAgICB9O1xuICB9XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUmVtZWRpYXRpb25SdW5ib29rUHJvcHMge1xuICBzc21Eb2NOYW1lOiBzdHJpbmc7XG4gIHNzbURvY1BhdGg6IHN0cmluZztcbiAgc3NtRG9jRmlsZU5hbWU6IHN0cmluZztcbiAgc29sdXRpb25WZXJzaW9uOiBzdHJpbmc7XG4gIHNvbHV0aW9uRGlzdEJ1Y2tldDogc3RyaW5nO1xuICByZW1lZGlhdGlvblBvbGljeT86IFBvbGljeTtcbiAgc29sdXRpb25JZDogc3RyaW5nO1xuICBzY3JpcHRQYXRoPzogc3RyaW5nO1xufVxuXG5leHBvcnQgY2xhc3MgU3NtUmVtZWRpYXRpb25SdW5ib29rIGV4dGVuZHMgY2RrLkNvbnN0cnVjdCB7XG5cbiAgY29uc3RydWN0b3Ioc2NvcGU6IGNkay5Db25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBSZW1lZGlhdGlvblJ1bmJvb2tQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCk7XG5cbiAgICAvLyBBZGQgcHJlZml4IHRvIHNzbURvY05hbWVcbiAgICBsZXQgc3NtRG9jTmFtZSA9IGBTSEFSUi0ke3Byb3BzLnNzbURvY05hbWV9YFxuXG4gICAgbGV0IHNjcmlwdFBhdGggPSAnJ1xuICAgIGlmIChwcm9wcy5zY3JpcHRQYXRoID09IHVuZGVmaW5lZCkge1xuICAgICAgICBzY3JpcHRQYXRoID0gJ3NzbWRvY3Mvc2NyaXB0cydcbiAgICB9IGVsc2Uge1xuICAgICAgICBzY3JpcHRQYXRoID0gcHJvcHMuc2NyaXB0UGF0aFxuICAgIH1cblxuICAgIGxldCBzc21Eb2NGUUZpbGVOYW1lID0gYCR7cHJvcHMuc3NtRG9jUGF0aH0vJHtwcm9wcy5zc21Eb2NGaWxlTmFtZX1gXG4gICAgbGV0IHNzbURvY1R5cGUgPSBwcm9wcy5zc21Eb2NGaWxlTmFtZS5zdWJzdHIocHJvcHMuc3NtRG9jRmlsZU5hbWUubGVuZ3RoIC0gNCkudG9Mb3dlckNhc2UoKVxuXG4gICAgbGV0IHNzbURvY0luID0gZnMucmVhZEZpbGVTeW5jKHNzbURvY0ZRRmlsZU5hbWUsICd1dGY4JylcblxuICAgIGxldCBzc21Eb2NPdXQ6IHN0cmluZyA9ICcnXG4gICAgY29uc3QgcmUgPSAvXig/PHBhZGRpbmc+XFxzKyklJVNDUklQVD0oPzxzY3JpcHQ+LiopJSUvXG5cbiAgICBmb3IgKGxldCBsaW5lIG9mIHNzbURvY0luLnNwbGl0KCdcXG4nKSkge1xuICAgICAgICBsZXQgZm91bmRNYXRjaCA9IHJlLmV4ZWMobGluZSlcbiAgICAgICAgaWYgKGZvdW5kTWF0Y2ggJiYgZm91bmRNYXRjaC5ncm91cHMgJiYgZm91bmRNYXRjaC5ncm91cHMuc2NyaXB0KSB7XG4gICAgICAgICAgICBsZXQgc2NyaXB0SW4gPSBmcy5yZWFkRmlsZVN5bmMoYCR7c2NyaXB0UGF0aH0vJHtmb3VuZE1hdGNoLmdyb3Vwcy5zY3JpcHR9YCwgJ3V0ZjgnKVxuICAgICAgICAgICAgZm9yIChsZXQgc2NyaXB0TGluZSBvZiBzY3JpcHRJbi5zcGxpdCgnXFxuJykpIHtcbiAgICAgICAgICAgICAgICBzc21Eb2NPdXQgKz0gZm91bmRNYXRjaC5ncm91cHMucGFkZGluZyArIHNjcmlwdExpbmUgKyAnXFxuJ1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgc3NtRG9jT3V0ICs9IGxpbmUgKyAnXFxuJ1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgbGV0IHNzbURvY1NvdXJjZSA9IHVuZGVmaW5lZFxuICAgIGlmIChzc21Eb2NUeXBlID09ICdqc29uJykge1xuICAgICAgICBzc21Eb2NTb3VyY2UgPSBKU09OLnBhcnNlKHNzbURvY091dClcbiAgICB9IGVsc2UgaWYgKHNzbURvY1R5cGUgPT0gJ3lhbWwnKSB7XG4gICAgICAgIHNzbURvY1NvdXJjZSA9IHlhbWwubG9hZChzc21Eb2NPdXQpXG4gICAgfVxuXG4gICAgbmV3IHNzbS5DZm5Eb2N1bWVudCh0aGlzLCAnQXV0b21hdGlvbiBEb2N1bWVudCcsIHtcbiAgICAgICAgY29udGVudDogc3NtRG9jU291cmNlLFxuICAgICAgICBkb2N1bWVudFR5cGU6ICdBdXRvbWF0aW9uJyxcbiAgICAgICAgbmFtZTogc3NtRG9jTmFtZVxuICAgIH0pXG4gIH1cbn1cbiJdfQ==