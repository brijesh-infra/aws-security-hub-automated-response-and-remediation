#!/usr/bin/env node
"use strict";
/*****************************************************************************
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.        *
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
exports.OrchLogStack = void 0;
const cdk = require("@aws-cdk/core");
const aws_logs_1 = require("@aws-cdk/aws-logs");
const aws_kms_1 = require("@aws-cdk/aws-kms");
class OrchLogStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        const stack = cdk.Stack.of(this);
        const reuseOrchLogGroup = new cdk.CfnParameter(this, 'Reuse Log Group', {
            type: "String",
            description: `Reuse existing Orchestrator Log Group? Choose "yes" if the log group already exists, else "no"`,
            default: "no",
            allowedValues: ["yes", "no"]
        });
        reuseOrchLogGroup.overrideLogicalId(`ReuseOrchestratorLogGroup`);
        const kmsKeyArn = new cdk.CfnParameter(this, 'KMS Key Arn', {
            type: "String",
            description: `ARN of the KMS key to use to encrypt log data.`,
        });
        kmsKeyArn.overrideLogicalId(`KmsKeyArn`);
        /**********************
         * Encrypted log group
         */
        // As of March 2021, CWLogs encryption is not yet supported in GovCloud
        // Choose based on partition
        const kmsKey = aws_kms_1.Key.fromKeyArn(this, "KmsKey", kmsKeyArn.valueAsString);
        const orchestratorLogGroupEncrypted = new aws_logs_1.LogGroup(this, 'Orchestrator-Logs-Encrypted', {
            logGroupName: props.logGroupName,
            removalPolicy: cdk.RemovalPolicy.RETAIN,
            retention: aws_logs_1.RetentionDays.ONE_YEAR,
            encryptionKey: kmsKey
        });
        /************************
         * Unencrypted log group
         */
        const orchestratorLogGroupNOTEncrypted = new aws_logs_1.LogGroup(this, 'Orchestrator-Logs', {
            logGroupName: props.logGroupName,
            removalPolicy: cdk.RemovalPolicy.RETAIN,
            retention: aws_logs_1.RetentionDays.ONE_YEAR
        });
        /*******************
         *  Conditions
         */
        const isNotGovCloud = new cdk.CfnCondition(this, "isNotGovCloud", {
            expression: cdk.Fn.conditionNot(cdk.Fn.conditionEquals(stack.partition, "aws-us-gov"))
        });
        {
            let childToMod = orchestratorLogGroupEncrypted.node.defaultChild;
            childToMod.cfnOptions.condition = new cdk.CfnCondition(this, "Encrypted Log Group", {
                expression: cdk.Fn.conditionAnd(isNotGovCloud, cdk.Fn.conditionEquals(reuseOrchLogGroup.valueAsString, "no"))
            });
        }
        {
            let childToMod = orchestratorLogGroupNOTEncrypted.node.defaultChild;
            childToMod.cfnOptions.condition = new cdk.CfnCondition(this, "Unencrypted Log Group", {
                expression: cdk.Fn.conditionAnd(cdk.Fn.conditionNot(isNotGovCloud), cdk.Fn.conditionEquals(reuseOrchLogGroup.valueAsString, "no"))
            });
            childToMod.cfnOptions.metadata = {
                cfn_nag: {
                    rules_to_suppress: [{
                            id: 'W84',
                            reason: 'KmsKeyId is not supported in GovCloud.'
                        }]
                }
            };
        }
    }
}
exports.OrchLogStack = OrchLogStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3JjaGVzdHJhdG9yLWxvZy1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIm9yY2hlc3RyYXRvci1sb2ctc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFDQTs7Ozs7Ozs7Ozs7OzsrRUFhK0U7OztBQUUvRSxxQ0FBcUM7QUFDckMsZ0RBQXlFO0FBQ3pFLDhDQUF1QztBQVF2QyxNQUFhLFlBQWEsU0FBUSxHQUFHLENBQUMsS0FBSztJQUN6QyxZQUFZLEtBQWMsRUFBRSxFQUFVLEVBQUUsS0FBd0I7UUFFOUQsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDeEIsTUFBTSxLQUFLLEdBQUcsR0FBRyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUM7UUFFakMsTUFBTSxpQkFBaUIsR0FBRyxJQUFJLEdBQUcsQ0FBQyxZQUFZLENBQUMsSUFBSSxFQUFFLGlCQUFpQixFQUFFO1lBQ3BFLElBQUksRUFBRSxRQUFRO1lBQ2QsV0FBVyxFQUFFLGdHQUFnRztZQUM3RyxPQUFPLEVBQUUsSUFBSTtZQUNiLGFBQWEsRUFBRSxDQUFDLEtBQUssRUFBRSxJQUFJLENBQUM7U0FDL0IsQ0FBQyxDQUFBO1FBQ0YsaUJBQWlCLENBQUMsaUJBQWlCLENBQUMsMkJBQTJCLENBQUMsQ0FBQTtRQUVoRSxNQUFNLFNBQVMsR0FBRyxJQUFJLEdBQUcsQ0FBQyxZQUFZLENBQUMsSUFBSSxFQUFFLGFBQWEsRUFBRTtZQUN4RCxJQUFJLEVBQUUsUUFBUTtZQUNkLFdBQVcsRUFBRSxnREFBZ0Q7U0FDaEUsQ0FBQyxDQUFBO1FBQ0YsU0FBUyxDQUFDLGlCQUFpQixDQUFDLFdBQVcsQ0FBQyxDQUFBO1FBRXhDOztXQUVHO1FBQ0gsdUVBQXVFO1FBQ3ZFLDRCQUE0QjtRQUU1QixNQUFNLE1BQU0sR0FBRyxhQUFHLENBQUMsVUFBVSxDQUFDLElBQUksRUFBRSxRQUFRLEVBQUUsU0FBUyxDQUFDLGFBQWEsQ0FBQyxDQUFBO1FBQ3RFLE1BQU0sNkJBQTZCLEdBQWEsSUFBSSxtQkFBUSxDQUFDLElBQUksRUFBRSw2QkFBNkIsRUFBRTtZQUM5RixZQUFZLEVBQUUsS0FBSyxDQUFDLFlBQVk7WUFDaEMsYUFBYSxFQUFFLEdBQUcsQ0FBQyxhQUFhLENBQUMsTUFBTTtZQUN2QyxTQUFTLEVBQUUsd0JBQWEsQ0FBQyxRQUFRO1lBQ2pDLGFBQWEsRUFBRSxNQUFNO1NBQ3hCLENBQUMsQ0FBQztRQUVIOztXQUVHO1FBQ0gsTUFBTSxnQ0FBZ0MsR0FBYSxJQUFJLG1CQUFRLENBQUMsSUFBSSxFQUFFLG1CQUFtQixFQUFFO1lBQ3ZGLFlBQVksRUFBRSxLQUFLLENBQUMsWUFBWTtZQUNoQyxhQUFhLEVBQUUsR0FBRyxDQUFDLGFBQWEsQ0FBQyxNQUFNO1lBQ3ZDLFNBQVMsRUFBRSx3QkFBYSxDQUFDLFFBQVE7U0FDcEMsQ0FBQyxDQUFDO1FBRUg7O1dBRUc7UUFDSCxNQUFNLGFBQWEsR0FBRyxJQUFJLEdBQUcsQ0FBQyxZQUFZLENBQUMsSUFBSSxFQUFFLGVBQWUsRUFBRTtZQUM5RCxVQUFVLEVBQUUsR0FBRyxDQUFDLEVBQUUsQ0FBQyxZQUFZLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxlQUFlLENBQUMsS0FBSyxDQUFDLFNBQVMsRUFBRSxZQUFZLENBQUMsQ0FBQztTQUN6RixDQUFDLENBQUM7UUFDSDtZQUNJLElBQUksVUFBVSxHQUFHLDZCQUE2QixDQUFDLElBQUksQ0FBQyxZQUEyQixDQUFDO1lBQ2hGLFVBQVUsQ0FBQyxVQUFVLENBQUMsU0FBUyxHQUFHLElBQUksR0FBRyxDQUFDLFlBQVksQ0FBQyxJQUFJLEVBQUUscUJBQXFCLEVBQUU7Z0JBQ2hGLFVBQVUsRUFBRSxHQUFHLENBQUMsRUFBRSxDQUFDLFlBQVksQ0FDM0IsYUFBYSxFQUNiLEdBQUcsQ0FBQyxFQUFFLENBQUMsZUFBZSxDQUFDLGlCQUFpQixDQUFDLGFBQWEsRUFBRSxJQUFJLENBQUMsQ0FDaEU7YUFDSixDQUFDLENBQUE7U0FDTDtRQUVEO1lBQ0ksSUFBSSxVQUFVLEdBQUcsZ0NBQWdDLENBQUMsSUFBSSxDQUFDLFlBQTJCLENBQUM7WUFDbkYsVUFBVSxDQUFDLFVBQVUsQ0FBQyxTQUFTLEdBQUcsSUFBSSxHQUFHLENBQUMsWUFBWSxDQUFDLElBQUksRUFBRSx1QkFBdUIsRUFBRTtnQkFDbEYsVUFBVSxFQUFFLEdBQUcsQ0FBQyxFQUFFLENBQUMsWUFBWSxDQUMzQixHQUFHLENBQUMsRUFBRSxDQUFDLFlBQVksQ0FBQyxhQUFhLENBQUMsRUFDbEMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxlQUFlLENBQUMsaUJBQWlCLENBQUMsYUFBYSxFQUFFLElBQUksQ0FBQyxDQUNoRTthQUNKLENBQUMsQ0FBQTtZQUNGLFVBQVUsQ0FBQyxVQUFVLENBQUMsUUFBUSxHQUFHO2dCQUM3QixPQUFPLEVBQUU7b0JBQ0wsaUJBQWlCLEVBQUUsQ0FBQzs0QkFDaEIsRUFBRSxFQUFFLEtBQUs7NEJBQ1QsTUFBTSxFQUFFLHdDQUF3Qzt5QkFDbkQsQ0FBQztpQkFDTDthQUNKLENBQUE7U0FDSjtJQUNILENBQUM7Q0FDRjtBQTdFRCxvQ0E2RUMiLCJzb3VyY2VzQ29udGVudCI6WyIjIS91c3IvYmluL2VudiBub2RlXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAqICBDb3B5cmlnaHQgQW1hem9uLmNvbSwgSW5jLiBvciBpdHMgYWZmaWxpYXRlcy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC4gICAgICAgICpcbiAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICpcbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wICh0aGUgXCJMaWNlbnNlXCIpLiBZb3UgbWF5ICAgKlxuICogIG5vdCB1c2UgdGhpcyBmaWxlIGV4Y2VwdCBpbiBjb21wbGlhbmNlIHdpdGggdGhlIExpY2Vuc2UuIEEgY29weSBvZiB0aGUgICAgKlxuICogIExpY2Vuc2UgaXMgbG9jYXRlZCBhdCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKlxuICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKlxuICogICAgICBodHRwOi8vd3d3LmFwYWNoZS5vcmcvbGljZW5zZXMvTElDRU5TRS0yLjAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKlxuICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKlxuICogIG9yIGluIHRoZSAnbGljZW5zZScgZmlsZSBhY2NvbXBhbnlpbmcgdGhpcyBmaWxlLiBUaGlzIGZpbGUgaXMgZGlzdHJpYnV0ZWQgKlxuICogIG9uIGFuICdBUyBJUycgQkFTSVMsIFdJVEhPVVQgV0FSUkFOVElFUyBPUiBDT05ESVRJT05TIE9GIEFOWSBLSU5ELCAgICAgICAgKlxuICogIGV4cHJlc3Mgb3IgaW1wbGllZC4gU2VlIHRoZSBMaWNlbnNlIGZvciB0aGUgc3BlY2lmaWMgbGFuZ3VhZ2UgZ292ZXJuaW5nICAgKlxuICogIHBlcm1pc3Npb25zIGFuZCBsaW1pdGF0aW9ucyB1bmRlciB0aGUgTGljZW5zZS4gICAgICAgICAgICAgICAgICAgICAgICAgICAgKlxuICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG5pbXBvcnQgKiBhcyBjZGsgZnJvbSAnQGF3cy1jZGsvY29yZSc7XG5pbXBvcnQgeyBMb2dHcm91cCwgQ2ZuTG9nR3JvdXAsIFJldGVudGlvbkRheXMgfSBmcm9tICdAYXdzLWNkay9hd3MtbG9ncyc7XG5pbXBvcnQgeyBLZXkgfSBmcm9tICdAYXdzLWNkay9hd3Mta21zJztcbiBcbmV4cG9ydCBpbnRlcmZhY2UgT3JjaExvZ1N0YWNrUHJvcHMgZXh0ZW5kcyBjZGsuU3RhY2tQcm9wcyB7XG4gICAgZGVzY3JpcHRpb246IHN0cmluZztcbiAgICBsb2dHcm91cE5hbWU6IHN0cmluZztcbiAgICBzb2x1dGlvbklkOiBzdHJpbmc7XG59XG4gIFxuZXhwb3J0IGNsYXNzIE9yY2hMb2dTdGFjayBleHRlbmRzIGNkay5TdGFjayB7XG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBjZGsuQXBwLCBpZDogc3RyaW5nLCBwcm9wczogT3JjaExvZ1N0YWNrUHJvcHMpIHtcbiAgXG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XG4gICAgY29uc3Qgc3RhY2sgPSBjZGsuU3RhY2sub2YodGhpcyk7XG5cbiAgICBjb25zdCByZXVzZU9yY2hMb2dHcm91cCA9IG5ldyBjZGsuQ2ZuUGFyYW1ldGVyKHRoaXMsICdSZXVzZSBMb2cgR3JvdXAnLCB7XG4gICAgICAgIHR5cGU6IFwiU3RyaW5nXCIsXG4gICAgICAgIGRlc2NyaXB0aW9uOiBgUmV1c2UgZXhpc3RpbmcgT3JjaGVzdHJhdG9yIExvZyBHcm91cD8gQ2hvb3NlIFwieWVzXCIgaWYgdGhlIGxvZyBncm91cCBhbHJlYWR5IGV4aXN0cywgZWxzZSBcIm5vXCJgLFxuICAgICAgICBkZWZhdWx0OiBcIm5vXCIsXG4gICAgICAgIGFsbG93ZWRWYWx1ZXM6IFtcInllc1wiLCBcIm5vXCJdXG4gICAgfSlcbiAgICByZXVzZU9yY2hMb2dHcm91cC5vdmVycmlkZUxvZ2ljYWxJZChgUmV1c2VPcmNoZXN0cmF0b3JMb2dHcm91cGApXG5cbiAgICBjb25zdCBrbXNLZXlBcm4gPSBuZXcgY2RrLkNmblBhcmFtZXRlcih0aGlzLCAnS01TIEtleSBBcm4nLCB7XG4gICAgICAgIHR5cGU6IFwiU3RyaW5nXCIsXG4gICAgICAgIGRlc2NyaXB0aW9uOiBgQVJOIG9mIHRoZSBLTVMga2V5IHRvIHVzZSB0byBlbmNyeXB0IGxvZyBkYXRhLmAsXG4gICAgfSlcbiAgICBrbXNLZXlBcm4ub3ZlcnJpZGVMb2dpY2FsSWQoYEttc0tleUFybmApXG4gICAgIFxuICAgIC8qKioqKioqKioqKioqKioqKioqKioqXG4gICAgICogRW5jcnlwdGVkIGxvZyBncm91cFxuICAgICAqL1xuICAgIC8vIEFzIG9mIE1hcmNoIDIwMjEsIENXTG9ncyBlbmNyeXB0aW9uIGlzIG5vdCB5ZXQgc3VwcG9ydGVkIGluIEdvdkNsb3VkXG4gICAgLy8gQ2hvb3NlIGJhc2VkIG9uIHBhcnRpdGlvblxuXG4gICAgY29uc3Qga21zS2V5ID0gS2V5LmZyb21LZXlBcm4odGhpcywgXCJLbXNLZXlcIiwga21zS2V5QXJuLnZhbHVlQXNTdHJpbmcpXG4gICAgY29uc3Qgb3JjaGVzdHJhdG9yTG9nR3JvdXBFbmNyeXB0ZWQ6IExvZ0dyb3VwID0gbmV3IExvZ0dyb3VwKHRoaXMsICdPcmNoZXN0cmF0b3ItTG9ncy1FbmNyeXB0ZWQnLCB7XG4gICAgICAgIGxvZ0dyb3VwTmFtZTogcHJvcHMubG9nR3JvdXBOYW1lLFxuICAgICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5SRVRBSU4sXG4gICAgICAgIHJldGVudGlvbjogUmV0ZW50aW9uRGF5cy5PTkVfWUVBUixcbiAgICAgICAgZW5jcnlwdGlvbktleToga21zS2V5XG4gICAgfSk7XG5cbiAgICAvKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgICogVW5lbmNyeXB0ZWQgbG9nIGdyb3VwXG4gICAgICovXG4gICAgY29uc3Qgb3JjaGVzdHJhdG9yTG9nR3JvdXBOT1RFbmNyeXB0ZWQ6IExvZ0dyb3VwID0gbmV3IExvZ0dyb3VwKHRoaXMsICdPcmNoZXN0cmF0b3ItTG9ncycsIHtcbiAgICAgICAgbG9nR3JvdXBOYW1lOiBwcm9wcy5sb2dHcm91cE5hbWUsXG4gICAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LlJFVEFJTixcbiAgICAgICAgcmV0ZW50aW9uOiBSZXRlbnRpb25EYXlzLk9ORV9ZRUFSXG4gICAgfSk7XG4gXG4gICAgLyoqKioqKioqKioqKioqKioqKipcbiAgICAgKiAgQ29uZGl0aW9uc1xuICAgICAqL1xuICAgIGNvbnN0IGlzTm90R292Q2xvdWQgPSBuZXcgY2RrLkNmbkNvbmRpdGlvbih0aGlzLCBcImlzTm90R292Q2xvdWRcIiwge1xuICAgICAgICBleHByZXNzaW9uOiBjZGsuRm4uY29uZGl0aW9uTm90KGNkay5Gbi5jb25kaXRpb25FcXVhbHMoc3RhY2sucGFydGl0aW9uLCBcImF3cy11cy1nb3ZcIikpXG4gICAgfSk7XG4gICAge1xuICAgICAgICBsZXQgY2hpbGRUb01vZCA9IG9yY2hlc3RyYXRvckxvZ0dyb3VwRW5jcnlwdGVkLm5vZGUuZGVmYXVsdENoaWxkIGFzIENmbkxvZ0dyb3VwO1xuICAgICAgICBjaGlsZFRvTW9kLmNmbk9wdGlvbnMuY29uZGl0aW9uID0gbmV3IGNkay5DZm5Db25kaXRpb24odGhpcywgXCJFbmNyeXB0ZWQgTG9nIEdyb3VwXCIsIHtcbiAgICAgICAgICAgIGV4cHJlc3Npb246IGNkay5Gbi5jb25kaXRpb25BbmQoXG4gICAgICAgICAgICAgICAgaXNOb3RHb3ZDbG91ZCxcbiAgICAgICAgICAgICAgICBjZGsuRm4uY29uZGl0aW9uRXF1YWxzKHJldXNlT3JjaExvZ0dyb3VwLnZhbHVlQXNTdHJpbmcsIFwibm9cIilcbiAgICAgICAgICAgIClcbiAgICAgICAgfSlcbiAgICB9XG5cbiAgICB7XG4gICAgICAgIGxldCBjaGlsZFRvTW9kID0gb3JjaGVzdHJhdG9yTG9nR3JvdXBOT1RFbmNyeXB0ZWQubm9kZS5kZWZhdWx0Q2hpbGQgYXMgQ2ZuTG9nR3JvdXA7XG4gICAgICAgIGNoaWxkVG9Nb2QuY2ZuT3B0aW9ucy5jb25kaXRpb24gPSBuZXcgY2RrLkNmbkNvbmRpdGlvbih0aGlzLCBcIlVuZW5jcnlwdGVkIExvZyBHcm91cFwiLCB7XG4gICAgICAgICAgICBleHByZXNzaW9uOiBjZGsuRm4uY29uZGl0aW9uQW5kKFxuICAgICAgICAgICAgICAgIGNkay5Gbi5jb25kaXRpb25Ob3QoaXNOb3RHb3ZDbG91ZCksXG4gICAgICAgICAgICAgICAgY2RrLkZuLmNvbmRpdGlvbkVxdWFscyhyZXVzZU9yY2hMb2dHcm91cC52YWx1ZUFzU3RyaW5nLCBcIm5vXCIpXG4gICAgICAgICAgICApXG4gICAgICAgIH0pXG4gICAgICAgIGNoaWxkVG9Nb2QuY2ZuT3B0aW9ucy5tZXRhZGF0YSA9IHtcbiAgICAgICAgICAgIGNmbl9uYWc6IHtcbiAgICAgICAgICAgICAgICBydWxlc190b19zdXBwcmVzczogW3tcbiAgICAgICAgICAgICAgICAgICAgaWQ6ICdXODQnLFxuICAgICAgICAgICAgICAgICAgICByZWFzb246ICdLbXNLZXlJZCBpcyBub3Qgc3VwcG9ydGVkIGluIEdvdkNsb3VkLidcbiAgICAgICAgICAgICAgICB9XVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuICB9XG59ICJdfQ==