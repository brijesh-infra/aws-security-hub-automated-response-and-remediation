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
const cdk = require("@aws-cdk/core");
const lambda = require("@aws-cdk/aws-lambda");
const SolutionDeploy = require("../solution_deploy/lib/solution_deploy-stack");
const cdk_nag_1 = require("cdk-nag");
const core_1 = require("@aws-cdk/core");
function getTestStack() {
    const envEU = { account: '111111111111', region: 'eu-west-1' };
    const app = new cdk.App();
    const stack = new SolutionDeploy.SolutionDeployStack(app, 'stack', {
        env: envEU,
        solutionId: 'SO0111',
        solutionVersion: 'v1.0.0',
        solutionDistBucket: 'solutions',
        solutionTMN: 'aws-security-hub-automated-response-and-remediation',
        solutionName: 'AWS Security Hub Automated Response & Remediation',
        runtimePython: lambda.Runtime.PYTHON_3_8,
        orchLogGroup: 'ORCH_LOG_GROUP'
    });
    core_1.Aspects.of(app).add(new cdk_nag_1.AwsSolutionsChecks({ verbose: true }));
    return stack;
}
test('Test if the Stack has all the resources.', () => {
    process.env.DIST_OUTPUT_BUCKET = 'solutions';
    process.env.SOLUTION_NAME = 'AWS Security Hub Automated Response & Remediation';
    process.env.DIST_VERSION = 'v1.0.0';
    process.env.SOLUTION_ID = 'SO0111111';
    process.env.SOLUTION_TRADEMARKEDNAME = 'aws-security-hub-automated-response-and-remediation';
    expect(assert_1.SynthUtils.toCloudFormation(getTestStack())).toMatchSnapshot();
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic29sdXRpb25fZGVwbG95LnRlc3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJzb2x1dGlvbl9kZXBsb3kudGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7Ozs7Ozs7Ozs7K0VBYStFOztBQUUvRSw0Q0FBNkY7QUFDN0YscUNBQXFDO0FBQ3JDLDhDQUE4QztBQUM5QywrRUFBK0U7QUFDL0UscUNBQTRDO0FBQzVDLHdDQUF1QztBQUV2QyxTQUFTLFlBQVk7SUFDbkIsTUFBTSxLQUFLLEdBQUcsRUFBRSxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sRUFBRSxXQUFXLEVBQUUsQ0FBQztJQUMvRCxNQUFNLEdBQUcsR0FBRyxJQUFJLEdBQUcsQ0FBQyxHQUFHLEVBQUUsQ0FBQztJQUMxQixNQUFNLEtBQUssR0FBRyxJQUFJLGNBQWMsQ0FBQyxtQkFBbUIsQ0FBQyxHQUFHLEVBQUUsT0FBTyxFQUFFO1FBQ2pFLEdBQUcsRUFBRSxLQUFLO1FBQ1YsVUFBVSxFQUFFLFFBQVE7UUFDcEIsZUFBZSxFQUFFLFFBQVE7UUFDekIsa0JBQWtCLEVBQUUsV0FBVztRQUMvQixXQUFXLEVBQUUscURBQXFEO1FBQ2xFLFlBQVksRUFBRSxtREFBbUQ7UUFDakUsYUFBYSxFQUFFLE1BQU0sQ0FBQyxPQUFPLENBQUMsVUFBVTtRQUN4QyxZQUFZLEVBQUUsZ0JBQWdCO0tBRS9CLENBQUMsQ0FBQTtJQUNGLGNBQU8sQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksNEJBQWtCLENBQUMsRUFBQyxPQUFPLEVBQUUsSUFBSSxFQUFDLENBQUMsQ0FBQyxDQUFBO0lBQzVELE9BQU8sS0FBSyxDQUFDO0FBQ2YsQ0FBQztBQUVELElBQUksQ0FBQywwQ0FBMEMsRUFBRSxHQUFHLEVBQUU7SUFDcEQsT0FBTyxDQUFDLEdBQUcsQ0FBQyxrQkFBa0IsR0FBRyxXQUFXLENBQUE7SUFDNUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxhQUFhLEdBQUcsbURBQW1ELENBQUE7SUFDL0UsT0FBTyxDQUFDLEdBQUcsQ0FBQyxZQUFZLEdBQUcsUUFBUSxDQUFBO0lBQ25DLE9BQU8sQ0FBQyxHQUFHLENBQUMsV0FBVyxHQUFHLFdBQVcsQ0FBQTtJQUNyQyxPQUFPLENBQUMsR0FBRyxDQUFDLHdCQUF3QixHQUFHLHFEQUFxRCxDQUFBO0lBQzVGLE1BQU0sQ0FBQyxtQkFBVSxDQUFDLGdCQUFnQixDQUFDLFlBQVksRUFBRSxDQUFDLENBQUMsQ0FBQyxlQUFlLEVBQUUsQ0FBQztBQUN4RSxDQUFDLENBQUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICogIENvcHlyaWdodCBBbWF6b24uY29tLCBJbmMuIG9yIGl0cyBhZmZpbGlhdGVzLiBBbGwgUmlnaHRzIFJlc2VydmVkLiAgICpcbiAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICpcbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wICh0aGUgXCJMaWNlbnNlXCIpLiBZb3UgbWF5ICAgKlxuICogIG5vdCB1c2UgdGhpcyBmaWxlIGV4Y2VwdCBpbiBjb21wbGlhbmNlIHdpdGggdGhlIExpY2Vuc2UuIEEgY29weSBvZiB0aGUgICAgKlxuICogIExpY2Vuc2UgaXMgbG9jYXRlZCBhdCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKlxuICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKlxuICogICAgICBodHRwOi8vd3d3LmFwYWNoZS5vcmcvbGljZW5zZXMvTElDRU5TRS0yLjAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKlxuICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKlxuICogIG9yIGluIHRoZSAnbGljZW5zZScgZmlsZSBhY2NvbXBhbnlpbmcgdGhpcyBmaWxlLiBUaGlzIGZpbGUgaXMgZGlzdHJpYnV0ZWQgKlxuICogIG9uIGFuICdBUyBJUycgQkFTSVMsIFdJVEhPVVQgV0FSUkFOVElFUyBPUiBDT05ESVRJT05TIE9GIEFOWSBLSU5ELCAgICAgICAgKlxuICogIGV4cHJlc3Mgb3IgaW1wbGllZC4gU2VlIHRoZSBMaWNlbnNlIGZvciB0aGUgc3BlY2lmaWMgbGFuZ3VhZ2UgZ292ZXJuaW5nICAgKlxuICogIHBlcm1pc3Npb25zIGFuZCBsaW1pdGF0aW9ucyB1bmRlciB0aGUgTGljZW5zZS4gICAgICAgICAgICAgICAgICAgICAgICAgICAgKlxuICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG5pbXBvcnQgeyBleHBlY3QgYXMgZXhwZWN0Q0RLLCBtYXRjaFRlbXBsYXRlLCBNYXRjaFN0eWxlLCBTeW50aFV0aWxzIH0gZnJvbSAnQGF3cy1jZGsvYXNzZXJ0JztcbmltcG9ydCAqIGFzIGNkayBmcm9tICdAYXdzLWNkay9jb3JlJztcbmltcG9ydCAqIGFzIGxhbWJkYSBmcm9tICdAYXdzLWNkay9hd3MtbGFtYmRhJztcbmltcG9ydCAqIGFzIFNvbHV0aW9uRGVwbG95IGZyb20gJy4uL3NvbHV0aW9uX2RlcGxveS9saWIvc29sdXRpb25fZGVwbG95LXN0YWNrJztcbmltcG9ydCB7IEF3c1NvbHV0aW9uc0NoZWNrcyB9IGZyb20gJ2Nkay1uYWcnXG5pbXBvcnQgeyBBc3BlY3RzIH0gZnJvbSAnQGF3cy1jZGsvY29yZSdcblxuZnVuY3Rpb24gZ2V0VGVzdFN0YWNrKCk6IGNkay5TdGFjayB7XG4gIGNvbnN0IGVudkVVID0geyBhY2NvdW50OiAnMTExMTExMTExMTExJywgcmVnaW9uOiAnZXUtd2VzdC0xJyB9O1xuICBjb25zdCBhcHAgPSBuZXcgY2RrLkFwcCgpO1xuICBjb25zdCBzdGFjayA9IG5ldyBTb2x1dGlvbkRlcGxveS5Tb2x1dGlvbkRlcGxveVN0YWNrKGFwcCwgJ3N0YWNrJywgeyBcbiAgICBlbnY6IGVudkVVLFxuICAgIHNvbHV0aW9uSWQ6ICdTTzAxMTEnLFxuICAgIHNvbHV0aW9uVmVyc2lvbjogJ3YxLjAuMCcsXG4gICAgc29sdXRpb25EaXN0QnVja2V0OiAnc29sdXRpb25zJyxcbiAgICBzb2x1dGlvblRNTjogJ2F3cy1zZWN1cml0eS1odWItYXV0b21hdGVkLXJlc3BvbnNlLWFuZC1yZW1lZGlhdGlvbicsXG4gICAgc29sdXRpb25OYW1lOiAnQVdTIFNlY3VyaXR5IEh1YiBBdXRvbWF0ZWQgUmVzcG9uc2UgJiBSZW1lZGlhdGlvbicsXG4gICAgcnVudGltZVB5dGhvbjogbGFtYmRhLlJ1bnRpbWUuUFlUSE9OXzNfOCxcbiAgICBvcmNoTG9nR3JvdXA6ICdPUkNIX0xPR19HUk9VUCdcbiAgICBcbiAgfSlcbiAgQXNwZWN0cy5vZihhcHApLmFkZChuZXcgQXdzU29sdXRpb25zQ2hlY2tzKHt2ZXJib3NlOiB0cnVlfSkpXG4gIHJldHVybiBzdGFjaztcbn1cblxudGVzdCgnVGVzdCBpZiB0aGUgU3RhY2sgaGFzIGFsbCB0aGUgcmVzb3VyY2VzLicsICgpID0+IHtcbiAgcHJvY2Vzcy5lbnYuRElTVF9PVVRQVVRfQlVDS0VUID0gJ3NvbHV0aW9ucydcbiAgcHJvY2Vzcy5lbnYuU09MVVRJT05fTkFNRSA9ICdBV1MgU2VjdXJpdHkgSHViIEF1dG9tYXRlZCBSZXNwb25zZSAmIFJlbWVkaWF0aW9uJ1xuICBwcm9jZXNzLmVudi5ESVNUX1ZFUlNJT04gPSAndjEuMC4wJ1xuICBwcm9jZXNzLmVudi5TT0xVVElPTl9JRCA9ICdTTzAxMTExMTEnXG4gIHByb2Nlc3MuZW52LlNPTFVUSU9OX1RSQURFTUFSS0VETkFNRSA9ICdhd3Mtc2VjdXJpdHktaHViLWF1dG9tYXRlZC1yZXNwb25zZS1hbmQtcmVtZWRpYXRpb24nXG4gIGV4cGVjdChTeW50aFV0aWxzLnRvQ2xvdWRGb3JtYXRpb24oZ2V0VGVzdFN0YWNrKCkpKS50b01hdGNoU25hcHNob3QoKTtcbn0pO1xuIl19