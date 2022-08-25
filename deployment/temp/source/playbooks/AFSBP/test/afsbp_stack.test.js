"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("@aws-cdk/assert");
const cdk = require("@aws-cdk/core");
const sharrplaybook_construct_1 = require("../../../lib/sharrplaybook-construct");
function getPrimaryStack() {
    const app = new cdk.App();
    const stack = new sharrplaybook_construct_1.PlaybookPrimaryStack(app, 'primaryStack', {
        description: 'test;',
        solutionId: 'SO0111',
        solutionVersion: 'v1.1.1',
        solutionDistBucket: 'sharrbukkit',
        solutionDistName: 'aws-security-hub-automated-response-and-remediation',
        remediations: [
            { "control": 'Example.3' }, { "control": 'Example.5' }, { "control": 'Example.1' }
        ],
        securityStandard: 'AFSBP',
        securityStandardLongName: 'aws-foundational-security-best-practices',
        securityStandardVersion: '1.0.0'
    });
    return stack;
}
test('Primary Stack - AFSBP', () => {
    expect(assert_1.SynthUtils.toCloudFormation(getPrimaryStack())).toMatchSnapshot();
});
function getMemberStack() {
    const app = new cdk.App();
    const stack = new sharrplaybook_construct_1.PlaybookMemberStack(app, 'memberStack', {
        description: 'test;',
        solutionId: 'SO0111',
        solutionVersion: 'v1.1.1',
        solutionDistBucket: 'sharrbukkit',
        securityStandard: 'AFSBP',
        securityStandardLongName: 'aws-foundational-security-best-practices',
        securityStandardVersion: '1.0.0',
        ssmdocs: 'playbooks/AFSBP/ssmdocs',
        commonScripts: 'playbooks/common',
        remediations: [{ "control": 'EC2.1' }, { "control": 'RDS.1' }, { "control": 'Lambda.1' }]
    });
    return stack;
}
test('Member Stack - AFSBP', () => {
    expect(assert_1.SynthUtils.toCloudFormation(getMemberStack())).toMatchSnapshot();
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWZzYnBfc3RhY2sudGVzdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImFmc2JwX3N0YWNrLnRlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQSw0Q0FBaUY7QUFDakYscUNBQXFDO0FBQ3JDLGtGQUFpRztBQUVqRyxTQUFTLGVBQWU7SUFDdEIsTUFBTSxHQUFHLEdBQUcsSUFBSSxHQUFHLENBQUMsR0FBRyxFQUFFLENBQUM7SUFDMUIsTUFBTSxLQUFLLEdBQUcsSUFBSSw4Q0FBb0IsQ0FBQyxHQUFHLEVBQUUsY0FBYyxFQUFFO1FBQzNELFdBQVcsRUFBRSxPQUFPO1FBQ25CLFVBQVUsRUFBRSxRQUFRO1FBQ3BCLGVBQWUsRUFBRSxRQUFRO1FBQ3pCLGtCQUFrQixFQUFFLGFBQWE7UUFDakMsZ0JBQWdCLEVBQUUscURBQXFEO1FBQ3ZFLFlBQVksRUFBRTtZQUNaLEVBQUMsU0FBUyxFQUFFLFdBQVcsRUFBQyxFQUFFLEVBQUMsU0FBUyxFQUFDLFdBQVcsRUFBQyxFQUFFLEVBQUMsU0FBUyxFQUFDLFdBQVcsRUFBQztTQUMzRTtRQUNELGdCQUFnQixFQUFFLE9BQU87UUFDekIsd0JBQXdCLEVBQUUsMENBQTBDO1FBQ3BFLHVCQUF1QixFQUFFLE9BQU87S0FDakMsQ0FBQyxDQUFBO0lBQ0YsT0FBTyxLQUFLLENBQUM7QUFDZixDQUFDO0FBRUQsSUFBSSxDQUFDLHVCQUF1QixFQUFFLEdBQUcsRUFBRTtJQUNqQyxNQUFNLENBQUMsbUJBQVUsQ0FBQyxnQkFBZ0IsQ0FBQyxlQUFlLEVBQUUsQ0FBQyxDQUFDLENBQUMsZUFBZSxFQUFFLENBQUM7QUFDM0UsQ0FBQyxDQUFDLENBQUM7QUFFSCxTQUFTLGNBQWM7SUFDckIsTUFBTSxHQUFHLEdBQUcsSUFBSSxHQUFHLENBQUMsR0FBRyxFQUFFLENBQUM7SUFDMUIsTUFBTSxLQUFLLEdBQUcsSUFBSSw2Q0FBbUIsQ0FBQyxHQUFHLEVBQUUsYUFBYSxFQUFFO1FBQ3hELFdBQVcsRUFBRSxPQUFPO1FBQ3BCLFVBQVUsRUFBRSxRQUFRO1FBQ3BCLGVBQWUsRUFBRSxRQUFRO1FBQ3pCLGtCQUFrQixFQUFFLGFBQWE7UUFDakMsZ0JBQWdCLEVBQUUsT0FBTztRQUN6Qix3QkFBd0IsRUFBRSwwQ0FBMEM7UUFDcEUsdUJBQXVCLEVBQUUsT0FBTztRQUNoQyxPQUFPLEVBQUUseUJBQXlCO1FBQ2xDLGFBQWEsRUFBRSxrQkFBa0I7UUFDakMsWUFBWSxFQUFFLENBQUUsRUFBRSxTQUFTLEVBQUUsT0FBTyxFQUFDLEVBQUUsRUFBQyxTQUFTLEVBQUUsT0FBTyxFQUFDLEVBQUUsRUFBQyxTQUFTLEVBQUMsVUFBVSxFQUFDLENBQUU7S0FDdEYsQ0FBQyxDQUFBO0lBQ0YsT0FBTyxLQUFLLENBQUM7QUFDZixDQUFDO0FBRUQsSUFBSSxDQUFDLHNCQUFzQixFQUFFLEdBQUcsRUFBRTtJQUNoQyxNQUFNLENBQUMsbUJBQVUsQ0FBQyxnQkFBZ0IsQ0FBQyxjQUFjLEVBQUUsQ0FBQyxDQUFDLENBQUMsZUFBZSxFQUFFLENBQUM7QUFDMUUsQ0FBQyxDQUFDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBleHBlY3QgYXMgZXhwZWN0Q0RLLCBtYXRjaFRlbXBsYXRlLCBTeW50aFV0aWxzIH0gZnJvbSAnQGF3cy1jZGsvYXNzZXJ0JztcbmltcG9ydCAqIGFzIGNkayBmcm9tICdAYXdzLWNkay9jb3JlJztcbmltcG9ydCB7IFBsYXlib29rUHJpbWFyeVN0YWNrLCBQbGF5Ym9va01lbWJlclN0YWNrIH0gZnJvbSAnLi4vLi4vLi4vbGliL3NoYXJycGxheWJvb2stY29uc3RydWN0JztcblxuZnVuY3Rpb24gZ2V0UHJpbWFyeVN0YWNrKCk6IGNkay5TdGFjayB7XG4gIGNvbnN0IGFwcCA9IG5ldyBjZGsuQXBwKCk7XG4gIGNvbnN0IHN0YWNrID0gbmV3IFBsYXlib29rUHJpbWFyeVN0YWNrKGFwcCwgJ3ByaW1hcnlTdGFjaycsIHtcbiAgXHRkZXNjcmlwdGlvbjogJ3Rlc3Q7JyxcbiAgICBzb2x1dGlvbklkOiAnU08wMTExJyxcbiAgICBzb2x1dGlvblZlcnNpb246ICd2MS4xLjEnLFxuICAgIHNvbHV0aW9uRGlzdEJ1Y2tldDogJ3NoYXJyYnVra2l0JyxcbiAgICBzb2x1dGlvbkRpc3ROYW1lOiAnYXdzLXNlY3VyaXR5LWh1Yi1hdXRvbWF0ZWQtcmVzcG9uc2UtYW5kLXJlbWVkaWF0aW9uJyxcbiAgICByZW1lZGlhdGlvbnM6IFsgXG4gICAgICB7XCJjb250cm9sXCI6ICdFeGFtcGxlLjMnfSwge1wiY29udHJvbFwiOidFeGFtcGxlLjUnfSwge1wiY29udHJvbFwiOidFeGFtcGxlLjEnfSBcbiAgICBdLFxuICAgIHNlY3VyaXR5U3RhbmRhcmQ6ICdBRlNCUCcsXG4gICAgc2VjdXJpdHlTdGFuZGFyZExvbmdOYW1lOiAnYXdzLWZvdW5kYXRpb25hbC1zZWN1cml0eS1iZXN0LXByYWN0aWNlcycsXG4gICAgc2VjdXJpdHlTdGFuZGFyZFZlcnNpb246ICcxLjAuMCdcbiAgfSlcbiAgcmV0dXJuIHN0YWNrO1xufVxuXG50ZXN0KCdQcmltYXJ5IFN0YWNrIC0gQUZTQlAnLCAoKSA9PiB7XG4gIGV4cGVjdChTeW50aFV0aWxzLnRvQ2xvdWRGb3JtYXRpb24oZ2V0UHJpbWFyeVN0YWNrKCkpKS50b01hdGNoU25hcHNob3QoKTtcbn0pO1xuXG5mdW5jdGlvbiBnZXRNZW1iZXJTdGFjaygpOiBjZGsuU3RhY2sge1xuICBjb25zdCBhcHAgPSBuZXcgY2RrLkFwcCgpO1xuICBjb25zdCBzdGFjayA9IG5ldyBQbGF5Ym9va01lbWJlclN0YWNrKGFwcCwgJ21lbWJlclN0YWNrJywge1xuICAgIGRlc2NyaXB0aW9uOiAndGVzdDsnLFxuICAgIHNvbHV0aW9uSWQ6ICdTTzAxMTEnLFxuICAgIHNvbHV0aW9uVmVyc2lvbjogJ3YxLjEuMScsXG4gICAgc29sdXRpb25EaXN0QnVja2V0OiAnc2hhcnJidWtraXQnLFxuICAgIHNlY3VyaXR5U3RhbmRhcmQ6ICdBRlNCUCcsXG4gICAgc2VjdXJpdHlTdGFuZGFyZExvbmdOYW1lOiAnYXdzLWZvdW5kYXRpb25hbC1zZWN1cml0eS1iZXN0LXByYWN0aWNlcycsXG4gICAgc2VjdXJpdHlTdGFuZGFyZFZlcnNpb246ICcxLjAuMCcsXG4gICAgc3NtZG9jczogJ3BsYXlib29rcy9BRlNCUC9zc21kb2NzJyxcbiAgICBjb21tb25TY3JpcHRzOiAncGxheWJvb2tzL2NvbW1vbicsXG4gICAgcmVtZWRpYXRpb25zOiBbIHsgXCJjb250cm9sXCI6ICdFQzIuMSd9LCB7XCJjb250cm9sXCI6ICdSRFMuMSd9LCB7XCJjb250cm9sXCI6J0xhbWJkYS4xJ30gXVxuICB9KVxuICByZXR1cm4gc3RhY2s7XG59XG5cbnRlc3QoJ01lbWJlciBTdGFjayAtIEFGU0JQJywgKCkgPT4ge1xuICBleHBlY3QoU3ludGhVdGlscy50b0Nsb3VkRm9ybWF0aW9uKGdldE1lbWJlclN0YWNrKCkpKS50b01hdGNoU25hcHNob3QoKTtcbn0pOyJdfQ==