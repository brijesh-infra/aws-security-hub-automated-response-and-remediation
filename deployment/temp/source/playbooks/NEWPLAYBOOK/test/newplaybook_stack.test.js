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
const sharrplaybook_construct_1 = require("../../../lib/sharrplaybook-construct");
function getTestStack() {
    const app = new cdk.App();
    const stack = new sharrplaybook_construct_1.PlaybookPrimaryStack(app, 'stack', {
        description: 'test;',
        solutionId: 'SO0111',
        solutionVersion: 'v1.1.1',
        solutionDistBucket: 'sharrbukkit',
        solutionDistName: 'aws-security-hub-automated-response-and-remediation',
        remediations: [{ "control": 'Example.3' }, { "control": 'Example.5' }, { "control": 'Example.1' }],
        securityStandard: 'PCI',
        securityStandardLongName: 'pci-dss',
        securityStandardVersion: '3.2.1'
    });
    return stack;
}
test('default stack', () => {
    expect(assert_1.SynthUtils.toCloudFormation(getTestStack())).toMatchSnapshot();
});
function getMemberStack() {
    const app = new cdk.App();
    const stack = new sharrplaybook_construct_1.PlaybookMemberStack(app, 'memberStack', {
        description: 'test;',
        solutionId: 'SO0111',
        solutionVersion: 'v1.1.1',
        solutionDistBucket: 'sharrbukkit',
        ssmdocs: 'playbooks/NEWPLAYBOOK/ssmdocs',
        remediations: [{ "control": 'Example.3' }, { "control": 'Example.5' }, { "control": 'Example.1' }],
        securityStandard: 'PCI',
        securityStandardLongName: 'pci-dss',
        securityStandardVersion: '3.2.1'
    });
    return stack;
}
test('default stack', () => {
    expect(assert_1.SynthUtils.toCloudFormation(getMemberStack())).toMatchSnapshot();
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibmV3cGxheWJvb2tfc3RhY2sudGVzdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIm5ld3BsYXlib29rX3N0YWNrLnRlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7Ozs7Ozs7OytFQWErRTs7QUFFL0UsNENBQWlGO0FBQ2pGLHFDQUFxQztBQUNyQyxrRkFBbUc7QUFFbkcsU0FBUyxZQUFZO0lBQ25CLE1BQU0sR0FBRyxHQUFHLElBQUksR0FBRyxDQUFDLEdBQUcsRUFBRSxDQUFDO0lBQzFCLE1BQU0sS0FBSyxHQUFHLElBQUksOENBQW9CLENBQUMsR0FBRyxFQUFFLE9BQU8sRUFBRTtRQUNwRCxXQUFXLEVBQUUsT0FBTztRQUNuQixVQUFVLEVBQUUsUUFBUTtRQUNwQixlQUFlLEVBQUUsUUFBUTtRQUN6QixrQkFBa0IsRUFBRSxhQUFhO1FBQ2pDLGdCQUFnQixFQUFFLHFEQUFxRDtRQUN2RSxZQUFZLEVBQUUsQ0FBRSxFQUFDLFNBQVMsRUFBQyxXQUFXLEVBQUMsRUFBRSxFQUFDLFNBQVMsRUFBQyxXQUFXLEVBQUMsRUFBRSxFQUFDLFNBQVMsRUFBQyxXQUFXLEVBQUMsQ0FBRTtRQUMzRixnQkFBZ0IsRUFBRSxLQUFLO1FBQ3ZCLHdCQUF3QixFQUFFLFNBQVM7UUFDbkMsdUJBQXVCLEVBQUUsT0FBTztLQUNqQyxDQUFDLENBQUE7SUFDRixPQUFPLEtBQUssQ0FBQztBQUNmLENBQUM7QUFFRCxJQUFJLENBQUMsZUFBZSxFQUFFLEdBQUcsRUFBRTtJQUN6QixNQUFNLENBQUMsbUJBQVUsQ0FBQyxnQkFBZ0IsQ0FBQyxZQUFZLEVBQUUsQ0FBQyxDQUFDLENBQUMsZUFBZSxFQUFFLENBQUM7QUFDeEUsQ0FBQyxDQUFDLENBQUM7QUFFSCxTQUFTLGNBQWM7SUFDckIsTUFBTSxHQUFHLEdBQUcsSUFBSSxHQUFHLENBQUMsR0FBRyxFQUFFLENBQUM7SUFDMUIsTUFBTSxLQUFLLEdBQUcsSUFBSSw2Q0FBbUIsQ0FBQyxHQUFHLEVBQUUsYUFBYSxFQUFFO1FBQ3hELFdBQVcsRUFBRSxPQUFPO1FBQ3BCLFVBQVUsRUFBRSxRQUFRO1FBQ3BCLGVBQWUsRUFBRSxRQUFRO1FBQ3pCLGtCQUFrQixFQUFFLGFBQWE7UUFDakMsT0FBTyxFQUFFLCtCQUErQjtRQUN4QyxZQUFZLEVBQUUsQ0FBRSxFQUFDLFNBQVMsRUFBQyxXQUFXLEVBQUMsRUFBRSxFQUFDLFNBQVMsRUFBQyxXQUFXLEVBQUMsRUFBRSxFQUFDLFNBQVMsRUFBQyxXQUFXLEVBQUMsQ0FBRTtRQUMzRixnQkFBZ0IsRUFBRSxLQUFLO1FBQ3ZCLHdCQUF3QixFQUFFLFNBQVM7UUFDbkMsdUJBQXVCLEVBQUUsT0FBTztLQUNqQyxDQUFDLENBQUE7SUFDRixPQUFPLEtBQUssQ0FBQztBQUNmLENBQUM7QUFFRCxJQUFJLENBQUMsZUFBZSxFQUFFLEdBQUcsRUFBRTtJQUN6QixNQUFNLENBQUMsbUJBQVUsQ0FBQyxnQkFBZ0IsQ0FBQyxjQUFjLEVBQUUsQ0FBQyxDQUFDLENBQUMsZUFBZSxFQUFFLENBQUM7QUFDMUUsQ0FBQyxDQUFDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAqICBDb3B5cmlnaHQgQW1hem9uLmNvbSwgSW5jLiBvciBpdHMgYWZmaWxpYXRlcy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC4gICAqXG4gKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAqXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZSBMaWNlbnNlLCBWZXJzaW9uIDIuMCAodGhlIFwiTGljZW5zZVwiKS4gWW91IG1heSAgICpcbiAqICBub3QgdXNlIHRoaXMgZmlsZSBleGNlcHQgaW4gY29tcGxpYW5jZSB3aXRoIHRoZSBMaWNlbnNlLiBBIGNvcHkgb2YgdGhlICAgICpcbiAqICBMaWNlbnNlIGlzIGxvY2F0ZWQgYXQgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICpcbiAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICpcbiAqICAgICAgaHR0cDovL3d3dy5hcGFjaGUub3JnL2xpY2Vuc2VzL0xJQ0VOU0UtMi4wICAgICAgICAgICAgICAgICAgICAgICAgICAgICpcbiAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICpcbiAqICBvciBpbiB0aGUgJ2xpY2Vuc2UnIGZpbGUgYWNjb21wYW55aW5nIHRoaXMgZmlsZS4gVGhpcyBmaWxlIGlzIGRpc3RyaWJ1dGVkICpcbiAqICBvbiBhbiAnQVMgSVMnIEJBU0lTLCBXSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTlkgS0lORCwgICAgICAgICpcbiAqICBleHByZXNzIG9yIGltcGxpZWQuIFNlZSB0aGUgTGljZW5zZSBmb3IgdGhlIHNwZWNpZmljIGxhbmd1YWdlIGdvdmVybmluZyAgICpcbiAqICBwZXJtaXNzaW9ucyBhbmQgbGltaXRhdGlvbnMgdW5kZXIgdGhlIExpY2Vuc2UuICAgICAgICAgICAgICAgICAgICAgICAgICAgICpcbiAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuaW1wb3J0IHsgZXhwZWN0IGFzIGV4cGVjdENESywgbWF0Y2hUZW1wbGF0ZSwgU3ludGhVdGlscyB9IGZyb20gJ0Bhd3MtY2RrL2Fzc2VydCc7XG5pbXBvcnQgKiBhcyBjZGsgZnJvbSAnQGF3cy1jZGsvY29yZSc7XG5pbXBvcnQgeyAgUGxheWJvb2tQcmltYXJ5U3RhY2ssIFBsYXlib29rTWVtYmVyU3RhY2sgIH0gZnJvbSAnLi4vLi4vLi4vbGliL3NoYXJycGxheWJvb2stY29uc3RydWN0JztcblxuZnVuY3Rpb24gZ2V0VGVzdFN0YWNrKCk6IGNkay5TdGFjayB7XG4gIGNvbnN0IGFwcCA9IG5ldyBjZGsuQXBwKCk7XG4gIGNvbnN0IHN0YWNrID0gbmV3IFBsYXlib29rUHJpbWFyeVN0YWNrKGFwcCwgJ3N0YWNrJywge1xuICBcdGRlc2NyaXB0aW9uOiAndGVzdDsnLFxuICAgIHNvbHV0aW9uSWQ6ICdTTzAxMTEnLFxuICAgIHNvbHV0aW9uVmVyc2lvbjogJ3YxLjEuMScsXG4gICAgc29sdXRpb25EaXN0QnVja2V0OiAnc2hhcnJidWtraXQnLFxuICAgIHNvbHV0aW9uRGlzdE5hbWU6ICdhd3Mtc2VjdXJpdHktaHViLWF1dG9tYXRlZC1yZXNwb25zZS1hbmQtcmVtZWRpYXRpb24nLFxuICAgIHJlbWVkaWF0aW9uczogWyB7XCJjb250cm9sXCI6J0V4YW1wbGUuMyd9LCB7XCJjb250cm9sXCI6J0V4YW1wbGUuNSd9LCB7XCJjb250cm9sXCI6J0V4YW1wbGUuMSd9IF0sXG4gICAgc2VjdXJpdHlTdGFuZGFyZDogJ1BDSScsXG4gICAgc2VjdXJpdHlTdGFuZGFyZExvbmdOYW1lOiAncGNpLWRzcycsXG4gICAgc2VjdXJpdHlTdGFuZGFyZFZlcnNpb246ICczLjIuMSdcbiAgfSlcbiAgcmV0dXJuIHN0YWNrO1xufVxuXG50ZXN0KCdkZWZhdWx0IHN0YWNrJywgKCkgPT4ge1xuICBleHBlY3QoU3ludGhVdGlscy50b0Nsb3VkRm9ybWF0aW9uKGdldFRlc3RTdGFjaygpKSkudG9NYXRjaFNuYXBzaG90KCk7XG59KTtcblxuZnVuY3Rpb24gZ2V0TWVtYmVyU3RhY2soKTogY2RrLlN0YWNrIHtcbiAgY29uc3QgYXBwID0gbmV3IGNkay5BcHAoKTtcbiAgY29uc3Qgc3RhY2sgPSBuZXcgUGxheWJvb2tNZW1iZXJTdGFjayhhcHAsICdtZW1iZXJTdGFjaycsIHtcbiAgICBkZXNjcmlwdGlvbjogJ3Rlc3Q7JyxcbiAgICBzb2x1dGlvbklkOiAnU08wMTExJyxcbiAgICBzb2x1dGlvblZlcnNpb246ICd2MS4xLjEnLFxuICAgIHNvbHV0aW9uRGlzdEJ1Y2tldDogJ3NoYXJyYnVra2l0JyxcbiAgICBzc21kb2NzOiAncGxheWJvb2tzL05FV1BMQVlCT09LL3NzbWRvY3MnLFxuICAgIHJlbWVkaWF0aW9uczogWyB7XCJjb250cm9sXCI6J0V4YW1wbGUuMyd9LCB7XCJjb250cm9sXCI6J0V4YW1wbGUuNSd9LCB7XCJjb250cm9sXCI6J0V4YW1wbGUuMSd9IF0sXG4gICAgc2VjdXJpdHlTdGFuZGFyZDogJ1BDSScsXG4gICAgc2VjdXJpdHlTdGFuZGFyZExvbmdOYW1lOiAncGNpLWRzcycsXG4gICAgc2VjdXJpdHlTdGFuZGFyZFZlcnNpb246ICczLjIuMSdcbiAgfSlcbiAgcmV0dXJuIHN0YWNrO1xufVxuXG50ZXN0KCdkZWZhdWx0IHN0YWNrJywgKCkgPT4ge1xuICBleHBlY3QoU3ludGhVdGlscy50b0Nsb3VkRm9ybWF0aW9uKGdldE1lbWJlclN0YWNrKCkpKS50b01hdGNoU25hcHNob3QoKTtcbn0pOyJdfQ==