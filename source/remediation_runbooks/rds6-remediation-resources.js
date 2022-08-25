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
exports.Rds6EnhancedMonitoringRole = void 0;
const cdk = require("@aws-cdk/core");
const aws_iam_1 = require("@aws-cdk/aws-iam");
class Rds6EnhancedMonitoringRole extends cdk.Construct {
    constructor(scope, id, props) {
        super(scope, id);
        const stack = cdk.Stack.of(this);
        const rds6Policy = new aws_iam_1.Policy(this, 'RDS6-Enhanced-Monitoring-Policy');
        const logs1Perms = new aws_iam_1.PolicyStatement({
            effect: aws_iam_1.Effect.ALLOW,
            sid: 'EnableCreationAndManagementOfRDSCloudwatchLogGroups'
        });
        logs1Perms.addActions("logs:CreateLogGroup");
        logs1Perms.addActions("logs:PutRetentionPolicy");
        logs1Perms.addResources(`arn:${stack.partition}:logs:*:${stack.account}:log-group:RDS*`);
        rds6Policy.addStatements(logs1Perms);
        const logs2Perms = new aws_iam_1.PolicyStatement({
            effect: aws_iam_1.Effect.ALLOW,
            sid: 'EnableCreationAndManagementOfRDSCloudwatchLogStreams'
        });
        logs2Perms.addActions("logs:CreateLogStream");
        logs2Perms.addActions("logs:PutLogEvents");
        logs2Perms.addActions("logs:DescribeLogStreams");
        logs2Perms.addActions("logs:GetLogEvents");
        logs2Perms.addResources(`arn:${stack.partition}:logs:*:${stack.account}:log-group:RDS*:log-stream:*`);
        rds6Policy.addStatements(logs2Perms);
        // AssumeRole Policy
        let principalPolicyStatement = new aws_iam_1.PolicyStatement();
        principalPolicyStatement.addActions("sts:AssumeRole");
        principalPolicyStatement.effect = aws_iam_1.Effect.ALLOW;
        let serviceprincipal = new aws_iam_1.ServicePrincipal('monitoring.rds.amazonaws.com');
        serviceprincipal.addToPolicy(principalPolicyStatement);
        let rds6Role = new aws_iam_1.Role(this, 'Rds6EnhancedMonitoringRole', {
            assumedBy: serviceprincipal,
            roleName: props.roleName
        });
        rds6Role.attachInlinePolicy(rds6Policy);
        rds6Role.applyRemovalPolicy(cdk.RemovalPolicy.RETAIN);
        let roleResource = rds6Role.node.findChild('Resource');
        roleResource.cfnOptions.metadata = {
            cfn_nag: {
                rules_to_suppress: [{
                        id: 'W28',
                        reason: 'Static names required to allow use in automated remediation runbooks.'
                    }]
            }
        };
    }
}
exports.Rds6EnhancedMonitoringRole = Rds6EnhancedMonitoringRole;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmRzNi1yZW1lZGlhdGlvbi1yZXNvdXJjZXMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJyZHM2LXJlbWVkaWF0aW9uLXJlc291cmNlcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUNBOzs7Ozs7Ozs7Ozs7OytFQWErRTs7O0FBRS9FLHFDQUFxQztBQUNyQyw4Q0FPMEI7QUFNMUIsTUFBYSwwQkFBMkIsU0FBUSxHQUFHLENBQUMsU0FBUztJQUUzRCxZQUFZLEtBQW9CLEVBQUUsRUFBVSxFQUFFLEtBQWtDO1FBQzlFLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFDakIsTUFBTSxLQUFLLEdBQUcsR0FBRyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUE7UUFFaEMsTUFBTSxVQUFVLEdBQUcsSUFBSSxnQkFBTSxDQUFDLElBQUksRUFBRSxpQ0FBaUMsQ0FBQyxDQUFBO1FBRXRFLE1BQU0sVUFBVSxHQUFHLElBQUkseUJBQWUsQ0FBQztZQUNuQyxNQUFNLEVBQUUsZ0JBQU0sQ0FBQyxLQUFLO1lBQ3BCLEdBQUcsRUFBRSxxREFBcUQ7U0FDN0QsQ0FBQyxDQUFDO1FBQ0gsVUFBVSxDQUFDLFVBQVUsQ0FBQyxxQkFBcUIsQ0FBQyxDQUFBO1FBQzVDLFVBQVUsQ0FBQyxVQUFVLENBQUMseUJBQXlCLENBQUMsQ0FBQTtRQUNoRCxVQUFVLENBQUMsWUFBWSxDQUNuQixPQUFPLEtBQUssQ0FBQyxTQUFTLFdBQVcsS0FBSyxDQUFDLE9BQU8saUJBQWlCLENBQ2xFLENBQUM7UUFDRixVQUFVLENBQUMsYUFBYSxDQUFDLFVBQVUsQ0FBQyxDQUFBO1FBRXBDLE1BQU0sVUFBVSxHQUFHLElBQUkseUJBQWUsQ0FBQztZQUNuQyxNQUFNLEVBQUUsZ0JBQU0sQ0FBQyxLQUFLO1lBQ3BCLEdBQUcsRUFBRSxzREFBc0Q7U0FDOUQsQ0FBQyxDQUFDO1FBQ0gsVUFBVSxDQUFDLFVBQVUsQ0FBQyxzQkFBc0IsQ0FBQyxDQUFBO1FBQzdDLFVBQVUsQ0FBQyxVQUFVLENBQUMsbUJBQW1CLENBQUMsQ0FBQTtRQUMxQyxVQUFVLENBQUMsVUFBVSxDQUFDLHlCQUF5QixDQUFDLENBQUE7UUFDaEQsVUFBVSxDQUFDLFVBQVUsQ0FBQyxtQkFBbUIsQ0FBQyxDQUFBO1FBQzFDLFVBQVUsQ0FBQyxZQUFZLENBQ25CLE9BQU8sS0FBSyxDQUFDLFNBQVMsV0FBVyxLQUFLLENBQUMsT0FBTyw4QkFBOEIsQ0FDL0UsQ0FBQztRQUNGLFVBQVUsQ0FBQyxhQUFhLENBQUMsVUFBVSxDQUFDLENBQUE7UUFFcEMsb0JBQW9CO1FBQ3BCLElBQUksd0JBQXdCLEdBQUcsSUFBSSx5QkFBZSxFQUFFLENBQUM7UUFDckQsd0JBQXdCLENBQUMsVUFBVSxDQUFDLGdCQUFnQixDQUFDLENBQUM7UUFDdEQsd0JBQXdCLENBQUMsTUFBTSxHQUFHLGdCQUFNLENBQUMsS0FBSyxDQUFDO1FBRS9DLElBQUksZ0JBQWdCLEdBQUcsSUFBSSwwQkFBZ0IsQ0FBQyw4QkFBOEIsQ0FBQyxDQUFBO1FBQzNFLGdCQUFnQixDQUFDLFdBQVcsQ0FBQyx3QkFBd0IsQ0FBQyxDQUFDO1FBRXZELElBQUksUUFBUSxHQUFHLElBQUksY0FBSSxDQUFDLElBQUksRUFBRSw0QkFBNEIsRUFBRTtZQUN4RCxTQUFTLEVBQUUsZ0JBQWdCO1lBQzNCLFFBQVEsRUFBRSxLQUFLLENBQUMsUUFBUTtTQUMzQixDQUFDLENBQUM7UUFFSCxRQUFRLENBQUMsa0JBQWtCLENBQUMsVUFBVSxDQUFDLENBQUE7UUFDdkMsUUFBUSxDQUFDLGtCQUFrQixDQUFDLEdBQUcsQ0FBQyxhQUFhLENBQUMsTUFBTSxDQUFDLENBQUE7UUFFckQsSUFBSSxZQUFZLEdBQUcsUUFBUSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsVUFBVSxDQUFZLENBQUM7UUFDbEUsWUFBWSxDQUFDLFVBQVUsQ0FBQyxRQUFRLEdBQUc7WUFDL0IsT0FBTyxFQUFFO2dCQUNMLGlCQUFpQixFQUFFLENBQUM7d0JBQ2hCLEVBQUUsRUFBRSxLQUFLO3dCQUNULE1BQU0sRUFBRSx1RUFBdUU7cUJBQ2xGLENBQUM7YUFDTDtTQUNKLENBQUM7SUFDSixDQUFDO0NBQ0Y7QUExREQsZ0VBMERDIiwic291cmNlc0NvbnRlbnQiOlsiIyEvdXNyL2Jpbi9lbnYgbm9kZVxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gKiAgQ29weXJpZ2h0IEFtYXpvbi5jb20sIEluYy4gb3IgaXRzIGFmZmlsaWF0ZXMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuICAgKlxuICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUgTGljZW5zZSwgVmVyc2lvbiAyLjAgKHRoZSBcIkxpY2Vuc2VcIikuIFlvdSBtYXkgICAqXG4gKiAgbm90IHVzZSB0aGlzIGZpbGUgZXhjZXB0IGluIGNvbXBsaWFuY2Ugd2l0aCB0aGUgTGljZW5zZS4gQSBjb3B5IG9mIHRoZSAgICAqXG4gKiAgTGljZW5zZSBpcyBsb2NhdGVkIGF0ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAqXG4gKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAqXG4gKiAgICAgIGh0dHA6Ly93d3cuYXBhY2hlLm9yZy9saWNlbnNlcy9MSUNFTlNFLTIuMCAgICAgICAgICAgICAgICAgICAgICAgICAgICAqXG4gKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAqXG4gKiAgb3IgaW4gdGhlICdsaWNlbnNlJyBmaWxlIGFjY29tcGFueWluZyB0aGlzIGZpbGUuIFRoaXMgZmlsZSBpcyBkaXN0cmlidXRlZCAqXG4gKiAgb24gYW4gJ0FTIElTJyBCQVNJUywgV0lUSE9VVCBXQVJSQU5USUVTIE9SIENPTkRJVElPTlMgT0YgQU5ZIEtJTkQsICAgICAgICAqXG4gKiAgZXhwcmVzcyBvciBpbXBsaWVkLiBTZWUgdGhlIExpY2Vuc2UgZm9yIHRoZSBzcGVjaWZpYyBsYW5ndWFnZSBnb3Zlcm5pbmcgICAqXG4gKiAgcGVybWlzc2lvbnMgYW5kIGxpbWl0YXRpb25zIHVuZGVyIHRoZSBMaWNlbnNlLiAgICAgICAgICAgICAgICAgICAgICAgICAgICAqXG4gKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbmltcG9ydCAqIGFzIGNkayBmcm9tICdAYXdzLWNkay9jb3JlJztcbmltcG9ydCB7IFxuICAgIEVmZmVjdCwgXG4gICAgUG9saWN5LCBcbiAgICBQb2xpY3lTdGF0ZW1lbnQsIFxuICAgIFJvbGUsXG4gICAgU2VydmljZVByaW5jaXBhbCxcbiAgICBDZm5Sb2xlXG59IGZyb20gJ0Bhd3MtY2RrL2F3cy1pYW0nO1xuXG5leHBvcnQgaW50ZXJmYWNlIElSZHM2RW5oYW5jZWRNb25pdG9yaW5nUm9sZSB7XG4gICAgcm9sZU5hbWU6IHN0cmluZztcbn1cblxuZXhwb3J0IGNsYXNzIFJkczZFbmhhbmNlZE1vbml0b3JpbmdSb2xlIGV4dGVuZHMgY2RrLkNvbnN0cnVjdCB7XG5cbiAgY29uc3RydWN0b3Ioc2NvcGU6IGNkay5Db25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBJUmRzNkVuaGFuY2VkTW9uaXRvcmluZ1JvbGUpIHtcbiAgICBzdXBlcihzY29wZSwgaWQpO1xuICAgIGNvbnN0IHN0YWNrID0gY2RrLlN0YWNrLm9mKHRoaXMpXG5cbiAgICBjb25zdCByZHM2UG9saWN5ID0gbmV3IFBvbGljeSh0aGlzLCAnUkRTNi1FbmhhbmNlZC1Nb25pdG9yaW5nLVBvbGljeScpXG4gICAgIFxuICAgIGNvbnN0IGxvZ3MxUGVybXMgPSBuZXcgUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgZWZmZWN0OiBFZmZlY3QuQUxMT1csXG4gICAgICAgIHNpZDogJ0VuYWJsZUNyZWF0aW9uQW5kTWFuYWdlbWVudE9mUkRTQ2xvdWR3YXRjaExvZ0dyb3VwcydcbiAgICB9KTtcbiAgICBsb2dzMVBlcm1zLmFkZEFjdGlvbnMoXCJsb2dzOkNyZWF0ZUxvZ0dyb3VwXCIpXG4gICAgbG9nczFQZXJtcy5hZGRBY3Rpb25zKFwibG9nczpQdXRSZXRlbnRpb25Qb2xpY3lcIilcbiAgICBsb2dzMVBlcm1zLmFkZFJlc291cmNlcyhcbiAgICAgICAgYGFybjoke3N0YWNrLnBhcnRpdGlvbn06bG9nczoqOiR7c3RhY2suYWNjb3VudH06bG9nLWdyb3VwOlJEUypgXG4gICAgKTtcbiAgICByZHM2UG9saWN5LmFkZFN0YXRlbWVudHMobG9nczFQZXJtcylcblxuICAgIGNvbnN0IGxvZ3MyUGVybXMgPSBuZXcgUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgZWZmZWN0OiBFZmZlY3QuQUxMT1csXG4gICAgICAgIHNpZDogJ0VuYWJsZUNyZWF0aW9uQW5kTWFuYWdlbWVudE9mUkRTQ2xvdWR3YXRjaExvZ1N0cmVhbXMnXG4gICAgfSk7XG4gICAgbG9nczJQZXJtcy5hZGRBY3Rpb25zKFwibG9nczpDcmVhdGVMb2dTdHJlYW1cIilcbiAgICBsb2dzMlBlcm1zLmFkZEFjdGlvbnMoXCJsb2dzOlB1dExvZ0V2ZW50c1wiKVxuICAgIGxvZ3MyUGVybXMuYWRkQWN0aW9ucyhcImxvZ3M6RGVzY3JpYmVMb2dTdHJlYW1zXCIpXG4gICAgbG9nczJQZXJtcy5hZGRBY3Rpb25zKFwibG9nczpHZXRMb2dFdmVudHNcIilcbiAgICBsb2dzMlBlcm1zLmFkZFJlc291cmNlcyhcbiAgICAgICAgYGFybjoke3N0YWNrLnBhcnRpdGlvbn06bG9nczoqOiR7c3RhY2suYWNjb3VudH06bG9nLWdyb3VwOlJEUyo6bG9nLXN0cmVhbToqYFxuICAgICk7XG4gICAgcmRzNlBvbGljeS5hZGRTdGF0ZW1lbnRzKGxvZ3MyUGVybXMpXG5cbiAgICAvLyBBc3N1bWVSb2xlIFBvbGljeVxuICAgIGxldCBwcmluY2lwYWxQb2xpY3lTdGF0ZW1lbnQgPSBuZXcgUG9saWN5U3RhdGVtZW50KCk7XG4gICAgcHJpbmNpcGFsUG9saWN5U3RhdGVtZW50LmFkZEFjdGlvbnMoXCJzdHM6QXNzdW1lUm9sZVwiKTtcbiAgICBwcmluY2lwYWxQb2xpY3lTdGF0ZW1lbnQuZWZmZWN0ID0gRWZmZWN0LkFMTE9XO1xuXG4gICAgbGV0IHNlcnZpY2VwcmluY2lwYWwgPSBuZXcgU2VydmljZVByaW5jaXBhbCgnbW9uaXRvcmluZy5yZHMuYW1hem9uYXdzLmNvbScpXG4gICAgc2VydmljZXByaW5jaXBhbC5hZGRUb1BvbGljeShwcmluY2lwYWxQb2xpY3lTdGF0ZW1lbnQpO1xuXG4gICAgbGV0IHJkczZSb2xlID0gbmV3IFJvbGUodGhpcywgJ1JkczZFbmhhbmNlZE1vbml0b3JpbmdSb2xlJywge1xuICAgICAgICBhc3N1bWVkQnk6IHNlcnZpY2VwcmluY2lwYWwsXG4gICAgICAgIHJvbGVOYW1lOiBwcm9wcy5yb2xlTmFtZVxuICAgIH0pO1xuXG4gICAgcmRzNlJvbGUuYXR0YWNoSW5saW5lUG9saWN5KHJkczZQb2xpY3kpXG4gICAgcmRzNlJvbGUuYXBwbHlSZW1vdmFsUG9saWN5KGNkay5SZW1vdmFsUG9saWN5LlJFVEFJTilcblxuICAgIGxldCByb2xlUmVzb3VyY2UgPSByZHM2Um9sZS5ub2RlLmZpbmRDaGlsZCgnUmVzb3VyY2UnKSBhcyBDZm5Sb2xlO1xuICAgIHJvbGVSZXNvdXJjZS5jZm5PcHRpb25zLm1ldGFkYXRhID0ge1xuICAgICAgICBjZm5fbmFnOiB7XG4gICAgICAgICAgICBydWxlc190b19zdXBwcmVzczogW3tcbiAgICAgICAgICAgICAgICBpZDogJ1cyOCcsXG4gICAgICAgICAgICAgICAgcmVhc29uOiAnU3RhdGljIG5hbWVzIHJlcXVpcmVkIHRvIGFsbG93IHVzZSBpbiBhdXRvbWF0ZWQgcmVtZWRpYXRpb24gcnVuYm9va3MuJ1xuICAgICAgICAgICAgfV1cbiAgICAgICAgfVxuICAgIH07XG4gIH1cbn0iXX0=