#!/usr/bin/env node
"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.RunbookFactory = void 0;
const cdk_nag = require("cdk-nag");
const lambda = require("@aws-cdk/aws-lambda");
const s3 = require("@aws-cdk/aws-s3");
const iam = require("@aws-cdk/aws-iam");
const cdk = require("@aws-cdk/core");
const fs = require("fs");
;
class RunbookFactory extends cdk.Construct {
    constructor(scope, id, props) {
        super(scope, id);
        const RESOURCE_PREFIX = props.solutionId.replace(/^DEV-/, '');
        const policy = new iam.Policy(this, 'Policy', {
            policyName: RESOURCE_PREFIX + '-SHARR_Runbook_Provider_Policy',
            statements: [
                new iam.PolicyStatement({
                    actions: [
                        'cloudwatch:PutMetricData'
                    ],
                    resources: ['*']
                }),
                new iam.PolicyStatement({
                    actions: [
                        'logs:CreateLogGroup',
                        'logs:CreateLogStream',
                        'logs:PutLogEvents'
                    ],
                    resources: ['*']
                }),
                new iam.PolicyStatement({
                    actions: [
                        'ssm:CreateDocument',
                        'ssm:UpdateDocument',
                        'ssm:UpdateDocumentDefaultVersion',
                        'ssm:ListDocumentVersions',
                        'ssm:DeleteDocument'
                    ],
                    resources: ['*']
                })
            ]
        });
        const cfnPolicy = policy.node.defaultChild;
        cfnPolicy.cfnOptions.metadata = {
            cfn_nag: {
                rules_to_suppress: [
                    {
                        id: 'W12',
                        reason: 'Resource * is required in order to manage arbitrary SSM documents'
                    }
                ]
            }
        };
        cdk_nag.NagSuppressions.addResourceSuppressions(policy, [
            { id: 'AwsSolutions-IAM5', reason: 'Resource * is required in order to manage arbitrary SSM documents' }
        ]);
        const role = new iam.Role(this, 'Role', {
            assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
            description: 'Lambda role to allow creation of updatable SSM documents'
        });
        role.attachInlinePolicy(policy);
        const SolutionsBucket = s3.Bucket.fromBucketAttributes(this, 'SolutionsBucket', {
            bucketName: props.solutionDistBucket + '-' + props.region
        });
        const memberLambdaLayer = new lambda.LayerVersion(this, 'MemberLambdaLayer', {
            compatibleRuntimes: [props.runtimePython],
            description: 'SO0111 SHARR Common functions used by the solution member stack',
            license: 'https://www.apache.org/licenses/LICENSE-2.0',
            code: lambda.Code.fromBucket(SolutionsBucket, props.solutionTMN + '/' + props.solutionVersion + '/lambda/memberLayer.zip')
        });
        const lambdaFunction = new lambda.Function(this, 'Function', {
            functionName: RunbookFactory.getLambdaFunctionName(props.solutionId),
            handler: 'updatableRunbookProvider.lambda_handler',
            runtime: props.runtimePython,
            description: 'Custom resource to manage versioned SSM documents',
            code: lambda.Code.fromBucket(SolutionsBucket, props.solutionTMN + '/' + props.solutionVersion + '/lambda/updatableRunbookProvider.py.zip'),
            environment: {
                LOG_LEVEL: 'info',
                SOLUTION_ID: `AwsSolution/${props.solutionId}/${props.solutionVersion}`
            },
            memorySize: 256,
            timeout: cdk.Duration.seconds(600),
            role: role,
            layers: [memberLambdaLayer],
            reservedConcurrentExecutions: 1
        });
        const cfnLambdaFunction = lambdaFunction.node.defaultChild;
        cfnLambdaFunction.cfnOptions.metadata = {
            cfn_nag: {
                rules_to_suppress: [
                    {
                        id: 'W58',
                        reason: 'False positive. Access is provided via a policy'
                    },
                    {
                        id: 'W89',
                        reason: 'There is no need to run this lambda in a VPC'
                    }
                ]
            }
        };
    }
    static getLambdaFunctionName(solutionId) {
        const RESOURCE_PREFIX = solutionId.replace(/^DEV-/, '');
        return `${RESOURCE_PREFIX}-SHARR-updatableRunbookProvider`;
    }
    static getServiceToken(scope, solutionId) {
        const stack = cdk.Stack.of(scope);
        return `arn:${stack.partition}:lambda:${stack.region}:${stack.account}:function:${RunbookFactory.getLambdaFunctionName(solutionId)}`;
    }
    static getResourceType() {
        return 'Custom::UpdatableRunbook';
    }
    static createControlRunbook(scope, id, props) {
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
        const enableParam = new cdk.CfnParameter(scope, 'Enable ' + props.controlId, {
            type: 'String',
            description: `Enable/disable availability of remediation for ${props.securityStandard} version ${props.securityStandardVersion} Control ${props.controlId} in Security Hub Console Custom Actions. If NOT Available the remediation cannot be triggered from the Security Hub console in the Security Hub Admin account.`,
            default: 'Available',
            allowedValues: ['Available', 'NOT Available']
        });
        const installSsmDoc = new cdk.CfnCondition(scope, 'Enable ' + props.controlId + ' Condition', {
            expression: cdk.Fn.conditionEquals(enableParam, 'Available')
        });
        const ssmDocName = `SHARR-${props.securityStandard}_${props.securityStandardVersion}_${props.controlId}`;
        const ssmDocFQFileName = `${props.ssmDocPath}/${props.ssmDocFileName}`;
        const ssmDocType = props.ssmDocFileName.substring(props.ssmDocFileName.length - 4).toLowerCase();
        const ssmDocIn = fs.readFileSync(ssmDocFQFileName, 'utf8');
        let ssmDocOut = '';
        const re = /^(?<padding>\s+)%%SCRIPT=(?<script>.*)%%/;
        for (const line of ssmDocIn.split('\n')) {
            const foundMatch = re.exec(line);
            if (foundMatch && foundMatch.groups && foundMatch.groups.script) {
                let pathAndFileToInsert = foundMatch.groups.script;
                // If a relative path is provided then use it
                if (pathAndFileToInsert.substring(0, 7) === 'common/') {
                    pathAndFileToInsert = `${commonScripts}/${pathAndFileToInsert.substring(7)}`;
                }
                else {
                    pathAndFileToInsert = `${scriptPath}/${pathAndFileToInsert}`;
                }
                const scriptIn = fs.readFileSync(pathAndFileToInsert, 'utf8');
                for (const scriptLine of scriptIn.split('\n')) {
                    ssmDocOut += foundMatch.groups.padding + scriptLine + '\n';
                }
            }
            else {
                ssmDocOut += line + '\n';
            }
        }
        const ssmDoc = new cdk.CustomResource(scope, id, {
            serviceToken: RunbookFactory.getServiceToken(scope, props.solutionId),
            resourceType: RunbookFactory.getResourceType(),
            properties: {
                Name: ssmDocName,
                Content: ssmDocOut,
                DocumentFormat: ssmDocType.toUpperCase(),
                VersionName: props.solutionVersion,
                DocumentType: 'Automation'
            }
        });
        const ssmDocCfnResource = ssmDoc.node.defaultChild;
        ssmDocCfnResource.cfnOptions.condition = installSsmDoc;
        return ssmDoc;
    }
    static createRemediationRunbook(scope, id, props) {
        const ssmDocName = `SHARR-${props.ssmDocName}`;
        let scriptPath = '';
        if (props.scriptPath == undefined) {
            scriptPath = 'ssmdocs/scripts';
        }
        else {
            scriptPath = props.scriptPath;
        }
        const ssmDocFQFileName = `${props.ssmDocPath}/${props.ssmDocFileName}`;
        const ssmDocType = props.ssmDocFileName.substring(props.ssmDocFileName.length - 4).toLowerCase();
        const ssmDocIn = fs.readFileSync(ssmDocFQFileName, 'utf8');
        let ssmDocOut = '';
        const re = /^(?<padding>\s+)%%SCRIPT=(?<script>.*)%%/;
        for (const line of ssmDocIn.split('\n')) {
            const foundMatch = re.exec(line);
            if (foundMatch && foundMatch.groups && foundMatch.groups.script) {
                const scriptIn = fs.readFileSync(`${scriptPath}/${foundMatch.groups.script}`, 'utf8');
                for (const scriptLine of scriptIn.split('\n')) {
                    ssmDocOut += foundMatch.groups.padding + scriptLine + '\n';
                }
            }
            else {
                ssmDocOut += line + '\n';
            }
        }
        const runbook = new cdk.CustomResource(scope, id, {
            serviceToken: RunbookFactory.getServiceToken(scope, props.solutionId),
            resourceType: RunbookFactory.getResourceType(),
            properties: {
                Name: ssmDocName,
                Content: ssmDocOut,
                DocumentFormat: ssmDocType.toUpperCase(),
                DocumentType: 'Automation'
            }
        });
        return runbook;
    }
}
exports.RunbookFactory = RunbookFactory;
;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicnVuYm9va19mYWN0b3J5LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsicnVuYm9va19mYWN0b3J5LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQ0E7Ozs7Ozs7Ozs7Ozs7K0VBYStFOzs7QUFHL0UsbUNBQW1DO0FBQ25DLDhDQUE4QztBQUM5QyxzQ0FBc0M7QUFDdEMsd0NBQXdDO0FBQ3hDLHFDQUFxQztBQUNyQyx5QkFBeUI7QUFVeEIsQ0FBQztBQUVGLE1BQWEsY0FBZSxTQUFRLEdBQUcsQ0FBQyxTQUFTO0lBQy9DLFlBQVksS0FBb0IsRUFBRSxFQUFVLEVBQUUsS0FBMEI7UUFDdEUsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUMsQ0FBQztRQUVqQixNQUFNLGVBQWUsR0FBRyxLQUFLLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFFOUQsTUFBTSxNQUFNLEdBQUcsSUFBSSxHQUFHLENBQUMsTUFBTSxDQUFDLElBQUksRUFBRSxRQUFRLEVBQUU7WUFDNUMsVUFBVSxFQUFFLGVBQWUsR0FBRyxnQ0FBZ0M7WUFDOUQsVUFBVSxFQUFFO2dCQUNWLElBQUksR0FBRyxDQUFDLGVBQWUsQ0FBQztvQkFDdEIsT0FBTyxFQUFFO3dCQUNQLDBCQUEwQjtxQkFDM0I7b0JBQ0QsU0FBUyxFQUFFLENBQUMsR0FBRyxDQUFDO2lCQUNqQixDQUFDO2dCQUNGLElBQUksR0FBRyxDQUFDLGVBQWUsQ0FBQztvQkFDdEIsT0FBTyxFQUFFO3dCQUNQLHFCQUFxQjt3QkFDckIsc0JBQXNCO3dCQUN0QixtQkFBbUI7cUJBQ3BCO29CQUNELFNBQVMsRUFBRSxDQUFDLEdBQUcsQ0FBQztpQkFDakIsQ0FBQztnQkFDRixJQUFJLEdBQUcsQ0FBQyxlQUFlLENBQUM7b0JBQ3RCLE9BQU8sRUFBRTt3QkFDUCxvQkFBb0I7d0JBQ3BCLG9CQUFvQjt3QkFDcEIsa0NBQWtDO3dCQUNsQywwQkFBMEI7d0JBQzFCLG9CQUFv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QUU7WUFDdkMsTUFBTSxVQUFVLEdBQUcsRUFBRSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUNqQyxJQUFJLFVBQVUsSUFBSSxVQUFVLENBQUMsTUFBTSxJQUFJLFVBQVUsQ0FBQyxNQUFNLENBQUMsTUFBTSxFQUFFO2dCQUMvRCxNQUFNLFFBQVEsR0FBRyxFQUFFLENBQUMsWUFBWSxDQUFDLEdBQUcsVUFBVSxJQUFJLFVBQVUsQ0FBQyxNQUFNLENBQUMsTUFBTSxFQUFFLEVBQUUsTUFBTSxDQUFDLENBQUM7Z0JBQ3RGLEtBQUssTUFBTSxVQUFVLElBQUksUUFBUSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsRUFBRTtvQkFDN0MsU0FBUyxJQUFJLFVBQVUsQ0FBQyxNQUFNLENBQUMsT0FBTyxHQUFHLFVBQVUsR0FBRyxJQUFJLENBQUM7aUJBQzVEO2FBQ0Y7aUJBQU07Z0JBQ0wsU0FBUyxJQUFJLElBQUksR0FBRyxJQUFJLENBQUM7YUFDMUI7U0FDRjtRQUVELE1BQU0sT0FBTyxHQUFHLElBQUksR0FBRyxDQUFDLGNBQWMsQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFO1lBQ2hELFlBQVksRUFBRSxjQUFjLENBQUMsZUFBZSxDQUFDLEtBQUssRUFBRSxLQUFLLENBQUMsVUFBVSxDQUFDO1lBQ3JFLFlBQVksRUFBRSxjQUFjLENBQUMsZUFBZSxFQUFFO1lBQzlDLFVBQVUsRUFBRTtnQkFDVixJQUFJLEVBQUUsVUFBVTtnQkFDaEIsT0FBTyxFQUFFLFNBQVM7Z0JBQ2xCLGNBQWMsRUFBRSxVQUFVLENBQUMsV0FBVyxFQUFFO2dCQUN4QyxZQUFZLEVBQUUsWUFBWTthQUMzQjtTQUNGLENBQUMsQ0FBQztRQUVILE9BQU8sT0FBTyxDQUFDO0lBQ2pCLENBQUM7Q0FDRjtBQTlPRCx3Q0E4T0M7QUFBQSxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiIyEvdXNyL2Jpbi9lbnYgbm9kZVxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICogIENvcHlyaWdodCBBbWF6b24uY29tLCBJbmMuIG9yIGl0cyBhZmZpbGlhdGVzLiBBbGwgUmlnaHRzIFJlc2VydmVkLiAgICAgICAgKlxuICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUgTGljZW5zZSwgVmVyc2lvbiAyLjAgKHRoZSBcIkxpY2Vuc2VcIikuIFlvdSBtYXkgICAqXG4gKiAgbm90IHVzZSB0aGlzIGZpbGUgZXhjZXB0IGluIGNvbXBsaWFuY2Ugd2l0aCB0aGUgTGljZW5zZS4gQSBjb3B5IG9mIHRoZSAgICAqXG4gKiAgTGljZW5zZSBpcyBsb2NhdGVkIGF0ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAqXG4gKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAqXG4gKiAgICAgIGh0dHA6Ly93d3cuYXBhY2hlLm9yZy9saWNlbnNlcy9MSUNFTlNFLTIuMCAgICAgICAgICAgICAgICAgICAgICAgICAgICAqXG4gKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAqXG4gKiAgb3IgaW4gdGhlICdsaWNlbnNlJyBmaWxlIGFjY29tcGFueWluZyB0aGlzIGZpbGUuIFRoaXMgZmlsZSBpcyBkaXN0cmlidXRlZCAqXG4gKiAgb24gYW4gJ0FTIElTJyBCQVNJUywgV0lUSE9VVCBXQVJSQU5USUVTIE9SIENPTkRJVElPTlMgT0YgQU5ZIEtJTkQsICAgICAgICAqXG4gKiAgZXhwcmVzcyBvciBpbXBsaWVkLiBTZWUgdGhlIExpY2Vuc2UgZm9yIHRoZSBzcGVjaWZpYyBsYW5ndWFnZSBnb3Zlcm5pbmcgICAqXG4gKiAgcGVybWlzc2lvbnMgYW5kIGxpbWl0YXRpb25zIHVuZGVyIHRoZSBMaWNlbnNlLiAgICAgICAgICAgICAgICAgICAgICAgICAgICAqXG4gKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbmltcG9ydCB7IElzc21QbGF5Ym9va1Byb3BzLCBSZW1lZGlhdGlvblJ1bmJvb2tQcm9wcyB9IGZyb20gJy4uLy4uL2xpYi9zc21wbGF5Ym9vayc7XG5pbXBvcnQgKiBhcyBjZGtfbmFnIGZyb20gJ2Nkay1uYWcnO1xuaW1wb3J0ICogYXMgbGFtYmRhIGZyb20gJ0Bhd3MtY2RrL2F3cy1sYW1iZGEnO1xuaW1wb3J0ICogYXMgczMgZnJvbSAnQGF3cy1jZGsvYXdzLXMzJztcbmltcG9ydCAqIGFzIGlhbSBmcm9tICdAYXdzLWNkay9hd3MtaWFtJztcbmltcG9ydCAqIGFzIGNkayBmcm9tICdAYXdzLWNkay9jb3JlJztcbmltcG9ydCAqIGFzIGZzIGZyb20gJ2ZzJztcblxuZXhwb3J0IGludGVyZmFjZSBSdW5ib29rRmFjdG9yeVByb3BzIHtcbiAgc29sdXRpb25JZDogc3RyaW5nO1xuICBydW50aW1lUHl0aG9uOiBsYW1iZGEuUnVudGltZTtcbiAgc29sdXRpb25EaXN0QnVja2V0OiBzdHJpbmc7XG4gIHNvbHV0aW9uVE1OOiBzdHJpbmc7XG4gIHNvbHV0aW9uVmVyc2lvbjogc3RyaW5nO1xuICByZWdpb246IHN0cmluZztcbiAgcGFydGl0aW9uOiBzdHJpbmc7XG59O1xuXG5leHBvcnQgY2xhc3MgUnVuYm9va0ZhY3RvcnkgZXh0ZW5kcyBjZGsuQ29uc3RydWN0IHtcbiAgY29uc3RydWN0b3Ioc2NvcGU6IGNkay5Db25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBSdW5ib29rRmFjdG9yeVByb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkKTtcblxuICAgIGNvbnN0IFJFU09VUkNFX1BSRUZJWCA9IHByb3BzLnNvbHV0aW9uSWQucmVwbGFjZSgvXkRFVi0vLCAnJyk7XG5cbiAgICBjb25zdCBwb2xpY3kgPSBuZXcgaWFtLlBvbGljeSh0aGlzLCAnUG9saWN5Jywge1xuICAgICAgcG9saWN5TmFtZTogUkVTT1VSQ0VfUFJFRklYICsgJy1TSEFSUl9SdW5ib29rX1Byb3ZpZGVyX1BvbGljeScsXG4gICAgICBzdGF0ZW1lbnRzOiBbXG4gICAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgICBhY3Rpb25zOiBbXG4gICAgICAgICAgICAnY2xvdWR3YXRjaDpQdXRNZXRyaWNEYXRhJ1xuICAgICAgICAgIF0sXG4gICAgICAgICAgcmVzb3VyY2VzOiBbJyonXVxuICAgICAgICB9KSxcbiAgICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgICAgICdsb2dzOkNyZWF0ZUxvZ0dyb3VwJyxcbiAgICAgICAgICAgICdsb2dzOkNyZWF0ZUxvZ1N0cmVhbScsXG4gICAgICAgICAgICAnbG9nczpQdXRMb2dFdmVudHMnXG4gICAgICAgICAgXSxcbiAgICAgICAgICByZXNvdXJjZXM6IFsnKiddXG4gICAgICAgIH0pLFxuICAgICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgICAgYWN0aW9uczogW1xuICAgICAgICAgICAgJ3NzbTpDcmVhdGVEb2N1bWVudCcsXG4gICAgICAgICAgICAnc3NtOlVwZGF0ZURvY3VtZW50JyxcbiAgICAgICAgICAgICdzc206VXBkYXRlRG9jdW1lbnREZWZhdWx0VmVyc2lvbicsXG4gICAgICAgICAgICAnc3NtOkxpc3REb2N1bWVudFZlcnNpb25zJyxcbiAgICAgICAgICAgICdzc206RGVsZXRlRG9jdW1lbnQnXG4gICAgICAgICAgXSxcbiAgICAgICAgICByZXNvdXJjZXM6IFsnKiddXG4gICAgICAgIH0pXG4gICAgICBdXG4gICAgfSk7XG5cbiAgICBjb25zdCBjZm5Qb2xpY3kgPSBwb2xpY3kubm9kZS5kZWZhdWx0Q2hpbGQgYXMgaWFtLkNmblBvbGljeTtcbiAgICBjZm5Qb2xpY3kuY2ZuT3B0aW9ucy5tZXRhZGF0YSA9IHtcbiAgICAgIGNmbl9uYWc6IHtcbiAgICAgICAgcnVsZXNfdG9fc3VwcHJlc3M6IFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICBpZDogJ1cxMicsXG4gICAgICAgICAgICByZWFzb246ICdSZXNvdXJjZSAqIGlzIHJlcXVpcmVkIGluIG9yZGVyIHRvIG1hbmFnZSBhcmJpdHJhcnkgU1NNIGRvY3VtZW50cydcbiAgICAgICAgICB9XG4gICAgICAgIF1cbiAgICAgIH1cbiAgICB9O1xuXG4gICAgY2RrX25hZy5OYWdTdXBwcmVzc2lvbnMuYWRkUmVzb3VyY2VTdXBwcmVzc2lvbnMocG9saWN5LCBbXG4gICAgICB7aWQ6ICdBd3NTb2x1dGlvbnMtSUFNNScsIHJlYXNvbjogJ1Jlc291cmNlICogaXMgcmVxdWlyZWQgaW4gb3JkZXIgdG8gbWFuYWdlIGFyYml0cmFyeSBTU00gZG9jdW1lbnRzJ31cbiAgICBdKTtcblxuICAgIGNvbnN0IHJvbGUgPSBuZXcgaWFtLlJvbGUodGhpcywgJ1JvbGUnLCB7XG4gICAgICBhc3N1bWVkQnk6IG5ldyBpYW0uU2VydmljZVByaW5jaXBhbCgnbGFtYmRhLmFtYXpvbmF3cy5jb20nKSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnTGFtYmRhIHJvbGUgdG8gYWxsb3cgY3JlYXRpb24gb2YgdXBkYXRhYmxlIFNTTSBkb2N1bWVudHMnXG4gICAgfSk7XG5cbiAgICByb2xlLmF0dGFjaElubGluZVBvbGljeShwb2xpY3kpO1xuXG4gICAgY29uc3QgU29sdXRpb25zQnVja2V0ID0gczMuQnVja2V0LmZyb21CdWNrZXRBdHRyaWJ1dGVzKHRoaXMsICdTb2x1dGlvbnNCdWNrZXQnLCB7XG4gICAgICBidWNrZXROYW1lOiBwcm9wcy5zb2x1dGlvbkRpc3RCdWNrZXQgKyAnLScgKyBwcm9wcy5yZWdpb25cbiAgICB9KTtcblxuICAgIGNvbnN0IG1lbWJlckxhbWJkYUxheWVyID0gbmV3IGxhbWJkYS5MYXllclZlcnNpb24odGhpcywgJ01lbWJlckxhbWJkYUxheWVyJywge1xuICAgICAgY29tcGF0aWJsZVJ1bnRpbWVzOiBbcHJvcHMucnVudGltZVB5dGhvbl0sXG4gICAgICBkZXNjcmlwdGlvbjogJ1NPMDExMSBTSEFSUiBDb21tb24gZnVuY3Rpb25zIHVzZWQgYnkgdGhlIHNvbHV0aW9uIG1lbWJlciBzdGFjaycsXG4gICAgICBsaWNlbnNlOiAnaHR0cHM6Ly93d3cuYXBhY2hlLm9yZy9saWNlbnNlcy9MSUNFTlNFLTIuMCcsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQnVja2V0KFxuICAgICAgICAgIFNvbHV0aW9uc0J1Y2tldCxcbiAgICAgICAgICBwcm9wcy5zb2x1dGlvblRNTiArICcvJyArIHByb3BzLnNvbHV0aW9uVmVyc2lvbiArICcvbGFtYmRhL21lbWJlckxheWVyLnppcCdcbiAgICAgIClcbiAgICB9KTtcblxuICAgIGNvbnN0IGxhbWJkYUZ1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnRnVuY3Rpb24nLCB7XG4gICAgICBmdW5jdGlvbk5hbWU6IFJ1bmJvb2tGYWN0b3J5LmdldExhbWJkYUZ1bmN0aW9uTmFtZShwcm9wcy5zb2x1dGlvbklkKSxcbiAgICAgIGhhbmRsZXI6ICd1cGRhdGFibGVSdW5ib29rUHJvdmlkZXIubGFtYmRhX2hhbmRsZXInLFxuICAgICAgcnVudGltZTogcHJvcHMucnVudGltZVB5dGhvbixcbiAgICAgIGRlc2NyaXB0aW9uOiAnQ3VzdG9tIHJlc291cmNlIHRvIG1hbmFnZSB2ZXJzaW9uZWQgU1NNIGRvY3VtZW50cycsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQnVja2V0KFxuICAgICAgICAgIFNvbHV0aW9uc0J1Y2tldCxcbiAgICAgICAgICBwcm9wcy5zb2x1dGlvblRNTiArICcvJyArIHByb3BzLnNvbHV0aW9uVmVyc2lvbiArICcvbGFtYmRhL3VwZGF0YWJsZVJ1bmJvb2tQcm92aWRlci5weS56aXAnXG4gICAgICApLFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgTE9HX0xFVkVMOiAnaW5mbycsXG4gICAgICAgIFNPTFVUSU9OX0lEOiBgQXdzU29sdXRpb24vJHtwcm9wcy5zb2x1dGlvbklkfS8ke3Byb3BzLnNvbHV0aW9uVmVyc2lvbn1gXG4gICAgICB9LFxuICAgICAgbWVtb3J5U2l6ZTogMjU2LFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoNjAwKSxcbiAgICAgIHJvbGU6IHJvbGUsXG4gICAgICBsYXllcnM6IFttZW1iZXJMYW1iZGFMYXllcl0sXG4gICAgICByZXNlcnZlZENvbmN1cnJlbnRFeGVjdXRpb25zOiAxXG4gICAgfSk7XG5cbiAgICBjb25zdCBjZm5MYW1iZGFGdW5jdGlvbiA9IGxhbWJkYUZ1bmN0aW9uLm5vZGUuZGVmYXVsdENoaWxkIGFzIGxhbWJkYS5DZm5GdW5jdGlvbjtcbiAgICBjZm5MYW1iZGFGdW5jdGlvbi5jZm5PcHRpb25zLm1ldGFkYXRhID0ge1xuICAgICAgY2ZuX25hZzoge1xuICAgICAgICBydWxlc190b19zdXBwcmVzczogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIGlkOiAnVzU4JyxcbiAgICAgICAgICAgIHJlYXNvbjogJ0ZhbHNlIHBvc2l0aXZlLiBBY2Nlc3MgaXMgcHJvdmlkZWQgdmlhIGEgcG9saWN5J1xuICAgICAgICAgIH0sXG4gICAgICAgICAge1xuICAgICAgICAgICAgaWQ6ICdXODknLFxuICAgICAgICAgICAgcmVhc29uOiAnVGhlcmUgaXMgbm8gbmVlZCB0byBydW4gdGhpcyBsYW1iZGEgaW4gYSBWUEMnXG4gICAgICAgICAgfVxuICAgICAgICBdXG4gICAgICB9XG4gICAgfTtcbiAgfVxuXG4gIHN0YXRpYyBnZXRMYW1iZGFGdW5jdGlvbk5hbWUoc29sdXRpb25JZDogc3RyaW5nKTogc3RyaW5nIHtcbiAgICBjb25zdCBSRVNPVVJDRV9QUkVGSVggPSBzb2x1dGlvbklkLnJlcGxhY2UoL15ERVYtLywgJycpO1xuICAgIHJldHVybiBgJHtSRVNPVVJDRV9QUkVGSVh9LVNIQVJSLXVwZGF0YWJsZVJ1bmJvb2tQcm92aWRlcmA7XG4gIH1cblxuICBzdGF0aWMgZ2V0U2VydmljZVRva2VuKHNjb3BlOiBjZGsuQ29uc3RydWN0LCBzb2x1dGlvbklkOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIGNvbnN0IHN0YWNrID0gY2RrLlN0YWNrLm9mKHNjb3BlKTtcbiAgICByZXR1cm4gYGFybjoke3N0YWNrLnBhcnRpdGlvbn06bGFtYmRhOiR7c3RhY2sucmVnaW9ufToke3N0YWNrLmFjY291bnR9OmZ1bmN0aW9uOiR7UnVuYm9va0ZhY3RvcnkuZ2V0TGFtYmRhRnVuY3Rpb25OYW1lKHNvbHV0aW9uSWQpfWA7XG4gIH1cblxuICBzdGF0aWMgZ2V0UmVzb3VyY2VUeXBlKCk6IHN0cmluZyB7XG4gICAgcmV0dXJuICdDdXN0b206OlVwZGF0YWJsZVJ1bmJvb2snO1xuICB9XG5cbiAgc3RhdGljIGNyZWF0ZUNvbnRyb2xSdW5ib29rKHNjb3BlOiBjZGsuQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczogSXNzbVBsYXlib29rUHJvcHMpOiBjZGsuQ3VzdG9tUmVzb3VyY2Uge1xuICAgIGxldCBzY3JpcHRQYXRoID0gJyc7XG4gICAgaWYgKHByb3BzLnNjcmlwdFBhdGggPT0gdW5kZWZpbmVkICkge1xuICAgICAgc2NyaXB0UGF0aCA9IGAke3Byb3BzLnNzbURvY1BhdGh9L3NjcmlwdHNgO1xuICAgIH0gZWxzZSB7XG4gICAgICBzY3JpcHRQYXRoID0gcHJvcHMuc2NyaXB0UGF0aDtcbiAgICB9XG5cbiAgICBsZXQgY29tbW9uU2NyaXB0cyA9ICcnO1xuICAgIGlmIChwcm9wcy5jb21tb25TY3JpcHRzID09IHVuZGVmaW5lZCApIHtcbiAgICAgIGNvbW1vblNjcmlwdHMgPSAnLi4vY29tbW9uJztcbiAgICB9IGVsc2Uge1xuICAgICAgY29tbW9uU2NyaXB0cyA9IHByb3BzLmNvbW1vblNjcmlwdHM7XG4gICAgfVxuXG4gICAgY29uc3QgZW5hYmxlUGFyYW0gPSBuZXcgY2RrLkNmblBhcmFtZXRlcihzY29wZSwgJ0VuYWJsZSAnICsgcHJvcHMuY29udHJvbElkLCB7XG4gICAgICB0eXBlOiAnU3RyaW5nJyxcbiAgICAgIGRlc2NyaXB0aW9uOiBgRW5hYmxlL2Rpc2FibGUgYXZhaWxhYmlsaXR5IG9mIHJlbWVkaWF0aW9uIGZvciAke3Byb3BzLnNlY3VyaXR5U3RhbmRhcmR9IHZlcnNpb24gJHtwcm9wcy5zZWN1cml0eVN0YW5kYXJkVmVyc2lvbn0gQ29udHJvbCAke3Byb3BzLmNvbnRyb2xJZH0gaW4gU2VjdXJpdHkgSHViIENvbnNvbGUgQ3VzdG9tIEFjdGlvbnMuIElmIE5PVCBBdmFpbGFibGUgdGhlIHJlbWVkaWF0aW9uIGNhbm5vdCBiZSB0cmlnZ2VyZWQgZnJvbSB0aGUgU2VjdXJpdHkgSHViIGNvbnNvbGUgaW4gdGhlIFNlY3VyaXR5IEh1YiBBZG1pbiBhY2NvdW50LmAsXG4gICAgICBkZWZhdWx0OiAnQXZhaWxhYmxlJyxcbiAgICAgIGFsbG93ZWRWYWx1ZXM6IFsnQXZhaWxhYmxlJywgJ05PVCBBdmFpbGFibGUnXVxuICAgIH0pO1xuXG4gICAgY29uc3QgaW5zdGFsbFNzbURvYyA9IG5ldyBjZGsuQ2ZuQ29uZGl0aW9uKHNjb3BlLCAnRW5hYmxlICcgKyBwcm9wcy5jb250cm9sSWQgKyAnIENvbmRpdGlvbicsIHtcbiAgICAgIGV4cHJlc3Npb246IGNkay5Gbi5jb25kaXRpb25FcXVhbHMoZW5hYmxlUGFyYW0sICdBdmFpbGFibGUnKVxuICAgIH0pO1xuXG4gICAgY29uc3Qgc3NtRG9jTmFtZSA9IGBTSEFSUi0ke3Byb3BzLnNlY3VyaXR5U3RhbmRhcmR9XyR7cHJvcHMuc2VjdXJpdHlTdGFuZGFyZFZlcnNpb259XyR7cHJvcHMuY29udHJvbElkfWA7XG4gICAgY29uc3Qgc3NtRG9jRlFGaWxlTmFtZSA9IGAke3Byb3BzLnNzbURvY1BhdGh9LyR7cHJvcHMuc3NtRG9jRmlsZU5hbWV9YDtcbiAgICBjb25zdCBzc21Eb2NUeXBlID0gcHJvcHMuc3NtRG9jRmlsZU5hbWUuc3Vic3RyaW5nKHByb3BzLnNzbURvY0ZpbGVOYW1lLmxlbmd0aCAtIDQpLnRvTG93ZXJDYXNlKCk7XG5cbiAgICBjb25zdCBzc21Eb2NJbiA9IGZzLnJlYWRGaWxlU3luYyhzc21Eb2NGUUZpbGVOYW1lLCAndXRmOCcpO1xuXG4gICAgbGV0IHNzbURvY091dDogc3RyaW5nID0gJyc7XG4gICAgY29uc3QgcmUgPSAvXig/PHBhZGRpbmc+XFxzKyklJVNDUklQVD0oPzxzY3JpcHQ+LiopJSUvO1xuXG4gICAgZm9yIChjb25zdCBsaW5lIG9mIHNzbURvY0luLnNwbGl0KCdcXG4nKSkge1xuICAgICAgY29uc3QgZm91bmRNYXRjaCA9IHJlLmV4ZWMobGluZSk7XG4gICAgICBpZiAoZm91bmRNYXRjaCAmJiBmb3VuZE1hdGNoLmdyb3VwcyAmJiBmb3VuZE1hdGNoLmdyb3Vwcy5zY3JpcHQpIHtcbiAgICAgICAgbGV0IHBhdGhBbmRGaWxlVG9JbnNlcnQgPSBmb3VuZE1hdGNoLmdyb3Vwcy5zY3JpcHQ7XG4gICAgICAgIC8vIElmIGEgcmVsYXRpdmUgcGF0aCBpcyBwcm92aWRlZCB0aGVuIHVzZSBpdFxuICAgICAgICBpZiAocGF0aEFuZEZpbGVUb0luc2VydC5zdWJzdHJpbmcoMCwgNykgPT09ICdjb21tb24vJykge1xuICAgICAgICAgIHBhdGhBbmRGaWxlVG9JbnNlcnQgPSBgJHtjb21tb25TY3JpcHRzfS8ke3BhdGhBbmRGaWxlVG9JbnNlcnQuc3Vic3RyaW5nKDcpfWA7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcGF0aEFuZEZpbGVUb0luc2VydCA9IGAke3NjcmlwdFBhdGh9LyR7cGF0aEFuZEZpbGVUb0luc2VydH1gO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHNjcmlwdEluID0gZnMucmVhZEZpbGVTeW5jKHBhdGhBbmRGaWxlVG9JbnNlcnQsICd1dGY4Jyk7XG4gICAgICAgIGZvciAoY29uc3Qgc2NyaXB0TGluZSBvZiBzY3JpcHRJbi5zcGxpdCgnXFxuJykpIHtcbiAgICAgICAgICBzc21Eb2NPdXQgKz0gZm91bmRNYXRjaC5ncm91cHMucGFkZGluZyArIHNjcmlwdExpbmUgKyAnXFxuJztcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgc3NtRG9jT3V0ICs9IGxpbmUgKyAnXFxuJztcbiAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCBzc21Eb2MgPSBuZXcgY2RrLkN1c3RvbVJlc291cmNlKHNjb3BlLCBpZCwge1xuICAgICAgc2VydmljZVRva2VuOiBSdW5ib29rRmFjdG9yeS5nZXRTZXJ2aWNlVG9rZW4oc2NvcGUsIHByb3BzLnNvbHV0aW9uSWQpLFxuICAgICAgcmVzb3VyY2VUeXBlOiBSdW5ib29rRmFjdG9yeS5nZXRSZXNvdXJjZVR5cGUoKSxcbiAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgTmFtZTogc3NtRG9jTmFtZSxcbiAgICAgICAgQ29udGVudDogc3NtRG9jT3V0LFxuICAgICAgICBEb2N1bWVudEZvcm1hdDogc3NtRG9jVHlwZS50b1VwcGVyQ2FzZSgpLFxuICAgICAgICBWZXJzaW9uTmFtZTogcHJvcHMuc29sdXRpb25WZXJzaW9uLFxuICAgICAgICBEb2N1bWVudFR5cGU6ICdBdXRvbWF0aW9uJ1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgY29uc3Qgc3NtRG9jQ2ZuUmVzb3VyY2UgPSBzc21Eb2Mubm9kZS5kZWZhdWx0Q2hpbGQgYXMgY2RrLkNmbkN1c3RvbVJlc291cmNlO1xuICAgIHNzbURvY0NmblJlc291cmNlLmNmbk9wdGlvbnMuY29uZGl0aW9uID0gaW5zdGFsbFNzbURvYztcblxuICAgIHJldHVybiBzc21Eb2M7XG4gIH1cblxuICBzdGF0aWMgY3JlYXRlUmVtZWRpYXRpb25SdW5ib29rKHNjb3BlOiBjZGsuQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczogUmVtZWRpYXRpb25SdW5ib29rUHJvcHMpIHtcbiAgICBjb25zdCBzc21Eb2NOYW1lID0gYFNIQVJSLSR7cHJvcHMuc3NtRG9jTmFtZX1gO1xuICAgIGxldCBzY3JpcHRQYXRoID0gJyc7XG4gICAgaWYgKHByb3BzLnNjcmlwdFBhdGggPT0gdW5kZWZpbmVkKSB7XG4gICAgICBzY3JpcHRQYXRoID0gJ3NzbWRvY3Mvc2NyaXB0cyc7XG4gICAgfSBlbHNlIHtcbiAgICAgIHNjcmlwdFBhdGggPSBwcm9wcy5zY3JpcHRQYXRoO1xuICAgIH1cblxuICAgIGNvbnN0IHNzbURvY0ZRRmlsZU5hbWUgPSBgJHtwcm9wcy5zc21Eb2NQYXRofS8ke3Byb3BzLnNzbURvY0ZpbGVOYW1lfWA7XG4gICAgY29uc3Qgc3NtRG9jVHlwZSA9IHByb3BzLnNzbURvY0ZpbGVOYW1lLnN1YnN0cmluZyhwcm9wcy5zc21Eb2NGaWxlTmFtZS5sZW5ndGggLSA0KS50b0xvd2VyQ2FzZSgpO1xuXG4gICAgY29uc3Qgc3NtRG9jSW4gPSBmcy5yZWFkRmlsZVN5bmMoc3NtRG9jRlFGaWxlTmFtZSwgJ3V0ZjgnKTtcblxuICAgIGxldCBzc21Eb2NPdXQ6IHN0cmluZyA9ICcnO1xuICAgIGNvbnN0IHJlID0gL14oPzxwYWRkaW5nPlxccyspJSVTQ1JJUFQ9KD88c2NyaXB0Pi4qKSUlLztcblxuICAgIGZvciAoY29uc3QgbGluZSBvZiBzc21Eb2NJbi5zcGxpdCgnXFxuJykpIHtcbiAgICAgIGNvbnN0IGZvdW5kTWF0Y2ggPSByZS5leGVjKGxpbmUpO1xuICAgICAgaWYgKGZvdW5kTWF0Y2ggJiYgZm91bmRNYXRjaC5ncm91cHMgJiYgZm91bmRNYXRjaC5ncm91cHMuc2NyaXB0KSB7XG4gICAgICAgIGNvbnN0IHNjcmlwdEluID0gZnMucmVhZEZpbGVTeW5jKGAke3NjcmlwdFBhdGh9LyR7Zm91bmRNYXRjaC5ncm91cHMuc2NyaXB0fWAsICd1dGY4Jyk7XG4gICAgICAgIGZvciAoY29uc3Qgc2NyaXB0TGluZSBvZiBzY3JpcHRJbi5zcGxpdCgnXFxuJykpIHtcbiAgICAgICAgICBzc21Eb2NPdXQgKz0gZm91bmRNYXRjaC5ncm91cHMucGFkZGluZyArIHNjcmlwdExpbmUgKyAnXFxuJztcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgc3NtRG9jT3V0ICs9IGxpbmUgKyAnXFxuJztcbiAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCBydW5ib29rID0gbmV3IGNkay5DdXN0b21SZXNvdXJjZShzY29wZSwgaWQsIHtcbiAgICAgIHNlcnZpY2VUb2tlbjogUnVuYm9va0ZhY3RvcnkuZ2V0U2VydmljZVRva2VuKHNjb3BlLCBwcm9wcy5zb2x1dGlvbklkKSxcbiAgICAgIHJlc291cmNlVHlwZTogUnVuYm9va0ZhY3RvcnkuZ2V0UmVzb3VyY2VUeXBlKCksXG4gICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgIE5hbWU6IHNzbURvY05hbWUsXG4gICAgICAgIENvbnRlbnQ6IHNzbURvY091dCxcbiAgICAgICAgRG9jdW1lbnRGb3JtYXQ6IHNzbURvY1R5cGUudG9VcHBlckNhc2UoKSxcbiAgICAgICAgRG9jdW1lbnRUeXBlOiAnQXV0b21hdGlvbidcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIHJldHVybiBydW5ib29rO1xuICB9XG59O1xuIl19