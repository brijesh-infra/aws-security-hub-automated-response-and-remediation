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
const orchestrator_log_stack_1 = require("../solution_deploy/lib/orchestrator-log-stack");
const cdk_nag_1 = require("cdk-nag");
const core_1 = require("@aws-cdk/core");
const app = new cdk.App();
function getTestStack() {
    const app = new cdk.App();
    const stack = new orchestrator_log_stack_1.OrchLogStack(app, 'roles', {
        description: 'test;',
        solutionId: 'SO0111',
        logGroupName: 'TestLogGroup'
    });
    core_1.Aspects.of(app).add(new cdk_nag_1.AwsSolutionsChecks({ verbose: true }));
    return stack;
}
test('Global Roles Stack', () => {
    expect(assert_1.SynthUtils.toCloudFormation(getTestStack())).toMatchSnapshot();
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3JjaGVzdHJhdG9yX2xvZ3MudGVzdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIm9yY2hlc3RyYXRvcl9sb2dzLnRlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7Ozs7Ozs7OytFQWErRTs7QUFFOUUsNENBQTZDO0FBQzdDLHFDQUFxQztBQUNyQywwRkFBNkU7QUFDN0UscUNBQTRDO0FBQzdDLHdDQUF1QztBQUV0QyxNQUFNLEdBQUcsR0FBRyxJQUFJLEdBQUcsQ0FBQyxHQUFHLEVBQUUsQ0FBQztBQUUxQixTQUFTLFlBQVk7SUFDbkIsTUFBTSxHQUFHLEdBQUcsSUFBSSxHQUFHLENBQUMsR0FBRyxFQUFFLENBQUM7SUFDMUIsTUFBTSxLQUFLLEdBQUcsSUFBSSxxQ0FBWSxDQUFDLEdBQUcsRUFBRSxPQUFPLEVBQUU7UUFDM0MsV0FBVyxFQUFFLE9BQU87UUFDcEIsVUFBVSxFQUFFLFFBQVE7UUFDcEIsWUFBWSxFQUFFLGNBQWM7S0FDN0IsQ0FBQyxDQUFBO0lBQ0YsY0FBTyxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSw0QkFBa0IsQ0FBQyxFQUFDLE9BQU8sRUFBRSxJQUFJLEVBQUMsQ0FBQyxDQUFDLENBQUE7SUFDNUQsT0FBTyxLQUFLLENBQUM7QUFDZixDQUFDO0FBQ0QsSUFBSSxDQUFDLG9CQUFvQixFQUFFLEdBQUcsRUFBRTtJQUM5QixNQUFNLENBQUMsbUJBQVUsQ0FBQyxnQkFBZ0IsQ0FBQyxZQUFZLEVBQUUsQ0FBQyxDQUFDLENBQUMsZUFBZSxFQUFFLENBQUM7QUFDeEUsQ0FBQyxDQUFDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAqICBDb3B5cmlnaHQgQW1hem9uLmNvbSwgSW5jLiBvciBpdHMgYWZmaWxpYXRlcy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC4gICAqXG4gKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAqXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZSBMaWNlbnNlLCBWZXJzaW9uIDIuMCAodGhlIFwiTGljZW5zZVwiKS4gWW91IG1heSAgICpcbiAqICBub3QgdXNlIHRoaXMgZmlsZSBleGNlcHQgaW4gY29tcGxpYW5jZSB3aXRoIHRoZSBMaWNlbnNlLiBBIGNvcHkgb2YgdGhlICAgICpcbiAqICBMaWNlbnNlIGlzIGxvY2F0ZWQgYXQgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICpcbiAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICpcbiAqICAgICAgaHR0cDovL3d3dy5hcGFjaGUub3JnL2xpY2Vuc2VzL0xJQ0VOU0UtMi4wICAgICAgICAgICAgICAgICAgICAgICAgICAgICpcbiAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICpcbiAqICBvciBpbiB0aGUgJ2xpY2Vuc2UnIGZpbGUgYWNjb21wYW55aW5nIHRoaXMgZmlsZS4gVGhpcyBmaWxlIGlzIGRpc3RyaWJ1dGVkICpcbiAqICBvbiBhbiAnQVMgSVMnIEJBU0lTLCBXSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTlkgS0lORCwgICAgICAgICpcbiAqICBleHByZXNzIG9yIGltcGxpZWQuIFNlZSB0aGUgTGljZW5zZSBmb3IgdGhlIHNwZWNpZmljIGxhbmd1YWdlIGdvdmVybmluZyAgICpcbiAqICBwZXJtaXNzaW9ucyBhbmQgbGltaXRhdGlvbnMgdW5kZXIgdGhlIExpY2Vuc2UuICAgICAgICAgICAgICAgICAgICAgICAgICAgICpcbiAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuIGltcG9ydCB7IFN5bnRoVXRpbHMgfSBmcm9tICdAYXdzLWNkay9hc3NlcnQnO1xuIGltcG9ydCAqIGFzIGNkayBmcm9tICdAYXdzLWNkay9jb3JlJztcbiBpbXBvcnQgeyBPcmNoTG9nU3RhY2sgfSBmcm9tICcuLi9zb2x1dGlvbl9kZXBsb3kvbGliL29yY2hlc3RyYXRvci1sb2ctc3RhY2snO1xuIGltcG9ydCB7IEF3c1NvbHV0aW9uc0NoZWNrcyB9IGZyb20gJ2Nkay1uYWcnXG5pbXBvcnQgeyBBc3BlY3RzIH0gZnJvbSAnQGF3cy1jZGsvY29yZSdcbiBcbiBjb25zdCBhcHAgPSBuZXcgY2RrLkFwcCgpO1xuIFxuIGZ1bmN0aW9uIGdldFRlc3RTdGFjaygpOiBjZGsuU3RhY2sge1xuICAgY29uc3QgYXBwID0gbmV3IGNkay5BcHAoKTtcbiAgIGNvbnN0IHN0YWNrID0gbmV3IE9yY2hMb2dTdGFjayhhcHAsICdyb2xlcycsIHtcbiAgICAgZGVzY3JpcHRpb246ICd0ZXN0OycsXG4gICAgIHNvbHV0aW9uSWQ6ICdTTzAxMTEnLFxuICAgICBsb2dHcm91cE5hbWU6ICdUZXN0TG9nR3JvdXAnXG4gICB9KVxuICAgQXNwZWN0cy5vZihhcHApLmFkZChuZXcgQXdzU29sdXRpb25zQ2hlY2tzKHt2ZXJib3NlOiB0cnVlfSkpXG4gICByZXR1cm4gc3RhY2s7XG4gfVxuIHRlc3QoJ0dsb2JhbCBSb2xlcyBTdGFjaycsICgpID0+IHtcbiAgIGV4cGVjdChTeW50aFV0aWxzLnRvQ2xvdWRGb3JtYXRpb24oZ2V0VGVzdFN0YWNrKCkpKS50b01hdGNoU25hcHNob3QoKTtcbiB9KTtcbiAiXX0=