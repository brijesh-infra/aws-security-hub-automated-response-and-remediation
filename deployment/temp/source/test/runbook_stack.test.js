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
const remediation_runbook_stack_1 = require("../solution_deploy/lib/remediation_runbook-stack");
const cdk_nag_1 = require("cdk-nag");
const core_1 = require("@aws-cdk/core");
const app = new cdk.App();
function getRoleTestStack() {
    const app = new cdk.App();
    const stack = new remediation_runbook_stack_1.MemberRoleStack(app, 'roles', {
        description: 'test;',
        solutionId: 'SO0111',
        solutionVersion: 'v1.1.1',
        solutionDistBucket: 'sharrbukkit'
    });
    return stack;
}
test('Global Roles Stack', () => {
    expect(assert_1.SynthUtils.toCloudFormation(getRoleTestStack())).toMatchSnapshot();
});
function getSsmTestStack() {
    const app = new cdk.App();
    const stack = new remediation_runbook_stack_1.RemediationRunbookStack(app, 'stack', {
        description: 'test;',
        solutionId: 'SO0111',
        solutionVersion: 'v1.1.1',
        solutionDistBucket: 'sharrbukkit',
        ssmdocs: 'remediation_runbooks',
        roleStack: getRoleTestStack()
    });
    core_1.Aspects.of(app).add(new cdk_nag_1.AwsSolutionsChecks({ verbose: true }));
    return stack;
}
test('Regional Documents', () => {
    expect(assert_1.SynthUtils.toCloudFormation(getSsmTestStack())).toMatchSnapshot();
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicnVuYm9va19zdGFjay50ZXN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsicnVuYm9va19zdGFjay50ZXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7Ozs7Ozs7OzsrRUFhK0U7O0FBRS9FLDRDQUE2QztBQUM3QyxxQ0FBcUM7QUFDckMsZ0dBQTRHO0FBQzVHLHFDQUE0QztBQUM1Qyx3Q0FBdUM7QUFFdkMsTUFBTSxHQUFHLEdBQUcsSUFBSSxHQUFHLENBQUMsR0FBRyxFQUFFLENBQUM7QUFFMUIsU0FBUyxnQkFBZ0I7SUFDdkIsTUFBTSxHQUFHLEdBQUcsSUFBSSxHQUFHLENBQUMsR0FBRyxFQUFFLENBQUM7SUFDMUIsTUFBTSxLQUFLLEdBQUcsSUFBSSwyQ0FBZSxDQUFDLEdBQUcsRUFBRSxPQUFPLEVBQUU7UUFDOUMsV0FBVyxFQUFFLE9BQU87UUFDcEIsVUFBVSxFQUFFLFFBQVE7UUFDcEIsZUFBZSxFQUFFLFFBQVE7UUFDekIsa0JBQWtCLEVBQUUsYUFBYTtLQUNsQyxDQUFDLENBQUE7SUFDRixPQUFPLEtBQUssQ0FBQztBQUNmLENBQUM7QUFDRCxJQUFJLENBQUMsb0JBQW9CLEVBQUUsR0FBRyxFQUFFO0lBQzlCLE1BQU0sQ0FBQyxtQkFBVSxDQUFDLGdCQUFnQixDQUFDLGdCQUFnQixFQUFFLENBQUMsQ0FBQyxDQUFDLGVBQWUsRUFBRSxDQUFDO0FBQzVFLENBQUMsQ0FBQyxDQUFDO0FBRUgsU0FBUyxlQUFlO0lBQ3RCLE1BQU0sR0FBRyxHQUFHLElBQUksR0FBRyxDQUFDLEdBQUcsRUFBRSxDQUFDO0lBQzFCLE1BQU0sS0FBSyxHQUFHLElBQUksbURBQXVCLENBQUMsR0FBRyxFQUFFLE9BQU8sRUFBRTtRQUN2RCxXQUFXLEVBQUUsT0FBTztRQUNuQixVQUFVLEVBQUUsUUFBUTtRQUNwQixlQUFlLEVBQUUsUUFBUTtRQUN6QixrQkFBa0IsRUFBRSxhQUFhO1FBQ2pDLE9BQU8sRUFBRSxzQkFBc0I7UUFDL0IsU0FBUyxFQUFFLGdCQUFnQixFQUFFO0tBQzlCLENBQUMsQ0FBQTtJQUNGLGNBQU8sQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksNEJBQWtCLENBQUMsRUFBQyxPQUFPLEVBQUUsSUFBSSxFQUFDLENBQUMsQ0FBQyxDQUFBO0lBQzVELE9BQU8sS0FBSyxDQUFDO0FBQ2YsQ0FBQztBQUVELElBQUksQ0FBQyxvQkFBb0IsRUFBRSxHQUFHLEVBQUU7SUFDOUIsTUFBTSxDQUFDLG1CQUFVLENBQUMsZ0JBQWdCLENBQUMsZUFBZSxFQUFFLENBQUMsQ0FBQyxDQUFDLGVBQWUsRUFBRSxDQUFDO0FBQzNFLENBQUMsQ0FBQyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gKiAgQ29weXJpZ2h0IEFtYXpvbi5jb20sIEluYy4gb3IgaXRzIGFmZmlsaWF0ZXMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuICAgKlxuICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUgTGljZW5zZSwgVmVyc2lvbiAyLjAgKHRoZSBcIkxpY2Vuc2VcIikuIFlvdSBtYXkgICAqXG4gKiAgbm90IHVzZSB0aGlzIGZpbGUgZXhjZXB0IGluIGNvbXBsaWFuY2Ugd2l0aCB0aGUgTGljZW5zZS4gQSBjb3B5IG9mIHRoZSAgICAqXG4gKiAgTGljZW5zZSBpcyBsb2NhdGVkIGF0ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAqXG4gKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAqXG4gKiAgICAgIGh0dHA6Ly93d3cuYXBhY2hlLm9yZy9saWNlbnNlcy9MSUNFTlNFLTIuMCAgICAgICAgICAgICAgICAgICAgICAgICAgICAqXG4gKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAqXG4gKiAgb3IgaW4gdGhlICdsaWNlbnNlJyBmaWxlIGFjY29tcGFueWluZyB0aGlzIGZpbGUuIFRoaXMgZmlsZSBpcyBkaXN0cmlidXRlZCAqXG4gKiAgb24gYW4gJ0FTIElTJyBCQVNJUywgV0lUSE9VVCBXQVJSQU5USUVTIE9SIENPTkRJVElPTlMgT0YgQU5ZIEtJTkQsICAgICAgICAqXG4gKiAgZXhwcmVzcyBvciBpbXBsaWVkLiBTZWUgdGhlIExpY2Vuc2UgZm9yIHRoZSBzcGVjaWZpYyBsYW5ndWFnZSBnb3Zlcm5pbmcgICAqXG4gKiAgcGVybWlzc2lvbnMgYW5kIGxpbWl0YXRpb25zIHVuZGVyIHRoZSBMaWNlbnNlLiAgICAgICAgICAgICAgICAgICAgICAgICAgICAqXG4gKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbmltcG9ydCB7IFN5bnRoVXRpbHMgfSBmcm9tICdAYXdzLWNkay9hc3NlcnQnO1xuaW1wb3J0ICogYXMgY2RrIGZyb20gJ0Bhd3MtY2RrL2NvcmUnO1xuaW1wb3J0IHsgTWVtYmVyUm9sZVN0YWNrLCBSZW1lZGlhdGlvblJ1bmJvb2tTdGFjayB9IGZyb20gJy4uL3NvbHV0aW9uX2RlcGxveS9saWIvcmVtZWRpYXRpb25fcnVuYm9vay1zdGFjayc7XG5pbXBvcnQgeyBBd3NTb2x1dGlvbnNDaGVja3MgfSBmcm9tICdjZGstbmFnJ1xuaW1wb3J0IHsgQXNwZWN0cyB9IGZyb20gJ0Bhd3MtY2RrL2NvcmUnXG5cbmNvbnN0IGFwcCA9IG5ldyBjZGsuQXBwKCk7XG5cbmZ1bmN0aW9uIGdldFJvbGVUZXN0U3RhY2soKTogTWVtYmVyUm9sZVN0YWNrIHtcbiAgY29uc3QgYXBwID0gbmV3IGNkay5BcHAoKTtcbiAgY29uc3Qgc3RhY2sgPSBuZXcgTWVtYmVyUm9sZVN0YWNrKGFwcCwgJ3JvbGVzJywge1xuICAgIGRlc2NyaXB0aW9uOiAndGVzdDsnLFxuICAgIHNvbHV0aW9uSWQ6ICdTTzAxMTEnLFxuICAgIHNvbHV0aW9uVmVyc2lvbjogJ3YxLjEuMScsXG4gICAgc29sdXRpb25EaXN0QnVja2V0OiAnc2hhcnJidWtraXQnXG4gIH0pXG4gIHJldHVybiBzdGFjaztcbn1cbnRlc3QoJ0dsb2JhbCBSb2xlcyBTdGFjaycsICgpID0+IHtcbiAgZXhwZWN0KFN5bnRoVXRpbHMudG9DbG91ZEZvcm1hdGlvbihnZXRSb2xlVGVzdFN0YWNrKCkpKS50b01hdGNoU25hcHNob3QoKTtcbn0pO1xuXG5mdW5jdGlvbiBnZXRTc21UZXN0U3RhY2soKTogY2RrLlN0YWNrIHtcbiAgY29uc3QgYXBwID0gbmV3IGNkay5BcHAoKTtcbiAgY29uc3Qgc3RhY2sgPSBuZXcgUmVtZWRpYXRpb25SdW5ib29rU3RhY2soYXBwLCAnc3RhY2snLCB7XG4gIFx0ZGVzY3JpcHRpb246ICd0ZXN0OycsXG4gICAgc29sdXRpb25JZDogJ1NPMDExMScsXG4gICAgc29sdXRpb25WZXJzaW9uOiAndjEuMS4xJyxcbiAgICBzb2x1dGlvbkRpc3RCdWNrZXQ6ICdzaGFycmJ1a2tpdCcsXG4gICAgc3NtZG9jczogJ3JlbWVkaWF0aW9uX3J1bmJvb2tzJyxcbiAgICByb2xlU3RhY2s6IGdldFJvbGVUZXN0U3RhY2soKVxuICB9KVxuICBBc3BlY3RzLm9mKGFwcCkuYWRkKG5ldyBBd3NTb2x1dGlvbnNDaGVja3Moe3ZlcmJvc2U6IHRydWV9KSlcbiAgcmV0dXJuIHN0YWNrO1xufVxuXG50ZXN0KCdSZWdpb25hbCBEb2N1bWVudHMnLCAoKSA9PiB7XG4gIGV4cGVjdChTeW50aFV0aWxzLnRvQ2xvdWRGb3JtYXRpb24oZ2V0U3NtVGVzdFN0YWNrKCkpKS50b01hdGNoU25hcHNob3QoKTtcbn0pOyJdfQ==