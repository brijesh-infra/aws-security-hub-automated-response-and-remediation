#!/usr/bin/env node
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
exports.OrchestratorMemberRole = void 0;
const core_1 = require("@aws-cdk/core");
const aws_iam_1 = require("@aws-cdk/aws-iam");
class OrchestratorMemberRole extends core_1.Construct {
    constructor(scope, id, props) {
        super(scope, id);
        const RESOURCE_PREFIX = props.solutionId.replace(/^DEV-/, ''); // prefix on every resource name
        const stack = core_1.Stack.of(this);
        const memberPolicy = new aws_iam_1.PolicyDocument();
        /**
         * @description Cross-account permissions for Orchestration role
         * @type {PolicyStatement}
         */
        const iamPerms = new aws_iam_1.PolicyStatement();
        iamPerms.addActions("iam:PassRole", "iam:GetRole");
        iamPerms.effect = aws_iam_1.Effect.ALLOW;
        iamPerms.addResources(`arn:${stack.partition}:iam::${stack.account}:role/${RESOURCE_PREFIX}-*`);
        memberPolicy.addStatements(iamPerms);
        const ssmRWPerms = new aws_iam_1.PolicyStatement();
        ssmRWPerms.addActions("ssm:StartAutomationExecution");
        ssmRWPerms.addResources(stack.formatArn({
            service: 'ssm',
            region: '*',
            resource: 'document',
            resourceName: 'SHARR-*',
            arnFormat: core_1.ArnFormat.SLASH_RESOURCE_NAME
        }), stack.formatArn({
            service: 'ssm',
            region: '*',
            resource: 'automation-definition',
            resourceName: '*',
            arnFormat: core_1.ArnFormat.SLASH_RESOURCE_NAME
        }), stack.formatArn({
            service: 'ssm',
            region: '*',
            resource: 'automation-definition',
            account: '',
            resourceName: '*',
            arnFormat: core_1.ArnFormat.SLASH_RESOURCE_NAME
        }), stack.formatArn({
            service: 'ssm',
            region: '*',
            resource: 'automation-execution',
            resourceName: '*',
            arnFormat: core_1.ArnFormat.SLASH_RESOURCE_NAME
        }));
        memberPolicy.addStatements(ssmRWPerms);
        memberPolicy.addStatements(
        // The actions in your policy do not support resource-level permissions and require you to choose All resources
        new aws_iam_1.PolicyStatement({
            actions: [
                'ssm:DescribeAutomationExecutions',
                'ssm:GetAutomationExecution'
            ],
            resources: ['*'],
            effect: aws_iam_1.Effect.ALLOW
        }), new aws_iam_1.PolicyStatement({
            actions: [
                'ssm:DescribeDocument'
            ],
            resources: [`arn:${stack.partition}:ssm:*:*:document/*`],
            effect: aws_iam_1.Effect.ALLOW
        }), new aws_iam_1.PolicyStatement({
            actions: [
                'ssm:GetParameters',
                'ssm:GetParameter'
            ],
            resources: [`arn:${stack.partition}:ssm:*:*:parameter/Solutions/SO0111/*`],
            effect: aws_iam_1.Effect.ALLOW
        }), new aws_iam_1.PolicyStatement({
            actions: [
                "config:DescribeConfigRules"
            ],
            resources: ["*"],
            effect: aws_iam_1.Effect.ALLOW
        }));
        const sechubPerms = new aws_iam_1.PolicyStatement();
        sechubPerms.addActions("cloudwatch:PutMetricData");
        sechubPerms.addActions("securityhub:BatchUpdateFindings");
        sechubPerms.effect = aws_iam_1.Effect.ALLOW;
        sechubPerms.addResources("*");
        memberPolicy.addStatements(sechubPerms);
        let principalPolicyStatement = new aws_iam_1.PolicyStatement();
        principalPolicyStatement.addActions("sts:AssumeRole");
        principalPolicyStatement.effect = aws_iam_1.Effect.ALLOW;
        let roleprincipal = new aws_iam_1.ArnPrincipal(`arn:${stack.partition}:iam::${props.adminAccountId}:role/${props.adminRoleName}`);
        let principals = new aws_iam_1.CompositePrincipal(roleprincipal);
        principals.addToPolicy(principalPolicyStatement);
        let serviceprincipal = new aws_iam_1.ServicePrincipal('ssm.amazonaws.com');
        principals.addPrincipals(serviceprincipal);
        let memberRole = new aws_iam_1.Role(this, 'MemberAccountRole', {
            assumedBy: principals,
            inlinePolicies: {
                'member_orchestrator': memberPolicy
            },
            roleName: `${RESOURCE_PREFIX}-SHARR-Orchestrator-Member`
        });
        const memberRoleResource = memberRole.node.findChild('Resource');
        memberRoleResource.cfnOptions.metadata = {
            cfn_nag: {
                rules_to_suppress: [{
                        id: 'W11',
                        reason: 'Resource * is required due to the administrative nature of the solution.'
                    }, {
                        id: 'W28',
                        reason: 'Static names chosen intentionally to provide integration in cross-account permissions'
                    }]
            }
        };
    }
}
exports.OrchestratorMemberRole = OrchestratorMemberRole;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3JjaGVzdHJhdG9yX3JvbGVzLWNvbnN0cnVjdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIm9yY2hlc3RyYXRvcl9yb2xlcy1jb25zdHJ1Y3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFDQTs7Ozs7Ozs7Ozs7OzsrRUFhK0U7OztBQUUvRSx3Q0FHcUM7QUFDckMsOENBUzBCO0FBUTFCLE1BQWEsc0JBQXVCLFNBQVEsZ0JBQVM7SUFDbkQsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUFvQjtRQUM1RCxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBQ2pCLE1BQU0sZUFBZSxHQUFHLEtBQUssQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLGdDQUFnQztRQUM5RixNQUFNLEtBQUssR0FBRyxZQUFLLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQzdCLE1BQU0sWUFBWSxHQUFHLElBQUksd0JBQWMsRUFBRSxDQUFDO1FBRTFDOzs7V0FHRztRQUNILE1BQU0sUUFBUSxHQUFHLElBQUkseUJBQWUsRUFBRSxDQUFDO1FBQ3ZDLFFBQVEsQ0FBQyxVQUFVLENBQ2YsY0FBYyxFQUNkLGFBQWEsQ0FDaEIsQ0FBQTtRQUNELFFBQVEsQ0FBQyxNQUFNLEdBQUcsZ0JBQU0sQ0FBQyxLQUFLLENBQUE7UUFDOUIsUUFBUSxDQUFDLFlBQVksQ0FDakIsT0FBTyxLQUFLLENBQUMsU0FBUyxTQUFTLEtBQUssQ0FBQyxPQUFPLFNBQVMsZUFBZSxJQUFJLENBQzNFLENBQUM7UUFDRixZQUFZLENBQUMsYUFBYSxDQUFDLFFBQVEsQ0FBQyxDQUFBO1FBRXBDLE1BQU0sVUFBVSxHQUFHLElBQUkseUJBQWUsRUFBRSxDQUFBO1FBQ3hDLFVBQVUsQ0FBQyxVQUFVLENBQ2pCLDhCQUE4QixDQUNqQyxDQUFBO1FBQ0QsVUFBVSxDQUFDLFlBQVksQ0FDbkIsS0FBSyxDQUFDLFNBQVMs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O1FBRUYsSUFBSSxVQUFVLEdBQUcsSUFBSSw0QkFBa0IsQ0FBQyxhQUFhLENBQUMsQ0FBQztRQUN2RCxVQUFVLENBQUMsV0FBVyxDQUFDLHdCQUF3QixDQUFDLENBQUM7UUFFakQsSUFBSSxnQkFBZ0IsR0FBRyxJQUFJLDBCQUFnQixDQUFDLG1CQUFtQixDQUFDLENBQUE7UUFDaEUsVUFBVSxDQUFDLGFBQWEsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDO1FBRTNDLElBQUksVUFBVSxHQUFHLElBQUksY0FBSSxDQUFDLElBQUksRUFBRSxtQkFBbUIsRUFBRTtZQUNqRCxTQUFTLEVBQUUsVUFBVTtZQUNyQixjQUFjLEVBQUU7Z0JBQ1oscUJBQXFCLEVBQUUsWUFBWTthQUN0QztZQUNELFFBQVEsRUFBRSxHQUFHLGVBQWUsNEJBQTRCO1NBQzNELENBQUMsQ0FBQztRQUVILE1BQU0sa0JBQWtCLEdBQUcsVUFBVSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsVUFBVSxDQUFZLENBQUM7UUFFNUUsa0JBQWtCLENBQUMsVUFBVSxDQUFDLFFBQVEsR0FBRztZQUNyQyxPQUFPLEVBQUU7Z0JBQ0wsaUJBQWlCLEVBQUUsQ0FBQzt3QkFDaEIsRUFBRSxFQUFFLEtBQUs7d0JBQ1QsTUFBTSxFQUFFLDBFQUEwRTtxQkFDckYsRUFBQzt3QkFDRSxFQUFFLEVBQUUsS0FBSzt3QkFDVCxNQUFNLEVBQUUsdUZBQXVGO3FCQUNsRyxDQUFDO2FBQ0w7U0FDSixDQUFBO0lBQ0gsQ0FBQztDQUNGO0FBMUlELHdEQTBJQyIsInNvdXJjZXNDb250ZW50IjpbIiMhL3Vzci9iaW4vZW52IG5vZGVcbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICogIENvcHlyaWdodCBBbWF6b24uY29tLCBJbmMuIG9yIGl0cyBhZmZpbGlhdGVzLiBBbGwgUmlnaHRzIFJlc2VydmVkLiAgICpcbiAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICpcbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wICh0aGUgXCJMaWNlbnNlXCIpLiBZb3UgbWF5ICAgKlxuICogIG5vdCB1c2UgdGhpcyBmaWxlIGV4Y2VwdCBpbiBjb21wbGlhbmNlIHdpdGggdGhlIExpY2Vuc2UuIEEgY29weSBvZiB0aGUgICAgKlxuICogIExpY2Vuc2UgaXMgbG9jYXRlZCBhdCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKlxuICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKlxuICogICAgICBodHRwOi8vd3d3LmFwYWNoZS5vcmcvbGljZW5zZXMvTElDRU5TRS0yLjAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKlxuICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKlxuICogIG9yIGluIHRoZSAnbGljZW5zZScgZmlsZSBhY2NvbXBhbnlpbmcgdGhpcyBmaWxlLiBUaGlzIGZpbGUgaXMgZGlzdHJpYnV0ZWQgKlxuICogIG9uIGFuICdBUyBJUycgQkFTSVMsIFdJVEhPVVQgV0FSUkFOVElFUyBPUiBDT05ESVRJT05TIE9GIEFOWSBLSU5ELCAgICAgICAgKlxuICogIGV4cHJlc3Mgb3IgaW1wbGllZC4gU2VlIHRoZSBMaWNlbnNlIGZvciB0aGUgc3BlY2lmaWMgbGFuZ3VhZ2UgZ292ZXJuaW5nICAgKlxuICogIHBlcm1pc3Npb25zIGFuZCBsaW1pdGF0aW9ucyB1bmRlciB0aGUgTGljZW5zZS4gICAgICAgICAgICAgICAgICAgICAgICAgICAgKlxuICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG5pbXBvcnQge1xuICAgIFN0YWNrLFxuICAgIENvbnN0cnVjdCxcbiAgICBBcm5Gb3JtYXQgfSBmcm9tICdAYXdzLWNkay9jb3JlJztcbmltcG9ydCB7IFxuICAgIFBvbGljeVN0YXRlbWVudCwgXG4gICAgRWZmZWN0LCBcbiAgICBSb2xlLCBcbiAgICBQb2xpY3lEb2N1bWVudCwgXG4gICAgQXJuUHJpbmNpcGFsLFxuICAgIFNlcnZpY2VQcmluY2lwYWwsXG4gICAgQ29tcG9zaXRlUHJpbmNpcGFsLCBcbiAgICBDZm5Sb2xlIFxufSBmcm9tICdAYXdzLWNkay9hd3MtaWFtJztcblxuZXhwb3J0IGludGVyZmFjZSBPcmNoUm9sZVByb3BzIHtcbiAgICBzb2x1dGlvbklkOiBzdHJpbmc7XG4gICAgYWRtaW5BY2NvdW50SWQ6IHN0cmluZztcbiAgICBhZG1pblJvbGVOYW1lOiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjbGFzcyBPcmNoZXN0cmF0b3JNZW1iZXJSb2xlIGV4dGVuZHMgQ29uc3RydWN0IHtcbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IE9yY2hSb2xlUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQpO1xuICAgIGNvbnN0IFJFU09VUkNFX1BSRUZJWCA9IHByb3BzLnNvbHV0aW9uSWQucmVwbGFjZSgvXkRFVi0vLCcnKTsgLy8gcHJlZml4IG9uIGV2ZXJ5IHJlc291cmNlIG5hbWVcbiAgICBjb25zdCBzdGFjayA9IFN0YWNrLm9mKHRoaXMpO1xuICAgIGNvbnN0IG1lbWJlclBvbGljeSA9IG5ldyBQb2xpY3lEb2N1bWVudCgpO1xuXG4gICAgLyoqXG4gICAgICogQGRlc2NyaXB0aW9uIENyb3NzLWFjY291bnQgcGVybWlzc2lvbnMgZm9yIE9yY2hlc3RyYXRpb24gcm9sZVxuICAgICAqIEB0eXBlIHtQb2xpY3lTdGF0ZW1lbnR9XG4gICAgICovXG4gICAgY29uc3QgaWFtUGVybXMgPSBuZXcgUG9saWN5U3RhdGVtZW50KCk7XG4gICAgaWFtUGVybXMuYWRkQWN0aW9ucyhcbiAgICAgICAgXCJpYW06UGFzc1JvbGVcIixcbiAgICAgICAgXCJpYW06R2V0Um9sZVwiXG4gICAgKVxuICAgIGlhbVBlcm1zLmVmZmVjdCA9IEVmZmVjdC5BTExPV1xuICAgIGlhbVBlcm1zLmFkZFJlc291cmNlcyhcbiAgICAgICAgYGFybjoke3N0YWNrLnBhcnRpdGlvbn06aWFtOjoke3N0YWNrLmFjY291bnR9OnJvbGUvJHtSRVNPVVJDRV9QUkVGSVh9LSpgXG4gICAgKTtcbiAgICBtZW1iZXJQb2xpY3kuYWRkU3RhdGVtZW50cyhpYW1QZXJtcylcblxuICAgIGNvbnN0IHNzbVJXUGVybXMgPSBuZXcgUG9saWN5U3RhdGVtZW50KClcbiAgICBzc21SV1Blcm1zLmFkZEFjdGlvbnMoXG4gICAgICAgIFwic3NtOlN0YXJ0QXV0b21hdGlvbkV4ZWN1dGlvblwiXG4gICAgKVxuICAgIHNzbVJXUGVybXMuYWRkUmVzb3VyY2VzKFxuICAgICAgICBzdGFjay5mb3JtYXRBcm4oe1xuICAgICAgICAgICAgc2VydmljZTogJ3NzbScsXG4gICAgICAgICAgICByZWdpb246ICcqJyxcbiAgICAgICAgICAgIHJlc291cmNlOiAnZG9jdW1lbnQnLFxuICAgICAgICAgICAgcmVzb3VyY2VOYW1lOiAnU0hBUlItKicsXG4gICAgICAgICAgICBhcm5Gb3JtYXQ6IEFybkZvcm1hdC5TTEFTSF9SRVNPVVJDRV9OQU1FXG4gICAgICAgIH0pLFxuICAgICAgICBzdGFjay5mb3JtYXRBcm4oe1xuICAgICAgICAgICAgc2VydmljZTogJ3NzbScsXG4gICAgICAgICAgICByZWdpb246ICcqJyxcbiAgICAgICAgICAgIHJlc291cmNlOiAnYXV0b21hdGlvbi1kZWZpbml0aW9uJyxcbiAgICAgICAgICAgIHJlc291cmNlTmFtZTogJyonLFxuICAgICAgICAgICAgYXJuRm9ybWF0OiBBcm5Gb3JtYXQuU0xBU0hfUkVTT1VSQ0VfTkFNRVxuICAgICAgICB9KSxcbiAgICAgICAgc3RhY2suZm9ybWF0QXJuKHtcbiAgICAgICAgICAgIHNlcnZpY2U6ICdzc20nLFxuICAgICAgICAgICAgcmVnaW9uOiAnKicsXG4gICAgICAgICAgICByZXNvdXJjZTogJ2F1dG9tYXRpb24tZGVmaW5pdGlvbicsXG4gICAgICAgICAgICBhY2NvdW50OicnLFxuICAgICAgICAgICAgcmVzb3VyY2VOYW1lOiAnKicsXG4gICAgICAgICAgICBhcm5Gb3JtYXQ6IEFybkZvcm1hdC5TTEFTSF9SRVNPVVJDRV9OQU1FXG4gICAgICAgIH0pLFxuICAgICAgICBzdGFjay5mb3JtYXRBcm4oe1xuICAgICAgICAgICAgc2VydmljZTogJ3NzbScsXG4gICAgICAgICAgICByZWdpb246ICcqJyxcbiAgICAgICAgICAgIHJlc291cmNlOiAnYXV0b21hdGlvbi1leGVjdXRpb24nLFxuICAgICAgICAgICAgcmVzb3VyY2VOYW1lOiAnKicsXG4gICAgICAgICAgICBhcm5Gb3JtYXQ6IEFybkZvcm1hdC5TTEFTSF9SRVNPVVJDRV9OQU1FXG4gICAgICAgIH0pXG4gICAgKTtcbiAgICBtZW1iZXJQb2xpY3kuYWRkU3RhdGVtZW50cyhzc21SV1Blcm1zKVxuXG4gICAgbWVtYmVyUG9saWN5LmFkZFN0YXRlbWVudHMoXG4gICAgICAgIC8vIFRoZSBhY3Rpb25zIGluIHlvdXIgcG9saWN5IGRvIG5vdCBzdXBwb3J0IHJlc291cmNlLWxldmVsIHBlcm1pc3Npb25zIGFuZCByZXF1aXJlIHlvdSB0byBjaG9vc2UgQWxsIHJlc291cmNlc1xuICAgICAgICBuZXcgUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgICAgICAgICAnc3NtOkRlc2NyaWJlQXV0b21hdGlvbkV4ZWN1dGlvbnMnLFxuICAgICAgICAgICAgICAgICdzc206R2V0QXV0b21hdGlvbkV4ZWN1dGlvbidcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgICByZXNvdXJjZXM6IFsgJyonIF0sXG4gICAgICAgICAgICBlZmZlY3Q6IEVmZmVjdC5BTExPV1xuICAgICAgICB9KSxcbiAgICAgICAgbmV3IFBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgICAgICBhY3Rpb25zOiBbXG4gICAgICAgICAgICAgICAgJ3NzbTpEZXNjcmliZURvY3VtZW50J1xuICAgICAgICAgICAgXSxcbiAgICAgICAgICAgIHJlc291cmNlczogWyBgYXJuOiR7c3RhY2sucGFydGl0aW9ufTpzc206KjoqOmRvY3VtZW50LypgIF0sXG4gICAgICAgICAgICBlZmZlY3Q6IEVmZmVjdC5BTExPV1xuICAgICAgICB9KSxcbiAgICAgICAgbmV3IFBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgICAgICBhY3Rpb25zOiBbXG4gICAgICAgICAgICAgICAgJ3NzbTpHZXRQYXJhbWV0ZXJzJyxcbiAgICAgICAgICAgICAgICAnc3NtOkdldFBhcmFtZXRlcidcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgICByZXNvdXJjZXM6IFsgYGFybjoke3N0YWNrLnBhcnRpdGlvbn06c3NtOio6KjpwYXJhbWV0ZXIvU29sdXRpb25zL1NPMDExMS8qYCBdLFxuICAgICAgICAgICAgZWZmZWN0OiBFZmZlY3QuQUxMT1dcbiAgICAgICAgfSksXG4gICAgICAgIG5ldyBQb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICAgICAgYWN0aW9uczogW1xuICAgICAgICAgICAgICAgIFwiY29uZmlnOkRlc2NyaWJlQ29uZmlnUnVsZXNcIlxuICAgICAgICAgICAgXSxcbiAgICAgICAgICAgIHJlc291cmNlczogWyBcIipcIiBdLFxuICAgICAgICAgICAgZWZmZWN0OiBFZmZlY3QuQUxMT1dcbiAgICAgICAgfSlcbiAgICApXG5cbiAgICBjb25zdCBzZWNodWJQZXJtcyA9IG5ldyBQb2xpY3lTdGF0ZW1lbnQoKTtcbiAgICBzZWNodWJQZXJtcy5hZGRBY3Rpb25zKFwiY2xvdWR3YXRjaDpQdXRNZXRyaWNEYXRhXCIpXG4gICAgc2VjaHViUGVybXMuYWRkQWN0aW9ucyhcInNlY3VyaXR5aHViOkJhdGNoVXBkYXRlRmluZGluZ3NcIilcbiAgICBzZWNodWJQZXJtcy5lZmZlY3QgPSBFZmZlY3QuQUxMT1dcbiAgICBzZWNodWJQZXJtcy5hZGRSZXNvdXJjZXMoXCIqXCIpXG5cbiAgICBtZW1iZXJQb2xpY3kuYWRkU3RhdGVtZW50cyhzZWNodWJQZXJtcylcblxuICAgIGxldCBwcmluY2lwYWxQb2xpY3lTdGF0ZW1lbnQgPSBuZXcgUG9saWN5U3RhdGVtZW50KCk7XG5cbiAgICBwcmluY2lwYWxQb2xpY3lTdGF0ZW1lbnQuYWRkQWN0aW9ucyhcInN0czpBc3N1bWVSb2xlXCIpO1xuICAgIHByaW5jaXBhbFBvbGljeVN0YXRlbWVudC5lZmZlY3QgPSBFZmZlY3QuQUxMT1c7XG5cbiAgICBsZXQgcm9sZXByaW5jaXBhbCA9IG5ldyBBcm5QcmluY2lwYWwoXG4gICAgICAgIGBhcm46JHtzdGFjay5wYXJ0aXRpb259OmlhbTo6JHtwcm9wcy5hZG1pbkFjY291bnRJZH06cm9sZS8ke3Byb3BzLmFkbWluUm9sZU5hbWV9YFxuICAgICk7XG5cbiAgICBsZXQgcHJpbmNpcGFscyA9IG5ldyBDb21wb3NpdGVQcmluY2lwYWwocm9sZXByaW5jaXBhbCk7XG4gICAgcHJpbmNpcGFscy5hZGRUb1BvbGljeShwcmluY2lwYWxQb2xpY3lTdGF0ZW1lbnQpO1xuXG4gICAgbGV0IHNlcnZpY2VwcmluY2lwYWwgPSBuZXcgU2VydmljZVByaW5jaXBhbCgnc3NtLmFtYXpvbmF3cy5jb20nKVxuICAgIHByaW5jaXBhbHMuYWRkUHJpbmNpcGFscyhzZXJ2aWNlcHJpbmNpcGFsKTtcblxuICAgIGxldCBtZW1iZXJSb2xlID0gbmV3IFJvbGUodGhpcywgJ01lbWJlckFjY291bnRSb2xlJywge1xuICAgICAgICBhc3N1bWVkQnk6IHByaW5jaXBhbHMsXG4gICAgICAgIGlubGluZVBvbGljaWVzOiB7XG4gICAgICAgICAgICAnbWVtYmVyX29yY2hlc3RyYXRvcic6IG1lbWJlclBvbGljeVxuICAgICAgICB9LFxuICAgICAgICByb2xlTmFtZTogYCR7UkVTT1VSQ0VfUFJFRklYfS1TSEFSUi1PcmNoZXN0cmF0b3ItTWVtYmVyYFxuICAgIH0pO1xuXG4gICAgY29uc3QgbWVtYmVyUm9sZVJlc291cmNlID0gbWVtYmVyUm9sZS5ub2RlLmZpbmRDaGlsZCgnUmVzb3VyY2UnKSBhcyBDZm5Sb2xlO1xuXG4gICAgbWVtYmVyUm9sZVJlc291cmNlLmNmbk9wdGlvbnMubWV0YWRhdGEgPSB7XG4gICAgICAgIGNmbl9uYWc6IHtcbiAgICAgICAgICAgIHJ1bGVzX3RvX3N1cHByZXNzOiBbe1xuICAgICAgICAgICAgICAgIGlkOiAnVzExJyxcbiAgICAgICAgICAgICAgICByZWFzb246ICdSZXNvdXJjZSAqIGlzIHJlcXVpcmVkIGR1ZSB0byB0aGUgYWRtaW5pc3RyYXRpdmUgbmF0dXJlIG9mIHRoZSBzb2x1dGlvbi4nXG4gICAgICAgICAgICB9LHtcbiAgICAgICAgICAgICAgICBpZDogJ1cyOCcsXG4gICAgICAgICAgICAgICAgcmVhc29uOiAnU3RhdGljIG5hbWVzIGNob3NlbiBpbnRlbnRpb25hbGx5IHRvIHByb3ZpZGUgaW50ZWdyYXRpb24gaW4gY3Jvc3MtYWNjb3VudCBwZXJtaXNzaW9ucydcbiAgICAgICAgICAgIH1dXG4gICAgICAgIH1cbiAgICB9XG4gIH1cbn0iXX0=