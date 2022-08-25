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
require("@aws-cdk/assert/jest");
const core_1 = require("@aws-cdk/core");
const common_orchestrator_construct_1 = require("../Orchestrator/lib/common-orchestrator-construct");
const kms = require("@aws-cdk/aws-kms");
const aws_ssm_1 = require("@aws-cdk/aws-ssm");
const aws_iam_1 = require("@aws-cdk/aws-iam");
const cdk_nag_1 = require("cdk-nag");
const core_2 = require("@aws-cdk/core");
test('test App Orchestrator Construct', () => {
    const app = new core_1.App();
    const stack = new core_1.Stack(app, 'testStack', {
        stackName: 'testStack'
    });
    const kmsKeyPolicy = new aws_iam_1.PolicyDocument();
    const kmsServicePolicy = new aws_iam_1.PolicyStatement({
        principals: [
            new aws_iam_1.ServicePrincipal('sns.amazonaws.com'),
            new aws_iam_1.ServicePrincipal(`logs.${stack.urlSuffix}`)
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
        ]
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
    const kmsKey = new kms.Key(stack, 'SHARR-key', {
        enableKeyRotation: true,
        alias: 'TO0111-SHARR-Key',
        policy: kmsKeyPolicy
    });
    const kmsKeyParm = new aws_ssm_1.StringParameter(stack, 'SHARR_Key', {
        description: 'KMS Customer Managed Key that SHARR will use to encrypt data',
        parameterName: `/Solutions/SO0111/CMK_ARN`,
        stringValue: kmsKey.keyArn
    });
    new common_orchestrator_construct_1.OrchestratorConstruct(stack, 'Orchestrator', {
        roleArn: 'arn:aws-test:iam::111122223333:role/TestRole',
        ssmDocStateLambda: 'arn:aws:lambda:us-east-1:111122223333:function/foobar',
        ssmExecDocLambda: 'arn:aws:lambda:us-east-1:111122223333:function/foobar',
        ssmExecMonitorLambda: 'arn:aws:lambda:us-east-1:111122223333:function/foobar',
        notifyLambda: 'arn:aws:lambda:us-east-1:111122223333:function/foobar',
        getApprovalRequirementLambda: 'arn:aws:lambda:us-east-1:111122223333:function/foobar',
        solutionId: 'bbb',
        solutionName: 'This is a test',
        solutionVersion: '1.1.1',
        orchLogGroup: 'ORCH_LOG_GROUP',
        kmsKeyParm: kmsKeyParm
    });
    core_2.Aspects.of(app).add(new cdk_nag_1.AwsSolutionsChecks({ verbose: true }));
    expect(assert_1.SynthUtils.toCloudFormation(stack)).toMatchSnapshot();
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3JjaGVzdHJhdG9yLnRlc3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJvcmNoZXN0cmF0b3IudGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7Ozs7Ozs7Ozs7K0VBYStFOztBQUUvRSw0Q0FBNkM7QUFDN0MsZ0NBQThCO0FBQzlCLHdDQUEyQztBQUMzQyxxR0FBMEY7QUFDMUYsd0NBQXdDO0FBQ3hDLDhDQUFtRDtBQUNuRCw4Q0FLMEI7QUFDMUIscUNBQTRDO0FBQzVDLHdDQUF1QztBQUV2QyxJQUFJLENBQUMsaUNBQWlDLEVBQUUsR0FBRyxFQUFFO0lBRXpDLE1BQU0sR0FBRyxHQUFHLElBQUksVUFBRyxFQUFFLENBQUM7SUFDdEIsTUFBTSxLQUFLLEdBQUcsSUFBSSxZQUFLLENBQUMsR0FBRyxFQUFFLFdBQVcsRUFBRTtRQUN0QyxTQUFTLEVBQUUsV0FBVztLQUN6QixDQUFDLENBQUM7SUFFSCxNQUFNLFlBQVksR0FBa0IsSUFBSSx3QkFBYyxFQUFFLENBQUE7SUFFeEQsTUFBTSxnQkFBZ0IsR0FBRyxJQUFJLHlCQUFlLENBQUM7UUFDekMsVUFBVSxFQUFFO1lBQ1IsSUFBSSwwQkFBZ0IsQ0FBQyxtQkFBbUIsQ0FBQztZQUN6QyxJQUFJLDBCQUFnQixDQUFDLFFBQVEsS0FBSyxDQUFDLFNBQVMsRUFBRSxDQUFDO1NBQ2xEO1FBQ0QsT0FBTyxFQUFFO1lBQ0wsY0FBYztZQUNkLGNBQWM7WUFDZCxnQkFBZ0I7WUFDaEIsc0JBQXNCO1lBQ3RCLGVBQWU7U0FDbEI7UUFDRCxTQUFTLEVBQUU7WUFDUCxHQUFHO1NBQ047S0FDSixDQUFDLENBQUE7SUFDRixZQUFZLENBQUMsYUFBYSxDQUFDLGdCQUFnQixDQUFDLENBQUE7SUFFNUMsTUFBTSxhQUFhLEdBQUcsSUFBSSx5QkFBZSxDQUFDO1FBQ3RDLFVBQVUsRUFBRTtZQUNSLElBQUksOEJBQW9CLEVBQUU7U0FDN0I7UUFDRCxPQUFPLEVBQUU7WUFDTCxPQUFPO1NBQ1Y7UUFDRCxTQUFTLEVBQUU7WUFDUCxHQUFHO1NBQ047S0FDSixDQUFDLENBQUE7SUFDRixZQUFZLENBQUMsYUFBYSxDQUFDLGFBQWEsQ0FBQyxDQUFBO0lBRXpDLE1BQU0sTUFBTSxHQUFHLElBQUksR0FBRyxDQUFDLEdBQUcsQ0FBQyxLQUFLLEVBQUUsV0FBVyxFQUFFO1FBQzNDLGlCQUFpQixFQUFFLElBQUk7UUFDdkIsS0FBSyxFQUFFLGtCQUFrQjtRQUN6QixNQUFNLEVBQUUsWUFBWTtLQUN2QixDQUFDLENBQUM7SUFFSCxNQUFNLFVBQVUsR0FBRyxJQUFJLHlCQUFlLENBQUMsS0FBSyxFQUFFLFdBQVcsRUFBRTtRQUN2RCxXQUFXLEVBQUUsOERBQThEO1FBQzNFLGFBQWEsRUFBRSwyQkFBMkI7UUFDMUMsV0FBVyxFQUFFLE1BQU0sQ0FBQyxNQUFNO0tBQzdCLENBQUMsQ0FBQztJQUVILElBQUkscURBQXFCLENBQUMsS0FBSyxFQUFFLGNBQWMsRUFBRTtRQUNoRCxPQUFPLEVBQUUsOENBQThDO1FBQ3ZELGlCQUFpQixFQUFFLHVEQUF1RDtRQUMxRSxnQkFBZ0IsRUFBRSx1REFBdUQ7UUFDekUsb0JBQW9CLEVBQUUsdURBQXVEO1FBQzdFLFlBQVksRUFBRSx1REFBdUQ7UUFDbEUsNEJBQTRCLEVBQUUsdURBQXVEO1FBQ3JGLFVBQVUsRUFBRSxLQUFLO1FBQ2pCLFlBQVksRUFBRSxnQkFBZ0I7UUFDOUIsZUFBZSxFQUFFLE9BQU87UUFDeEIsWUFBWSxFQUFFLGdCQUFnQjtRQUM5QixVQUFVLEVBQUUsVUFBVTtLQUN6QixDQUFDLENBQUM7SUFDSCxjQUFPLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLDRCQUFrQixDQUFDLEVBQUMsT0FBTyxFQUFFLElBQUksRUFBQyxDQUFDLENBQUMsQ0FBQTtJQUM1RCxNQUFNLENBQUMsbUJBQVUsQ0FBQyxnQkFBZ0IsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLGVBQWUsRUFBRSxDQUFDO0FBQ2pFLENBQUMsQ0FBQyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gKiAgQ29weXJpZ2h0IEFtYXpvbi5jb20sIEluYy4gb3IgaXRzIGFmZmlsaWF0ZXMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuICAgKlxuICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUgTGljZW5zZSwgVmVyc2lvbiAyLjAgKHRoZSBcIkxpY2Vuc2VcIikuIFlvdSBtYXkgICAqXG4gKiAgbm90IHVzZSB0aGlzIGZpbGUgZXhjZXB0IGluIGNvbXBsaWFuY2Ugd2l0aCB0aGUgTGljZW5zZS4gQSBjb3B5IG9mIHRoZSAgICAqXG4gKiAgTGljZW5zZSBpcyBsb2NhdGVkIGF0ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAqXG4gKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAqXG4gKiAgICAgIGh0dHA6Ly93d3cuYXBhY2hlLm9yZy9saWNlbnNlcy9MSUNFTlNFLTIuMCAgICAgICAgICAgICAgICAgICAgICAgICAgICAqXG4gKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAqXG4gKiAgb3IgaW4gdGhlICdsaWNlbnNlJyBmaWxlIGFjY29tcGFueWluZyB0aGlzIGZpbGUuIFRoaXMgZmlsZSBpcyBkaXN0cmlidXRlZCAqXG4gKiAgb24gYW4gJ0FTIElTJyBCQVNJUywgV0lUSE9VVCBXQVJSQU5USUVTIE9SIENPTkRJVElPTlMgT0YgQU5ZIEtJTkQsICAgICAgICAqXG4gKiAgZXhwcmVzcyBvciBpbXBsaWVkLiBTZWUgdGhlIExpY2Vuc2UgZm9yIHRoZSBzcGVjaWZpYyBsYW5ndWFnZSBnb3Zlcm5pbmcgICAqXG4gKiAgcGVybWlzc2lvbnMgYW5kIGxpbWl0YXRpb25zIHVuZGVyIHRoZSBMaWNlbnNlLiAgICAgICAgICAgICAgICAgICAgICAgICAgICAqXG4gKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbmltcG9ydCB7IFN5bnRoVXRpbHMgfSBmcm9tICdAYXdzLWNkay9hc3NlcnQnO1xuaW1wb3J0ICdAYXdzLWNkay9hc3NlcnQvamVzdCc7XG5pbXBvcnQgeyBBcHAsIFN0YWNrIH0gZnJvbSAnQGF3cy1jZGsvY29yZSc7XG5pbXBvcnQgeyBPcmNoZXN0cmF0b3JDb25zdHJ1Y3QgfSBmcm9tICcuLi9PcmNoZXN0cmF0b3IvbGliL2NvbW1vbi1vcmNoZXN0cmF0b3ItY29uc3RydWN0JztcbmltcG9ydCAqIGFzIGttcyBmcm9tICdAYXdzLWNkay9hd3Mta21zJztcbmltcG9ydCB7IFN0cmluZ1BhcmFtZXRlciB9IGZyb20gJ0Bhd3MtY2RrL2F3cy1zc20nO1xuaW1wb3J0IHsgXG4gICAgUG9saWN5U3RhdGVtZW50LCBcbiAgICBQb2xpY3lEb2N1bWVudCwgXG4gICAgU2VydmljZVByaW5jaXBhbCxcbiAgICBBY2NvdW50Um9vdFByaW5jaXBhbCxcbn0gZnJvbSAnQGF3cy1jZGsvYXdzLWlhbSc7XG5pbXBvcnQgeyBBd3NTb2x1dGlvbnNDaGVja3MgfSBmcm9tICdjZGstbmFnJ1xuaW1wb3J0IHsgQXNwZWN0cyB9IGZyb20gJ0Bhd3MtY2RrL2NvcmUnXG5cbnRlc3QoJ3Rlc3QgQXBwIE9yY2hlc3RyYXRvciBDb25zdHJ1Y3QnLCAoKSA9PiB7XG5cbiAgICBjb25zdCBhcHAgPSBuZXcgQXBwKCk7XG4gICAgY29uc3Qgc3RhY2sgPSBuZXcgU3RhY2soYXBwLCAndGVzdFN0YWNrJywge1xuICAgICAgICBzdGFja05hbWU6ICd0ZXN0U3RhY2snXG4gICAgfSk7XG5cbiAgICBjb25zdCBrbXNLZXlQb2xpY3k6UG9saWN5RG9jdW1lbnQgPSBuZXcgUG9saWN5RG9jdW1lbnQoKVxuICAgIFxuICAgIGNvbnN0IGttc1NlcnZpY2VQb2xpY3kgPSBuZXcgUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgcHJpbmNpcGFsczogW1xuICAgICAgICAgICAgbmV3IFNlcnZpY2VQcmluY2lwYWwoJ3Nucy5hbWF6b25hd3MuY29tJyksXG4gICAgICAgICAgICBuZXcgU2VydmljZVByaW5jaXBhbChgbG9ncy4ke3N0YWNrLnVybFN1ZmZpeH1gKVxuICAgICAgICBdLFxuICAgICAgICBhY3Rpb25zOiBbXG4gICAgICAgICAgICBcImttczpFbmNyeXB0KlwiLFxuICAgICAgICAgICAgXCJrbXM6RGVjcnlwdCpcIixcbiAgICAgICAgICAgIFwia21zOlJlRW5jcnlwdCpcIixcbiAgICAgICAgICAgIFwia21zOkdlbmVyYXRlRGF0YUtleSpcIixcbiAgICAgICAgICAgIFwia21zOkRlc2NyaWJlKlwiXG4gICAgICAgIF0sXG4gICAgICAgIHJlc291cmNlczogW1xuICAgICAgICAgICAgJyonXG4gICAgICAgIF1cbiAgICB9KVxuICAgIGttc0tleVBvbGljeS5hZGRTdGF0ZW1lbnRzKGttc1NlcnZpY2VQb2xpY3kpXG5cbiAgICBjb25zdCBrbXNSb290UG9saWN5ID0gbmV3IFBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgIHByaW5jaXBhbHM6IFtcbiAgICAgICAgICAgIG5ldyBBY2NvdW50Um9vdFByaW5jaXBhbCgpXG4gICAgICAgIF0sXG4gICAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgICAgICdrbXM6KidcbiAgICAgICAgXSxcbiAgICAgICAgcmVzb3VyY2VzOiBbXG4gICAgICAgICAgICAnKidcbiAgICAgICAgXVxuICAgIH0pXG4gICAga21zS2V5UG9saWN5LmFkZFN0YXRlbWVudHMoa21zUm9vdFBvbGljeSlcblxuICAgIGNvbnN0IGttc0tleSA9IG5ldyBrbXMuS2V5KHN0YWNrLCAnU0hBUlIta2V5Jywge1xuICAgICAgICBlbmFibGVLZXlSb3RhdGlvbjogdHJ1ZSxcbiAgICAgICAgYWxpYXM6ICdUTzAxMTEtU0hBUlItS2V5JyxcbiAgICAgICAgcG9saWN5OiBrbXNLZXlQb2xpY3lcbiAgICB9KTtcblxuICAgIGNvbnN0IGttc0tleVBhcm0gPSBuZXcgU3RyaW5nUGFyYW1ldGVyKHN0YWNrLCAnU0hBUlJfS2V5Jywge1xuICAgICAgICBkZXNjcmlwdGlvbjogJ0tNUyBDdXN0b21lciBNYW5hZ2VkIEtleSB0aGF0IFNIQVJSIHdpbGwgdXNlIHRvIGVuY3J5cHQgZGF0YScsXG4gICAgICAgIHBhcmFtZXRlck5hbWU6IGAvU29sdXRpb25zL1NPMDExMS9DTUtfQVJOYCxcbiAgICAgICAgc3RyaW5nVmFsdWU6IGttc0tleS5rZXlBcm5cbiAgICB9KTtcblxuICAgIG5ldyBPcmNoZXN0cmF0b3JDb25zdHJ1Y3Qoc3RhY2ssICdPcmNoZXN0cmF0b3InLCB7XG5cdCAgICByb2xlQXJuOiAnYXJuOmF3cy10ZXN0OmlhbTo6MTExMTIyMjIzMzMzOnJvbGUvVGVzdFJvbGUnLFxuXHQgICAgc3NtRG9jU3RhdGVMYW1iZGE6ICdhcm46YXdzOmxhbWJkYTp1cy1lYXN0LTE6MTExMTIyMjIzMzMzOmZ1bmN0aW9uL2Zvb2JhcicsXG5cdCAgICBzc21FeGVjRG9jTGFtYmRhOiAnYXJuOmF3czpsYW1iZGE6dXMtZWFzdC0xOjExMTEyMjIyMzMzMzpmdW5jdGlvbi9mb29iYXInLFxuXHQgICAgc3NtRXhlY01vbml0b3JMYW1iZGE6ICdhcm46YXdzOmxhbWJkYTp1cy1lYXN0LTE6MTExMTIyMjIzMzMzOmZ1bmN0aW9uL2Zvb2JhcicsXG5cdCAgICBub3RpZnlMYW1iZGE6ICdhcm46YXdzOmxhbWJkYTp1cy1lYXN0LTE6MTExMTIyMjIzMzMzOmZ1bmN0aW9uL2Zvb2JhcicsXG4gICAgICAgIGdldEFwcHJvdmFsUmVxdWlyZW1lbnRMYW1iZGE6ICdhcm46YXdzOmxhbWJkYTp1cy1lYXN0LTE6MTExMTIyMjIzMzMzOmZ1bmN0aW9uL2Zvb2JhcicsXG4gICAgICAgIHNvbHV0aW9uSWQ6ICdiYmInLFxuICAgICAgICBzb2x1dGlvbk5hbWU6ICdUaGlzIGlzIGEgdGVzdCcsXG4gICAgICAgIHNvbHV0aW9uVmVyc2lvbjogJzEuMS4xJyxcbiAgICAgICAgb3JjaExvZ0dyb3VwOiAnT1JDSF9MT0dfR1JPVVAnLFxuICAgICAgICBrbXNLZXlQYXJtOiBrbXNLZXlQYXJtXG4gICAgfSk7XG4gICAgQXNwZWN0cy5vZihhcHApLmFkZChuZXcgQXdzU29sdXRpb25zQ2hlY2tzKHt2ZXJib3NlOiB0cnVlfSkpXG4gICAgZXhwZWN0KFN5bnRoVXRpbHMudG9DbG91ZEZvcm1hdGlvbihzdGFjaykpLnRvTWF0Y2hTbmFwc2hvdCgpO1xufSk7Il19