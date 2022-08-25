"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("@aws-cdk/assert");
const cdk = require("@aws-cdk/core");
const aws_ssm_1 = require("@aws-cdk/aws-ssm");
const sharrplaybook_construct_1 = require("../../../lib/sharrplaybook-construct");
const RESOURCE_PREFIX = 'SO0111';
function getPrimaryStack() {
    const app = new cdk.App();
    const stack = new sharrplaybook_construct_1.PlaybookPrimaryStack(app, 'primaryStack', {
        description: 'test;',
        solutionId: 'SO0111',
        solutionVersion: 'v1.1.1',
        solutionDistBucket: 'sharrbukkit',
        solutionDistName: 'aws-security-hub-automated-response-and-remediation',
        remediations: [{ "control": '1.1' }, { "control": '1.2' }, { "control": '1.3' }],
        securityStandard: 'CIS',
        securityStandardLongName: 'cis-aws-foundations-benchmark',
        securityStandardVersion: '1.2.0'
    });
    return stack;
}
test('default stack', () => {
    expect(assert_1.SynthUtils.toCloudFormation(getPrimaryStack())).toMatchSnapshot();
});
function getMemberStack() {
    const app = new cdk.App();
    const stack = new sharrplaybook_construct_1.PlaybookMemberStack(app, 'memberStack', {
        description: 'test;',
        solutionId: 'SO0111',
        solutionVersion: 'v1.1.1',
        solutionDistBucket: 'sharrbukkit',
        securityStandard: 'CIS',
        securityStandardVersion: '1.2.0',
        securityStandardLongName: 'cis-aws-foundations-benchmark',
        ssmdocs: 'playbooks/CIS120/ssmdocs',
        commonScripts: 'playbooks/common',
        remediations: [{ "control": '1.3' }, { "control": '1.5' }, { "control": '2.1' }]
    });
    new aws_ssm_1.StringParameter(stack, `Remap CIS 4.2`, {
        description: `Remap the CIS 4.2 finding to CIS 4.1 remediation`,
        parameterName: `/Solutions/${RESOURCE_PREFIX}/cis-aws-foundations-benchmark/1.2.0-4.2`,
        stringValue: '4.1'
    });
    return stack;
}
test('default stack', () => {
    expect(assert_1.SynthUtils.toCloudFormation(getMemberStack())).toMatchSnapshot();
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2lzX3N0YWNrLnRlc3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJjaXNfc3RhY2sudGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFBLDRDQUE2QztBQUM3QyxxQ0FBcUM7QUFDckMsOENBQW1EO0FBQ25ELGtGQUFpRztBQUVqRyxNQUFNLGVBQWUsR0FBRyxRQUFRLENBQUE7QUFFaEMsU0FBUyxlQUFlO0lBQ3RCLE1BQU0sR0FBRyxHQUFHLElBQUksR0FBRyxDQUFDLEdBQUcsRUFBRSxDQUFDO0lBQzFCLE1BQU0sS0FBSyxHQUFHLElBQUksOENBQW9CLENBQUMsR0FBRyxFQUFFLGNBQWMsRUFBRTtRQUMzRCxXQUFXLEVBQUUsT0FBTztRQUNuQixVQUFVLEVBQUUsUUFBUTtRQUNwQixlQUFlLEVBQUUsUUFBUTtRQUN6QixrQkFBa0IsRUFBRSxhQUFhO1FBQ2pDLGdCQUFnQixFQUFFLHFEQUFxRDtRQUN2RSxZQUFZLEVBQUUsQ0FBRSxFQUFDLFNBQVMsRUFBQyxLQUFLLEVBQUMsRUFBRSxFQUFDLFNBQVMsRUFBQyxLQUFLLEVBQUMsRUFBRSxFQUFDLFNBQVMsRUFBQyxLQUFLLEVBQUMsQ0FBRTtRQUN6RSxnQkFBZ0IsRUFBRSxLQUFLO1FBQ3ZCLHdCQUF3QixFQUFFLCtCQUErQjtRQUN6RCx1QkFBdUIsRUFBRSxPQUFPO0tBQ2pDLENBQUMsQ0FBQTtJQUNGLE9BQU8sS0FBSyxDQUFDO0FBQ2YsQ0FBQztBQUVELElBQUksQ0FBQyxlQUFlLEVBQUUsR0FBRyxFQUFFO0lBQ3pCLE1BQU0sQ0FBQyxtQkFBVSxDQUFDLGdCQUFnQixDQUFDLGVBQWUsRUFBRSxDQUFDLENBQUMsQ0FBQyxlQUFlLEVBQUUsQ0FBQztBQUMzRSxDQUFDLENBQUMsQ0FBQztBQUVILFNBQVMsY0FBYztJQUNyQixNQUFNLEdBQUcsR0FBRyxJQUFJLEdBQUcsQ0FBQyxHQUFHLEVBQUUsQ0FBQztJQUMxQixNQUFNLEtBQUssR0FBRyxJQUFJLDZDQUFtQixDQUFDLEdBQUcsRUFBRSxhQUFhLEVBQUU7UUFDeEQsV0FBVyxFQUFFLE9BQU87UUFDcEIsVUFBVSxFQUFFLFFBQVE7UUFDcEIsZUFBZSxFQUFFLFFBQVE7UUFDekIsa0JBQWtCLEVBQUUsYUFBYTtRQUNqQyxnQkFBZ0IsRUFBRSxLQUFLO1FBQ3ZCLHVCQUF1QixFQUFFLE9BQU87UUFDaEMsd0JBQXdCLEVBQUUsK0JBQStCO1FBQ3pELE9BQU8sRUFBRSwwQkFBMEI7UUFDbkMsYUFBYSxFQUFFLGtCQUFrQjtRQUNqQyxZQUFZLEVBQUUsQ0FBRSxFQUFDLFNBQVMsRUFBQyxLQUFLLEVBQUMsRUFBRSxFQUFDLFNBQVMsRUFBQyxLQUFLLEVBQUMsRUFBRSxFQUFDLFNBQVMsRUFBQyxLQUFLLEVBQUMsQ0FBRTtLQUMxRSxDQUFDLENBQUE7SUFFRixJQUFJLHlCQUFlLENBQUMsS0FBSyxFQUFFLGVBQWUsRUFBRTtRQUMxQyxXQUFXLEVBQUUsa0RBQWtEO1FBQy9ELGFBQWEsRUFBRSxjQUFjLGVBQWUsMENBQTBDO1FBQ3RGLFdBQVcsRUFBRSxLQUFLO0tBQ25CLENBQUMsQ0FBQztJQUNILE9BQU8sS0FBSyxDQUFDO0FBQ2YsQ0FBQztBQUVELElBQUksQ0FBQyxlQUFlLEVBQUUsR0FBRyxFQUFFO0lBQ3pCLE1BQU0sQ0FBQyxtQkFBVSxDQUFDLGdCQUFnQixDQUFDLGNBQWMsRUFBRSxDQUFDLENBQUMsQ0FBQyxlQUFlLEVBQUUsQ0FBQztBQUMxRSxDQUFDLENBQUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IFN5bnRoVXRpbHMgfSBmcm9tICdAYXdzLWNkay9hc3NlcnQnO1xuaW1wb3J0ICogYXMgY2RrIGZyb20gJ0Bhd3MtY2RrL2NvcmUnO1xuaW1wb3J0IHsgU3RyaW5nUGFyYW1ldGVyIH0gZnJvbSAnQGF3cy1jZGsvYXdzLXNzbSc7XG5pbXBvcnQgeyBQbGF5Ym9va1ByaW1hcnlTdGFjaywgUGxheWJvb2tNZW1iZXJTdGFjayB9IGZyb20gJy4uLy4uLy4uL2xpYi9zaGFycnBsYXlib29rLWNvbnN0cnVjdCc7XG5cbmNvbnN0IFJFU09VUkNFX1BSRUZJWCA9ICdTTzAxMTEnXG5cbmZ1bmN0aW9uIGdldFByaW1hcnlTdGFjaygpOiBjZGsuU3RhY2sge1xuICBjb25zdCBhcHAgPSBuZXcgY2RrLkFwcCgpO1xuICBjb25zdCBzdGFjayA9IG5ldyBQbGF5Ym9va1ByaW1hcnlTdGFjayhhcHAsICdwcmltYXJ5U3RhY2snLCB7XG4gIFx0ZGVzY3JpcHRpb246ICd0ZXN0OycsXG4gICAgc29sdXRpb25JZDogJ1NPMDExMScsXG4gICAgc29sdXRpb25WZXJzaW9uOiAndjEuMS4xJyxcbiAgICBzb2x1dGlvbkRpc3RCdWNrZXQ6ICdzaGFycmJ1a2tpdCcsXG4gICAgc29sdXRpb25EaXN0TmFtZTogJ2F3cy1zZWN1cml0eS1odWItYXV0b21hdGVkLXJlc3BvbnNlLWFuZC1yZW1lZGlhdGlvbicsXG4gICAgcmVtZWRpYXRpb25zOiBbIHtcImNvbnRyb2xcIjonMS4xJ30sIHtcImNvbnRyb2xcIjonMS4yJ30sIHtcImNvbnRyb2xcIjonMS4zJ30gXSxcbiAgICBzZWN1cml0eVN0YW5kYXJkOiAnQ0lTJyxcbiAgICBzZWN1cml0eVN0YW5kYXJkTG9uZ05hbWU6ICdjaXMtYXdzLWZvdW5kYXRpb25zLWJlbmNobWFyaycsXG4gICAgc2VjdXJpdHlTdGFuZGFyZFZlcnNpb246ICcxLjIuMCdcbiAgfSlcbiAgcmV0dXJuIHN0YWNrO1xufVxuXG50ZXN0KCdkZWZhdWx0IHN0YWNrJywgKCkgPT4ge1xuICBleHBlY3QoU3ludGhVdGlscy50b0Nsb3VkRm9ybWF0aW9uKGdldFByaW1hcnlTdGFjaygpKSkudG9NYXRjaFNuYXBzaG90KCk7XG59KTtcblxuZnVuY3Rpb24gZ2V0TWVtYmVyU3RhY2soKTogY2RrLlN0YWNrIHtcbiAgY29uc3QgYXBwID0gbmV3IGNkay5BcHAoKTtcbiAgY29uc3Qgc3RhY2sgPSBuZXcgUGxheWJvb2tNZW1iZXJTdGFjayhhcHAsICdtZW1iZXJTdGFjaycsIHtcbiAgICBkZXNjcmlwdGlvbjogJ3Rlc3Q7JyxcbiAgICBzb2x1dGlvbklkOiAnU08wMTExJyxcbiAgICBzb2x1dGlvblZlcnNpb246ICd2MS4xLjEnLFxuICAgIHNvbHV0aW9uRGlzdEJ1Y2tldDogJ3NoYXJyYnVra2l0JyxcbiAgICBzZWN1cml0eVN0YW5kYXJkOiAnQ0lTJyxcbiAgICBzZWN1cml0eVN0YW5kYXJkVmVyc2lvbjogJzEuMi4wJyxcbiAgICBzZWN1cml0eVN0YW5kYXJkTG9uZ05hbWU6ICdjaXMtYXdzLWZvdW5kYXRpb25zLWJlbmNobWFyaycsXG4gICAgc3NtZG9jczogJ3BsYXlib29rcy9DSVMxMjAvc3NtZG9jcycsXG4gICAgY29tbW9uU2NyaXB0czogJ3BsYXlib29rcy9jb21tb24nLFxuICAgIHJlbWVkaWF0aW9uczogWyB7XCJjb250cm9sXCI6JzEuMyd9LCB7XCJjb250cm9sXCI6JzEuNSd9LCB7XCJjb250cm9sXCI6JzIuMSd9IF1cbiAgfSlcblxuICBuZXcgU3RyaW5nUGFyYW1ldGVyKHN0YWNrLCBgUmVtYXAgQ0lTIDQuMmAsIHtcbiAgICBkZXNjcmlwdGlvbjogYFJlbWFwIHRoZSBDSVMgNC4yIGZpbmRpbmcgdG8gQ0lTIDQuMSByZW1lZGlhdGlvbmAsXG4gICAgcGFyYW1ldGVyTmFtZTogYC9Tb2x1dGlvbnMvJHtSRVNPVVJDRV9QUkVGSVh9L2Npcy1hd3MtZm91bmRhdGlvbnMtYmVuY2htYXJrLzEuMi4wLTQuMmAsXG4gICAgc3RyaW5nVmFsdWU6ICc0LjEnXG4gIH0pO1xuICByZXR1cm4gc3RhY2s7XG59XG5cbnRlc3QoJ2RlZmF1bHQgc3RhY2snLCAoKSA9PiB7XG4gIGV4cGVjdChTeW50aFV0aWxzLnRvQ2xvdWRGb3JtYXRpb24oZ2V0TWVtYmVyU3RhY2soKSkpLnRvTWF0Y2hTbmFwc2hvdCgpO1xufSk7XG4iXX0=