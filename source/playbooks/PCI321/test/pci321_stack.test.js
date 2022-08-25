"use strict";
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
        remediations: [{ "control": 'PCI.AutoScaling.1' }, { "control": 'PCI.EC2.6' }, { "control": 'PCI.IAM.8' }],
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
        securityStandard: 'PCI',
        securityStandardVersion: '3.2.1',
        securityStandardLongName: 'pci-dss',
        ssmdocs: 'playbooks/PCI321/ssmdocs',
        commonScripts: 'playbooks/common',
        remediations: [{ "control": 'PCI.AutoScaling.1' }, { "control": 'PCI.EC2.6' }, { "control": 'PCI.IAM.8' }]
    });
    return stack;
}
test('default stack', () => {
    expect(assert_1.SynthUtils.toCloudFormation(getMemberStack())).toMatchSnapshot();
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGNpMzIxX3N0YWNrLnRlc3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJwY2kzMjFfc3RhY2sudGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFBLDRDQUE2QztBQUM3QyxxQ0FBcUM7QUFDckMsa0ZBQWlHO0FBRWpHLFNBQVMsWUFBWTtJQUNuQixNQUFNLEdBQUcsR0FBRyxJQUFJLEdBQUcsQ0FBQyxHQUFHLEVBQUUsQ0FBQztJQUMxQixNQUFNLEtBQUssR0FBRyxJQUFJLDhDQUFvQixDQUFDLEdBQUcsRUFBRSxPQUFPLEVBQUU7UUFDbkQsV0FBVyxFQUFFLE9BQU87UUFDcEIsVUFBVSxFQUFFLFFBQVE7UUFDcEIsZUFBZSxFQUFFLFFBQVE7UUFDekIsa0JBQWtCLEVBQUUsYUFBYTtRQUNqQyxnQkFBZ0IsRUFBRSxxREFBcUQ7UUFDdkUsWUFBWSxFQUFFLENBQUUsRUFBQyxTQUFTLEVBQUMsbUJBQW1CLEVBQUMsRUFBRSxFQUFDLFNBQVMsRUFBQyxXQUFXLEVBQUMsRUFBRSxFQUFDLFNBQVMsRUFBQyxXQUFXLEVBQUMsQ0FBRTtRQUNuRyxnQkFBZ0IsRUFBRSxLQUFLO1FBQ3ZCLHdCQUF3QixFQUFFLFNBQVM7UUFDbkMsdUJBQXVCLEVBQUUsT0FBTztLQUNqQyxDQUFDLENBQUE7SUFDRixPQUFPLEtBQUssQ0FBQztBQUNmLENBQUM7QUFFRCxJQUFJLENBQUMsZUFBZSxFQUFFLEdBQUcsRUFBRTtJQUN6QixNQUFNLENBQUMsbUJBQVUsQ0FBQyxnQkFBZ0IsQ0FBQyxZQUFZLEVBQUUsQ0FBQyxDQUFDLENBQUMsZUFBZSxFQUFFLENBQUM7QUFDeEUsQ0FBQyxDQUFDLENBQUM7QUFFSCxTQUFTLGNBQWM7SUFDckIsTUFBTSxHQUFHLEdBQUcsSUFBSSxHQUFHLENBQUMsR0FBRyxFQUFFLENBQUM7SUFDMUIsTUFBTSxLQUFLLEdBQUcsSUFBSSw2Q0FBbUIsQ0FBQyxHQUFHLEVBQUUsYUFBYSxFQUFFO1FBQ3hELFdBQVcsRUFBRSxPQUFPO1FBQ3BCLFVBQVUsRUFBRSxRQUFRO1FBQ3BCLGVBQWUsRUFBRSxRQUFRO1FBQ3pCLGtCQUFrQixFQUFFLGFBQWE7UUFDakMsZ0JBQWdCLEVBQUUsS0FBSztRQUN2Qix1QkFBdUIsRUFBRSxPQUFPO1FBQ2hDLHdCQUF3QixFQUFFLFNBQVM7UUFDbkMsT0FBTyxFQUFFLDBCQUEwQjtRQUNuQyxhQUFhLEVBQUUsa0JBQWtCO1FBQ2pDLFlBQVksRUFBRSxDQUFFLEVBQUMsU0FBUyxFQUFDLG1CQUFtQixFQUFDLEVBQUUsRUFBQyxTQUFTLEVBQUMsV0FBVyxFQUFDLEVBQUUsRUFBQyxTQUFTLEVBQUMsV0FBVyxFQUFDLENBQUU7S0FDcEcsQ0FBQyxDQUFBO0lBQ0YsT0FBTyxLQUFLLENBQUM7QUFDZixDQUFDO0FBRUQsSUFBSSxDQUFDLGVBQWUsRUFBRSxHQUFHLEVBQUU7SUFDekIsTUFBTSxDQUFDLG1CQUFVLENBQUMsZ0JBQWdCLENBQUMsY0FBYyxFQUFFLENBQUMsQ0FBQyxDQUFDLGVBQWUsRUFBRSxDQUFDO0FBQzFFLENBQUMsQ0FBQyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgU3ludGhVdGlscyB9IGZyb20gJ0Bhd3MtY2RrL2Fzc2VydCc7XG5pbXBvcnQgKiBhcyBjZGsgZnJvbSAnQGF3cy1jZGsvY29yZSc7XG5pbXBvcnQgeyBQbGF5Ym9va1ByaW1hcnlTdGFjaywgUGxheWJvb2tNZW1iZXJTdGFjayB9IGZyb20gJy4uLy4uLy4uL2xpYi9zaGFycnBsYXlib29rLWNvbnN0cnVjdCc7XG5cbmZ1bmN0aW9uIGdldFRlc3RTdGFjaygpOiBjZGsuU3RhY2sge1xuICBjb25zdCBhcHAgPSBuZXcgY2RrLkFwcCgpO1xuICBjb25zdCBzdGFjayA9IG5ldyBQbGF5Ym9va1ByaW1hcnlTdGFjayhhcHAsICdzdGFjaycsIHtcbiAgICBkZXNjcmlwdGlvbjogJ3Rlc3Q7JyxcbiAgICBzb2x1dGlvbklkOiAnU08wMTExJyxcbiAgICBzb2x1dGlvblZlcnNpb246ICd2MS4xLjEnLFxuICAgIHNvbHV0aW9uRGlzdEJ1Y2tldDogJ3NoYXJyYnVra2l0JyxcbiAgICBzb2x1dGlvbkRpc3ROYW1lOiAnYXdzLXNlY3VyaXR5LWh1Yi1hdXRvbWF0ZWQtcmVzcG9uc2UtYW5kLXJlbWVkaWF0aW9uJyxcbiAgICByZW1lZGlhdGlvbnM6IFsge1wiY29udHJvbFwiOidQQ0kuQXV0b1NjYWxpbmcuMSd9LCB7XCJjb250cm9sXCI6J1BDSS5FQzIuNid9LCB7XCJjb250cm9sXCI6J1BDSS5JQU0uOCd9IF0sXG4gICAgc2VjdXJpdHlTdGFuZGFyZDogJ1BDSScsXG4gICAgc2VjdXJpdHlTdGFuZGFyZExvbmdOYW1lOiAncGNpLWRzcycsXG4gICAgc2VjdXJpdHlTdGFuZGFyZFZlcnNpb246ICczLjIuMSdcbiAgfSlcbiAgcmV0dXJuIHN0YWNrO1xufVxuXG50ZXN0KCdkZWZhdWx0IHN0YWNrJywgKCkgPT4ge1xuICBleHBlY3QoU3ludGhVdGlscy50b0Nsb3VkRm9ybWF0aW9uKGdldFRlc3RTdGFjaygpKSkudG9NYXRjaFNuYXBzaG90KCk7XG59KTtcblxuZnVuY3Rpb24gZ2V0TWVtYmVyU3RhY2soKTogY2RrLlN0YWNrIHtcbiAgY29uc3QgYXBwID0gbmV3IGNkay5BcHAoKTtcbiAgY29uc3Qgc3RhY2sgPSBuZXcgUGxheWJvb2tNZW1iZXJTdGFjayhhcHAsICdtZW1iZXJTdGFjaycsIHtcbiAgICBkZXNjcmlwdGlvbjogJ3Rlc3Q7JyxcbiAgICBzb2x1dGlvbklkOiAnU08wMTExJyxcbiAgICBzb2x1dGlvblZlcnNpb246ICd2MS4xLjEnLFxuICAgIHNvbHV0aW9uRGlzdEJ1Y2tldDogJ3NoYXJyYnVra2l0JyxcbiAgICBzZWN1cml0eVN0YW5kYXJkOiAnUENJJyxcbiAgICBzZWN1cml0eVN0YW5kYXJkVmVyc2lvbjogJzMuMi4xJyxcbiAgICBzZWN1cml0eVN0YW5kYXJkTG9uZ05hbWU6ICdwY2ktZHNzJyxcbiAgICBzc21kb2NzOiAncGxheWJvb2tzL1BDSTMyMS9zc21kb2NzJyxcbiAgICBjb21tb25TY3JpcHRzOiAncGxheWJvb2tzL2NvbW1vbicsXG4gICAgcmVtZWRpYXRpb25zOiBbIHtcImNvbnRyb2xcIjonUENJLkF1dG9TY2FsaW5nLjEnfSwge1wiY29udHJvbFwiOidQQ0kuRUMyLjYnfSwge1wiY29udHJvbFwiOidQQ0kuSUFNLjgnfSBdXG4gIH0pXG4gIHJldHVybiBzdGFjaztcbn1cblxudGVzdCgnZGVmYXVsdCBzdGFjaycsICgpID0+IHtcbiAgZXhwZWN0KFN5bnRoVXRpbHMudG9DbG91ZEZvcm1hdGlvbihnZXRNZW1iZXJTdGFjaygpKSkudG9NYXRjaFNuYXBzaG90KCk7XG59KTsiXX0=