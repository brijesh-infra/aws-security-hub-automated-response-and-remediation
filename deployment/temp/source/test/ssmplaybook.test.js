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
const assert_1 = require("@aws-cdk/assert");
const core_1 = require("@aws-cdk/core");
const aws_iam_1 = require("@aws-cdk/aws-iam");
const ssmplaybook_1 = require("../lib/ssmplaybook");
const remediation_runbook_stack_1 = require("../solution_deploy/lib/remediation_runbook-stack");
const cdk_nag_1 = require("cdk-nag");
const core_2 = require("@aws-cdk/core");
// ----------------------------
// SsmPlaybook - Parse Runbook
// ----------------------------
function getSsmPlaybook() {
    const app = new core_1.App();
    const stack = new core_1.Stack(app, 'MyTestStack', {
        stackName: 'testStack'
    });
    new ssmplaybook_1.SsmPlaybook(stack, 'Playbook', {
        securityStandard: 'SECTEST',
        securityStandardVersion: '1.2.3',
        controlId: 'TEST.1',
        ssmDocPath: 'test/test_data/',
        ssmDocFileName: 'tstest-rds1.yaml',
        solutionVersion: 'v1.1.1',
        solutionDistBucket: 'solutionstest',
        solutionId: 'SO0111'
    });
    core_2.Aspects.of(app).add(new cdk_nag_1.AwsSolutionsChecks({ verbose: true }));
    return stack;
}
test('Test SsmPlaybook Generation', () => {
    (0, assert_1.expect)(getSsmPlaybook()).to((0, assert_1.haveResourceLike)("AWS::SSM::Document", {
        "Content": {
            "description": "### Document Name - SHARR-SECTEST_1.2.3_TEST.1\n",
            "schemaVersion": "0.3",
            "assumeRole": "{{ AutomationAssumeRole }}",
            "outputs": [
                "VerifySGRules.Response"
            ],
            "parameters": {
                "Finding": {
                    "type": "StringMap",
                    "description": "The input from Step function for TEST1 finding"
                },
                "AutomationAssumeRole": {
                    "type": "String",
                    "description": "(Optional) The ARN of the role that allows Automation to perform the actions on your behalf.",
                    "default": ""
                }
            }
        },
        "DocumentType": "Automation",
        "Name": "SHARR-SECTEST_1.2.3_TEST.1"
    }, assert_1.ResourcePart.Properties));
});
// -------------------
// Trigger
// -------------------
function getTriggerStack() {
    const app = new core_1.App();
    const stack = new core_1.Stack(app, 'MyTestStack', {
        stackName: 'testStack'
    });
    new ssmplaybook_1.Trigger(stack, 'Trigger', {
        description: 'Trigger description',
        securityStandard: 'AFSBP',
        generatorId: 'aws-foundational-security-best-practices/v/1.0.0/RDS.1',
        controlId: 'RDS.1',
        targetArn: 'arn:aws-test:sns:us-east-1:1111111111111111:foo'
    });
    return stack;
}
// ---------------------
// SsmRemediationRunbook
// ---------------------
function getSsmRemediationRunbook() {
    const app = new core_1.App();
    const stack = new core_1.Stack(app, 'MyTestStack', {
        stackName: 'testStack'
    });
    const roleStack = new remediation_runbook_stack_1.MemberRoleStack(app, 'roles', {
        description: 'test;',
        solutionId: 'SO0111',
        solutionVersion: 'v1.1.1',
        solutionDistBucket: 'sharrbukkit'
    });
    new ssmplaybook_1.SsmRemediationRunbook(stack, 'Playbook', {
        ssmDocName: 'blahblahblah',
        ssmDocPath: 'test/test_data/',
        ssmDocFileName: 'tstest-cis29.yaml',
        solutionVersion: 'v1.1.1',
        solutionDistBucket: 'solutionstest',
        solutionId: 'SO0111'
    });
    return stack;
}
test('Test Shared Remediation Generation', () => {
    (0, assert_1.expect)(getSsmRemediationRunbook()).to((0, assert_1.haveResourceLike)("AWS::SSM::Document", {
        "Content": {
            "description": "### Document Name - SHARR-CIS_1.2.0_2.9\n",
            "schemaVersion": "0.3",
            "assumeRole": "{{ AutomationAssumeRole }}",
            "outputs": [
                "VerifySGRules.Response"
            ],
            "parameters": {
                "Finding": {
                    "type": "StringMap",
                    "description": "The input from Step function for 2.9 finding"
                },
                "AutomationAssumeRole": {
                    "type": "String",
                    "description": "(Optional) The ARN of the role that allows Automation to perform the actions on your behalf.",
                    "default": ""
                }
            }
        },
        "DocumentType": "Automation",
        "Name": "SHARR-blahblahblah"
    }, assert_1.ResourcePart.Properties));
});
// ------------------
// SsmRole
// ------------------
function getSsmRemediationRoleCis() {
    const app = new core_1.App();
    const stack = new remediation_runbook_stack_1.MemberRoleStack(app, 'MyTestStack', {
        description: 'test-description',
        solutionId: 'SO0111',
        solutionVersion: 'v1.0.0',
        solutionDistBucket: 'test-bucket'
    });
    let inlinePolicy = new aws_iam_1.Policy(stack, 'Policy');
    let rdsPerms = new aws_iam_1.PolicyStatement();
    rdsPerms.addActions("rds:ModifyDBSnapshotAttribute");
    rdsPerms.effect = aws_iam_1.Effect.ALLOW;
    rdsPerms.addResources("*");
    inlinePolicy.addStatements(rdsPerms);
    new ssmplaybook_1.SsmRole(stack, 'Role', {
        solutionId: "SO0111",
        ssmDocName: "foobar",
        remediationPolicy: inlinePolicy,
        remediationRoleName: "SHARR-RemediationRoleName"
    });
    return stack;
}
test('Test SsmRole Generation', () => {
    (0, assert_1.expect)(getSsmRemediationRoleCis()).to((0, assert_1.haveResourceLike)("AWS::IAM::Role", {
        "AssumeRolePolicyDocument": {
            "Statement": [
                {
                    "Action": "sts:AssumeRole",
                    "Effect": "Allow",
                    "Principal": {
                        "AWS": {
                            "Fn::Join": [
                                "",
                                [
                                    "arn:",
                                    {
                                        "Ref": "AWS::Partition"
                                    },
                                    ":iam::",
                                    {
                                        "Ref": "AWS::AccountId"
                                    },
                                    ":role/SO0111-SHARR-Orchestrator-Member"
                                ]
                            ]
                        }
                    }
                }
            ],
            "Version": "2012-10-17"
        },
        "RoleName": "SHARR-RemediationRoleName"
    }, assert_1.ResourcePart.Properties));
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3NtcGxheWJvb2sudGVzdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInNzbXBsYXlib29rLnRlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7Ozs7Ozs7OytFQWErRTs7QUFFL0UsNENBQXFGO0FBQ3JGLHdDQUEyQztBQUMzQyw4Q0FJMEI7QUFDMUIsb0RBQTBGO0FBQzFGLGdHQUFtRjtBQUNuRixxQ0FBNEM7QUFDNUMsd0NBQXVDO0FBRXZDLCtCQUErQjtBQUMvQiw4QkFBOEI7QUFDOUIsK0JBQStCO0FBQy9CLFNBQVMsY0FBYztJQUNuQixNQUFNLEdBQUcsR0FBRyxJQUFJLFVBQUcsRUFBRSxDQUFDO0lBQ3RCLE1BQU0sS0FBSyxHQUFHLElBQUksWUFBSyxDQUFDLEdBQUcsRUFBRSxhQUFhLEVBQUU7UUFDMUMsU0FBUyxFQUFFLFdBQVc7S0FDdkIsQ0FBQyxDQUFDO0lBQ0gsSUFBSSx5QkFBVyxDQUFDLEtBQUssRUFBRSxVQUFVLEVBQUU7UUFDakMsZ0JBQWdCLEVBQUUsU0FBUztRQUMzQix1QkFBdUIsRUFBRSxPQUFPO1FBQ2hDLFNBQVMsRUFBRSxRQUFRO1FBQ25CLFVBQVUsRUFBRSxpQkFBaUI7UUFDN0IsY0FBYyxFQUFFLGtCQUFrQjtRQUNsQyxlQUFlLEVBQUUsUUFBUTtRQUN6QixrQkFBa0IsRUFBRSxlQUFlO1FBQ25DLFVBQVUsRUFBRSxRQUFRO0tBQ3JCLENBQUMsQ0FBQTtJQUNGLGNBQU8sQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksNEJBQWtCLENBQUMsRUFBQyxPQUFPLEVBQUUsSUFBSSxFQUFDLENBQUMsQ0FBQyxDQUFBO0lBQzVELE9BQU8sS0FBSyxDQUFDO0FBQ2pCLENBQUM7QUFDRCxJQUFJLENBQUMsNkJBQTZCLEVBQUUsR0FBRyxFQUFFO0lBQ3ZDLElBQUEsZUFBUyxFQUFDLGNBQWMsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLElBQUEseUJBQWdCLEVBQUMs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SUFBQSx5QkFBZ0IsRUFBQyxnQkFBZ0IsRUFBRTtRQUMxRSwwQkFBMEIsRUFBRTtZQUMxQixXQUFXLEVBQUU7Z0JBQ1g7b0JBQ0UsUUFBUSxFQUFFLGdCQUFnQjtvQkFDMUIsUUFBUSxFQUFFLE9BQU87b0JBQ2pCLFdBQVcsRUFBRTt3QkFDWCxLQUFLLEVBQUU7NEJBQ0wsVUFBVSxFQUFFO2dDQUNWLEVBQUU7Z0NBQ0Y7b0NBQ0UsTUFBTTtvQ0FDTjt3Q0FDRSxLQUFLLEVBQUUsZ0JBQWdCO3FDQUN4QjtvQ0FDRCxRQUFRO29DQUNSO3dDQUNFLEtBQUssRUFBRSxnQkFBZ0I7cUNBQ3hCO29DQUNELHdDQUF3QztpQ0FDekM7NkJBQ0Y7eUJBQ0Y7cUJBQ0Y7aUJBQ0Y7YUFDRjtZQUNELFNBQVMsRUFBRSxZQUFZO1NBQ3hCO1FBQ0QsVUFBVSxFQUFFLDJCQUEyQjtLQUN4QyxFQUFFLHFCQUFZLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQztBQUM3QixDQUFDLENBQUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICogIENvcHlyaWdodCBBbWF6b24uY29tLCBJbmMuIG9yIGl0cyBhZmZpbGlhdGVzLiBBbGwgUmlnaHRzIFJlc2VydmVkLiAgICpcbiAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICpcbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wICh0aGUgXCJMaWNlbnNlXCIpLiBZb3UgbWF5ICAgKlxuICogIG5vdCB1c2UgdGhpcyBmaWxlIGV4Y2VwdCBpbiBjb21wbGlhbmNlIHdpdGggdGhlIExpY2Vuc2UuIEEgY29weSBvZiB0aGUgICAgKlxuICogIExpY2Vuc2UgaXMgbG9jYXRlZCBhdCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKlxuICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKlxuICogICAgICBodHRwOi8vd3d3LmFwYWNoZS5vcmcvbGljZW5zZXMvTElDRU5TRS0yLjAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKlxuICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKlxuICogIG9yIGluIHRoZSAnbGljZW5zZScgZmlsZSBhY2NvbXBhbnlpbmcgdGhpcyBmaWxlLiBUaGlzIGZpbGUgaXMgZGlzdHJpYnV0ZWQgKlxuICogIG9uIGFuICdBUyBJUycgQkFTSVMsIFdJVEhPVVQgV0FSUkFOVElFUyBPUiBDT05ESVRJT05TIE9GIEFOWSBLSU5ELCAgICAgICAgKlxuICogIGV4cHJlc3Mgb3IgaW1wbGllZC4gU2VlIHRoZSBMaWNlbnNlIGZvciB0aGUgc3BlY2lmaWMgbGFuZ3VhZ2UgZ292ZXJuaW5nICAgKlxuICogIHBlcm1pc3Npb25zIGFuZCBsaW1pdGF0aW9ucyB1bmRlciB0aGUgTGljZW5zZS4gICAgICAgICAgICAgICAgICAgICAgICAgICAgKlxuICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG5pbXBvcnQge2V4cGVjdCBhcyBleHBlY3RDREssIGhhdmVSZXNvdXJjZUxpa2UsIFJlc291cmNlUGFydCB9IGZyb20gJ0Bhd3MtY2RrL2Fzc2VydCc7XG5pbXBvcnQgeyBBcHAsIFN0YWNrIH0gZnJvbSAnQGF3cy1jZGsvY29yZSc7XG5pbXBvcnQge1xuICBQb2xpY3ksXG4gIFBvbGljeVN0YXRlbWVudCxcbiAgRWZmZWN0XG59IGZyb20gJ0Bhd3MtY2RrL2F3cy1pYW0nO1xuaW1wb3J0IHsgU3NtUGxheWJvb2ssIFRyaWdnZXIsIFNzbVJvbGUsIFNzbVJlbWVkaWF0aW9uUnVuYm9vayB9IGZyb20gJy4uL2xpYi9zc21wbGF5Ym9vayc7XG5pbXBvcnQgeyBNZW1iZXJSb2xlU3RhY2sgfSBmcm9tICcuLi9zb2x1dGlvbl9kZXBsb3kvbGliL3JlbWVkaWF0aW9uX3J1bmJvb2stc3RhY2snO1xuaW1wb3J0IHsgQXdzU29sdXRpb25zQ2hlY2tzIH0gZnJvbSAnY2RrLW5hZydcbmltcG9ydCB7IEFzcGVjdHMgfSBmcm9tICdAYXdzLWNkay9jb3JlJ1xuXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4vLyBTc21QbGF5Ym9vayAtIFBhcnNlIFJ1bmJvb2tcbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbmZ1bmN0aW9uIGdldFNzbVBsYXlib29rKCk6IFN0YWNrIHtcbiAgICBjb25zdCBhcHAgPSBuZXcgQXBwKCk7XG4gICAgY29uc3Qgc3RhY2sgPSBuZXcgU3RhY2soYXBwLCAnTXlUZXN0U3RhY2snLCB7XG4gICAgICBzdGFja05hbWU6ICd0ZXN0U3RhY2snXG4gICAgfSk7XG4gICAgbmV3IFNzbVBsYXlib29rKHN0YWNrLCAnUGxheWJvb2snLCB7XG4gICAgICBzZWN1cml0eVN0YW5kYXJkOiAnU0VDVEVTVCcsXG4gICAgICBzZWN1cml0eVN0YW5kYXJkVmVyc2lvbjogJzEuMi4zJyxcbiAgICAgIGNvbnRyb2xJZDogJ1RFU1QuMScsXG4gICAgICBzc21Eb2NQYXRoOiAndGVzdC90ZXN0X2RhdGEvJyxcbiAgICAgIHNzbURvY0ZpbGVOYW1lOiAndHN0ZXN0LXJkczEueWFtbCcsXG4gICAgICBzb2x1dGlvblZlcnNpb246ICd2MS4xLjEnLFxuICAgICAgc29sdXRpb25EaXN0QnVja2V0OiAnc29sdXRpb25zdGVzdCcsXG4gICAgICBzb2x1dGlvbklkOiAnU08wMTExJ1xuICAgIH0pXG4gICAgQXNwZWN0cy5vZihhcHApLmFkZChuZXcgQXdzU29sdXRpb25zQ2hlY2tzKHt2ZXJib3NlOiB0cnVlfSkpXG4gICAgcmV0dXJuIHN0YWNrO1xufVxudGVzdCgnVGVzdCBTc21QbGF5Ym9vayBHZW5lcmF0aW9uJywgKCkgPT4ge1xuICBleHBlY3RDREsoZ2V0U3NtUGxheWJvb2soKSkudG8oaGF2ZVJlc291cmNlTGlrZShcIkFXUzo6U1NNOjpEb2N1bWVudFwiLCB7XG4gICAgXCJDb250ZW50XCI6IHtcbiAgICAgIFwiZGVzY3JpcHRpb25cIjogXCIjIyMgRG9jdW1lbnQgTmFtZSAtIFNIQVJSLVNFQ1RFU1RfMS4yLjNfVEVTVC4xXFxuXCIsXG4gICAgICBcInNjaGVtYVZlcnNpb25cIjogXCIwLjNcIixcbiAgICAgIFwiYXNzdW1lUm9sZVwiOiBcInt7IEF1dG9tYXRpb25Bc3N1bWVSb2xlIH19XCIsXG4gICAgICBcIm91dHB1dHNcIjogW1xuICAgICAgICBcIlZlcmlmeVNHUnVsZXMuUmVzcG9uc2VcIlxuICAgICAgXSxcbiAgICAgIFwicGFyYW1ldGVyc1wiOiB7XG4gICAgICAgIFwiRmluZGluZ1wiOiB7XG4gICAgICAgICAgXCJ0eXBlXCI6IFwiU3RyaW5nTWFwXCIsXG4gICAgICAgICAgXCJkZXNjcmlwdGlvblwiOiBcIlRoZSBpbnB1dCBmcm9tIFN0ZXAgZnVuY3Rpb24gZm9yIFRFU1QxIGZpbmRpbmdcIlxuICAgICAgICB9LFxuICAgICAgICBcIkF1dG9tYXRpb25Bc3N1bWVSb2xlXCI6IHtcbiAgICAgICAgICBcInR5cGVcIjogXCJTdHJpbmdcIixcbiAgICAgICAgICBcImRlc2NyaXB0aW9uXCI6IFwiKE9wdGlvbmFsKSBUaGUgQVJOIG9mIHRoZSByb2xlIHRoYXQgYWxsb3dzIEF1dG9tYXRpb24gdG8gcGVyZm9ybSB0aGUgYWN0aW9ucyBvbiB5b3VyIGJlaGFsZi5cIixcbiAgICAgICAgICBcImRlZmF1bHRcIjogXCJcIlxuICAgICAgICB9XG4gICAgICB9XG4gICAgfSxcbiAgICBcIkRvY3VtZW50VHlwZVwiOiBcIkF1dG9tYXRpb25cIixcbiAgICBcIk5hbWVcIjogXCJTSEFSUi1TRUNURVNUXzEuMi4zX1RFU1QuMVwiXG4gIH0sIFJlc291cmNlUGFydC5Qcm9wZXJ0aWVzKSk7XG59KTtcblxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLVxuLy8gVHJpZ2dlclxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLVxuZnVuY3Rpb24gZ2V0VHJpZ2dlclN0YWNrKCk6IFN0YWNrIHtcbiAgICBjb25zdCBhcHAgPSBuZXcgQXBwKCk7XG4gICAgY29uc3Qgc3RhY2sgPSBuZXcgU3RhY2soYXBwLCAnTXlUZXN0U3RhY2snLCB7XG4gICAgICBzdGFja05hbWU6ICd0ZXN0U3RhY2snXG4gICAgfSk7XG4gICAgbmV3IFRyaWdnZXIoc3RhY2ssICdUcmlnZ2VyJywge1xuICAgICAgZGVzY3JpcHRpb246ICdUcmlnZ2VyIGRlc2NyaXB0aW9uJyxcbiAgICAgIHNlY3VyaXR5U3RhbmRhcmQ6ICdBRlNCUCcsXG4gICAgICBnZW5lcmF0b3JJZDogJ2F3cy1mb3VuZGF0aW9uYWwtc2VjdXJpdHktYmVzdC1wcmFjdGljZXMvdi8xLjAuMC9SRFMuMScsXG4gICAgICBjb250cm9sSWQ6ICdSRFMuMScsXG4gICAgICB0YXJnZXRBcm46ICdhcm46YXdzLXRlc3Q6c25zOnVzLWVhc3QtMToxMTExMTExMTExMTExMTExOmZvbydcbiAgICB9KVxuICAgIHJldHVybiBzdGFjaztcbn1cblxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4vLyBTc21SZW1lZGlhdGlvblJ1bmJvb2tcbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuZnVuY3Rpb24gZ2V0U3NtUmVtZWRpYXRpb25SdW5ib29rKCk6IFN0YWNrIHtcbiAgICBjb25zdCBhcHAgPSBuZXcgQXBwKCk7XG4gICAgY29uc3Qgc3RhY2sgPSBuZXcgU3RhY2soYXBwLCAnTXlUZXN0U3RhY2snLCB7XG4gICAgICBzdGFja05hbWU6ICd0ZXN0U3RhY2snXG4gICAgfSk7XG4gICAgY29uc3Qgcm9sZVN0YWNrID0gbmV3IE1lbWJlclJvbGVTdGFjayhhcHAsICdyb2xlcycsIHtcbiAgICAgIGRlc2NyaXB0aW9uOiAndGVzdDsnLFxuICAgICAgc29sdXRpb25JZDogJ1NPMDExMScsXG4gICAgICBzb2x1dGlvblZlcnNpb246ICd2MS4xLjEnLFxuICAgICAgc29sdXRpb25EaXN0QnVja2V0OiAnc2hhcnJidWtraXQnXG4gICAgfSlcbiAgICBuZXcgU3NtUmVtZWRpYXRpb25SdW5ib29rKHN0YWNrLCAnUGxheWJvb2snLCB7XG4gICAgICBzc21Eb2NOYW1lOiAnYmxhaGJsYWhibGFoJyxcbiAgICAgIHNzbURvY1BhdGg6ICd0ZXN0L3Rlc3RfZGF0YS8nLFxuICAgICAgc3NtRG9jRmlsZU5hbWU6ICd0c3Rlc3QtY2lzMjkueWFtbCcsXG4gICAgICBzb2x1dGlvblZlcnNpb246ICd2MS4xLjEnLFxuICAgICAgc29sdXRpb25EaXN0QnVja2V0OiAnc29sdXRpb25zdGVzdCcsXG4gICAgICBzb2x1dGlvbklkOiAnU08wMTExJ1xuICAgIH0pXG4gICAgcmV0dXJuIHN0YWNrO1xufVxudGVzdCgnVGVzdCBTaGFyZWQgUmVtZWRpYXRpb24gR2VuZXJhdGlvbicsICgpID0+IHtcbiAgZXhwZWN0Q0RLKGdldFNzbVJlbWVkaWF0aW9uUnVuYm9vaygpKS50byhoYXZlUmVzb3VyY2VMaWtlKFwiQVdTOjpTU006OkRvY3VtZW50XCIsIHtcbiAgICBcIkNvbnRlbnRcIjoge1xuICAgICAgXCJkZXNjcmlwdGlvblwiOiBcIiMjIyBEb2N1bWVudCBOYW1lIC0gU0hBUlItQ0lTXzEuMi4wXzIuOVxcblwiLFxuICAgICAgXCJzY2hlbWFWZXJzaW9uXCI6IFwiMC4zXCIsXG4gICAgICBcImFzc3VtZVJvbGVcIjogXCJ7eyBBdXRvbWF0aW9uQXNzdW1lUm9sZSB9fVwiLFxuICAgICAgXCJvdXRwdXRzXCI6IFtcbiAgICAgICAgXCJWZXJpZnlTR1J1bGVzLlJlc3BvbnNlXCJcbiAgICAgIF0sXG4gICAgICBcInBhcmFtZXRlcnNcIjoge1xuICAgICAgICBcIkZpbmRpbmdcIjoge1xuICAgICAgICAgIFwidHlwZVwiOiBcIlN0cmluZ01hcFwiLFxuICAgICAgICAgIFwiZGVzY3JpcHRpb25cIjogXCJUaGUgaW5wdXQgZnJvbSBTdGVwIGZ1bmN0aW9uIGZvciAyLjkgZmluZGluZ1wiXG4gICAgICAgIH0sXG4gICAgICAgIFwiQXV0b21hdGlvbkFzc3VtZVJvbGVcIjoge1xuICAgICAgICAgIFwidHlwZVwiOiBcIlN0cmluZ1wiLFxuICAgICAgICAgIFwiZGVzY3JpcHRpb25cIjogXCIoT3B0aW9uYWwpIFRoZSBBUk4gb2YgdGhlIHJvbGUgdGhhdCBhbGxvd3MgQXV0b21hdGlvbiB0byBwZXJmb3JtIHRoZSBhY3Rpb25zIG9uIHlvdXIgYmVoYWxmLlwiLFxuICAgICAgICAgIFwiZGVmYXVsdFwiOiBcIlwiXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9LFxuICAgIFwiRG9jdW1lbnRUeXBlXCI6IFwiQXV0b21hdGlvblwiLFxuICAgIFwiTmFtZVwiOiBcIlNIQVJSLWJsYWhibGFoYmxhaFwiXG4gIH0sIFJlc291cmNlUGFydC5Qcm9wZXJ0aWVzKSk7XG59KTtcblxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tXG4vLyBTc21Sb2xlXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS1cbmZ1bmN0aW9uIGdldFNzbVJlbWVkaWF0aW9uUm9sZUNpcygpOiBTdGFjayB7XG4gIGNvbnN0IGFwcCA9IG5ldyBBcHAoKTtcbiAgY29uc3Qgc3RhY2sgPSBuZXcgTWVtYmVyUm9sZVN0YWNrKGFwcCwgJ015VGVzdFN0YWNrJywge1xuICAgIGRlc2NyaXB0aW9uOiAndGVzdC1kZXNjcmlwdGlvbicsXG4gICAgc29sdXRpb25JZDogJ1NPMDExMScsXG4gICAgc29sdXRpb25WZXJzaW9uOiAndjEuMC4wJyxcbiAgICBzb2x1dGlvbkRpc3RCdWNrZXQ6ICd0ZXN0LWJ1Y2tldCdcbiAgfSk7XG4gIGxldCBpbmxpbmVQb2xpY3kgPSBuZXcgUG9saWN5KHN0YWNrLCAnUG9saWN5JylcbiAgbGV0IHJkc1Blcm1zID0gbmV3IFBvbGljeVN0YXRlbWVudCgpO1xuICByZHNQZXJtcy5hZGRBY3Rpb25zKFwicmRzOk1vZGlmeURCU25hcHNob3RBdHRyaWJ1dGVcIilcbiAgcmRzUGVybXMuZWZmZWN0ID0gRWZmZWN0LkFMTE9XXG4gIHJkc1Blcm1zLmFkZFJlc291cmNlcyhcIipcIik7XG4gIGlubGluZVBvbGljeS5hZGRTdGF0ZW1lbnRzKHJkc1Blcm1zKVxuICBuZXcgU3NtUm9sZShzdGFjaywgJ1JvbGUnLCB7XG4gICAgc29sdXRpb25JZDogXCJTTzAxMTFcIixcbiAgICBzc21Eb2NOYW1lOiBcImZvb2JhclwiLFxuICAgIHJlbWVkaWF0aW9uUG9saWN5OiBpbmxpbmVQb2xpY3ksXG4gICAgcmVtZWRpYXRpb25Sb2xlTmFtZTogXCJTSEFSUi1SZW1lZGlhdGlvblJvbGVOYW1lXCJcbiAgfSlcbiAgcmV0dXJuIHN0YWNrO1xufVxuXG50ZXN0KCdUZXN0IFNzbVJvbGUgR2VuZXJhdGlvbicsICgpID0+IHtcbmV4cGVjdENESyhnZXRTc21SZW1lZGlhdGlvblJvbGVDaXMoKSkudG8oaGF2ZVJlc291cmNlTGlrZShcIkFXUzo6SUFNOjpSb2xlXCIsIHtcbiAgXCJBc3N1bWVSb2xlUG9saWN5RG9jdW1lbnRcIjoge1xuICAgIFwiU3RhdGVtZW50XCI6IFtcbiAgICAgIHtcbiAgICAgICAgXCJBY3Rpb25cIjogXCJzdHM6QXNzdW1lUm9sZVwiLFxuICAgICAgICBcIkVmZmVjdFwiOiBcIkFsbG93XCIsXG4gICAgICAgIFwiUHJpbmNpcGFsXCI6IHtcbiAgICAgICAgICBcIkFXU1wiOiB7XG4gICAgICAgICAgICBcIkZuOjpKb2luXCI6IFtcbiAgICAgICAgICAgICAgXCJcIixcbiAgICAgICAgICAgICAgW1xuICAgICAgICAgICAgICAgIFwiYXJuOlwiLFxuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgIFwiUmVmXCI6IFwiQVdTOjpQYXJ0aXRpb25cIlxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgXCI6aWFtOjpcIixcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICBcIlJlZlwiOiBcIkFXUzo6QWNjb3VudElkXCJcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIFwiOnJvbGUvU08wMTExLVNIQVJSLU9yY2hlc3RyYXRvci1NZW1iZXJcIlxuICAgICAgICAgICAgICBdXG4gICAgICAgICAgICBdXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgXSxcbiAgICBcIlZlcnNpb25cIjogXCIyMDEyLTEwLTE3XCJcbiAgfSxcbiAgXCJSb2xlTmFtZVwiOiBcIlNIQVJSLVJlbWVkaWF0aW9uUm9sZU5hbWVcIlxufSwgUmVzb3VyY2VQYXJ0LlByb3BlcnRpZXMpKTtcbn0pO1xuIl19