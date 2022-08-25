"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SolutionDeployStack = void 0;
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
const s3 = require("@aws-cdk/aws-s3");
const sns = require("@aws-cdk/aws-sns");
const lambda = require("@aws-cdk/aws-lambda");
const aws_ssm_1 = require("@aws-cdk/aws-ssm");
const kms = require("@aws-cdk/aws-kms");
const fs = require("fs");
const aws_iam_1 = require("@aws-cdk/aws-iam");
const common_orchestrator_construct_1 = require("../../Orchestrator/lib/common-orchestrator-construct");
const ssmplaybook_1 = require("../../lib/ssmplaybook");
class SolutionDeployStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        this.SEND_ANONYMOUS_DATA = 'Yes';
        const stack = cdk.Stack.of(this);
        const RESOURCE_PREFIX = props.solutionId.replace(/^DEV-/, ''); // prefix on every resource name
        //-------------------------------------------------------------------------
        // Solutions Bucket - Source Code
        //
        const SolutionsBucket = s3.Bucket.fromBucketAttributes(this, 'SolutionsBucket', {
            bucketName: props.solutionDistBucket + '-' + this.region
        });
        //=========================================================================
        // MAPPINGS
        //=========================================================================
        new cdk.CfnMapping(this, 'SourceCode', {
            mapping: { "General": {
                    "S3Bucket": props.solutionDistBucket,
                    "KeyPrefix": props.solutionTMN + '/' + props.solutionVersion
                } }
        });
        //-------------------------------------------------------------------------
        // KMS Key for solution encryption
        //
        // Key Policy
        const kmsKeyPolicy = new aws_iam_1.PolicyDocument();
        const kmsServicePolicy = new aws_iam_1.PolicyStatement({
            principals: [
                new aws_iam_1.ServicePrincipal('sns.amazonaws.com'),
                new aws_iam_1.ServicePrincipal(`logs.${this.urlSuffix}`)
            ],
            actions: [
                "kms:Encrypt*",
                "kms:Decrypt*",
                "kms:ReEncrypt*",
                "kms:GenerateDataKey*",
                "kms:Describe*"
            ],
            resources: [
                '*'
            ],
            conditions: {
                ArnEquals: {
                    "kms:EncryptionContext:aws:logs:arn": this.formatArn({
                        service: 'logs',
                        resource: 'log-group:SO0111-SHARR-*'
                    })
                }
            }
        });
        kmsKeyPolicy.addStatements(kmsServicePolicy);
        const kmsRootPolicy = new aws_iam_1.PolicyStatement({
            principals: [
                new aws_iam_1.AccountRootPrincipal()
            ],
            actions: [
                'kms:*'
            ],
            resources: [
                '*'
            ]
        });
        kmsKeyPolicy.addStatements(kmsRootPolicy);
        const kmsKey = new kms.Key(this, 'SHARR-key', {
            enableKeyRotation: true,
            alias: `${RESOURCE_PREFIX}-SHARR-Key`,
            policy: kmsKeyPolicy
        });
        const kmsKeyParm = new aws_ssm_1.StringParameter(this, 'SHARR_Key', {
            description: 'KMS Customer Managed Key that SHARR will use to encrypt data',
            parameterName: `/Solutions/${RESOURCE_PREFIX}/CMK_ARN`,
            stringValue: kmsKey.keyArn
        });
        //-------------------------------------------------------------------------
        // SNS Topic for notification fanout on Playbook completion
        //
        const snsTopic = new sns.Topic(this, 'SHARR-Topic', {
            displayName: 'SHARR Playbook Topic (' + RESOURCE_PREFIX + ')',
            topicName: RESOURCE_PREFIX + '-SHARR_Topic',
            masterKey: kmsKey
        });
        new aws_ssm_1.StringParameter(this, 'SHARR_SNS_Topic', {
            description: 'SNS Topic ARN where SHARR will send status messages. This\
        topic can be useful for driving additional actions, such as email notifications,\
        trouble ticket updates.',
            parameterName: '/Solutions/' + RESOURCE_PREFIX + '/SNS_Topic_ARN',
            stringValue: snsTopic.topicArn
        });
        const mapping = new cdk.CfnMapping(this, 'mappings');
        mapping.setValue("sendAnonymousMetrics", "data", this.SEND_ANONYMOUS_DATA);
        new aws_ssm_1.StringParameter(this, 'SHARR_SendAnonymousMetrics', {
            description: 'Flag to enable or disable sending anonymous metrics.',
            parameterName: '/Solutions/' + RESOURCE_PREFIX + '/sendAnonymousMetrics',
            stringValue: mapping.findInMap("sendAnonymousMetrics", "data")
        });
        new aws_ssm_1.StringParameter(this, 'SHARR_version', {
            description: 'Solution version for metrics.',
            parameterName: '/Solutions/' + RESOURCE_PREFIX + '/version',
            stringValue: props.solutionVersion
        });
        /**
         * @description Lambda Layer for common solution functions
         * @type {lambda.LayerVersion}
         */
        const sharrLambdaLayer = new lambda.LayerVersion(this, 'SharrLambdaLayer', {
            compatibleRuntimes: [
                lambda.Runtime.PYTHON_3_6,
                lambda.Runtime.PYTHON_3_7,
                lambda.Runtime.PYTHON_3_8
            ],
            description: 'SO0111 SHARR Common functions used by the solution',
            license: "https://www.apache.org/licenses/LICENSE-2.0",
            code: lambda.Code.fromBucket(SolutionsBucket, props.solutionTMN + '/' + props.solutionVersion + '/lambda/layer.zip'),
        });
        /**
         * @description Policy for role used by common Orchestrator Lambdas
         * @type {Policy}
         */
        const orchestratorPolicy = new aws_iam_1.Policy(this, 'orchestratorPolicy', {
            policyName: RESOURCE_PREFIX + '-SHARR_Orchestrator',
            statements: [
                new aws_iam_1.PolicyStatement({
                    actions: [
                        'logs:CreateLogGroup',
                        'logs:CreateLogStream',
                        'logs:PutLogEvents'
                    ],
                    resources: ['*']
                }),
                new aws_iam_1.PolicyStatement({
                    actions: [
                        'ssm:GetParameter',
                        'ssm:GetParameters',
                        'ssm:PutParameter'
                    ],
                    resources: [`arn:${this.partition}:ssm:*:${this.account}:parameter/Solutions/SO0111/*`]
                }),
                new aws_iam_1.PolicyStatement({
                    actions: [
                        'sts:AssumeRole'
                    ],
                    resources: [
                        `arn:${this.partition}:iam::*:role/${RESOURCE_PREFIX}-SHARR-Orchestrator-Member`
                        //'arn:' + this.partition + ':iam::*:role/' + RESOURCE_PREFIX +
                        //'-Remediate-*',
                    ]
                }),
                // Supports https://gitlab.aws.dev/dangibbo/sharr-remediation-framework
                new aws_iam_1.PolicyStatement({
                    actions: ['organizations:ListTagsForResource'],
                    resources: ['*']
                })
            ]
        });
        {
            let childToMod = orchestratorPolicy.node.findChild('Resource');
            childToMod.cfnOptions.metadata = {
                cfn_nag: {
                    rules_to_suppress: [{
                            id: 'W12',
                            reason: 'Resource * is required for read-only policies used by orchestrator Lambda functions.'
                        }]
                }
            };
        }
        cdk_nag.NagSuppressions.addResourceSuppressions(orchestratorPolicy, [
            { id: 'AwsSolutions-IAM5', reason: 'Resource * is required for read-only policies used by orchestrator Lambda functions.' }
        ]);
        /**
         * @description Role used by common Orchestrator Lambdas
         * @type {Role}
         */
        const orchestratorRole = new aws_iam_1.Role(this, 'orchestratorRole', {
            assumedBy: new aws_iam_1.ServicePrincipal('lambda.amazonaws.com'),
            description: 'Lambda role to allow cross account read-only SHARR orchestrator functions',
            roleName: `${RESOURCE_PREFIX}-SHARR-Orchestrator-Admin`
        });
        orchestratorRole.attachInlinePolicy(orchestratorPolicy);
        {
            let childToMod = orchestratorRole.node.findChild('Resource');
            childToMod.cfnOptions.metadata = {
                cfn_nag: {
                    rules_to_suppress: [{
                            id: 'W28',
                            reason: 'Static names chosen intentionally to provide easy integration with playbook orchestrator step functions.'
                        }]
                }
            };
        }
        /**
         * @description checkSSMDocState - get the status of an ssm document
         * @type {lambda.Function}
         */
        const checkSSMDocState = new lambda.Function(this, 'checkSSMDocState', {
            functionName: RESOURCE_PREFIX + '-SHARR-checkSSMDocState',
            handler: 'check_ssm_doc_state.lambda_handler',
            runtime: props.runtimePython,
            description: 'Checks the status of an SSM Automation Document in the target account',
            code: lambda.Code.fromBucket(SolutionsBucket, props.solutionTMN + '/' + props.solutionVersion + '/lambda/check_ssm_doc_state.py.zip'),
            environment: {
                log_level: 'info',
                AWS_PARTITION: this.partition,
                SOLUTION_ID: props.solutionId,
                SOLUTION_VERSION: props.solutionVersion
            },
            memorySize: 256,
            timeout: cdk.Duration.seconds(600),
            role: orchestratorRole,
            layers: [sharrLambdaLayer]
        });
        {
            const childToMod = checkSSMDocState.node.findChild('Resource');
            childToMod.cfnOptions.metadata = {
                cfn_nag: {
                    rules_to_suppress: [
                        {
                            id: 'W58',
                            reason: 'False positive. Access is provided via a policy'
                        },
                        {
                            id: 'W89',
                            reason: 'There is no need to run this lambda in a VPC'
                        },
                        {
                            id: 'W92',
                            reason: 'There is no need for Reserved Concurrency'
                        }
                    ]
                }
            };
        }
        /**
         * @description getApprovalRequirement - determine whether manual approval is required
         * @type {lambda.Function}
         */
        const getApprovalRequirement = new lambda.Function(this, 'getApprovalRequirement', {
            functionName: RESOURCE_PREFIX + '-SHARR-getApprovalRequirement',
            handler: 'get_approval_requirement.lambda_handler',
            runtime: props.runtimePython,
            description: 'Determines if a manual approval is required for remediation',
            code: lambda.Code.fromBucket(SolutionsBucket, props.solutionTMN + '/' + props.solutionVersion + '/lambda/get_approval_requirement.py.zip'),
            environment: {
                log_level: 'info',
                AWS_PARTITION: this.partition,
                SOLUTION_ID: props.solutionId,
                SOLUTION_VERSION: props.solutionVersion,
                WORKFLOW_RUNBOOK: ''
            },
            memorySize: 256,
            timeout: cdk.Duration.seconds(600),
            role: orchestratorRole,
            layers: [sharrLambdaLayer]
        });
        {
            const childToMod = getApprovalRequirement.node.findChild('Resource');
            childToMod.cfnOptions.metadata = {
                cfn_nag: {
                    rules_to_suppress: [{
                            id: 'W58',
                            reason: 'False positive. Access is provided via a policy'
                        }, {
                            id: 'W89',
                            reason: 'There is no need to run this lambda in a VPC'
                        },
                        {
                            id: 'W92',
                            reason: 'There is no need for Reserved Concurrency'
                        }]
                }
            };
        }
        /**
         * @description execAutomation - initiate an SSM automation document in a target account
         * @type {lambda.Function}
         */
        const execAutomation = new lambda.Function(this, 'execAutomation', {
            functionName: RESOURCE_PREFIX + '-SHARR-execAutomation',
            handler: 'exec_ssm_doc.lambda_handler',
            runtime: props.runtimePython,
            description: 'Executes an SSM Automation Document in a target account',
            code: lambda.Code.fromBucket(SolutionsBucket, props.solutionTMN + '/' + props.solutionVersion + '/lambda/exec_ssm_doc.py.zip'),
            environment: {
                log_level: 'info',
                AWS_PARTITION: this.partition,
                SOLUTION_ID: props.solutionId,
                SOLUTION_VERSION: props.solutionVersion
            },
            memorySize: 256,
            timeout: cdk.Duration.seconds(600),
            role: orchestratorRole,
            layers: [sharrLambdaLayer]
        });
        {
            const childToMod = execAutomation.node.findChild('Resource');
            childToMod.cfnOptions.metadata = {
                cfn_nag: {
                    rules_to_suppress: [{
                            id: 'W58',
                            reason: 'False positive. Access is provided via a policy'
                        }, {
                            id: 'W89',
                            reason: 'There is no need to run this lambda in a VPC'
                        },
                        {
                            id: 'W92',
                            reason: 'There is no need for Reserved Concurrency'
                        }]
                }
            };
        }
        /**
         * @description monitorSSMExecState - get the status of an ssm execution
         * @type {lambda.Function}
         */
        const monitorSSMExecState = new lambda.Function(this, 'monitorSSMExecState', {
            functionName: RESOURCE_PREFIX + '-SHARR-monitorSSMExecState',
            handler: 'check_ssm_execution.lambda_handler',
            runtime: props.runtimePython,
            description: 'Checks the status of an SSM automation document execution',
            code: lambda.Code.fromBucket(SolutionsBucket, props.solutionTMN + '/' + props.solutionVersion + '/lambda/check_ssm_execution.py.zip'),
            environment: {
                log_level: 'info',
                AWS_PARTITION: this.partition,
                SOLUTION_ID: props.solutionId,
                SOLUTION_VERSION: props.solutionVersion
            },
            memorySize: 256,
            timeout: cdk.Duration.seconds(600),
            role: orchestratorRole,
            layers: [sharrLambdaLayer]
        });
        {
            const childToMod = monitorSSMExecState.node.findChild('Resource');
            childToMod.cfnOptions.metadata = {
                cfn_nag: {
                    rules_to_suppress: [{
                            id: 'W58',
                            reason: 'False positive. Access is provided via a policy'
                        }, {
                            id: 'W89',
                            reason: 'There is no need to run this lambda in a VPC'
                        },
                        {
                            id: 'W92',
                            reason: 'There is no need for Reserved Concurrency'
                        }]
                }
            };
        }
        /**
         * @description Policy for role used by common Orchestrator notification lambda
         * @type {Policy}
         */
        const notifyPolicy = new aws_iam_1.Policy(this, 'notifyPolicy', {
            policyName: RESOURCE_PREFIX + '-SHARR_Orchestrator_Notifier',
            statements: [
                new aws_iam_1.PolicyStatement({
                    actions: [
                        'logs:CreateLogGroup',
                        'logs:CreateLogStream',
                        'logs:PutLogEvents'
                    ],
                    resources: ['*']
                }),
                new aws_iam_1.PolicyStatement({
                    actions: [
                        'securityhub:BatchUpdateFindings'
                    ],
                    resources: ['*']
                }),
                new aws_iam_1.PolicyStatement({
                    actions: [
                        'ssm:GetParameter',
                        'ssm:PutParameter'
                    ],
                    resources: [`arn:${this.partition}:ssm:${this.region}:${this.account}:parameter/Solutions/SO0111/*`]
                }),
                new aws_iam_1.PolicyStatement({
                    actions: [
                        'kms:Encrypt',
                        'kms:Decrypt',
                        'kms:GenerateDataKey',
                    ],
                    resources: [kmsKey.keyArn]
                }),
                new aws_iam_1.PolicyStatement({
                    actions: [
                        'sns:Publish'
                    ],
                    resources: [
                        `arn:${this.partition}:sns:${this.region}:${this.account}:${RESOURCE_PREFIX}-SHARR_Topic`
                    ]
                })
            ]
        });
        {
            let childToMod = notifyPolicy.node.findChild('Resource');
            childToMod.cfnOptions.metadata = {
                cfn_nag: {
                    rules_to_suppress: [{
                            id: 'W12',
                            reason: 'Resource * is required for CloudWatch Logs and Security Hub policies used by core solution Lambda function for notifications.'
                        }, {
                            id: 'W58',
                            reason: 'False positive. Access is provided via a policy'
                        }]
                }
            };
        }
        cdk_nag.NagSuppressions.addResourceSuppressions(notifyPolicy, [
            { id: 'AwsSolutions-IAM5', reason: 'Resource * is required for CloudWatch Logs and Security Hub policies used by core solution Lambda function for notifications.' }
        ]);
        notifyPolicy.attachToRole(orchestratorRole); // Any Orchestrator Lambda can send to sns
        /**
         * @description Role used by common Orchestrator Lambdas
         * @type {Role}
         */
        const notifyRole = new aws_iam_1.Role(this, 'notifyRole', {
            assumedBy: new aws_iam_1.ServicePrincipal('lambda.amazonaws.com'),
            description: 'Lambda role to perform notification and logging from orchestrator step function'
        });
        notifyRole.attachInlinePolicy(notifyPolicy);
        {
            let childToMod = notifyRole.node.findChild('Resource');
            childToMod.cfnOptions.metadata = {
                cfn_nag: {
                    rules_to_suppress: [{
                            id: 'W28',
                            reason: 'Static names chosen intentionally to provide easy integration with playbook orchestrator step functions.'
                        }]
                }
            };
        }
        /**
         * @description sendNotifications - send notifications and log messages from Orchestrator step function
         * @type {lambda.Function}
         */
        const sendNotifications = new lambda.Function(this, 'sendNotifications', {
            functionName: RESOURCE_PREFIX + '-SHARR-sendNotifications',
            handler: 'send_notifications.lambda_handler',
            runtime: props.runtimePython,
            description: 'Sends notifications and log messages',
            code: lambda.Code.fromBucket(SolutionsBucket, props.solutionTMN + '/' + props.solutionVersion + '/lambda/send_notifications.py.zip'),
            environment: {
                log_level: 'info',
                AWS_PARTITION: this.partition,
                SOLUTION_ID: props.solutionId,
                SOLUTION_VERSION: props.solutionVersion
            },
            memorySize: 256,
            timeout: cdk.Duration.seconds(600),
            role: notifyRole,
            layers: [sharrLambdaLayer]
        });
        {
            const childToMod = sendNotifications.node.findChild('Resource');
            childToMod.cfnOptions.metadata = {
                cfn_nag: {
                    rules_to_suppress: [{
                            id: 'W58',
                            reason: 'False positive. Access is provided via a policy'
                        }, {
                            id: 'W89',
                            reason: 'There is no need to run this lambda in a VPC'
                        },
                        {
                            id: 'W92',
                            reason: 'There is no need for Reserved Concurrency due to low request rate'
                        }]
                }
            };
        }
        //-------------------------------------------------------------------------
        // Custom Lambda Policy
        //
        const createCustomActionPolicy = new aws_iam_1.Policy(this, 'createCustomActionPolicy', {
            policyName: RESOURCE_PREFIX + '-SHARR_Custom_Action',
            statements: [
                new aws_iam_1.PolicyStatement({
                    actions: [
                        'cloudwatch:PutMetricData'
                    ],
                    resources: ['*']
                }),
                new aws_iam_1.PolicyStatement({
                    actions: [
                        'logs:CreateLogGroup',
                        'logs:CreateLogStream',
                        'logs:PutLogEvents'
                    ],
                    resources: ['*']
                }),
                new aws_iam_1.PolicyStatement({
                    actions: [
                        'securityhub:CreateActionTarget',
                        'securityhub:DeleteActionTarget'
                    ],
                    resources: ['*']
                }),
                new aws_iam_1.PolicyStatement({
                    actions: [
                        'ssm:GetParameter',
                        'ssm:GetParameters',
                        'ssm:PutParameter'
                    ],
                    resources: [`arn:${this.partition}:ssm:*:${this.account}:parameter/Solutions/SO0111/*`]
                }),
            ]
        });
        const createCAPolicyResource = createCustomActionPolicy.node.findChild('Resource');
        createCAPolicyResource.cfnOptions.metadata = {
            cfn_nag: {
                rules_to_suppress: [{
                        id: 'W12',
                        reason: 'Resource * is required for CloudWatch Logs policies used on Lambda functions.'
                    }]
            }
        };
        cdk_nag.NagSuppressions.addResourceSuppressions(createCustomActionPolicy, [
            { id: 'AwsSolutions-IAM5', reason: 'Resource * is required for CloudWatch Logs policies used on Lambda functions.' }
        ]);
        //-------------------------------------------------------------------------
        // Custom Lambda Role
        //
        const createCustomActionRole = new aws_iam_1.Role(this, 'createCustomActionRole', {
            assumedBy: new aws_iam_1.ServicePrincipal('lambda.amazonaws.com'),
            description: 'Lambda role to allow creation of Security Hub Custom Actions'
        });
        createCustomActionRole.attachInlinePolicy(createCustomActionPolicy);
        const createCARoleResource = createCustomActionRole.node.findChild('Resource');
        createCARoleResource.cfnOptions.metadata = {
            cfn_nag: {
                rules_to_suppress: [{
                        id: 'W28',
                        reason: 'Static names chosen intentionally to provide easy integration with playbook templates'
                    }]
            }
        };
        //-------------------------------------------------------------------------
        // Custom Lambda - Create Custom Action
        //
        const createCustomAction = new lambda.Function(this, 'CreateCustomAction', {
            functionName: RESOURCE_PREFIX + '-SHARR-CustomAction',
            handler: 'createCustomAction.lambda_handler',
            runtime: props.runtimePython,
            description: 'Custom resource to create an action target in Security Hub',
            code: lambda.Code.fromBucket(SolutionsBucket, props.solutionTMN + '/' + props.solutionVersion + '/lambda/createCustomAction.py.zip'),
            environment: {
                log_level: 'info',
                AWS_PARTITION: this.partition,
                sendAnonymousMetrics: mapping.findInMap("sendAnonymousMetrics", "data"),
                SOLUTION_ID: props.solutionId,
                SOLUTION_VERSION: props.solutionVersion
            },
            memorySize: 256,
            timeout: cdk.Duration.seconds(600),
            role: createCustomActionRole,
            layers: [sharrLambdaLayer]
        });
        const createCAFuncResource = createCustomAction.node.findChild('Resource');
        createCAFuncResource.cfnOptions.metadata = {
            cfn_nag: {
                rules_to_suppress: [
                    {
                        id: 'W58',
                        reason: 'False positive. the lambda role allows write to CW Logs'
                    },
                    {
                        id: 'W89',
                        reason: 'There is no need to run this lambda in a VPC'
                    },
                    {
                        id: 'W92',
                        reason: 'There is no need for Reserved Concurrency due to low request rate'
                    }
                ]
            }
        };
        const orchestrator = new common_orchestrator_construct_1.OrchestratorConstruct(this, "orchestrator", {
            roleArn: orchestratorRole.roleArn,
            ssmDocStateLambda: checkSSMDocState.functionArn,
            ssmExecDocLambda: execAutomation.functionArn,
            ssmExecMonitorLambda: monitorSSMExecState.functionArn,
            notifyLambda: sendNotifications.functionArn,
            getApprovalRequirementLambda: getApprovalRequirement.functionArn,
            solutionId: RESOURCE_PREFIX,
            solutionName: props.solutionName,
            solutionVersion: props.solutionVersion,
            orchLogGroup: props.orchLogGroup,
            kmsKeyParm: kmsKeyParm
        });
        let orchStateMachine = orchestrator.node.findChild('StateMachine');
        let stateMachineConstruct = orchStateMachine.node.defaultChild;
        let orchArnParm = orchestrator.node.findChild('SHARR_Orchestrator_Arn');
        let orchestratorArn = orchArnParm.node.defaultChild;
        //---------------------------------------------------------------------
        // OneTrigger - Remediate with SHARR custom action
        //
        new ssmplaybook_1.OneTrigger(this, 'RemediateWithSharr', {
            targetArn: orchStateMachine.stateMachineArn,
            serviceToken: createCustomAction.functionArn,
            prereq: [
                createCAFuncResource,
                createCAPolicyResource
            ]
        });
        //-------------------------------------------------------------------------
        // Loop through all of the Playbooks and create an option to load each
        //
        const PB_DIR = `${__dirname}/../../playbooks`;
        var ignore = ['.DS_Store', 'common', 'python_lib', 'python_tests', '.pytest_cache', 'NEWPLAYBOOK', '.coverage'];
        let illegalChars = /[\._]/g;
        var standardLogicalNames = [];
        fs.readdir(PB_DIR, (err, items) => {
            items.forEach(file => {
                if (!ignore.includes(file)) {
                    var template_file = `${file}Stack.template`;
                    //---------------------------------------------------------------------
                    // Playbook Admin Template Nested Stack
                    //
                    let parmname = file.replace(illegalChars, '');
                    let adminStackOption = new cdk.CfnParameter(this, `LoadAdminStack${parmname}`, {
                        type: "String",
                        description: `Load CloudWatch Event Rules for ${file}?`,
                        default: "yes",
                        allowedValues: ["yes", "no"],
                    });
                    adminStackOption.overrideLogicalId(`Load${parmname}AdminStack`);
                    standardLogicalNames.push(`Load${parmname}AdminStack`);
                    let adminStack = new cdk.CfnStack(this, `PlaybookAdminStack${file}`, {
                        templateUrl: "https://" + cdk.Fn.findInMap("SourceCode", "General", "S3Bucket") +
                            "-reference.s3.amazonaws.com/" + cdk.Fn.findInMap("SourceCode", "General", "KeyPrefix") +
                            "/playbooks/" + template_file
                    });
                    adminStack.addDependsOn(stateMachineConstruct);
                    adminStack.addDependsOn(orchestratorArn);
                    adminStack.cfnOptions.condition = new cdk.CfnCondition(this, `load${file}Cond`, {
                        expression: cdk.Fn.conditionEquals(adminStackOption, "yes")
                    });
                }
            });
        });
        stack.templateOptions.metadata = {
            "AWS::CloudFormation::Interface": {
                ParameterGroups: [
                    {
                        Label: { default: "Security Standard Playbooks" },
                        Parameters: standardLogicalNames
                    }
                ]
            },
        };
    }
}
exports.SolutionDeployStack = SolutionDeployStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic29sdXRpb25fZGVwbG95LXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsic29sdXRpb25fZGVwbG95LXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBOzs7Ozs7Ozs7Ozs7OytFQWErRTtBQUMvRSxtQ0FBbUM7QUFDbkMscUNBQXFDO0FBQ3JDLHNDQUFzQztBQUN0Qyx3Q0FBd0M7QUFDeEMsOENBQThDO0FBQzlDLDhDQUFpRTtBQUNqRSx3Q0FBd0M7QUFDeEMseUJBQXlCO0FBQ3pCLDhDQVMwQjtBQUMxQix3R0FBNkY7QUFFN0YsdURBQW1EO0FBV25ELE1BQWEsbUJBQW9CLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFJaEQsWUFBWSxLQUFjLEVBQUUsRUFBVSxFQUFFLEtBQXNCO1FBQzVELEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBSDFCLHdCQUFtQixHQUFHLEtBQUssQ0FBQTtRQUl6QixNQUFNLEtBQUssR0FBRyxHQUFHLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUNqQyxNQUFNLGVBQWUsR0FBRyxLQUFLLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxnQ0FBZ0M7UUFFOUYsMkVBQTJFO1FBQzNFLGlDQUFpQztRQUNqQyxFQUFFO1FBQ0YsTUFBTSxlQUFlLEdBQUcsRUFBRSxDQUFDLE1BQU0sQ0FBQyxvQkFBb0IsQ0FBQyxJQUFJLEVBQUUsaUJBQWlCLEVBQUU7WUFDNUUsVUFBVSxFQUFFLEtBQUssQ0FBQyxrQkFBa0IsR0FBRyxHQUFHLEdBQUcsSUFBSSxDQUFDLE1BQU07U0FDM0QsQ0FBQyxDQUFDO1FBRUgsMkVBQTJFO1FBQzNFLFdBQVc7UUFDWCwyRUFBMkU7UUFDM0UsSUFBSSxHQUFHLENBQUMsVUFBVSxDQUFDLElBQUksRUFBRSxZQUFZLEVBQUU7WUFDbkMsT0FBTyxFQUFFLEVBQUUs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QUFDLE9BQU8sRUFBRSw2QkFBNkIsRUFBQzt3QkFDL0MsVUFBVSxFQUFFLG9CQUFvQjtxQkFDbkM7aUJBQ0o7YUFDSjtTQUNKLENBQUM7SUFDSixDQUFDO0NBQ0Y7QUFydUJELGtEQXF1QkMiLCJzb3VyY2VzQ29udGVudCI6WyIvKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAqICBDb3B5cmlnaHQgQW1hem9uLmNvbSwgSW5jLiBvciBpdHMgYWZmaWxpYXRlcy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC4gICAqXG4gKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAqXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZSBMaWNlbnNlLCBWZXJzaW9uIDIuMCAodGhlIFwiTGljZW5zZVwiKS4gWW91IG1heSAgICpcbiAqICBub3QgdXNlIHRoaXMgZmlsZSBleGNlcHQgaW4gY29tcGxpYW5jZSB3aXRoIHRoZSBMaWNlbnNlLiBBIGNvcHkgb2YgdGhlICAgICpcbiAqICBMaWNlbnNlIGlzIGxvY2F0ZWQgYXQgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICpcbiAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICpcbiAqICAgICAgaHR0cDovL3d3dy5hcGFjaGUub3JnL2xpY2Vuc2VzL0xJQ0VOU0UtMi4wICAgICAgICAgICAgICAgICAgICAgICAgICAgICpcbiAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICpcbiAqICBvciBpbiB0aGUgJ2xpY2Vuc2UnIGZpbGUgYWNjb21wYW55aW5nIHRoaXMgZmlsZS4gVGhpcyBmaWxlIGlzIGRpc3RyaWJ1dGVkICpcbiAqICBvbiBhbiAnQVMgSVMnIEJBU0lTLCBXSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTlkgS0lORCwgICAgICAgICpcbiAqICBleHByZXNzIG9yIGltcGxpZWQuIFNlZSB0aGUgTGljZW5zZSBmb3IgdGhlIHNwZWNpZmljIGxhbmd1YWdlIGdvdmVybmluZyAgICpcbiAqICBwZXJtaXNzaW9ucyBhbmQgbGltaXRhdGlvbnMgdW5kZXIgdGhlIExpY2Vuc2UuICAgICAgICAgICAgICAgICAgICAgICAgICAgICpcbiAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cbmltcG9ydCAqIGFzIGNka19uYWcgZnJvbSAnY2RrLW5hZyc7XG5pbXBvcnQgKiBhcyBjZGsgZnJvbSAnQGF3cy1jZGsvY29yZSc7XG5pbXBvcnQgKiBhcyBzMyBmcm9tICdAYXdzLWNkay9hd3MtczMnO1xuaW1wb3J0ICogYXMgc25zIGZyb20gJ0Bhd3MtY2RrL2F3cy1zbnMnO1xuaW1wb3J0ICogYXMgbGFtYmRhIGZyb20gJ0Bhd3MtY2RrL2F3cy1sYW1iZGEnO1xuaW1wb3J0IHsgU3RyaW5nUGFyYW1ldGVyLCBDZm5QYXJhbWV0ZXIgfSBmcm9tICdAYXdzLWNkay9hd3Mtc3NtJztcbmltcG9ydCAqIGFzIGttcyBmcm9tICdAYXdzLWNkay9hd3Mta21zJztcbmltcG9ydCAqIGFzIGZzIGZyb20gJ2ZzJztcbmltcG9ydCB7XG4gICAgUm9sZSxcbiAgICBDZm5Sb2xlLFxuICAgIFBvbGljeSxcbiAgICBDZm5Qb2xpY3ksXG4gICAgUG9saWN5U3RhdGVtZW50LFxuICAgIFBvbGljeURvY3VtZW50LFxuICAgIFNlcnZpY2VQcmluY2lwYWwsXG4gICAgQWNjb3VudFJvb3RQcmluY2lwYWxcbn0gZnJvbSAnQGF3cy1jZGsvYXdzLWlhbSc7XG5pbXBvcnQgeyBPcmNoZXN0cmF0b3JDb25zdHJ1Y3QgfSBmcm9tICcuLi8uLi9PcmNoZXN0cmF0b3IvbGliL2NvbW1vbi1vcmNoZXN0cmF0b3ItY29uc3RydWN0JztcbmltcG9ydCB7IENmblN0YXRlTWFjaGluZSwgU3RhdGVNYWNoaW5lIH0gZnJvbSAnQGF3cy1jZGsvYXdzLXN0ZXBmdW5jdGlvbnMnO1xuaW1wb3J0IHsgT25lVHJpZ2dlciB9IGZyb20gJy4uLy4uL2xpYi9zc21wbGF5Ym9vayc7XG5leHBvcnQgaW50ZXJmYWNlIFNIQVJSU3RhY2tQcm9wcyBleHRlbmRzIGNkay5TdGFja1Byb3BzICB7XG4gICAgc29sdXRpb25JZDogc3RyaW5nO1xuICAgIHNvbHV0aW9uVmVyc2lvbjogc3RyaW5nO1xuICAgIHNvbHV0aW9uRGlzdEJ1Y2tldDogc3RyaW5nO1xuICAgIHNvbHV0aW9uVE1OOiBzdHJpbmc7XG4gICAgc29sdXRpb25OYW1lOiBzdHJpbmc7XG4gICAgcnVudGltZVB5dGhvbjogbGFtYmRhLlJ1bnRpbWU7XG4gICAgb3JjaExvZ0dyb3VwOiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjbGFzcyBTb2x1dGlvbkRlcGxveVN0YWNrIGV4dGVuZHMgY2RrLlN0YWNrIHtcblxuICBTRU5EX0FOT05ZTU9VU19EQVRBID0gJ1llcydcblxuICBjb25zdHJ1Y3RvcihzY29wZTogY2RrLkFwcCwgaWQ6IHN0cmluZywgcHJvcHM6IFNIQVJSU3RhY2tQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xuICAgIGNvbnN0IHN0YWNrID0gY2RrLlN0YWNrLm9mKHRoaXMpO1xuICAgIGNvbnN0IFJFU09VUkNFX1BSRUZJWCA9IHByb3BzLnNvbHV0aW9uSWQucmVwbGFjZSgvXkRFVi0vLCcnKTsgLy8gcHJlZml4IG9uIGV2ZXJ5IHJlc291cmNlIG5hbWVcblxuICAgIC8vLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgIC8vIFNvbHV0aW9ucyBCdWNrZXQgLSBTb3VyY2UgQ29kZVxuICAgIC8vXG4gICAgY29uc3QgU29sdXRpb25zQnVja2V0ID0gczMuQnVja2V0LmZyb21CdWNrZXRBdHRyaWJ1dGVzKHRoaXMsICdTb2x1dGlvbnNCdWNrZXQnLCB7XG4gICAgICAgIGJ1Y2tldE5hbWU6IHByb3BzLnNvbHV0aW9uRGlzdEJ1Y2tldCArICctJyArIHRoaXMucmVnaW9uXG4gICAgfSk7XG5cbiAgICAvLz09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAvLyBNQVBQSU5HU1xuICAgIC8vPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIG5ldyBjZGsuQ2ZuTWFwcGluZyh0aGlzLCAnU291cmNlQ29kZScsIHtcbiAgICAgICAgbWFwcGluZzogeyBcIkdlbmVyYWxcIjoge1xuICAgICAgICAgICAgXCJTM0J1Y2tldFwiOiBwcm9wcy5zb2x1dGlvbkRpc3RCdWNrZXQsXG4gICAgICAgICAgICBcIktleVByZWZpeFwiOiBwcm9wcy5zb2x1dGlvblRNTiArICcvJyArIHByb3BzLnNvbHV0aW9uVmVyc2lvblxuICAgICAgICB9IH1cbiAgICB9KVxuXG4gICAgLy8tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAgLy8gS01TIEtleSBmb3Igc29sdXRpb24gZW5jcnlwdGlvblxuICAgIC8vXG5cbiAgICAvLyBLZXkgUG9saWN5XG4gICAgY29uc3Qga21zS2V5UG9saWN5OlBvbGljeURvY3VtZW50ID0gbmV3IFBvbGljeURvY3VtZW50KClcblxuICAgIGNvbnN0IGttc1NlcnZpY2VQb2xpY3kgPSBuZXcgUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgcHJpbmNpcGFsczogW1xuICAgICAgICAgICAgbmV3IFNlcnZpY2VQcmluY2lwYWwoJ3Nucy5hbWF6b25hd3MuY29tJyksXG4gICAgICAgICAgICBuZXcgU2VydmljZVByaW5jaXBhbChgbG9ncy4ke3RoaXMudXJsU3VmZml4fWApXG4gICAgICAgIF0sXG4gICAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgICAgIFwia21zOkVuY3J5cHQqXCIsXG4gICAgICAgICAgICBcImttczpEZWNyeXB0KlwiLFxuICAgICAgICAgICAgXCJrbXM6UmVFbmNyeXB0KlwiLFxuICAgICAgICAgICAgXCJrbXM6R2VuZXJhdGVEYXRhS2V5KlwiLFxuICAgICAgICAgICAgXCJrbXM6RGVzY3JpYmUqXCJcbiAgICAgICAgXSxcbiAgICAgICAgcmVzb3VyY2VzOiBbXG4gICAgICAgICAgICAnKidcbiAgICAgICAgXSxcbiAgICAgICAgY29uZGl0aW9uczoge1xuICAgICAgICAgICAgQXJuRXF1YWxzOiB7XG4gICAgICAgICAgICAgICAgXCJrbXM6RW5jcnlwdGlvbkNvbnRleHQ6YXdzOmxvZ3M6YXJuXCI6IHRoaXMuZm9ybWF0QXJuKHtcbiAgICAgICAgICAgICAgICAgICAgc2VydmljZTogJ2xvZ3MnLFxuICAgICAgICAgICAgICAgICAgICByZXNvdXJjZTogJ2xvZy1ncm91cDpTTzAxMTEtU0hBUlItKidcbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSlcbiAgICBrbXNLZXlQb2xpY3kuYWRkU3RhdGVtZW50cyhrbXNTZXJ2aWNlUG9saWN5KVxuXG4gICAgY29uc3Qga21zUm9vdFBvbGljeSA9IG5ldyBQb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICBwcmluY2lwYWxzOiBbXG4gICAgICAgICAgICBuZXcgQWNjb3VudFJvb3RQcmluY2lwYWwoKVxuICAgICAgICBdLFxuICAgICAgICBhY3Rpb25zOiBbXG4gICAgICAgICAgICAna21zOionXG4gICAgICAgIF0sXG4gICAgICAgIHJlc291cmNlczogW1xuICAgICAgICAgICAgJyonXG4gICAgICAgIF1cbiAgICB9KVxuICAgIGttc0tleVBvbGljeS5hZGRTdGF0ZW1lbnRzKGttc1Jvb3RQb2xpY3kpXG5cbiAgICBjb25zdCBrbXNLZXkgPSBuZXcga21zLktleSh0aGlzLCAnU0hBUlIta2V5Jywge1xuICAgICAgICBlbmFibGVLZXlSb3RhdGlvbjogdHJ1ZSxcbiAgICAgICAgYWxpYXM6IGAke1JFU09VUkNFX1BSRUZJWH0tU0hBUlItS2V5YCxcbiAgICAgICAgcG9saWN5OiBrbXNLZXlQb2xpY3lcbiAgICB9KTtcblxuICAgIGNvbnN0IGttc0tleVBhcm0gPSBuZXcgU3RyaW5nUGFyYW1ldGVyKHRoaXMsICdTSEFSUl9LZXknLCB7XG4gICAgICAgIGRlc2NyaXB0aW9uOiAnS01TIEN1c3RvbWVyIE1hbmFnZWQgS2V5IHRoYXQgU0hBUlIgd2lsbCB1c2UgdG8gZW5jcnlwdCBkYXRhJyxcbiAgICAgICAgcGFyYW1ldGVyTmFtZTogYC9Tb2x1dGlvbnMvJHtSRVNPVVJDRV9QUkVGSVh9L0NNS19BUk5gLFxuICAgICAgICBzdHJpbmdWYWx1ZToga21zS2V5LmtleUFyblxuICAgIH0pO1xuXG4gICAgLy8tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAgLy8gU05TIFRvcGljIGZvciBub3RpZmljYXRpb24gZmFub3V0IG9uIFBsYXlib29rIGNvbXBsZXRpb25cbiAgICAvL1xuICAgIGNvbnN0IHNuc1RvcGljID0gbmV3IHNucy5Ub3BpYyh0aGlzLCAnU0hBUlItVG9waWMnLCB7XG4gICAgICAgIGRpc3BsYXlOYW1lOiAnU0hBUlIgUGxheWJvb2sgVG9waWMgKCcgKyBSRVNPVVJDRV9QUkVGSVggKyAnKScsXG4gICAgICAgIHRvcGljTmFtZTogUkVTT1VSQ0VfUFJFRklYICsgJy1TSEFSUl9Ub3BpYycsXG4gICAgICAgIG1hc3RlcktleToga21zS2V5XG4gICAgfSk7XG5cbiAgICBuZXcgU3RyaW5nUGFyYW1ldGVyKHRoaXMsICdTSEFSUl9TTlNfVG9waWMnLCB7XG4gICAgICAgIGRlc2NyaXB0aW9uOiAnU05TIFRvcGljIEFSTiB3aGVyZSBTSEFSUiB3aWxsIHNlbmQgc3RhdHVzIG1lc3NhZ2VzLiBUaGlzXFxcbiAgICAgICAgdG9waWMgY2FuIGJlIHVzZWZ1bCBmb3IgZHJpdmluZyBhZGRpdGlvbmFsIGFjdGlvbnMsIHN1Y2ggYXMgZW1haWwgbm90aWZpY2F0aW9ucyxcXFxuICAgICAgICB0cm91YmxlIHRpY2tldCB1cGRhdGVzLicsXG4gICAgICAgIHBhcmFtZXRlck5hbWU6ICcvU29sdXRpb25zLycgKyBSRVNPVVJDRV9QUkVGSVggKyAnL1NOU19Ub3BpY19BUk4nLFxuICAgICAgICBzdHJpbmdWYWx1ZTogc25zVG9waWMudG9waWNBcm5cbiAgICB9KTtcblxuICAgIGNvbnN0IG1hcHBpbmcgPSBuZXcgY2RrLkNmbk1hcHBpbmcodGhpcywgJ21hcHBpbmdzJyk7XG4gICAgbWFwcGluZy5zZXRWYWx1ZShcInNlbmRBbm9ueW1vdXNNZXRyaWNzXCIsIFwiZGF0YVwiLCB0aGlzLlNFTkRfQU5PTllNT1VTX0RBVEEpXG5cblx0bmV3IFN0cmluZ1BhcmFtZXRlcih0aGlzLCAnU0hBUlJfU2VuZEFub255bW91c01ldHJpY3MnLCB7XG5cdFx0ZGVzY3JpcHRpb246ICdGbGFnIHRvIGVuYWJsZSBvciBkaXNhYmxlIHNlbmRpbmcgYW5vbnltb3VzIG1ldHJpY3MuJyxcblx0XHRwYXJhbWV0ZXJOYW1lOiAnL1NvbHV0aW9ucy8nICsgUkVTT1VSQ0VfUFJFRklYICsgJy9zZW5kQW5vbnltb3VzTWV0cmljcycsXG5cdFx0c3RyaW5nVmFsdWU6IG1hcHBpbmcuZmluZEluTWFwKFwic2VuZEFub255bW91c01ldHJpY3NcIiwgXCJkYXRhXCIpXG5cdH0pO1xuXG4gICAgbmV3IFN0cmluZ1BhcmFtZXRlcih0aGlzLCAnU0hBUlJfdmVyc2lvbicsIHtcbiAgICAgICAgZGVzY3JpcHRpb246ICdTb2x1dGlvbiB2ZXJzaW9uIGZvciBtZXRyaWNzLicsXG4gICAgICAgIHBhcmFtZXRlck5hbWU6ICcvU29sdXRpb25zLycgKyBSRVNPVVJDRV9QUkVGSVggKyAnL3ZlcnNpb24nLFxuICAgICAgICBzdHJpbmdWYWx1ZTogcHJvcHMuc29sdXRpb25WZXJzaW9uXG4gICAgfSk7XG5cbiAgICAvKipcbiAgICAgKiBAZGVzY3JpcHRpb24gTGFtYmRhIExheWVyIGZvciBjb21tb24gc29sdXRpb24gZnVuY3Rpb25zXG4gICAgICogQHR5cGUge2xhbWJkYS5MYXllclZlcnNpb259XG4gICAgICovXG4gICAgY29uc3Qgc2hhcnJMYW1iZGFMYXllciA9IG5ldyBsYW1iZGEuTGF5ZXJWZXJzaW9uKHRoaXMsICdTaGFyckxhbWJkYUxheWVyJywge1xuICAgICAgICBjb21wYXRpYmxlUnVudGltZXM6IFtcbiAgICAgICAgICAgIGxhbWJkYS5SdW50aW1lLlBZVEhPTl8zXzYsXG4gICAgICAgICAgICBsYW1iZGEuUnVudGltZS5QWVRIT05fM183LFxuICAgICAgICAgICAgbGFtYmRhLlJ1bnRpbWUuUFlUSE9OXzNfOFxuICAgICAgICBdLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ1NPMDExMSBTSEFSUiBDb21tb24gZnVuY3Rpb25zIHVzZWQgYnkgdGhlIHNvbHV0aW9uJyxcbiAgICAgICAgbGljZW5zZTogXCJodHRwczovL3d3dy5hcGFjaGUub3JnL2xpY2Vuc2VzL0xJQ0VOU0UtMi4wXCIsXG4gICAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21CdWNrZXQoXG4gICAgICAgICAgICBTb2x1dGlvbnNCdWNrZXQsXG4gICAgICAgICAgICBwcm9wcy5zb2x1dGlvblRNTiArICcvJyArIHByb3BzLnNvbHV0aW9uVmVyc2lvbiArICcvbGFtYmRhL2xheWVyLnppcCdcbiAgICAgICAgKSxcbiAgICB9KTtcblxuICAgIC8qKlxuICAgICAqIEBkZXNjcmlwdGlvbiBQb2xpY3kgZm9yIHJvbGUgdXNlZCBieSBjb21tb24gT3JjaGVzdHJhdG9yIExhbWJkYXNcbiAgICAgKiBAdHlwZSB7UG9saWN5fVxuICAgICAqL1xuICAgIGNvbnN0IG9yY2hlc3RyYXRvclBvbGljeSA9IG5ldyBQb2xpY3kodGhpcywgJ29yY2hlc3RyYXRvclBvbGljeScsIHtcbiAgICAgICAgcG9saWN5TmFtZTogUkVTT1VSQ0VfUFJFRklYICsgJy1TSEFSUl9PcmNoZXN0cmF0b3InLFxuICAgICAgICBzdGF0ZW1lbnRzOiBbXG4gICAgICAgICAgICBuZXcgUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgICAgICAgICBhY3Rpb25zOiBbXG4gICAgICAgICAgICAgICAgICAgICdsb2dzOkNyZWF0ZUxvZ0dyb3VwJyxcbiAgICAgICAgICAgICAgICAgICAgJ2xvZ3M6Q3JlYXRlTG9nU3RyZWFtJyxcbiAgICAgICAgICAgICAgICAgICAgJ2xvZ3M6UHV0TG9nRXZlbnRzJ1xuICAgICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgICAgcmVzb3VyY2VzOiBbJyonXVxuICAgICAgICAgICAgfSksXG4gICAgICAgICAgICBuZXcgUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgICAgICAgICBhY3Rpb25zOiBbXG4gICAgICAgICAgICAgICAgICAgICdzc206R2V0UGFyYW1ldGVyJyxcbiAgICAgICAgICAgICAgICAgICAgJ3NzbTpHZXRQYXJhbWV0ZXJzJyxcbiAgICAgICAgICAgICAgICAgICAgJ3NzbTpQdXRQYXJhbWV0ZXInXG4gICAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgICByZXNvdXJjZXM6IFtgYXJuOiR7dGhpcy5wYXJ0aXRpb259OnNzbToqOiR7dGhpcy5hY2NvdW50fTpwYXJhbWV0ZXIvU29sdXRpb25zL1NPMDExMS8qYF1cbiAgICAgICAgICAgIH0pLFxuICAgICAgICAgICAgbmV3IFBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgICAgICAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgICAgICAgICAgICAgJ3N0czpBc3N1bWVSb2xlJ1xuICAgICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgICAgcmVzb3VyY2VzOiBbXG4gICAgICAgICAgICAgICAgICAgIGBhcm46JHt0aGlzLnBhcnRpdGlvbn06aWFtOjoqOnJvbGUvJHtSRVNPVVJDRV9QUkVGSVh9LVNIQVJSLU9yY2hlc3RyYXRvci1NZW1iZXJgXG4gICAgICAgICAgICAgICAgICAgIC8vJ2FybjonICsgdGhpcy5wYXJ0aXRpb24gKyAnOmlhbTo6Kjpyb2xlLycgKyBSRVNPVVJDRV9QUkVGSVggK1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8nLVJlbWVkaWF0ZS0qJyxcbiAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICB9KSxcbiAgICAgICAgICAgIC8vIFN1cHBvcnRzIGh0dHBzOi8vZ2l0bGFiLmF3cy5kZXYvZGFuZ2liYm8vc2hhcnItcmVtZWRpYXRpb24tZnJhbWV3b3JrXG4gICAgICAgICAgICBuZXcgUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgICAgICAgICBhY3Rpb25zOiBbJ29yZ2FuaXphdGlvbnM6TGlzdFRhZ3NGb3JSZXNvdXJjZSddLFxuICAgICAgICAgICAgICAgIHJlc291cmNlczogWycqJ11cbiAgICAgICAgICAgIH0pXG4gICAgICAgIF1cbiAgICB9KVxuXG4gICAge1xuICAgICAgICBsZXQgY2hpbGRUb01vZCA9IG9yY2hlc3RyYXRvclBvbGljeS5ub2RlLmZpbmRDaGlsZCgnUmVzb3VyY2UnKSBhcyBDZm5Qb2xpY3k7XG4gICAgICAgIGNoaWxkVG9Nb2QuY2ZuT3B0aW9ucy5tZXRhZGF0YSA9IHtcbiAgICAgICAgICAgIGNmbl9uYWc6IHtcbiAgICAgICAgICAgICAgICBydWxlc190b19zdXBwcmVzczogW3tcbiAgICAgICAgICAgICAgICAgICAgaWQ6ICdXMTInLFxuICAgICAgICAgICAgICAgICAgICByZWFzb246ICdSZXNvdXJjZSAqIGlzIHJlcXVpcmVkIGZvciByZWFkLW9ubHkgcG9saWNpZXMgdXNlZCBieSBvcmNoZXN0cmF0b3IgTGFtYmRhIGZ1bmN0aW9ucy4nXG4gICAgICAgICAgICAgICAgfV1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGNka19uYWcuTmFnU3VwcHJlc3Npb25zLmFkZFJlc291cmNlU3VwcHJlc3Npb25zKG9yY2hlc3RyYXRvclBvbGljeSwgW1xuICAgICAgICB7aWQ6ICdBd3NTb2x1dGlvbnMtSUFNNScsIHJlYXNvbjogJ1Jlc291cmNlICogaXMgcmVxdWlyZWQgZm9yIHJlYWQtb25seSBwb2xpY2llcyB1c2VkIGJ5IG9yY2hlc3RyYXRvciBMYW1iZGEgZnVuY3Rpb25zLid9XG4gICAgXSk7XG5cbiAgICAvKipcbiAgICAgKiBAZGVzY3JpcHRpb24gUm9sZSB1c2VkIGJ5IGNvbW1vbiBPcmNoZXN0cmF0b3IgTGFtYmRhc1xuICAgICAqIEB0eXBlIHtSb2xlfVxuICAgICAqL1xuXG4gICAgY29uc3Qgb3JjaGVzdHJhdG9yUm9sZSA9IG5ldyBSb2xlKHRoaXMsICdvcmNoZXN0cmF0b3JSb2xlJywge1xuICAgICAgICBhc3N1bWVkQnk6IG5ldyBTZXJ2aWNlUHJpbmNpcGFsKCdsYW1iZGEuYW1hem9uYXdzLmNvbScpLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ0xhbWJkYSByb2xlIHRvIGFsbG93IGNyb3NzIGFjY291bnQgcmVhZC1vbmx5IFNIQVJSIG9yY2hlc3RyYXRvciBmdW5jdGlvbnMnLFxuICAgICAgICByb2xlTmFtZTogYCR7UkVTT1VSQ0VfUFJFRklYfS1TSEFSUi1PcmNoZXN0cmF0b3ItQWRtaW5gXG4gICAgfSk7XG5cbiAgICBvcmNoZXN0cmF0b3JSb2xlLmF0dGFjaElubGluZVBvbGljeShvcmNoZXN0cmF0b3JQb2xpY3kpO1xuXG4gICAge1xuICAgICAgICBsZXQgY2hpbGRUb01vZCA9IG9yY2hlc3RyYXRvclJvbGUubm9kZS5maW5kQ2hpbGQoJ1Jlc291cmNlJykgYXMgQ2ZuUm9sZTtcbiAgICAgICAgY2hpbGRUb01vZC5jZm5PcHRpb25zLm1ldGFkYXRhID0ge1xuICAgICAgICAgICAgY2ZuX25hZzoge1xuICAgICAgICAgICAgICAgIHJ1bGVzX3RvX3N1cHByZXNzOiBbe1xuICAgICAgICAgICAgICAgICAgICBpZDogJ1cyOCcsXG4gICAgICAgICAgICAgICAgICAgIHJlYXNvbjogJ1N0YXRpYyBuYW1lcyBjaG9zZW4gaW50ZW50aW9uYWxseSB0byBwcm92aWRlIGVhc3kgaW50ZWdyYXRpb24gd2l0aCBwbGF5Ym9vayBvcmNoZXN0cmF0b3Igc3RlcCBmdW5jdGlvbnMuJ1xuICAgICAgICAgICAgICAgIH1dXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAZGVzY3JpcHRpb24gY2hlY2tTU01Eb2NTdGF0ZSAtIGdldCB0aGUgc3RhdHVzIG9mIGFuIHNzbSBkb2N1bWVudFxuICAgICAqIEB0eXBlIHtsYW1iZGEuRnVuY3Rpb259XG4gICAgICovXG4gICAgY29uc3QgY2hlY2tTU01Eb2NTdGF0ZSA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ2NoZWNrU1NNRG9jU3RhdGUnLCB7XG4gICAgICAgIGZ1bmN0aW9uTmFtZTogUkVTT1VSQ0VfUFJFRklYICsgJy1TSEFSUi1jaGVja1NTTURvY1N0YXRlJyxcbiAgICAgICAgaGFuZGxlcjogJ2NoZWNrX3NzbV9kb2Nfc3RhdGUubGFtYmRhX2hhbmRsZXInLFxuICAgICAgICBydW50aW1lOiBwcm9wcy5ydW50aW1lUHl0aG9uLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ0NoZWNrcyB0aGUgc3RhdHVzIG9mIGFuIFNTTSBBdXRvbWF0aW9uIERvY3VtZW50IGluIHRoZSB0YXJnZXQgYWNjb3VudCcsXG4gICAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21CdWNrZXQoXG4gICAgICAgICAgICBTb2x1dGlvbnNCdWNrZXQsXG4gICAgICAgICAgICBwcm9wcy5zb2x1dGlvblRNTiArICcvJyArIHByb3BzLnNvbHV0aW9uVmVyc2lvbiArICcvbGFtYmRhL2NoZWNrX3NzbV9kb2Nfc3RhdGUucHkuemlwJ1xuICAgICAgICApLFxuICAgICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICAgICAgbG9nX2xldmVsOiAnaW5mbycsXG4gICAgICAgICAgICBBV1NfUEFSVElUSU9OOiB0aGlzLnBhcnRpdGlvbixcbiAgICAgICAgICAgIFNPTFVUSU9OX0lEOiBwcm9wcy5zb2x1dGlvbklkLFxuICAgICAgICAgICAgU09MVVRJT05fVkVSU0lPTjogcHJvcHMuc29sdXRpb25WZXJzaW9uXG4gICAgICAgIH0sXG4gICAgICAgIG1lbW9yeVNpemU6IDI1NixcbiAgICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoNjAwKSxcbiAgICAgICAgcm9sZTogb3JjaGVzdHJhdG9yUm9sZSxcbiAgICAgICAgbGF5ZXJzOiBbc2hhcnJMYW1iZGFMYXllcl1cbiAgICB9KTtcblxuICAgIHtcbiAgICAgICAgY29uc3QgY2hpbGRUb01vZCA9IGNoZWNrU1NNRG9jU3RhdGUubm9kZS5maW5kQ2hpbGQoJ1Jlc291cmNlJykgYXMgbGFtYmRhLkNmbkZ1bmN0aW9uO1xuXG4gICAgICAgIGNoaWxkVG9Nb2QuY2ZuT3B0aW9ucy5tZXRhZGF0YSA9IHtcbiAgICAgICAgICAgIGNmbl9uYWc6IHtcbiAgICAgICAgICAgICAgICBydWxlc190b19zdXBwcmVzczogW1xuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgaWQ6ICdXNTgnLFxuICAgICAgICAgICAgICAgICAgICByZWFzb246ICdGYWxzZSBwb3NpdGl2ZS4gQWNjZXNzIGlzIHByb3ZpZGVkIHZpYSBhIHBvbGljeSdcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgaWQ6ICdXODknLFxuICAgICAgICAgICAgICAgICAgICByZWFzb246ICdUaGVyZSBpcyBubyBuZWVkIHRvIHJ1biB0aGlzIGxhbWJkYSBpbiBhIFZQQydcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgaWQ6ICdXOTInLFxuICAgICAgICAgICAgICAgICAgICByZWFzb246ICdUaGVyZSBpcyBubyBuZWVkIGZvciBSZXNlcnZlZCBDb25jdXJyZW5jeSdcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBkZXNjcmlwdGlvbiBnZXRBcHByb3ZhbFJlcXVpcmVtZW50IC0gZGV0ZXJtaW5lIHdoZXRoZXIgbWFudWFsIGFwcHJvdmFsIGlzIHJlcXVpcmVkXG4gICAgICogQHR5cGUge2xhbWJkYS5GdW5jdGlvbn1cbiAgICAgKi9cbiAgICAgICAgIGNvbnN0IGdldEFwcHJvdmFsUmVxdWlyZW1lbnQgPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdnZXRBcHByb3ZhbFJlcXVpcmVtZW50Jywge1xuICAgICAgICAgICAgZnVuY3Rpb25OYW1lOiBSRVNPVVJDRV9QUkVGSVggKyAnLVNIQVJSLWdldEFwcHJvdmFsUmVxdWlyZW1lbnQnLFxuICAgICAgICAgICAgaGFuZGxlcjogJ2dldF9hcHByb3ZhbF9yZXF1aXJlbWVudC5sYW1iZGFfaGFuZGxlcicsXG4gICAgICAgICAgICBydW50aW1lOiBwcm9wcy5ydW50aW1lUHl0aG9uLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246ICdEZXRlcm1pbmVzIGlmIGEgbWFudWFsIGFwcHJvdmFsIGlzIHJlcXVpcmVkIGZvciByZW1lZGlhdGlvbicsXG4gICAgICAgICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQnVja2V0KFxuICAgICAgICAgICAgICAgIFNvbHV0aW9uc0J1Y2tldCxcbiAgICAgICAgICAgICAgICBwcm9wcy5zb2x1dGlvblRNTiArICcvJyArIHByb3BzLnNvbHV0aW9uVmVyc2lvbiArICcvbGFtYmRhL2dldF9hcHByb3ZhbF9yZXF1aXJlbWVudC5weS56aXAnXG4gICAgICAgICAgICApLFxuICAgICAgICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgICAgICAgICBsb2dfbGV2ZWw6ICdpbmZvJyxcbiAgICAgICAgICAgICAgICBBV1NfUEFSVElUSU9OOiB0aGlzLnBhcnRpdGlvbixcbiAgICAgICAgICAgICAgICBTT0xVVElPTl9JRDogcHJvcHMuc29sdXRpb25JZCxcbiAgICAgICAgICAgICAgICBTT0xVVElPTl9WRVJTSU9OOiBwcm9wcy5zb2x1dGlvblZlcnNpb24sXG4gICAgICAgICAgICAgICAgV09SS0ZMT1dfUlVOQk9PSzogJydcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBtZW1vcnlTaXplOiAyNTYsXG4gICAgICAgICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcyg2MDApLFxuICAgICAgICAgICAgcm9sZTogb3JjaGVzdHJhdG9yUm9sZSxcbiAgICAgICAgICAgIGxheWVyczogW3NoYXJyTGFtYmRhTGF5ZXJdXG4gICAgICAgIH0pO1xuXG4gICAgICAgIHtcbiAgICAgICAgICAgIGNvbnN0IGNoaWxkVG9Nb2QgPSBnZXRBcHByb3ZhbFJlcXVpcmVtZW50Lm5vZGUuZmluZENoaWxkKCdSZXNvdXJjZScpIGFzIGxhbWJkYS5DZm5GdW5jdGlvbjtcblxuICAgICAgICAgICAgY2hpbGRUb01vZC5jZm5PcHRpb25zLm1ldGFkYXRhID0ge1xuICAgICAgICAgICAgICAgIGNmbl9uYWc6IHtcbiAgICAgICAgICAgICAgICAgICAgcnVsZXNfdG9fc3VwcHJlc3M6IFt7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZDogJ1c1OCcsXG4gICAgICAgICAgICAgICAgICAgICAgICByZWFzb246ICdGYWxzZSBwb3NpdGl2ZS4gQWNjZXNzIGlzIHByb3ZpZGVkIHZpYSBhIHBvbGljeSdcbiAgICAgICAgICAgICAgICAgICAgfSx7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZDogJ1c4OScsXG4gICAgICAgICAgICAgICAgICAgICAgICByZWFzb246ICdUaGVyZSBpcyBubyBuZWVkIHRvIHJ1biB0aGlzIGxhbWJkYSBpbiBhIFZQQydcbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWQ6ICdXOTInLFxuICAgICAgICAgICAgICAgICAgICAgICAgcmVhc29uOiAnVGhlcmUgaXMgbm8gbmVlZCBmb3IgUmVzZXJ2ZWQgQ29uY3VycmVuY3knXG4gICAgICAgICAgICAgICAgICAgIH1dXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuXG5cbiAgICAvKipcbiAgICAgKiBAZGVzY3JpcHRpb24gZXhlY0F1dG9tYXRpb24gLSBpbml0aWF0ZSBhbiBTU00gYXV0b21hdGlvbiBkb2N1bWVudCBpbiBhIHRhcmdldCBhY2NvdW50XG4gICAgICogQHR5cGUge2xhbWJkYS5GdW5jdGlvbn1cbiAgICAgKi9cbiAgICBjb25zdCBleGVjQXV0b21hdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ2V4ZWNBdXRvbWF0aW9uJywge1xuICAgICAgICBmdW5jdGlvbk5hbWU6IFJFU09VUkNFX1BSRUZJWCArICctU0hBUlItZXhlY0F1dG9tYXRpb24nLFxuICAgICAgICBoYW5kbGVyOiAnZXhlY19zc21fZG9jLmxhbWJkYV9oYW5kbGVyJyxcbiAgICAgICAgcnVudGltZTogcHJvcHMucnVudGltZVB5dGhvbixcbiAgICAgICAgZGVzY3JpcHRpb246ICdFeGVjdXRlcyBhbiBTU00gQXV0b21hdGlvbiBEb2N1bWVudCBpbiBhIHRhcmdldCBhY2NvdW50JyxcbiAgICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUJ1Y2tldChcbiAgICAgICAgICAgIFNvbHV0aW9uc0J1Y2tldCxcbiAgICAgICAgICAgIHByb3BzLnNvbHV0aW9uVE1OICsgJy8nICsgcHJvcHMuc29sdXRpb25WZXJzaW9uICsgJy9sYW1iZGEvZXhlY19zc21fZG9jLnB5LnppcCdcbiAgICAgICAgKSxcbiAgICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgICAgIGxvZ19sZXZlbDogJ2luZm8nLFxuICAgICAgICAgICAgQVdTX1BBUlRJVElPTjogdGhpcy5wYXJ0aXRpb24sXG4gICAgICAgICAgICBTT0xVVElPTl9JRDogcHJvcHMuc29sdXRpb25JZCxcbiAgICAgICAgICAgIFNPTFVUSU9OX1ZFUlNJT046IHByb3BzLnNvbHV0aW9uVmVyc2lvblxuICAgICAgICB9LFxuICAgICAgICBtZW1vcnlTaXplOiAyNTYsXG4gICAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDYwMCksXG4gICAgICAgIHJvbGU6IG9yY2hlc3RyYXRvclJvbGUsXG4gICAgICAgIGxheWVyczogW3NoYXJyTGFtYmRhTGF5ZXJdXG4gICAgfSk7XG5cbiAgICB7XG4gICAgICAgIGNvbnN0IGNoaWxkVG9Nb2QgPSBleGVjQXV0b21hdGlvbi5ub2RlLmZpbmRDaGlsZCgnUmVzb3VyY2UnKSBhcyBsYW1iZGEuQ2ZuRnVuY3Rpb247XG5cbiAgICAgICAgY2hpbGRUb01vZC5jZm5PcHRpb25zLm1ldGFkYXRhID0ge1xuICAgICAgICAgICAgY2ZuX25hZzoge1xuICAgICAgICAgICAgICAgIHJ1bGVzX3RvX3N1cHByZXNzOiBbe1xuICAgICAgICAgICAgICAgICAgICBpZDogJ1c1OCcsXG4gICAgICAgICAgICAgICAgICAgIHJlYXNvbjogJ0ZhbHNlIHBvc2l0aXZlLiBBY2Nlc3MgaXMgcHJvdmlkZWQgdmlhIGEgcG9saWN5J1xuICAgICAgICAgICAgICAgIH0se1xuICAgICAgICAgICAgICAgICAgICBpZDogJ1c4OScsXG4gICAgICAgICAgICAgICAgICAgIHJlYXNvbjogJ1RoZXJlIGlzIG5vIG5lZWQgdG8gcnVuIHRoaXMgbGFtYmRhIGluIGEgVlBDJ1xuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBpZDogJ1c5MicsXG4gICAgICAgICAgICAgICAgICAgIHJlYXNvbjogJ1RoZXJlIGlzIG5vIG5lZWQgZm9yIFJlc2VydmVkIENvbmN1cnJlbmN5J1xuICAgICAgICAgICAgICAgIH1dXG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQGRlc2NyaXB0aW9uIG1vbml0b3JTU01FeGVjU3RhdGUgLSBnZXQgdGhlIHN0YXR1cyBvZiBhbiBzc20gZXhlY3V0aW9uXG4gICAgICogQHR5cGUge2xhbWJkYS5GdW5jdGlvbn1cbiAgICAgKi9cbiAgICBjb25zdCBtb25pdG9yU1NNRXhlY1N0YXRlID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnbW9uaXRvclNTTUV4ZWNTdGF0ZScsIHtcbiAgICAgICAgZnVuY3Rpb25OYW1lOiBSRVNPVVJDRV9QUkVGSVggKyAnLVNIQVJSLW1vbml0b3JTU01FeGVjU3RhdGUnLFxuICAgICAgICBoYW5kbGVyOiAnY2hlY2tfc3NtX2V4ZWN1dGlvbi5sYW1iZGFfaGFuZGxlcicsXG4gICAgICAgIHJ1bnRpbWU6IHByb3BzLnJ1bnRpbWVQeXRob24sXG4gICAgICAgIGRlc2NyaXB0aW9uOiAnQ2hlY2tzIHRoZSBzdGF0dXMgb2YgYW4gU1NNIGF1dG9tYXRpb24gZG9jdW1lbnQgZXhlY3V0aW9uJyxcbiAgICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUJ1Y2tldChcbiAgICAgICAgICAgIFNvbHV0aW9uc0J1Y2tldCxcbiAgICAgICAgICAgIHByb3BzLnNvbHV0aW9uVE1OICsgJy8nICsgcHJvcHMuc29sdXRpb25WZXJzaW9uICsgJy9sYW1iZGEvY2hlY2tfc3NtX2V4ZWN1dGlvbi5weS56aXAnXG4gICAgICAgICksXG4gICAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgICAgICBsb2dfbGV2ZWw6ICdpbmZvJyxcbiAgICAgICAgICAgIEFXU19QQVJUSVRJT046IHRoaXMucGFydGl0aW9uLFxuICAgICAgICAgICAgU09MVVRJT05fSUQ6IHByb3BzLnNvbHV0aW9uSWQsXG4gICAgICAgICAgICBTT0xVVElPTl9WRVJTSU9OOiBwcm9wcy5zb2x1dGlvblZlcnNpb25cbiAgICAgICAgfSxcbiAgICAgICAgbWVtb3J5U2l6ZTogMjU2LFxuICAgICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcyg2MDApLFxuICAgICAgICByb2xlOiBvcmNoZXN0cmF0b3JSb2xlLFxuICAgICAgICBsYXllcnM6IFtzaGFyckxhbWJkYUxheWVyXVxuICAgIH0pO1xuXG4gICAge1xuICAgICAgICBjb25zdCBjaGlsZFRvTW9kID0gbW9uaXRvclNTTUV4ZWNTdGF0ZS5ub2RlLmZpbmRDaGlsZCgnUmVzb3VyY2UnKSBhcyBsYW1iZGEuQ2ZuRnVuY3Rpb247XG5cbiAgICAgICAgY2hpbGRUb01vZC5jZm5PcHRpb25zLm1ldGFkYXRhID0ge1xuICAgICAgICAgICAgY2ZuX25hZzoge1xuICAgICAgICAgICAgICAgIHJ1bGVzX3RvX3N1cHByZXNzOiBbe1xuICAgICAgICAgICAgICAgICAgICBpZDogJ1c1OCcsXG4gICAgICAgICAgICAgICAgICAgIHJlYXNvbjogJ0ZhbHNlIHBvc2l0aXZlLiBBY2Nlc3MgaXMgcHJvdmlkZWQgdmlhIGEgcG9saWN5J1xuICAgICAgICAgICAgICAgIH0se1xuICAgICAgICAgICAgICAgICAgICBpZDogJ1c4OScsXG4gICAgICAgICAgICAgICAgICAgIHJlYXNvbjogJ1RoZXJlIGlzIG5vIG5lZWQgdG8gcnVuIHRoaXMgbGFtYmRhIGluIGEgVlBDJ1xuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBpZDogJ1c5MicsXG4gICAgICAgICAgICAgICAgICAgIHJlYXNvbjogJ1RoZXJlIGlzIG5vIG5lZWQgZm9yIFJlc2VydmVkIENvbmN1cnJlbmN5J1xuICAgICAgICAgICAgICAgIH1dXG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQGRlc2NyaXB0aW9uIFBvbGljeSBmb3Igcm9sZSB1c2VkIGJ5IGNvbW1vbiBPcmNoZXN0cmF0b3Igbm90aWZpY2F0aW9uIGxhbWJkYVxuICAgICAqIEB0eXBlIHtQb2xpY3l9XG4gICAgICovXG4gICAgY29uc3Qgbm90aWZ5UG9saWN5ID0gbmV3IFBvbGljeSh0aGlzLCAnbm90aWZ5UG9saWN5Jywge1xuICAgICAgICBwb2xpY3lOYW1lOiBSRVNPVVJDRV9QUkVGSVggKyAnLVNIQVJSX09yY2hlc3RyYXRvcl9Ob3RpZmllcicsXG4gICAgICAgIHN0YXRlbWVudHM6IFtcbiAgICAgICAgICAgIG5ldyBQb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICAgICAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgICAgICAgICAgICAgJ2xvZ3M6Q3JlYXRlTG9nR3JvdXAnLFxuICAgICAgICAgICAgICAgICAgICAnbG9nczpDcmVhdGVMb2dTdHJlYW0nLFxuICAgICAgICAgICAgICAgICAgICAnbG9nczpQdXRMb2dFdmVudHMnXG4gICAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgICByZXNvdXJjZXM6IFsnKiddXG4gICAgICAgICAgICB9KSxcbiAgICAgICAgICAgIG5ldyBQb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICAgICAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgICAgICAgICAgICAgJ3NlY3VyaXR5aHViOkJhdGNoVXBkYXRlRmluZGluZ3MnXG4gICAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgICByZXNvdXJjZXM6IFsnKiddXG4gICAgICAgICAgICB9KSxcbiAgICAgICAgICAgIG5ldyBQb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICAgICAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgICAgICAgICAgICAgJ3NzbTpHZXRQYXJhbWV0ZXInLFxuICAgICAgICAgICAgICAgICAgICAnc3NtOlB1dFBhcmFtZXRlcidcbiAgICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICAgIHJlc291cmNlczogW2Bhcm46JHt0aGlzLnBhcnRpdGlvbn06c3NtOiR7dGhpcy5yZWdpb259OiR7dGhpcy5hY2NvdW50fTpwYXJhbWV0ZXIvU29sdXRpb25zL1NPMDExMS8qYF1cbiAgICAgICAgICAgIH0pLFxuICAgICAgICAgICAgbmV3IFBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgICAgICAgICAgYWN0aW9uczogW1xuICAgICAgICAgICAgICAgICAgICAna21zOkVuY3J5cHQnLFxuICAgICAgICAgICAgICAgICAgICAna21zOkRlY3J5cHQnLFxuICAgICAgICAgICAgICAgICAgICAna21zOkdlbmVyYXRlRGF0YUtleScsXG4gICAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgICByZXNvdXJjZXM6IFtrbXNLZXkua2V5QXJuXVxuICAgICAgICAgICAgfSksXG4gICAgICAgICAgICBuZXcgUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgICAgICAgICBhY3Rpb25zOiBbXG4gICAgICAgICAgICAgICAgICAgICdzbnM6UHVibGlzaCdcbiAgICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICAgIHJlc291cmNlczogW1xuICAgICAgICAgICAgICAgICAgICBgYXJuOiR7dGhpcy5wYXJ0aXRpb259OnNuczoke3RoaXMucmVnaW9ufToke3RoaXMuYWNjb3VudH06JHtSRVNPVVJDRV9QUkVGSVh9LVNIQVJSX1RvcGljYFxuICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgIH0pXG4gICAgICAgIF1cbiAgICB9KVxuXG4gICAge1xuICAgICAgICBsZXQgY2hpbGRUb01vZCA9IG5vdGlmeVBvbGljeS5ub2RlLmZpbmRDaGlsZCgnUmVzb3VyY2UnKSBhcyBDZm5Qb2xpY3k7XG4gICAgICAgIGNoaWxkVG9Nb2QuY2ZuT3B0aW9ucy5tZXRhZGF0YSA9IHtcbiAgICAgICAgICAgIGNmbl9uYWc6IHtcbiAgICAgICAgICAgICAgICBydWxlc190b19zdXBwcmVzczogW3tcbiAgICAgICAgICAgICAgICAgICAgaWQ6ICdXMTInLFxuICAgICAgICAgICAgICAgICAgICByZWFzb246ICdSZXNvdXJjZSAqIGlzIHJlcXVpcmVkIGZvciBDbG91ZFdhdGNoIExvZ3MgYW5kIFNlY3VyaXR5IEh1YiBwb2xpY2llcyB1c2VkIGJ5IGNvcmUgc29sdXRpb24gTGFtYmRhIGZ1bmN0aW9uIGZvciBub3RpZmljYXRpb25zLidcbiAgICAgICAgICAgICAgICB9LHtcbiAgICAgICAgICAgICAgICAgICAgaWQ6ICdXNTgnLFxuICAgICAgICAgICAgICAgICAgICByZWFzb246ICdGYWxzZSBwb3NpdGl2ZS4gQWNjZXNzIGlzIHByb3ZpZGVkIHZpYSBhIHBvbGljeSdcbiAgICAgICAgICAgICAgICB9XVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgY2RrX25hZy5OYWdTdXBwcmVzc2lvbnMuYWRkUmVzb3VyY2VTdXBwcmVzc2lvbnMobm90aWZ5UG9saWN5LCBbXG4gICAgICAgIHtpZDogJ0F3c1NvbHV0aW9ucy1JQU01JywgcmVhc29uOiAnUmVzb3VyY2UgKiBpcyByZXF1aXJlZCBmb3IgQ2xvdWRXYXRjaCBMb2dzIGFuZCBTZWN1cml0eSBIdWIgcG9saWNpZXMgdXNlZCBieSBjb3JlIHNvbHV0aW9uIExhbWJkYSBmdW5jdGlvbiBmb3Igbm90aWZpY2F0aW9ucy4nfVxuICAgIF0pO1xuXG4gICAgbm90aWZ5UG9saWN5LmF0dGFjaFRvUm9sZShvcmNoZXN0cmF0b3JSb2xlKSAvLyBBbnkgT3JjaGVzdHJhdG9yIExhbWJkYSBjYW4gc2VuZCB0byBzbnNcblxuICAgIC8qKlxuICAgICAqIEBkZXNjcmlwdGlvbiBSb2xlIHVzZWQgYnkgY29tbW9uIE9yY2hlc3RyYXRvciBMYW1iZGFzXG4gICAgICogQHR5cGUge1JvbGV9XG4gICAgICovXG5cbiAgICBjb25zdCBub3RpZnlSb2xlID0gbmV3IFJvbGUodGhpcywgJ25vdGlmeVJvbGUnLCB7XG4gICAgICAgIGFzc3VtZWRCeTogbmV3IFNlcnZpY2VQcmluY2lwYWwoJ2xhbWJkYS5hbWF6b25hd3MuY29tJyksXG4gICAgICAgIGRlc2NyaXB0aW9uOiAnTGFtYmRhIHJvbGUgdG8gcGVyZm9ybSBub3RpZmljYXRpb24gYW5kIGxvZ2dpbmcgZnJvbSBvcmNoZXN0cmF0b3Igc3RlcCBmdW5jdGlvbidcbiAgICB9KTtcblxuICAgIG5vdGlmeVJvbGUuYXR0YWNoSW5saW5lUG9saWN5KG5vdGlmeVBvbGljeSk7XG5cbiAgICB7XG4gICAgICAgIGxldCBjaGlsZFRvTW9kID0gbm90aWZ5Um9sZS5ub2RlLmZpbmRDaGlsZCgnUmVzb3VyY2UnKSBhcyBDZm5Sb2xlO1xuICAgICAgICBjaGlsZFRvTW9kLmNmbk9wdGlvbnMubWV0YWRhdGEgPSB7XG4gICAgICAgICAgICBjZm5fbmFnOiB7XG4gICAgICAgICAgICAgICAgcnVsZXNfdG9fc3VwcHJlc3M6IFt7XG4gICAgICAgICAgICAgICAgICAgIGlkOiAnVzI4JyxcbiAgICAgICAgICAgICAgICAgICAgcmVhc29uOiAnU3RhdGljIG5hbWVzIGNob3NlbiBpbnRlbnRpb25hbGx5IHRvIHByb3ZpZGUgZWFzeSBpbnRlZ3JhdGlvbiB3aXRoIHBsYXlib29rIG9yY2hlc3RyYXRvciBzdGVwIGZ1bmN0aW9ucy4nXG4gICAgICAgICAgICAgICAgfV1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBkZXNjcmlwdGlvbiBzZW5kTm90aWZpY2F0aW9ucyAtIHNlbmQgbm90aWZpY2F0aW9ucyBhbmQgbG9nIG1lc3NhZ2VzIGZyb20gT3JjaGVzdHJhdG9yIHN0ZXAgZnVuY3Rpb25cbiAgICAgKiBAdHlwZSB7bGFtYmRhLkZ1bmN0aW9ufVxuICAgICAqL1xuICAgIGNvbnN0IHNlbmROb3RpZmljYXRpb25zID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnc2VuZE5vdGlmaWNhdGlvbnMnLCB7XG4gICAgICAgIGZ1bmN0aW9uTmFtZTogUkVTT1VSQ0VfUFJFRklYICsgJy1TSEFSUi1zZW5kTm90aWZpY2F0aW9ucycsXG4gICAgICAgIGhhbmRsZXI6ICdzZW5kX25vdGlmaWNhdGlvbnMubGFtYmRhX2hhbmRsZXInLFxuICAgICAgICBydW50aW1lOiBwcm9wcy5ydW50aW1lUHl0aG9uLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ1NlbmRzIG5vdGlmaWNhdGlvbnMgYW5kIGxvZyBtZXNzYWdlcycsXG4gICAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21CdWNrZXQoXG4gICAgICAgICAgICBTb2x1dGlvbnNCdWNrZXQsXG4gICAgICAgICAgICBwcm9wcy5zb2x1dGlvblRNTiArICcvJyArIHByb3BzLnNvbHV0aW9uVmVyc2lvbiArICcvbGFtYmRhL3NlbmRfbm90aWZpY2F0aW9ucy5weS56aXAnXG4gICAgICAgICksXG4gICAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgICAgICBsb2dfbGV2ZWw6ICdpbmZvJyxcbiAgICAgICAgICAgIEFXU19QQVJUSVRJT046IHRoaXMucGFydGl0aW9uLFxuICAgICAgICAgICAgU09MVVRJT05fSUQ6IHByb3BzLnNvbHV0aW9uSWQsXG4gICAgICAgICAgICBTT0xVVElPTl9WRVJTSU9OOiBwcm9wcy5zb2x1dGlvblZlcnNpb25cbiAgICAgICAgfSxcbiAgICAgICAgbWVtb3J5U2l6ZTogMjU2LFxuICAgICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcyg2MDApLFxuICAgICAgICByb2xlOiBub3RpZnlSb2xlLFxuICAgICAgICBsYXllcnM6IFtzaGFyckxhbWJkYUxheWVyXVxuICAgIH0pO1xuXG4gICAge1xuICAgICAgICBjb25zdCBjaGlsZFRvTW9kID0gc2VuZE5vdGlmaWNhdGlvbnMubm9kZS5maW5kQ2hpbGQoJ1Jlc291cmNlJykgYXMgbGFtYmRhLkNmbkZ1bmN0aW9uO1xuXG4gICAgICAgIGNoaWxkVG9Nb2QuY2ZuT3B0aW9ucy5tZXRhZGF0YSA9IHtcbiAgICAgICAgICAgIGNmbl9uYWc6IHtcbiAgICAgICAgICAgICAgICBydWxlc190b19zdXBwcmVzczogW3tcbiAgICAgICAgICAgICAgICAgICAgaWQ6ICdXNTgnLFxuICAgICAgICAgICAgICAgICAgICByZWFzb246ICdGYWxzZSBwb3NpdGl2ZS4gQWNjZXNzIGlzIHByb3ZpZGVkIHZpYSBhIHBvbGljeSdcbiAgICAgICAgICAgICAgICB9LHtcbiAgICAgICAgICAgICAgICAgICAgaWQ6ICdXODknLFxuICAgICAgICAgICAgICAgICAgICByZWFzb246ICdUaGVyZSBpcyBubyBuZWVkIHRvIHJ1biB0aGlzIGxhbWJkYSBpbiBhIFZQQydcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgaWQ6ICdXOTInLFxuICAgICAgICAgICAgICAgICAgICByZWFzb246ICdUaGVyZSBpcyBubyBuZWVkIGZvciBSZXNlcnZlZCBDb25jdXJyZW5jeSBkdWUgdG8gbG93IHJlcXVlc3QgcmF0ZSdcbiAgICAgICAgICAgICAgICB9XVxuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgIH1cblxuICAgIC8vLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgIC8vIEN1c3RvbSBMYW1iZGEgUG9saWN5XG4gICAgLy9cbiAgICBjb25zdCBjcmVhdGVDdXN0b21BY3Rpb25Qb2xpY3kgPSBuZXcgUG9saWN5KHRoaXMsICdjcmVhdGVDdXN0b21BY3Rpb25Qb2xpY3knLCB7XG4gICAgICAgIHBvbGljeU5hbWU6IFJFU09VUkNFX1BSRUZJWCArICctU0hBUlJfQ3VzdG9tX0FjdGlvbicsXG4gICAgICAgIHN0YXRlbWVudHM6IFtcbiAgICAgICAgICAgIG5ldyBQb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICAgICAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgICAgICAgICAgICAgJ2Nsb3Vkd2F0Y2g6UHV0TWV0cmljRGF0YSdcbiAgICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICAgIHJlc291cmNlczogWycqJ11cbiAgICAgICAgICAgIH0pLFxuICAgICAgICAgICAgbmV3IFBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgICAgICAgICAgYWN0aW9uczogW1xuICAgICAgICAgICAgICAgICAgICAnbG9nczpDcmVhdGVMb2dHcm91cCcsXG4gICAgICAgICAgICAgICAgICAgICdsb2dzOkNyZWF0ZUxvZ1N0cmVhbScsXG4gICAgICAgICAgICAgICAgICAgICdsb2dzOlB1dExvZ0V2ZW50cydcbiAgICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICAgIHJlc291cmNlczogWycqJ11cbiAgICAgICAgICAgIH0pLFxuICAgICAgICAgICAgbmV3IFBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgICAgICAgICAgYWN0aW9uczogW1xuICAgICAgICAgICAgICAgICAgICAnc2VjdXJpdHlodWI6Q3JlYXRlQWN0aW9uVGFyZ2V0JyxcbiAgICAgICAgICAgICAgICAgICAgJ3NlY3VyaXR5aHViOkRlbGV0ZUFjdGlvblRhcmdldCdcbiAgICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICAgIHJlc291cmNlczogWycqJ11cbiAgICAgICAgICAgIH0pLFxuICAgICAgICAgICAgbmV3IFBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgICAgICAgICAgYWN0aW9uczogW1xuICAgICAgICAgICAgICAgICAgICAnc3NtOkdldFBhcmFtZXRlcicsXG4gICAgICAgICAgICAgICAgICAgICdzc206R2V0UGFyYW1ldGVycycsXG4gICAgICAgICAgICAgICAgICAgICdzc206UHV0UGFyYW1ldGVyJ1xuICAgICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgICAgcmVzb3VyY2VzOiBbYGFybjoke3RoaXMucGFydGl0aW9ufTpzc206Kjoke3RoaXMuYWNjb3VudH06cGFyYW1ldGVyL1NvbHV0aW9ucy9TTzAxMTEvKmBdXG4gICAgICAgICAgICB9KSxcbiAgICAgICAgXVxuICAgIH0pXG5cbiAgICBjb25zdCBjcmVhdGVDQVBvbGljeVJlc291cmNlID0gY3JlYXRlQ3VzdG9tQWN0aW9uUG9saWN5Lm5vZGUuZmluZENoaWxkKCdSZXNvdXJjZScpIGFzIENmblBvbGljeTtcblxuICAgIGNyZWF0ZUNBUG9saWN5UmVzb3VyY2UuY2ZuT3B0aW9ucy5tZXRhZGF0YSA9IHtcbiAgICAgICAgY2ZuX25hZzoge1xuICAgICAgICAgICAgcnVsZXNfdG9fc3VwcHJlc3M6IFt7XG4gICAgICAgICAgICAgICAgaWQ6ICdXMTInLFxuICAgICAgICAgICAgICAgIHJlYXNvbjogJ1Jlc291cmNlICogaXMgcmVxdWlyZWQgZm9yIENsb3VkV2F0Y2ggTG9ncyBwb2xpY2llcyB1c2VkIG9uIExhbWJkYSBmdW5jdGlvbnMuJ1xuICAgICAgICAgICAgfV1cbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBjZGtfbmFnLk5hZ1N1cHByZXNzaW9ucy5hZGRSZXNvdXJjZVN1cHByZXNzaW9ucyhjcmVhdGVDdXN0b21BY3Rpb25Qb2xpY3ksIFtcbiAgICAgICAge2lkOiAnQXdzU29sdXRpb25zLUlBTTUnLCByZWFzb246ICdSZXNvdXJjZSAqIGlzIHJlcXVpcmVkIGZvciBDbG91ZFdhdGNoIExvZ3MgcG9saWNpZXMgdXNlZCBvbiBMYW1iZGEgZnVuY3Rpb25zLid9XG4gICAgXSk7XG5cbiAgICAvLy0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICAvLyBDdXN0b20gTGFtYmRhIFJvbGVcbiAgICAvL1xuICAgIGNvbnN0IGNyZWF0ZUN1c3RvbUFjdGlvblJvbGUgPSBuZXcgUm9sZSh0aGlzLCAnY3JlYXRlQ3VzdG9tQWN0aW9uUm9sZScsIHtcbiAgICAgICAgYXNzdW1lZEJ5OiBuZXcgU2VydmljZVByaW5jaXBhbCgnbGFtYmRhLmFtYXpvbmF3cy5jb20nKSxcbiAgICAgICAgZGVzY3JpcHRpb246ICdMYW1iZGEgcm9sZSB0byBhbGxvdyBjcmVhdGlvbiBvZiBTZWN1cml0eSBIdWIgQ3VzdG9tIEFjdGlvbnMnXG4gICAgfSk7XG5cbiAgICBjcmVhdGVDdXN0b21BY3Rpb25Sb2xlLmF0dGFjaElubGluZVBvbGljeShjcmVhdGVDdXN0b21BY3Rpb25Qb2xpY3kpO1xuXG4gICAgY29uc3QgY3JlYXRlQ0FSb2xlUmVzb3VyY2UgPSBjcmVhdGVDdXN0b21BY3Rpb25Sb2xlLm5vZGUuZmluZENoaWxkKCdSZXNvdXJjZScpIGFzIENmblJvbGU7XG5cbiAgICBjcmVhdGVDQVJvbGVSZXNvdXJjZS5jZm5PcHRpb25zLm1ldGFkYXRhID0ge1xuICAgICAgICBjZm5fbmFnOiB7XG4gICAgICAgICAgICBydWxlc190b19zdXBwcmVzczogW3tcbiAgICAgICAgICAgICAgICBpZDogJ1cyOCcsXG4gICAgICAgICAgICAgICAgcmVhc29uOiAnU3RhdGljIG5hbWVzIGNob3NlbiBpbnRlbnRpb25hbGx5IHRvIHByb3ZpZGUgZWFzeSBpbnRlZ3JhdGlvbiB3aXRoIHBsYXlib29rIHRlbXBsYXRlcydcbiAgICAgICAgICAgIH1dXG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgLy8tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAgLy8gQ3VzdG9tIExhbWJkYSAtIENyZWF0ZSBDdXN0b20gQWN0aW9uXG4gICAgLy9cbiAgICBjb25zdCBjcmVhdGVDdXN0b21BY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdDcmVhdGVDdXN0b21BY3Rpb24nLCB7XG4gICAgICAgIGZ1bmN0aW9uTmFtZTogUkVTT1VSQ0VfUFJFRklYICsgJy1TSEFSUi1DdXN0b21BY3Rpb24nLFxuICAgICAgICBoYW5kbGVyOiAnY3JlYXRlQ3VzdG9tQWN0aW9uLmxhbWJkYV9oYW5kbGVyJyxcbiAgICAgICAgcnVudGltZTogcHJvcHMucnVudGltZVB5dGhvbixcbiAgICAgICAgZGVzY3JpcHRpb246ICdDdXN0b20gcmVzb3VyY2UgdG8gY3JlYXRlIGFuIGFjdGlvbiB0YXJnZXQgaW4gU2VjdXJpdHkgSHViJyxcbiAgICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUJ1Y2tldChcbiAgICAgICAgICAgIFNvbHV0aW9uc0J1Y2tldCxcbiAgICAgICAgICAgIHByb3BzLnNvbHV0aW9uVE1OICsgJy8nICsgcHJvcHMuc29sdXRpb25WZXJzaW9uICsgJy9sYW1iZGEvY3JlYXRlQ3VzdG9tQWN0aW9uLnB5LnppcCdcbiAgICAgICAgKSxcbiAgICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgICAgIGxvZ19sZXZlbDogJ2luZm8nLFxuICAgICAgICAgICAgQVdTX1BBUlRJVElPTjogdGhpcy5wYXJ0aXRpb24sXG4gICAgICAgICAgICBzZW5kQW5vbnltb3VzTWV0cmljczogbWFwcGluZy5maW5kSW5NYXAoXCJzZW5kQW5vbnltb3VzTWV0cmljc1wiLCBcImRhdGFcIiksXG4gICAgICAgICAgICBTT0xVVElPTl9JRDogcHJvcHMuc29sdXRpb25JZCxcbiAgICAgICAgICAgIFNPTFVUSU9OX1ZFUlNJT046IHByb3BzLnNvbHV0aW9uVmVyc2lvblxuICAgICAgICB9LFxuICAgICAgICBtZW1vcnlTaXplOiAyNTYsXG4gICAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDYwMCksXG4gICAgICAgIHJvbGU6IGNyZWF0ZUN1c3RvbUFjdGlvblJvbGUsXG4gICAgICAgIGxheWVyczogW3NoYXJyTGFtYmRhTGF5ZXJdXG4gICAgfSk7XG5cbiAgICBjb25zdCBjcmVhdGVDQUZ1bmNSZXNvdXJjZSA9IGNyZWF0ZUN1c3RvbUFjdGlvbi5ub2RlLmZpbmRDaGlsZCgnUmVzb3VyY2UnKSBhcyBsYW1iZGEuQ2ZuRnVuY3Rpb247XG5cbiAgICBjcmVhdGVDQUZ1bmNSZXNvdXJjZS5jZm5PcHRpb25zLm1ldGFkYXRhID0ge1xuICAgICAgICBjZm5fbmFnOiB7XG4gICAgICAgICAgICBydWxlc190b19zdXBwcmVzczogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGlkOiAnVzU4JyxcbiAgICAgICAgICAgICAgICByZWFzb246ICdGYWxzZSBwb3NpdGl2ZS4gdGhlIGxhbWJkYSByb2xlIGFsbG93cyB3cml0ZSB0byBDVyBMb2dzJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBpZDogJ1c4OScsXG4gICAgICAgICAgICAgICAgcmVhc29uOiAnVGhlcmUgaXMgbm8gbmVlZCB0byBydW4gdGhpcyBsYW1iZGEgaW4gYSBWUEMnXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGlkOiAnVzkyJyxcbiAgICAgICAgICAgICAgICByZWFzb246ICdUaGVyZSBpcyBubyBuZWVkIGZvciBSZXNlcnZlZCBDb25jdXJyZW5jeSBkdWUgdG8gbG93IHJlcXVlc3QgcmF0ZSdcbiAgICAgICAgICAgIH1dXG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgY29uc3Qgb3JjaGVzdHJhdG9yID0gbmV3IE9yY2hlc3RyYXRvckNvbnN0cnVjdCh0aGlzLCBcIm9yY2hlc3RyYXRvclwiLCB7XG4gICAgICAgIHJvbGVBcm46IG9yY2hlc3RyYXRvclJvbGUucm9sZUFybixcbiAgICAgICAgc3NtRG9jU3RhdGVMYW1iZGE6IGNoZWNrU1NNRG9jU3RhdGUuZnVuY3Rpb25Bcm4sXG4gICAgICAgIHNzbUV4ZWNEb2NMYW1iZGE6IGV4ZWNBdXRvbWF0aW9uLmZ1bmN0aW9uQXJuLFxuICAgICAgICBzc21FeGVjTW9uaXRvckxhbWJkYTogbW9uaXRvclNTTUV4ZWNTdGF0ZS5mdW5jdGlvbkFybixcbiAgICAgICAgbm90aWZ5TGFtYmRhOiBzZW5kTm90aWZpY2F0aW9ucy5mdW5jdGlvbkFybixcbiAgICAgICAgZ2V0QXBwcm92YWxSZXF1aXJlbWVudExhbWJkYTogZ2V0QXBwcm92YWxSZXF1aXJlbWVudC5mdW5jdGlvbkFybixcbiAgICAgICAgc29sdXRpb25JZDogUkVTT1VSQ0VfUFJFRklYLFxuICAgICAgICBzb2x1dGlvbk5hbWU6IHByb3BzLnNvbHV0aW9uTmFtZSxcbiAgICAgICAgc29sdXRpb25WZXJzaW9uOiBwcm9wcy5zb2x1dGlvblZlcnNpb24sXG4gICAgICAgIG9yY2hMb2dHcm91cDogcHJvcHMub3JjaExvZ0dyb3VwLFxuICAgICAgICBrbXNLZXlQYXJtOiBrbXNLZXlQYXJtXG4gICAgfSlcblxuICAgIGxldCBvcmNoU3RhdGVNYWNoaW5lID0gb3JjaGVzdHJhdG9yLm5vZGUuZmluZENoaWxkKCdTdGF0ZU1hY2hpbmUnKSBhcyBTdGF0ZU1hY2hpbmVcbiAgICBsZXQgc3RhdGVNYWNoaW5lQ29uc3RydWN0ID0gb3JjaFN0YXRlTWFjaGluZS5ub2RlLmRlZmF1bHRDaGlsZCBhcyBDZm5TdGF0ZU1hY2hpbmVcbiAgICBsZXQgb3JjaEFyblBhcm0gPSBvcmNoZXN0cmF0b3Iubm9kZS5maW5kQ2hpbGQoJ1NIQVJSX09yY2hlc3RyYXRvcl9Bcm4nKSBhcyBTdHJpbmdQYXJhbWV0ZXJcbiAgICBsZXQgb3JjaGVzdHJhdG9yQXJuID0gb3JjaEFyblBhcm0ubm9kZS5kZWZhdWx0Q2hpbGQgYXMgQ2ZuUGFyYW1ldGVyXG5cbiAgICAvLy0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgIC8vIE9uZVRyaWdnZXIgLSBSZW1lZGlhdGUgd2l0aCBTSEFSUiBjdXN0b20gYWN0aW9uXG4gICAgLy9cbiAgICBuZXcgT25lVHJpZ2dlcih0aGlzLCAnUmVtZWRpYXRlV2l0aFNoYXJyJywge1xuICAgICAgICB0YXJnZXRBcm46IG9yY2hTdGF0ZU1hY2hpbmUuc3RhdGVNYWNoaW5lQXJuLFxuICAgICAgICBzZXJ2aWNlVG9rZW46IGNyZWF0ZUN1c3RvbUFjdGlvbi5mdW5jdGlvbkFybixcbiAgICAgICAgcHJlcmVxOiBbXG4gICAgICAgICAgICBjcmVhdGVDQUZ1bmNSZXNvdXJjZSxcbiAgICAgICAgICAgIGNyZWF0ZUNBUG9saWN5UmVzb3VyY2VcbiAgICAgICAgXVxuICAgIH0pXG5cbiAgICAvLy0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICAvLyBMb29wIHRocm91Z2ggYWxsIG9mIHRoZSBQbGF5Ym9va3MgYW5kIGNyZWF0ZSBhbiBvcHRpb24gdG8gbG9hZCBlYWNoXG4gICAgLy9cbiAgICBjb25zdCBQQl9ESVIgPSBgJHtfX2Rpcm5hbWV9Ly4uLy4uL3BsYXlib29rc2BcbiAgICB2YXIgaWdub3JlID0gWycuRFNfU3RvcmUnLCAnY29tbW9uJywgJ3B5dGhvbl9saWInLCAncHl0aG9uX3Rlc3RzJywgJy5weXRlc3RfY2FjaGUnLCAnTkVXUExBWUJPT0snLCAnLmNvdmVyYWdlJ107XG4gICAgbGV0IGlsbGVnYWxDaGFycyA9IC9bXFwuX10vZztcblxuICAgIHZhciBzdGFuZGFyZExvZ2ljYWxOYW1lczogc3RyaW5nW10gPSBbXVxuXG4gICAgZnMucmVhZGRpcihQQl9ESVIsIChlcnIsIGl0ZW1zKSA9PiB7XG4gICAgICAgIGl0ZW1zLmZvckVhY2goZmlsZSA9PiB7XG4gICAgICAgICAgICBpZiAoIWlnbm9yZS5pbmNsdWRlcyhmaWxlKSkge1xuICAgICAgICAgICAgICAgIHZhciB0ZW1wbGF0ZV9maWxlID0gYCR7ZmlsZX1TdGFjay50ZW1wbGF0ZWBcblxuICAgICAgICAgICAgICAgIC8vLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAgICAgICAgICAgICAgLy8gUGxheWJvb2sgQWRtaW4gVGVtcGxhdGUgTmVzdGVkIFN0YWNrXG4gICAgICAgICAgICAgICAgLy9cbiAgICAgICAgICAgICAgICBsZXQgcGFybW5hbWUgPSBmaWxlLnJlcGxhY2UoaWxsZWdhbENoYXJzLCAnJylcbiAgICAgICAgICAgICAgICBsZXQgYWRtaW5TdGFja09wdGlvbiA9IG5ldyBjZGsuQ2ZuUGFyYW1ldGVyKHRoaXMsIGBMb2FkQWRtaW5TdGFjayR7cGFybW5hbWV9YCwge1xuICAgICAgICAgICAgICAgICAgICB0eXBlOiBcIlN0cmluZ1wiLFxuICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogYExvYWQgQ2xvdWRXYXRjaCBFdmVudCBSdWxlcyBmb3IgJHtmaWxlfT9gLFxuICAgICAgICAgICAgICAgICAgICBkZWZhdWx0OiBcInllc1wiLFxuICAgICAgICAgICAgICAgICAgICBhbGxvd2VkVmFsdWVzOiBbXCJ5ZXNcIiwgXCJub1wiXSxcbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgIGFkbWluU3RhY2tPcHRpb24ub3ZlcnJpZGVMb2dpY2FsSWQoYExvYWQke3Bhcm1uYW1lfUFkbWluU3RhY2tgKVxuICAgICAgICAgICAgICAgIHN0YW5kYXJkTG9naWNhbE5hbWVzLnB1c2goYExvYWQke3Bhcm1uYW1lfUFkbWluU3RhY2tgKVxuXG4gICAgICAgICAgICAgICAgbGV0IGFkbWluU3RhY2sgPSBuZXcgY2RrLkNmblN0YWNrKHRoaXMsIGBQbGF5Ym9va0FkbWluU3RhY2ske2ZpbGV9YCwge1xuICAgICAgICAgICAgICAgICAgICB0ZW1wbGF0ZVVybDogXCJodHRwczovL1wiICsgY2RrLkZuLmZpbmRJbk1hcChcIlNvdXJjZUNvZGVcIiwgXCJHZW5lcmFsXCIsIFwiUzNCdWNrZXRcIikgK1xuICAgICAgICAgICAgICAgICAgICBcIi1yZWZlcmVuY2UuczMuYW1hem9uYXdzLmNvbS9cIiArIGNkay5Gbi5maW5kSW5NYXAoXCJTb3VyY2VDb2RlXCIsIFwiR2VuZXJhbFwiLCBcIktleVByZWZpeFwiKSArXG4gICAgICAgICAgICAgICAgICAgIFwiL3BsYXlib29rcy9cIiArIHRlbXBsYXRlX2ZpbGVcbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgIGFkbWluU3RhY2suYWRkRGVwZW5kc09uKHN0YXRlTWFjaGluZUNvbnN0cnVjdClcbiAgICAgICAgICAgICAgICBhZG1pblN0YWNrLmFkZERlcGVuZHNPbihvcmNoZXN0cmF0b3JBcm4pXG5cbiAgICAgICAgICAgICAgICBhZG1pblN0YWNrLmNmbk9wdGlvbnMuY29uZGl0aW9uID0gbmV3IGNkay5DZm5Db25kaXRpb24odGhpcywgYGxvYWQke2ZpbGV9Q29uZGAsIHtcbiAgICAgICAgICAgICAgICAgICAgZXhwcmVzc2lvbjpcbiAgICAgICAgICAgICAgICAgICAgICAgIGNkay5Gbi5jb25kaXRpb25FcXVhbHMoYWRtaW5TdGFja09wdGlvbiwgXCJ5ZXNcIilcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfSlcbiAgICBzdGFjay50ZW1wbGF0ZU9wdGlvbnMubWV0YWRhdGEgPSB7XG4gICAgICAgIFwiQVdTOjpDbG91ZEZvcm1hdGlvbjo6SW50ZXJmYWNlXCI6IHtcbiAgICAgICAgICAgIFBhcmFtZXRlckdyb3VwczogW1xuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgTGFiZWw6IHtkZWZhdWx0OiBcIlNlY3VyaXR5IFN0YW5kYXJkIFBsYXlib29rc1wifSxcbiAgICAgICAgICAgICAgICAgICAgUGFyYW1ldGVyczogc3RhbmRhcmRMb2dpY2FsTmFtZXNcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICBdXG4gICAgICAgIH0sXG4gICAgfTtcbiAgfVxufVxuIl19