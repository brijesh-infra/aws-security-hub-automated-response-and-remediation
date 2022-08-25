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
exports.AdminAccountParm = void 0;
const cdk = require("@aws-cdk/core");
class AdminAccountParm extends cdk.Construct {
    constructor(scope, id, props) {
        super(scope, id);
        const validAwsAccount = "\\d{12}";
        this.adminAccountNumber = new cdk.CfnParameter(this, 'Admin Account Number', {
            description: "Admin account number",
            type: "String",
            allowedPattern: validAwsAccount
        });
        this.adminAccountNumber.overrideLogicalId(`SecHubAdminAccount`);
    }
}
exports.AdminAccountParm = AdminAccountParm;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWRtaW5fYWNjb3VudF9wYXJtLWNvbnN0cnVjdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImFkbWluX2FjY291bnRfcGFybS1jb25zdHJ1Y3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFDQTs7Ozs7Ozs7Ozs7OzsrRUFhK0U7OztBQUUvRSxxQ0FBcUM7QUFNckMsTUFBYSxnQkFBaUIsU0FBUSxHQUFHLENBQUMsU0FBUztJQUlqRCxZQUFZLEtBQW9CLEVBQUUsRUFBVSxFQUFFLEtBQWlDO1FBQzdFLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFFakIsTUFBTSxlQUFlLEdBQUcsU0FBUyxDQUFBO1FBRWpDLElBQUksQ0FBQyxrQkFBa0IsR0FBRyxJQUFJLEdBQUcsQ0FBQyxZQUFZLENBQUMsSUFBSSxFQUFFLHNCQUFzQixFQUFFO1lBQ3pFLFdBQVcsRUFBRSxzQkFBc0I7WUFDbkMsSUFBSSxFQUFFLFFBQVE7WUFDZCxjQUFjLEVBQUUsZUFBZTtTQUNsQyxDQUFDLENBQUM7UUFDSCxJQUFJLENBQUMsa0JBQWtCLENBQUMsaUJBQWlCLENBQUMsb0JBQW9CLENBQUMsQ0FBQTtJQUNqRSxDQUFDO0NBQ0Y7QUFoQkQsNENBZ0JDIiwic291cmNlc0NvbnRlbnQiOlsiIyEvdXNyL2Jpbi9lbnYgbm9kZVxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gKiAgQ29weXJpZ2h0IEFtYXpvbi5jb20sIEluYy4gb3IgaXRzIGFmZmlsaWF0ZXMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuICAgKlxuICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUgTGljZW5zZSwgVmVyc2lvbiAyLjAgKHRoZSBcIkxpY2Vuc2VcIikuIFlvdSBtYXkgICAqXG4gKiAgbm90IHVzZSB0aGlzIGZpbGUgZXhjZXB0IGluIGNvbXBsaWFuY2Ugd2l0aCB0aGUgTGljZW5zZS4gQSBjb3B5IG9mIHRoZSAgICAqXG4gKiAgTGljZW5zZSBpcyBsb2NhdGVkIGF0ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAqXG4gKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAqXG4gKiAgICAgIGh0dHA6Ly93d3cuYXBhY2hlLm9yZy9saWNlbnNlcy9MSUNFTlNFLTIuMCAgICAgICAgICAgICAgICAgICAgICAgICAgICAqXG4gKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAqXG4gKiAgb3IgaW4gdGhlICdsaWNlbnNlJyBmaWxlIGFjY29tcGFueWluZyB0aGlzIGZpbGUuIFRoaXMgZmlsZSBpcyBkaXN0cmlidXRlZCAqXG4gKiAgb24gYW4gJ0FTIElTJyBCQVNJUywgV0lUSE9VVCBXQVJSQU5USUVTIE9SIENPTkRJVElPTlMgT0YgQU5ZIEtJTkQsICAgICAgICAqXG4gKiAgZXhwcmVzcyBvciBpbXBsaWVkLiBTZWUgdGhlIExpY2Vuc2UgZm9yIHRoZSBzcGVjaWZpYyBsYW5ndWFnZSBnb3Zlcm5pbmcgICAqXG4gKiAgcGVybWlzc2lvbnMgYW5kIGxpbWl0YXRpb25zIHVuZGVyIHRoZSBMaWNlbnNlLiAgICAgICAgICAgICAgICAgICAgICAgICAgICAqXG4gKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbmltcG9ydCAqIGFzIGNkayBmcm9tICdAYXdzLWNkay9jb3JlJztcblxuZXhwb3J0IGludGVyZmFjZSBBZG1pbkFjY291bnRDb25zdHJ1Y3RQcm9wcyB7XG4gICAgc29sdXRpb25JZDogc3RyaW5nO1xufVxuXG5leHBvcnQgY2xhc3MgQWRtaW5BY2NvdW50UGFybSBleHRlbmRzIGNkay5Db25zdHJ1Y3Qge1xuXG4gIHB1YmxpYyByZWFkb25seSBhZG1pbkFjY291bnROdW1iZXI6IGNkay5DZm5QYXJhbWV0ZXI7XG5cbiAgY29uc3RydWN0b3Ioc2NvcGU6IGNkay5Db25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBBZG1pbkFjY291bnRDb25zdHJ1Y3RQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCk7XG5cbiAgICBjb25zdCB2YWxpZEF3c0FjY291bnQgPSBcIlxcXFxkezEyfVwiXG5cbiAgICB0aGlzLmFkbWluQWNjb3VudE51bWJlciA9IG5ldyBjZGsuQ2ZuUGFyYW1ldGVyKHRoaXMsICdBZG1pbiBBY2NvdW50IE51bWJlcicsIHtcbiAgICAgICAgZGVzY3JpcHRpb246IFwiQWRtaW4gYWNjb3VudCBudW1iZXJcIixcbiAgICAgICAgdHlwZTogXCJTdHJpbmdcIixcbiAgICAgICAgYWxsb3dlZFBhdHRlcm46IHZhbGlkQXdzQWNjb3VudFxuICAgIH0pO1xuICAgIHRoaXMuYWRtaW5BY2NvdW50TnVtYmVyLm92ZXJyaWRlTG9naWNhbElkKGBTZWNIdWJBZG1pbkFjY291bnRgKVxuICB9XG59XG4iXX0=