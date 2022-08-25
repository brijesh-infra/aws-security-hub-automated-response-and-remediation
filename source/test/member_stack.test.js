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
const lambda = require("@aws-cdk/aws-lambda");
const cdk = require("@aws-cdk/core");
const sharr_member_stack_1 = require("../solution_deploy/lib/sharr_member-stack");
const cdk_nag_1 = require("cdk-nag");
const core_1 = require("@aws-cdk/core");
function getCatStack() {
    const app = new cdk.App();
    const stack = new sharr_member_stack_1.MemberStack(app, 'CatalogStack', {
        description: 'test;',
        solutionId: 'SO0111',
        solutionVersion: 'v1.1.1',
        solutionDistBucket: 'sharrbukkit',
        solutionTMN: 'aws-security-hub-automated-response-and-remediation',
        runtimePython: lambda.Runtime.PYTHON_3_8
    });
    core_1.Aspects.of(app).add(new cdk_nag_1.AwsSolutionsChecks({ verbose: true }));
    return stack;
}
test('default stack', () => {
    expect(assert_1.SynthUtils.toCloudFormation(getCatStack())).toMatchSnapshot();
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWVtYmVyX3N0YWNrLnRlc3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJtZW1iZXJfc3RhY2sudGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7Ozs7Ozs7Ozs7K0VBYStFOztBQUUvRSw0Q0FBNkM7QUFDN0MsOENBQThDO0FBQzlDLHFDQUFxQztBQUNyQyxrRkFBd0U7QUFDeEUscUNBQTRDO0FBQzVDLHdDQUF1QztBQUV2QyxTQUFTLFdBQVc7SUFDbEIsTUFBTSxHQUFHLEdBQUcsSUFBSSxHQUFHLENBQUMsR0FBRyxFQUFFLENBQUM7SUFDMUIsTUFBTSxLQUFLLEdBQUcsSUFBSSxnQ0FBVyxDQUFDLEdBQUcsRUFBRSxjQUFjLEVBQUU7UUFDakQsV0FBVyxFQUFFLE9BQU87UUFDcEIsVUFBVSxFQUFFLFFBQVE7UUFDcEIsZUFBZSxFQUFFLFFBQVE7UUFDekIsa0JBQWtCLEVBQUUsYUFBYTtRQUNqQyxXQUFXLEVBQUUscURBQXFEO1FBQ2xFLGFBQWEsRUFBRSxNQUFNLENBQUMsT0FBTyxDQUFDLFVBQVU7S0FDekMsQ0FBQyxDQUFDO0lBQ0gsY0FBTyxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSw0QkFBa0IsQ0FBQyxFQUFDLE9BQU8sRUFBRSxJQUFJLEVBQUMsQ0FBQyxDQUFDLENBQUE7SUFDNUQsT0FBTyxLQUFLLENBQUM7QUFDZixDQUFDO0FBRUQsSUFBSSxDQUFDLGVBQWUsRUFBRSxHQUFHLEVBQUU7SUFDekIsTUFBTSxDQUFDLG1CQUFVLENBQUMsZ0JBQWdCLENBQUMsV0FBVyxFQUFFLENBQUMsQ0FBQyxDQUFDLGVBQWUsRUFBRSxDQUFDO0FBQ3ZFLENBQUMsQ0FBQyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gKiAgQ29weXJpZ2h0IEFtYXpvbi5jb20sIEluYy4gb3IgaXRzIGFmZmlsaWF0ZXMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuICAgKlxuICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUgTGljZW5zZSwgVmVyc2lvbiAyLjAgKHRoZSBcIkxpY2Vuc2VcIikuIFlvdSBtYXkgICAqXG4gKiAgbm90IHVzZSB0aGlzIGZpbGUgZXhjZXB0IGluIGNvbXBsaWFuY2Ugd2l0aCB0aGUgTGljZW5zZS4gQSBjb3B5IG9mIHRoZSAgICAqXG4gKiAgTGljZW5zZSBpcyBsb2NhdGVkIGF0ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAqXG4gKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAqXG4gKiAgICAgIGh0dHA6Ly93d3cuYXBhY2hlLm9yZy9saWNlbnNlcy9MSUNFTlNFLTIuMCAgICAgICAgICAgICAgICAgICAgICAgICAgICAqXG4gKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAqXG4gKiAgb3IgaW4gdGhlICdsaWNlbnNlJyBmaWxlIGFjY29tcGFueWluZyB0aGlzIGZpbGUuIFRoaXMgZmlsZSBpcyBkaXN0cmlidXRlZCAqXG4gKiAgb24gYW4gJ0FTIElTJyBCQVNJUywgV0lUSE9VVCBXQVJSQU5USUVTIE9SIENPTkRJVElPTlMgT0YgQU5ZIEtJTkQsICAgICAgICAqXG4gKiAgZXhwcmVzcyBvciBpbXBsaWVkLiBTZWUgdGhlIExpY2Vuc2UgZm9yIHRoZSBzcGVjaWZpYyBsYW5ndWFnZSBnb3Zlcm5pbmcgICAqXG4gKiAgcGVybWlzc2lvbnMgYW5kIGxpbWl0YXRpb25zIHVuZGVyIHRoZSBMaWNlbnNlLiAgICAgICAgICAgICAgICAgICAgICAgICAgICAqXG4gKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbmltcG9ydCB7IFN5bnRoVXRpbHMgfSBmcm9tICdAYXdzLWNkay9hc3NlcnQnO1xuaW1wb3J0ICogYXMgbGFtYmRhIGZyb20gJ0Bhd3MtY2RrL2F3cy1sYW1iZGEnO1xuaW1wb3J0ICogYXMgY2RrIGZyb20gJ0Bhd3MtY2RrL2NvcmUnO1xuaW1wb3J0IHsgTWVtYmVyU3RhY2sgfSBmcm9tICcuLi9zb2x1dGlvbl9kZXBsb3kvbGliL3NoYXJyX21lbWJlci1zdGFjayc7XG5pbXBvcnQgeyBBd3NTb2x1dGlvbnNDaGVja3MgfSBmcm9tICdjZGstbmFnJ1xuaW1wb3J0IHsgQXNwZWN0cyB9IGZyb20gJ0Bhd3MtY2RrL2NvcmUnXG5cbmZ1bmN0aW9uIGdldENhdFN0YWNrKCk6IGNkay5TdGFjayB7XG4gIGNvbnN0IGFwcCA9IG5ldyBjZGsuQXBwKCk7XG4gIGNvbnN0IHN0YWNrID0gbmV3IE1lbWJlclN0YWNrKGFwcCwgJ0NhdGFsb2dTdGFjaycsIHtcbiAgICBkZXNjcmlwdGlvbjogJ3Rlc3Q7JyxcbiAgICBzb2x1dGlvbklkOiAnU08wMTExJyxcbiAgICBzb2x1dGlvblZlcnNpb246ICd2MS4xLjEnLFxuICAgIHNvbHV0aW9uRGlzdEJ1Y2tldDogJ3NoYXJyYnVra2l0JyxcbiAgICBzb2x1dGlvblRNTjogJ2F3cy1zZWN1cml0eS1odWItYXV0b21hdGVkLXJlc3BvbnNlLWFuZC1yZW1lZGlhdGlvbicsXG4gICAgcnVudGltZVB5dGhvbjogbGFtYmRhLlJ1bnRpbWUuUFlUSE9OXzNfOFxuICB9KTtcbiAgQXNwZWN0cy5vZihhcHApLmFkZChuZXcgQXdzU29sdXRpb25zQ2hlY2tzKHt2ZXJib3NlOiB0cnVlfSkpXG4gIHJldHVybiBzdGFjaztcbn1cblxudGVzdCgnZGVmYXVsdCBzdGFjaycsICgpID0+IHtcbiAgZXhwZWN0KFN5bnRoVXRpbHMudG9DbG91ZEZvcm1hdGlvbihnZXRDYXRTdGFjaygpKSkudG9NYXRjaFNuYXBzaG90KCk7XG59KTtcblxuXG4iXX0=