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
const admin_account_parm_construct_1 = require("../lib/admin_account_parm-construct");
function createAdminAccountParm() {
    const app = new core_1.App();
    const stack = new core_1.Stack(app, 'testStack', {
        stackName: 'testStack'
    });
    const admin = new admin_account_parm_construct_1.AdminAccountParm(stack, 'roles', {
        solutionId: 'SO0111'
    });
    return stack;
}
test('AdminParm Test Stack', () => {
    expect(assert_1.SynthUtils.toCloudFormation(createAdminAccountParm())).toMatchSnapshot();
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWRtaW5fYWNjb3VudF9wYXJtLnRlc3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJhZG1pbl9hY2NvdW50X3Bhcm0udGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7Ozs7Ozs7Ozs7K0VBYStFOztBQUUvRSw0Q0FBaUY7QUFDakYsZ0NBQThCO0FBQzlCLHdDQUEyQztBQUMzQyxzRkFBdUU7QUFFdkUsU0FBUyxzQkFBc0I7SUFDM0IsTUFBTSxHQUFHLEdBQUcsSUFBSSxVQUFHLEVBQUUsQ0FBQztJQUN0QixNQUFNLEtBQUssR0FBRyxJQUFJLFlBQUssQ0FBQyxHQUFHLEVBQUUsV0FBVyxFQUFFO1FBQ3RDLFNBQVMsRUFBRSxXQUFXO0tBQ3pCLENBQUMsQ0FBQztJQUNILE1BQU0sS0FBSyxHQUFHLElBQUksK0NBQWdCLENBQUMsS0FBSyxFQUFFLE9BQU8sRUFBRTtRQUNqRCxVQUFVLEVBQUUsUUFBUTtLQUNyQixDQUFDLENBQUE7SUFDRixPQUFPLEtBQUssQ0FBQztBQUNqQixDQUFDO0FBQ0QsSUFBSSxDQUFDLHNCQUFzQixFQUFFLEdBQUcsRUFBRTtJQUM5QixNQUFNLENBQUMsbUJBQVUsQ0FBQyxnQkFBZ0IsQ0FBQyxzQkFBc0IsRUFBRSxDQUFDLENBQUMsQ0FBQyxlQUFlLEVBQUUsQ0FBQztBQUNwRixDQUFDLENBQUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICogIENvcHlyaWdodCBBbWF6b24uY29tLCBJbmMuIG9yIGl0cyBhZmZpbGlhdGVzLiBBbGwgUmlnaHRzIFJlc2VydmVkLiAgICpcbiAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICpcbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wICh0aGUgXCJMaWNlbnNlXCIpLiBZb3UgbWF5ICAgKlxuICogIG5vdCB1c2UgdGhpcyBmaWxlIGV4Y2VwdCBpbiBjb21wbGlhbmNlIHdpdGggdGhlIExpY2Vuc2UuIEEgY29weSBvZiB0aGUgICAgKlxuICogIExpY2Vuc2UgaXMgbG9jYXRlZCBhdCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKlxuICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKlxuICogICAgICBodHRwOi8vd3d3LmFwYWNoZS5vcmcvbGljZW5zZXMvTElDRU5TRS0yLjAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKlxuICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKlxuICogIG9yIGluIHRoZSAnbGljZW5zZScgZmlsZSBhY2NvbXBhbnlpbmcgdGhpcyBmaWxlLiBUaGlzIGZpbGUgaXMgZGlzdHJpYnV0ZWQgKlxuICogIG9uIGFuICdBUyBJUycgQkFTSVMsIFdJVEhPVVQgV0FSUkFOVElFUyBPUiBDT05ESVRJT05TIE9GIEFOWSBLSU5ELCAgICAgICAgKlxuICogIGV4cHJlc3Mgb3IgaW1wbGllZC4gU2VlIHRoZSBMaWNlbnNlIGZvciB0aGUgc3BlY2lmaWMgbGFuZ3VhZ2UgZ292ZXJuaW5nICAgKlxuICogIHBlcm1pc3Npb25zIGFuZCBsaW1pdGF0aW9ucyB1bmRlciB0aGUgTGljZW5zZS4gICAgICAgICAgICAgICAgICAgICAgICAgICAgKlxuICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG5pbXBvcnQgeyBleHBlY3QgYXMgZXhwZWN0Q0RLLCBtYXRjaFRlbXBsYXRlLCBTeW50aFV0aWxzIH0gZnJvbSAnQGF3cy1jZGsvYXNzZXJ0JztcbmltcG9ydCAnQGF3cy1jZGsvYXNzZXJ0L2plc3QnO1xuaW1wb3J0IHsgQXBwLCBTdGFjayB9IGZyb20gJ0Bhd3MtY2RrL2NvcmUnO1xuaW1wb3J0IHsgQWRtaW5BY2NvdW50UGFybSB9IGZyb20gJy4uL2xpYi9hZG1pbl9hY2NvdW50X3Bhcm0tY29uc3RydWN0JztcbiBcbmZ1bmN0aW9uIGNyZWF0ZUFkbWluQWNjb3VudFBhcm0oKTogU3RhY2sge1xuICAgIGNvbnN0IGFwcCA9IG5ldyBBcHAoKTtcbiAgICBjb25zdCBzdGFjayA9IG5ldyBTdGFjayhhcHAsICd0ZXN0U3RhY2snLCB7XG4gICAgICAgIHN0YWNrTmFtZTogJ3Rlc3RTdGFjaydcbiAgICB9KTtcbiAgICBjb25zdCBhZG1pbiA9IG5ldyBBZG1pbkFjY291bnRQYXJtKHN0YWNrLCAncm9sZXMnLCB7XG4gICAgICBzb2x1dGlvbklkOiAnU08wMTExJ1xuICAgIH0pXG4gICAgcmV0dXJuIHN0YWNrO1xufVxudGVzdCgnQWRtaW5QYXJtIFRlc3QgU3RhY2snLCAoKSA9PiB7XG4gICAgZXhwZWN0KFN5bnRoVXRpbHMudG9DbG91ZEZvcm1hdGlvbihjcmVhdGVBZG1pbkFjY291bnRQYXJtKCkpKS50b01hdGNoU25hcHNob3QoKTtcbn0pO1xuICJdfQ==