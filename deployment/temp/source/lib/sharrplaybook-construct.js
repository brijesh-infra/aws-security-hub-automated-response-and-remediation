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
exports.PlaybookMemberStack = exports.PlaybookPrimaryStack = void 0;
//
// Primary Stack - launched by Service Catalog in the Security Hub Admin account
// Creates CWE rules and custom actions, orchestrator step function
// Orchestrator lambdas are common to all Playbooks and deployed in the main stack
//
const cdk = require("@aws-cdk/core");
const aws_ssm_1 = require("@aws-cdk/aws-ssm");
const ssmplaybook_1 = require("./ssmplaybook");
const admin_account_parm_construct_1 = require("./admin_account_parm-construct");
const runbook_factory_1 = require("../solution_deploy/lib/runbook_factory");
class PlaybookPrimaryStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        const stack = cdk.Stack.of(this);
        const RESOURCE_PREFIX = props.solutionId.replace(/^DEV-/, ''); // prefix on every resource name
        const orchestratorArn = aws_ssm_1.StringParameter.valueForStringParameter(this, `/Solutions/${RESOURCE_PREFIX}/OrchestratorArn`);
        // Register the playbook. These parameters enable the step function to route matching events
        new aws_ssm_1.StringParameter(this, 'StandardShortName', {
            description: 'Provides a short (1-12) character abbreviation for the standard.',
            parameterName: `/Solutions/${RESOURCE_PREFIX}/${props.securityStandardLongName}/shortname`,
            stringValue: props.securityStandard
        });
        new aws_ssm_1.StringParameter(this, 'StandardVersion', {
            description: 'This parameter controls whether the SHARR step function will process findings for this version of the standard.',
            parameterName: `/Solutions/${RESOURCE_PREFIX}/${props.securityStandardLongName}/${props.securityStandardVersion}/status`,
            stringValue: 'enabled'
        });
        new cdk.CfnMapping(this, 'SourceCode', {
            mapping: { "General": {
                    "S3Bucket": props.solutionDistBucket,
                    "KeyPrefix": props.solutionDistName + '/' + props.solutionVersion
                } }
        });
        const processRemediation = function (controlSpec) {
            if ((controlSpec.executes != undefined) &&
                (controlSpec.control != controlSpec.executes)) {
                // This control is remapped to another
                new aws_ssm_1.StringParameter(stack, `Remap ${props.securityStandard} ${controlSpec.control}`, {
                    description: `Remap the ${props.securityStandard} ${controlSpec.control} finding to ${props.securityStandard} ${controlSpec.executes} remediation`,
                    parameterName: `/Solutions/${RESOURCE_PREFIX}/${props.securityStandard}/${props.securityStandardVersion}/${controlSpec.control}/remap`,
                    stringValue: `${controlSpec.executes}`
                });
            }
            let generatorId = '';
            if (props.securityStandard === 'CIS' && props.securityStandardVersion === '1.2.0') {
                // CIS 1.2.0 uses an arn-like format: arn:aws:securityhub:::ruleset/cis-aws-foundations-benchmark/v/1.2.0/rule/1.3
                generatorId = `arn:${stack.partition}:securityhub:::ruleset/${props.securityStandardLongName}/v/${props.securityStandardVersion}/rule/${controlSpec.control}`;
            }
            else {
                generatorId = `${props.securityStandardLongName}/v/${props.securityStandardVersion}/${controlSpec.control}`;
            }
            new ssmplaybook_1.Trigger(stack, `${props.securityStandard} ${controlSpec.control}`, {
                securityStandard: props.securityStandard,
                controlId: controlSpec.control,
                generatorId: generatorId,
                targetArn: orchestratorArn
            });
        };
        props.remediations.forEach(processRemediation);
    }
}
exports.PlaybookPrimaryStack = PlaybookPrimaryStack;
class PlaybookMemberStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        const stack = cdk.Stack.of(this);
        let ssmdocs = '';
        if (props.ssmdocs == undefined) {
            ssmdocs = './ssmdocs';
        }
        else {
            ssmdocs = props.ssmdocs;
        }
        new admin_account_parm_construct_1.AdminAccountParm(this, 'AdminAccountParameter', {
            solutionId: props.solutionId
        });
        const processRemediation = function (controlSpec) {
            // Create the ssm automation document only if this is not a remapped control
            if (!(controlSpec.executes && controlSpec.control != controlSpec.executes)) {
                runbook_factory_1.RunbookFactory.createControlRunbook(stack, `${props.securityStandard} ${controlSpec.control}`, {
                    securityStandard: props.securityStandard,
                    securityStandardVersion: props.securityStandardVersion,
                    controlId: controlSpec.control,
                    ssmDocPath: ssmdocs,
                    ssmDocFileName: `${props.securityStandard}_${controlSpec.control}.yaml`,
                    solutionVersion: props.solutionVersion,
                    solutionDistBucket: props.solutionDistBucket,
                    solutionId: props.solutionId,
                    commonScripts: props.commonScripts
                });
            }
        };
        props.remediations.forEach(processRemediation);
    }
}
exports.PlaybookMemberStack = PlaybookMemberStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2hhcnJwbGF5Ym9vay1jb25zdHJ1Y3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJzaGFycnBsYXlib29rLWNvbnN0cnVjdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUNBOzs7Ozs7Ozs7Ozs7OytFQWErRTs7O0FBRS9FLEVBQUU7QUFDRixnRkFBZ0Y7QUFDaEYsbUVBQW1FO0FBQ25FLGtGQUFrRjtBQUNsRixFQUFFO0FBQ0YscUNBQXFDO0FBQ3JDLDhDQUFtRDtBQUNuRCwrQ0FBcUQ7QUFDckQsaUZBQWtFO0FBQ2xFLDRFQUF3RTtBQWtCeEUsTUFBYSxvQkFBcUIsU0FBUSxHQUFHLENBQUMsS0FBSztJQUVqRCxZQUFZLEtBQW9CLEVBQUUsRUFBVSxFQUFFLEtBQW9CO1FBQ2hFLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXhCLE1BQU0sS0FBSyxHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFBO1FBQ2hDLE1BQU0sZUFBZSxHQUFHLEtBQUssQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLGdDQUFnQztRQUM5RixNQUFNLGVBQWUsR0FBRyx5QkFBZSxDQUFDLHVCQUF1QixDQUFDLElBQUksRUFBRSxjQUFjLGVBQWUsa0JBQWtCLENBQUMsQ0FBQTtRQUV0SCw0RkFBNEY7UUFDNUYsSUFBSSx5QkFBZSxDQUFDLElBQUksRUFBRSxtQkFBbUIsRUFBRTtZQUMzQyxXQUFXLEVBQUUsa0VBQWtFO1lBQy9FLGFBQWEsRUFBRSxjQUFjLGVBQWUsSUFBSSxLQUFLLENBQUMsd0JBQXdCLFlBQVk7WUFDMUYsV0FBVyxFQUFFLEtBQUssQ0FBQyxnQkFBZ0I7U0FDdEMsQ0FBQyxDQUFDO1FBQ0gsSUFBSSx5QkFBZSxDQUFDLElBQUksRUFBRSxpQkFBaUIsRUFBRTtZQUN6QyxXQUFXLEVBQUUsaUhBQWlIO1lBQzlILGFB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QUVELElBQUksK0NBQWdCLENBQUMsSUFBSSxFQUFFLHVCQUF1QixFQUFFO1lBQ2xELFVBQVUsRUFBRSxLQUFLLENBQUMsVUFBVTtTQUM3QixDQUFDLENBQUM7UUFFSCxNQUFNLGtCQUFrQixHQUFHLFVBQVMsV0FBcUI7WUFDdkQsNEVBQTRFO1lBQzVFLElBQUksQ0FBQyxDQUFDLFdBQVcsQ0FBQyxRQUFRLElBQUksV0FBVyxDQUFDLE9BQU8sSUFBSSxXQUFXLENBQUMsUUFBUSxDQUFDLEVBQUU7Z0JBQzFFLGdDQUFjLENBQUMsb0JBQW9CLENBQUMsS0FBSyxFQUFFLEdBQUcsS0FBSyxDQUFDLGdCQUFnQixJQUFJLFdBQVcsQ0FBQyxPQUFPLEVBQUUsRUFBRTtvQkFDN0YsZ0JBQWdCLEVBQUUsS0FBSyxDQUFDLGdCQUFnQjtvQkFDeEMsdUJBQXVCLEVBQUUsS0FBSyxDQUFDLHVCQUF1QjtvQkFDdEQsU0FBUyxFQUFFLFdBQVcsQ0FBQyxPQUFPO29CQUM5QixVQUFVLEVBQUUsT0FBTztvQkFDbkIsY0FBYyxFQUFFLEdBQUcsS0FBSyxDQUFDLGdCQUFnQixJQUFJLFdBQVcsQ0FBQyxPQUFPLE9BQU87b0JBQ3ZFLGVBQWUsRUFBRSxLQUFLLENBQUMsZUFBZTtvQkFDdEMsa0JBQWtCLEVBQUUsS0FBSyxDQUFDLGtCQUFrQjtvQkFDNUMsVUFBVSxFQUFFLEtBQUssQ0FBQyxVQUFVO29CQUM1QixhQUFhLEVBQUUsS0FBSyxDQUFDLGFBQWE7aUJBQ25DLENBQUMsQ0FBQzthQUNKO1FBQ0gsQ0FBQyxDQUFDO1FBRUYsS0FBSyxDQUFDLFlBQVksQ0FBQyxPQUFPLENBQUMsa0JBQWtCLENBQUMsQ0FBQztJQUNqRCxDQUFDO0NBQ0Y7QUFuQ0Qsa0RBbUNDIiwic291cmNlc0NvbnRlbnQiOlsiIyEvdXNyL2Jpbi9lbnYgbm9kZVxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gKiAgQ29weXJpZ2h0IEFtYXpvbi5jb20sIEluYy4gb3IgaXRzIGFmZmlsaWF0ZXMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuICAgKlxuICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUgTGljZW5zZSwgVmVyc2lvbiAyLjAgKHRoZSBcIkxpY2Vuc2VcIikuIFlvdSBtYXkgICAqXG4gKiAgbm90IHVzZSB0aGlzIGZpbGUgZXhjZXB0IGluIGNvbXBsaWFuY2Ugd2l0aCB0aGUgTGljZW5zZS4gQSBjb3B5IG9mIHRoZSAgICAqXG4gKiAgTGljZW5zZSBpcyBsb2NhdGVkIGF0ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAqXG4gKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAqXG4gKiAgICAgIGh0dHA6Ly93d3cuYXBhY2hlLm9yZy9saWNlbnNlcy9MSUNFTlNFLTIuMCAgICAgICAgICAgICAgICAgICAgICAgICAgICAqXG4gKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAqXG4gKiAgb3IgaW4gdGhlICdsaWNlbnNlJyBmaWxlIGFjY29tcGFueWluZyB0aGlzIGZpbGUuIFRoaXMgZmlsZSBpcyBkaXN0cmlidXRlZCAqXG4gKiAgb24gYW4gJ0FTIElTJyBCQVNJUywgV0lUSE9VVCBXQVJSQU5USUVTIE9SIENPTkRJVElPTlMgT0YgQU5ZIEtJTkQsICAgICAgICAqXG4gKiAgZXhwcmVzcyBvciBpbXBsaWVkLiBTZWUgdGhlIExpY2Vuc2UgZm9yIHRoZSBzcGVjaWZpYyBsYW5ndWFnZSBnb3Zlcm5pbmcgICAqXG4gKiAgcGVybWlzc2lvbnMgYW5kIGxpbWl0YXRpb25zIHVuZGVyIHRoZSBMaWNlbnNlLiAgICAgICAgICAgICAgICAgICAgICAgICAgICAqXG4gKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbi8vXG4vLyBQcmltYXJ5IFN0YWNrIC0gbGF1bmNoZWQgYnkgU2VydmljZSBDYXRhbG9nIGluIHRoZSBTZWN1cml0eSBIdWIgQWRtaW4gYWNjb3VudFxuLy8gQ3JlYXRlcyBDV0UgcnVsZXMgYW5kIGN1c3RvbSBhY3Rpb25zLCBvcmNoZXN0cmF0b3Igc3RlcCBmdW5jdGlvblxuLy8gT3JjaGVzdHJhdG9yIGxhbWJkYXMgYXJlIGNvbW1vbiB0byBhbGwgUGxheWJvb2tzIGFuZCBkZXBsb3llZCBpbiB0aGUgbWFpbiBzdGFja1xuLy9cbmltcG9ydCAqIGFzIGNkayBmcm9tICdAYXdzLWNkay9jb3JlJztcbmltcG9ydCB7IFN0cmluZ1BhcmFtZXRlciB9IGZyb20gJ0Bhd3MtY2RrL2F3cy1zc20nO1xuaW1wb3J0IHsgVHJpZ2dlciwgU3NtUGxheWJvb2sgfSBmcm9tICcuL3NzbXBsYXlib29rJztcbmltcG9ydCB7IEFkbWluQWNjb3VudFBhcm0gfSBmcm9tICcuL2FkbWluX2FjY291bnRfcGFybS1jb25zdHJ1Y3QnO1xuaW1wb3J0IHsgUnVuYm9va0ZhY3RvcnkgfSBmcm9tICcuLi9zb2x1dGlvbl9kZXBsb3kvbGliL3J1bmJvb2tfZmFjdG9yeSc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUNvbnRyb2wge1xuICAgIGNvbnRyb2w6IHN0cmluZztcbiAgICBleGVjdXRlcz86IHN0cmluZztcbn1cbmV4cG9ydCBpbnRlcmZhY2UgUGxheWJvb2tQcm9wcyB7XG4gICAgZGVzY3JpcHRpb246IHN0cmluZztcbiAgICBzb2x1dGlvbklkOiBzdHJpbmc7XG4gICAgc29sdXRpb25WZXJzaW9uOiBzdHJpbmc7XG4gICAgc29sdXRpb25EaXN0QnVja2V0OiBzdHJpbmc7XG4gICAgc29sdXRpb25EaXN0TmFtZTogc3RyaW5nO1xuICAgIHJlbWVkaWF0aW9uczogSUNvbnRyb2xbXTtcbiAgICBzZWN1cml0eVN0YW5kYXJkOiBzdHJpbmc7XG4gICAgc2VjdXJpdHlTdGFuZGFyZExvbmdOYW1lOiBzdHJpbmc7XG4gICAgc2VjdXJpdHlTdGFuZGFyZFZlcnNpb246IHN0cmluZztcbn1cblxuZXhwb3J0IGNsYXNzIFBsYXlib29rUHJpbWFyeVN0YWNrIGV4dGVuZHMgY2RrLlN0YWNrIHtcblxuICBjb25zdHJ1Y3RvcihzY29wZTogY2RrLkNvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IFBsYXlib29rUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcblxuICAgIGNvbnN0IHN0YWNrID0gY2RrLlN0YWNrLm9mKHRoaXMpXG4gICAgY29uc3QgUkVTT1VSQ0VfUFJFRklYID0gcHJvcHMuc29sdXRpb25JZC5yZXBsYWNlKC9eREVWLS8sJycpOyAvLyBwcmVmaXggb24gZXZlcnkgcmVzb3VyY2UgbmFtZVxuICAgIGNvbnN0IG9yY2hlc3RyYXRvckFybiA9IFN0cmluZ1BhcmFtZXRlci52YWx1ZUZvclN0cmluZ1BhcmFtZXRlcih0aGlzLCBgL1NvbHV0aW9ucy8ke1JFU09VUkNFX1BSRUZJWH0vT3JjaGVzdHJhdG9yQXJuYClcblxuICAgIC8vIFJlZ2lzdGVyIHRoZSBwbGF5Ym9vay4gVGhlc2UgcGFyYW1ldGVycyBlbmFibGUgdGhlIHN0ZXAgZnVuY3Rpb24gdG8gcm91dGUgbWF0Y2hpbmcgZXZlbnRzXG4gICAgbmV3IFN0cmluZ1BhcmFtZXRlcih0aGlzLCAnU3RhbmRhcmRTaG9ydE5hbWUnLCB7XG4gICAgICAgIGRlc2NyaXB0aW9uOiAnUHJvdmlkZXMgYSBzaG9ydCAoMS0xMikgY2hhcmFjdGVyIGFiYnJldmlhdGlvbiBmb3IgdGhlIHN0YW5kYXJkLicsXG4gICAgICAgIHBhcmFtZXRlck5hbWU6IGAvU29sdXRpb25zLyR7UkVTT1VSQ0VfUFJFRklYfS8ke3Byb3BzLnNlY3VyaXR5U3RhbmRhcmRMb25nTmFtZX0vc2hvcnRuYW1lYCxcbiAgICAgICAgc3RyaW5nVmFsdWU6IHByb3BzLnNlY3VyaXR5U3RhbmRhcmRcbiAgICB9KTtcbiAgICBuZXcgU3RyaW5nUGFyYW1ldGVyKHRoaXMsICdTdGFuZGFyZFZlcnNpb24nLCB7XG4gICAgICAgIGRlc2NyaXB0aW9uOiAnVGhpcyBwYXJhbWV0ZXIgY29udHJvbHMgd2hldGhlciB0aGUgU0hBUlIgc3RlcCBmdW5jdGlvbiB3aWxsIHByb2Nlc3MgZmluZGluZ3MgZm9yIHRoaXMgdmVyc2lvbiBvZiB0aGUgc3RhbmRhcmQuJyxcbiAgICAgICAgcGFyYW1ldGVyTmFtZTogYC9Tb2x1dGlvbnMvJHtSRVNPVVJDRV9QUkVGSVh9LyR7cHJvcHMuc2VjdXJpdHlTdGFuZGFyZExvbmdOYW1lfS8ke3Byb3BzLnNlY3VyaXR5U3RhbmRhcmRWZXJzaW9ufS9zdGF0dXNgLFxuICAgICAgICBzdHJpbmdWYWx1ZTogJ2VuYWJsZWQnXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk1hcHBpbmcodGhpcywgJ1NvdXJjZUNvZGUnLCB7XG4gICAgICAgIG1hcHBpbmc6IHsgXCJHZW5lcmFsXCI6IHtcbiAgICAgICAgICAgIFwiUzNCdWNrZXRcIjogcHJvcHMuc29sdXRpb25EaXN0QnVja2V0LFxuICAgICAgICAgICAgXCJLZXlQcmVmaXhcIjogcHJvcHMuc29sdXRpb25EaXN0TmFtZSArICcvJyArIHByb3BzLnNvbHV0aW9uVmVyc2lvblxuICAgICAgICB9IH1cbiAgICB9KVxuXG4gICAgY29uc3QgcHJvY2Vzc1JlbWVkaWF0aW9uID0gZnVuY3Rpb24oY29udHJvbFNwZWM6IElDb250cm9sKTogdm9pZCB7XG4gICAgICAgIGlmICgoY29udHJvbFNwZWMuZXhlY3V0ZXMgIT0gdW5kZWZpbmVkKSAmJlxuICAgICAgICAgICAgKGNvbnRyb2xTcGVjLmNvbnRyb2wgIT0gY29udHJvbFNwZWMuZXhlY3V0ZXMpKSB7XG4gICAgICAgICAgICAvLyBUaGlzIGNvbnRyb2wgaXMgcmVtYXBwZWQgdG8gYW5vdGhlclxuICAgICAgICAgICAgbmV3IFN0cmluZ1BhcmFtZXRlcihzdGFjaywgYFJlbWFwICR7cHJvcHMuc2VjdXJpdHlTdGFuZGFyZH0gJHtjb250cm9sU3BlYy5jb250cm9sfWAsIHtcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogYFJlbWFwIHRoZSAke3Byb3BzLnNlY3VyaXR5U3RhbmRhcmR9ICR7Y29udHJvbFNwZWMuY29udHJvbH0gZmluZGluZyB0byAke3Byb3BzLnNlY3VyaXR5U3RhbmRhcmR9ICR7Y29udHJvbFNwZWMuZXhlY3V0ZXN9IHJlbWVkaWF0aW9uYCxcbiAgICAgICAgICAgICAgICBwYXJhbWV0ZXJOYW1lOiBgL1NvbHV0aW9ucy8ke1JFU09VUkNFX1BSRUZJWH0vJHtwcm9wcy5zZWN1cml0eVN0YW5kYXJkfS8ke3Byb3BzLnNlY3VyaXR5U3RhbmRhcmRWZXJzaW9ufS8ke2NvbnRyb2xTcGVjLmNvbnRyb2x9L3JlbWFwYCxcbiAgICAgICAgICAgICAgICBzdHJpbmdWYWx1ZTogYCR7Y29udHJvbFNwZWMuZXhlY3V0ZXN9YFxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgbGV0IGdlbmVyYXRvcklkID0gJydcbiAgICAgICAgaWYgKHByb3BzLnNlY3VyaXR5U3RhbmRhcmQgPT09ICdDSVMnICYmIHByb3BzLnNlY3VyaXR5U3RhbmRhcmRWZXJzaW9uID09PSAnMS4yLjAnKSB7XG4gICAgICAgICAgICAvLyBDSVMgMS4yLjAgdXNlcyBhbiBhcm4tbGlrZSBmb3JtYXQ6IGFybjphd3M6c2VjdXJpdHlodWI6OjpydWxlc2V0L2Npcy1hd3MtZm91bmRhdGlvbnMtYmVuY2htYXJrL3YvMS4yLjAvcnVsZS8xLjNcbiAgICAgICAgICAgIGdlbmVyYXRvcklkID0gYGFybjoke3N0YWNrLnBhcnRpdGlvbn06c2VjdXJpdHlodWI6OjpydWxlc2V0LyR7cHJvcHMuc2VjdXJpdHlTdGFuZGFyZExvbmdOYW1lfS92LyR7cHJvcHMuc2VjdXJpdHlTdGFuZGFyZFZlcnNpb259L3J1bGUvJHtjb250cm9sU3BlYy5jb250cm9sfWBcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGdlbmVyYXRvcklkID0gYCR7cHJvcHMuc2VjdXJpdHlTdGFuZGFyZExvbmdOYW1lfS92LyR7cHJvcHMuc2VjdXJpdHlTdGFuZGFyZFZlcnNpb259LyR7Y29udHJvbFNwZWMuY29udHJvbH1gXG4gICAgICAgIH1cbiAgICAgICAgbmV3IFRyaWdnZXIoc3RhY2ssIGAke3Byb3BzLnNlY3VyaXR5U3RhbmRhcmR9ICR7Y29udHJvbFNwZWMuY29udHJvbH1gLCB7XG4gICAgICAgICAgICBzZWN1cml0eVN0YW5kYXJkOiBwcm9wcy5zZWN1cml0eVN0YW5kYXJkLFxuICAgICAgICAgICAgY29udHJvbElkOiBjb250cm9sU3BlYy5jb250cm9sLFxuICAgICAgICAgICAgZ2VuZXJhdG9ySWQ6IGdlbmVyYXRvcklkLFxuICAgICAgICAgICAgdGFyZ2V0QXJuOiBvcmNoZXN0cmF0b3JBcm5cbiAgICAgICAgfSlcbiAgICB9XG5cbiAgICBwcm9wcy5yZW1lZGlhdGlvbnMuZm9yRWFjaChwcm9jZXNzUmVtZWRpYXRpb24pXG5cbiAgfVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIE1lbWJlclN0YWNrUHJvcHMge1xuICBkZXNjcmlwdGlvbjogc3RyaW5nO1xuICBzb2x1dGlvbklkOiBzdHJpbmc7XG4gIHNvbHV0aW9uVmVyc2lvbjogc3RyaW5nO1xuICBzb2x1dGlvbkRpc3RCdWNrZXQ6IHN0cmluZztcbiAgc2VjdXJpdHlTdGFuZGFyZDogc3RyaW5nO1xuICBzZWN1cml0eVN0YW5kYXJkVmVyc2lvbjogc3RyaW5nO1xuICBzZWN1cml0eVN0YW5kYXJkTG9uZ05hbWU6IHN0cmluZztcbiAgc3NtZG9jcz86IHN0cmluZztcbiAgY29tbW9uU2NyaXB0cz86IHN0cmluZztcbiAgcmVtZWRpYXRpb25zOiBJQ29udHJvbFtdO1xufVxuXG5leHBvcnQgY2xhc3MgUGxheWJvb2tNZW1iZXJTdGFjayBleHRlbmRzIGNkay5TdGFjayB7XG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBjZGsuQXBwLCBpZDogc3RyaW5nLCBwcm9wczogTWVtYmVyU3RhY2tQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xuICAgIGNvbnN0IHN0YWNrID0gY2RrLlN0YWNrLm9mKHRoaXMpO1xuXG4gICAgbGV0IHNzbWRvY3MgPSAnJztcbiAgICBpZiAocHJvcHMuc3NtZG9jcyA9PSB1bmRlZmluZWQpIHtcbiAgICAgIHNzbWRvY3MgPSAnLi9zc21kb2NzJztcbiAgICB9IGVsc2Uge1xuICAgICAgc3NtZG9jcyA9IHByb3BzLnNzbWRvY3M7XG4gICAgfVxuXG4gICAgbmV3IEFkbWluQWNjb3VudFBhcm0odGhpcywgJ0FkbWluQWNjb3VudFBhcmFtZXRlcicsIHtcbiAgICAgIHNvbHV0aW9uSWQ6IHByb3BzLnNvbHV0aW9uSWRcbiAgICB9KTtcblxuICAgIGNvbnN0IHByb2Nlc3NSZW1lZGlhdGlvbiA9IGZ1bmN0aW9uKGNvbnRyb2xTcGVjOiBJQ29udHJvbCk6IHZvaWQge1xuICAgICAgLy8gQ3JlYXRlIHRoZSBzc20gYXV0b21hdGlvbiBkb2N1bWVudCBvbmx5IGlmIHRoaXMgaXMgbm90IGEgcmVtYXBwZWQgY29udHJvbFxuICAgICAgaWYgKCEoY29udHJvbFNwZWMuZXhlY3V0ZXMgJiYgY29udHJvbFNwZWMuY29udHJvbCAhPSBjb250cm9sU3BlYy5leGVjdXRlcykpIHtcbiAgICAgICAgUnVuYm9va0ZhY3RvcnkuY3JlYXRlQ29udHJvbFJ1bmJvb2soc3RhY2ssIGAke3Byb3BzLnNlY3VyaXR5U3RhbmRhcmR9ICR7Y29udHJvbFNwZWMuY29udHJvbH1gLCB7XG4gICAgICAgICAgc2VjdXJpdHlTdGFuZGFyZDogcHJvcHMuc2VjdXJpdHlTdGFuZGFyZCxcbiAgICAgICAgICBzZWN1cml0eVN0YW5kYXJkVmVyc2lvbjogcHJvcHMuc2VjdXJpdHlTdGFuZGFyZFZlcnNpb24sXG4gICAgICAgICAgY29udHJvbElkOiBjb250cm9sU3BlYy5jb250cm9sLFxuICAgICAgICAgIHNzbURvY1BhdGg6IHNzbWRvY3MsXG4gICAgICAgICAgc3NtRG9jRmlsZU5hbWU6IGAke3Byb3BzLnNlY3VyaXR5U3RhbmRhcmR9XyR7Y29udHJvbFNwZWMuY29udHJvbH0ueWFtbGAsXG4gICAgICAgICAgc29sdXRpb25WZXJzaW9uOiBwcm9wcy5zb2x1dGlvblZlcnNpb24sXG4gICAgICAgICAgc29sdXRpb25EaXN0QnVja2V0OiBwcm9wcy5zb2x1dGlvbkRpc3RCdWNrZXQsXG4gICAgICAgICAgc29sdXRpb25JZDogcHJvcHMuc29sdXRpb25JZCxcbiAgICAgICAgICBjb21tb25TY3JpcHRzOiBwcm9wcy5jb21tb25TY3JpcHRzXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH07XG5cbiAgICBwcm9wcy5yZW1lZGlhdGlvbnMuZm9yRWFjaChwcm9jZXNzUmVtZWRpYXRpb24pO1xuICB9XG59XG4iXX0=