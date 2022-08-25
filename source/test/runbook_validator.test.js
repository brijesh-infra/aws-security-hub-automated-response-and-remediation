"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
const regex_registry_1 = require("./regex_registry");
const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");
class RunbookTestHelper {
    constructor(file) {
        this._file = file;
    }
    getFile() {
        return this._file;
    }
    isRemediationRunbook() {
        const parent = path.dirname(this._file).split(path.sep).pop();
        return parent === 'remediation_runbooks';
    }
    getContents() {
        if (this._contents === undefined) {
            this._contents = fs.readFileSync(this._file, 'utf8');
        }
        return this._contents || '';
    }
    getLines() {
        if (this._contentsAsLines === undefined) {
            this._contentsAsLines = this.getContents().split('\n');
        }
        return this._contentsAsLines || [];
    }
    getObject() {
        if (this._contentsAsObject === undefined) {
            this._contentsAsObject = yaml.load(this.getContents());
        }
        return this._contentsAsObject;
    }
    toString() {
        return this._file;
    }
    getValidVariables() {
        if (this._validVariables !== undefined) {
            return this._validVariables;
        }
        this._validVariables = new Set();
        for (const parameter of Object.keys(this.getObject().parameters)) {
            if (this._validVariables.has(parameter)) {
                throw Error(`Duplicate parameter: ${parameter}`);
            }
            this._validVariables.add(parameter);
        }
        for (const step of this.getObject().mainSteps) {
            const name = step.name;
            if (step.outputs !== undefined) {
                for (const output of step.outputs) {
                    const variable = `${name}.${output.Name}`;
                    if (this._validVariables.has(variable)) {
                        throw Error(`Duplicate step output: ${variable}`);
                    }
                    this._validVariables.add(variable);
                }
            }
        }
        const globals = [
            'global:ACCOUNT_ID',
            'global:REGION',
            'global:AWS_PARTITION'
        ];
        for (const global of globals) {
            this._validVariables.add(global);
        }
        return this._validVariables;
    }
    getStandardName() {
        if (this.isRemediationRunbook()) {
            throw Error('Remediation runbooks are not aware of standards');
        }
        return path.dirname(path.dirname(this._file)).split(path.sep).pop() || '';
    }
    getDocumentName() {
        return path.basename(this._file, path.extname(this._file));
    }
    getControlName() {
        if (this.isRemediationRunbook()) {
            throw Error('Remediation runbooks are not aware of controls');
        }
        const standard = this.getStandardName();
        switch (standard) {
            case 'AFSBP':
                return this.getDocumentName().substring(6);
            case 'CIS120':
                return this.getDocumentName().substring(4);
            case 'PCI321':
                return this.getDocumentName().substring(4);
            default:
                throw Error(`Unrecognized standard: ${standard}`);
        }
    }
}
;
function getRunbooksFromDirectories(directories, exclusions) {
    var _a;
    let result = [];
    for (const directory of directories) {
        const directoryContents = fs.readdirSync(directory);
        for (const filename of directoryContents) {
            if (exclusions.includes(filename)) {
                continue;
            }
            const file = path.join(directory, filename);
            const stats = fs.statSync(file);
            if (stats.isFile()) {
                const extension = (_a = filename.split('.').pop()) === null || _a === void 0 ? void 0 : _a.toLowerCase();
                if (extension == 'yaml' || extension == 'yml') {
                    result.push(new RunbookTestHelper(file));
                }
            }
        }
    }
    return result;
}
function getControlRunbooks(runbooks) {
    let result = [];
    for (const runbook of runbooks) {
        if (!runbook.isRemediationRunbook()) {
            result.push(runbook);
        }
    }
    return result;
}
function getRemediationRunbooks(runbooks) {
    let result = [];
    for (const runbook of runbooks) {
        if (runbook.isRemediationRunbook()) {
            result.push(runbook);
        }
    }
    return result;
}
// Tests run from the source directory
const runbookDirectories = [
    './playbooks/AFSBP/ssmdocs',
    './playbooks/CIS120/ssmdocs',
    './playbooks/PCI321/ssmdocs',
    './remediation_runbooks'
];
// Documents that are copies of AWS Config remediation documents can temporarily be excluded from tests
// Do not add other runbooks to this list
// TODO all remediation documents should eventually be tested
const excludedRunbooks = [
    'ConfigureS3BucketPublicAccessBlock.yaml',
    'ConfigureS3PublicAccessBlock.yaml',
    'DisablePublicAccessToRDSInstance.yaml',
    'EnableCloudTrailLogFileValidation.yaml',
    'EnableEbsEncryptionByDefault.yaml',
    'EnableEnhancedMonitoringOnRDSInstance.yaml',
    'EnableKeyRotation.yaml',
    'EnableRDSClusterDeletionProtection.yaml',
    'RemoveVPCDefaultSecurityGroupRules.yaml',
    'RevokeUnusedIAMUserCredentials.yaml',
    'SetIAMPasswordPolicy.yaml'
];
const runbooks = getRunbooksFromDirectories(runbookDirectories, excludedRunbooks);
const controlRunbooks = getControlRunbooks(runbooks);
const remediationRunbooks = getRemediationRunbooks(runbooks);
const regexRegistry = (0, regex_registry_1.getRegexRegistry)();
test.skip.each(runbooks)('%s has copyright header', (runbook) => {
    expect(runbook.getLines().slice(0, 2)).toStrictEqual([
        '# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.',
        '# SPDX-License-Identifier: Apache-2.0'
    ]);
});
test.skip.each(runbooks)('%s has begin document indicator', (runbook) => {
    expect(runbook.getLines()[2]).toStrictEqual('---');
});
test.skip.each(runbooks)('%s ends with newline', (runbook) => {
    expect(runbook.getLines().pop()).toStrictEqual('');
});
test.each(runbooks)('%s has correct schema version', (runbook) => {
    expect(runbook.getObject().schemaVersion).toStrictEqual('0.3');
});
function getExpectedDocumentName(runbook) {
    if (runbook.isRemediationRunbook()) {
        return `SHARR-${runbook.getDocumentName()}`;
    }
    const standard = runbook.getStandardName();
    switch (standard) {
        case 'AFSBP':
            return `SHARR-AFSBP_1.0.0_${runbook.getControlName()}`;
        case 'CIS120':
            return `SHARR-CIS_1.2.0_${runbook.getControlName()}`;
        case 'PCI321':
            return `SHARR-PCI_3.2.1_${runbook.getControlName()}`;
        default:
            throw Error(`Unrecognized standard: ${standard}`);
    }
}
test.skip.each(runbooks)('%s description has correct document name', (runbook) => {
    const expectedName = getExpectedDocumentName(runbook);
    const description = runbook.getObject().description;
    expect(description.split('\n')[0]).toStrictEqual(`### Document Name - ${expectedName}`);
});
function sectionNotEmpty(description, header) {
    const lines = description.split('\n');
    let headerFound = false;
    let nonBlankLines = 0;
    for (const line of lines) {
        if (!headerFound) {
            if (line === header) {
                headerFound = true;
            }
        }
        else if (line === '' || line.startsWith('#')) {
            break;
        }
        else {
            ++nonBlankLines;
        }
    }
    return nonBlankLines > 0;
}
function descriptionHasExplanation(description) {
    return sectionNotEmpty(description, '## What does this document do?');
}
test.each(runbooks)('%s description has explanation', (runbook) => {
    const description = runbook.getObject().description;
    expect(descriptionHasExplanation(description)).toBe(true);
});
function descriptionDocumentsInputParameters(description, parameters) {
    if (!parameters) {
        return true;
    }
    let expectedDoc = new Set();
    for (const [name, details] of Object.entries(parameters)) {
        expectedDoc.add(`* ${name}: ${details.description}`);
    }
    const lines = description.split('\n');
    let inputParametersHeaderFound = false;
    let actualDoc = new Set();
    for (const line of lines) {
        if (!inputParametersHeaderFound) {
            if (line === '## Input Parameters') {
                inputParametersHeaderFound = true;
            }
        }
        else if (line === '' || line.startsWith('##')) {
            // The section has ended
            break;
        }
        else {
            actualDoc.add(line);
        }
    }
    if (expectedDoc.size != actualDoc.size) {
        return false;
    }
    for (const element of expectedDoc) {
        if (!actualDoc.has(element)) {
            return false;
        }
    }
    return true;
}
test.skip.each(runbooks)('%s description documents input parameters', (runbook) => {
    const description = runbook.getObject().description;
    const parameters = runbook.getObject().parameters;
    expect(descriptionDocumentsInputParameters(description, parameters)).toBe(true);
});
function descriptionDocumentsOutputParameters(description, outputs) {
    if (!outputs) {
        return true;
    }
    let expectedDoc = new Set();
    for (const output of outputs) {
        expectedDoc.add(`* ${output}`);
    }
    const lines = description.split('\n');
    let outputParametersHeaderFound = false;
    let actualDoc = new Set();
    for (const line of lines) {
        if (!outputParametersHeaderFound) {
            if (line === '## Output Parameters') {
                outputParametersHeaderFound = true;
            }
        }
        else if (line === '' || line.startsWith('##')) {
            // The section has ended
            break;
        }
        else {
            actualDoc.add(line);
        }
    }
    if (expectedDoc.size != actualDoc.size) {
        return false;
    }
    for (const element of expectedDoc) {
        if (!actualDoc.has(element)) {
            return false;
        }
    }
    return true;
}
test.skip.each(runbooks)('%s description documents output parameters', (runbook) => {
    const description = runbook.getObject().description;
    const outputs = runbook.getObject().outputs;
    expect(descriptionDocumentsOutputParameters(description, outputs)).toBe(true);
});
function descriptionHasDocumentationLinks(description, file) {
    return sectionNotEmpty(description, '## Documentation Links');
}
test.skip.each(controlRunbooks)('%s description has documentation links', (runbook) => {
    const description = runbook.getObject().description;
    expect(descriptionHasDocumentationLinks(description, runbook.getFile())).toBe(true);
});
function desriptionDocumentsSecurityStandards(description) {
    return sectionNotEmpty(description, '## Security Standards / Controls');
}
test.skip.each(remediationRunbooks)('%s description documents security standards and controls', (runbook) => {
    const description = runbook.getObject().description;
    expect(desriptionDocumentsSecurityStandards(description)).toBe(true);
});
function isAssumeRoleParameter(value) {
    return value === '{{ AutomationAssumeRole }}' || value == '{{AutomationAssumeRole}}';
}
test.each(runbooks)('%s takes AssumeRole as parameter', (runbook) => {
    expect(isAssumeRoleParameter(runbook.getObject().assumeRole)).toBe(true);
    expect(runbook.getObject().parameters.AutomationAssumeRole.type).toStrictEqual('String');
    expect(runbook.getObject().parameters.AutomationAssumeRole.description).toStrictEqual('(Required) The ARN of the role that allows Automation to perform the actions on your behalf.');
    expect(runbook.getObject().parameters.AutomationAssumeRole).not.toHaveProperty('default');
    expect(runbook.getObject().parameters.AutomationAssumeRole.allowedPattern).toStrictEqual(regexRegistry.getRegexForAutomationAssumeRole());
});
test.skip.each(controlRunbooks)('%s has correct outputs', (runbook) => {
    expect(runbook.getObject().outputs).toStrictEqual(['Remediation.Output', 'ParseInput.AffectedObject']);
});
test.skip.each(remediationRunbooks)('%s has outputs', (runbook) => {
    expect(runbook.getObject().outputs).toBeTruthy();
});
test.each(controlRunbooks)('%s takes finding as parameter', (runbook) => {
    expect(runbook.getObject().parameters.Finding.type).toStrictEqual('StringMap');
    expect(runbook.getObject().parameters.Finding.description).toStrictEqual(`The input from the Orchestrator Step function for the ${runbook.getControlName()} finding`);
});
test.each(runbooks)('%s takes valid parameters', (runbook) => {
    // https://docs.aws.amazon.com/systems-manager/latest/userguide/sysman-doc-syntax.html
    const parameters = runbook.getObject().parameters;
    if (!parameters) {
        return;
    }
    for (let [name, detailsObj] of Object.entries(parameters)) {
        const details = detailsObj;
        switch (details.type) {
            case 'String':
                // String parameters must be validated
                expect(details.allowedPattern || details.allowedValues).toBeTruthy();
                if (details.allowedPattern) {
                    // Regular expressions must be tested
                    expect(regexRegistry.has(details.allowedPattern)).toBe(true);
                }
                break;
            case 'StringList':
                break;
            case 'Integer':
                break;
            case 'Boolean':
                break;
            case 'MapList':
                break;
            case 'StringMap':
                break;
            default:
                throw Error(`Unrecognized type: ${details.type}`);
        }
    }
    // TODO: check that default values, if provided, are the correct type
    // TODO: require descriptions
    // TODO: disallow .*
});
test.each(controlRunbooks)('%s has valid parse input step', (runbook) => {
    const steps = runbook.getObject().mainSteps;
    const parseStep = steps[0];
    expect(parseStep.name).toStrictEqual('ParseInput');
    expect(parseStep.action).toStrictEqual('aws:executeScript');
    expect(parseStep.inputs.Handler).toStrictEqual('parse_event');
    expect(parseStep.inputs.Script).toStrictEqual('%%SCRIPT=common/parse_input.py%%');
    expect(parseStep.inputs.InputPayload.Finding).toStrictEqual('{{Finding}}');
    const parseIdPattern = parseStep.inputs.InputPayload.parse_id_pattern;
    // Empty parse ID pattern is ok if no information needs to be extracted from the finding resource ID
    if (parseIdPattern !== '') {
        // Patterns must be tested
        expect(regexRegistry.has(parseIdPattern)).toBe(true);
    }
    const expectedControlId = parseStep.inputs.InputPayload.expected_control_id;
    expect(Array.isArray(expectedControlId)).toBe(true);
    expect(expectedControlId).toEqual(expect.arrayContaining([runbook.getControlName()]));
    // TODO match known outputs of parse_input and types
});
function validateScriptStep(runbook, step) {
    if (step.outputs) {
        for (const output of step.outputs) {
            // capturing the entire output with '$' is ok
            if (output.Selector !== '$') {
                // selectors must have the correct prefix
                expect(output.Selector).toMatch(/\$\.Payload.*/);
            }
        }
    }
    // TODO scripts must be templates that link to files
    expect(step.inputs.Runtime).toStrictEqual('python3.8');
}
test.each(runbooks)('%s has valid steps', (runbook) => {
    const steps = runbook.getObject().mainSteps;
    // Must have at least one step
    expect(steps.length).toBeGreaterThan(0);
    for (const step of steps) {
        const stepName = step.name;
        // Must have name
        expect(stepName.length).toBeGreaterThan(0);
        const stepAction = step.action;
        switch (stepAction) {
            case 'aws:executeScript':
                validateScriptStep(runbook, step);
                break;
            case 'aws:executeAutomation':
                // TODO
                break;
            case 'aws:executeAwsApi':
                // TODO
                break;
            case 'aws:waitForAwsResourceProperty':
                // TODO
                break;
            case 'aws:assertAwsResourceProperty':
                // TODO
                break;
            case 'aws:branch':
                // TODO
                break;
            default:
                throw Error(`Unrecognized step action: ${stepAction}`);
        }
    }
});
function isSsmParameter(parameter) {
    return parameter.startsWith('ssm:/');
}
function validateTemplateVariablesRecursive(obj, runbook) {
    if (obj === undefined || obj === null) {
        return;
    }
    else if (typeof obj === 'string') {
        const objAsString = obj;
        const regex = /(?<={{)(.*?)(?=}})/g;
        let matches;
        while (matches = regex.exec(objAsString)) {
            const match = matches[1].trim();
            if (!isSsmParameter(match)) {
                expect(runbook.getValidVariables()).toContain(match);
            }
        }
    }
    else if (typeof obj[Symbol.iterator] === 'function') {
        for (const element of obj) {
            validateTemplateVariablesRecursive(element, runbook);
        }
    }
    else {
        for (const value of Object.values(obj)) {
            validateTemplateVariablesRecursive(value, runbook);
        }
    }
}
test.each(runbooks)('%s has valid template variables', (runbook) => {
    validateTemplateVariablesRecursive(runbook.getObject(), runbook);
});
test.skip.each(runbooks)('%s has valid output variables', (runbook) => {
    if (runbook.getObject().outputs) {
        for (const output of runbook.getObject().outputs) {
            expect(runbook.getValidVariables()).toContain(output);
        }
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicnVuYm9va192YWxpZGF0b3IudGVzdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInJ1bmJvb2tfdmFsaWRhdG9yLnRlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQSxxRUFBcUU7QUFDckUsc0NBQXNDO0FBQ3RDLHFEQUFtRTtBQUNuRSx5QkFBeUI7QUFDekIsNkJBQTZCO0FBQzdCLGdDQUFnQztBQUVoQyxNQUFNLGlCQUFpQjtJQU9yQixZQUFZLElBQVk7UUFDdEIsSUFBSSxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUM7SUFDcEIsQ0FBQztJQUVELE9BQU87UUFDTCxPQUFPLElBQUksQ0FBQyxLQUFLLENBQUM7SUFDcEIsQ0FBQztJQUVELG9CQUFvQjtRQUNsQixNQUFNLE1BQU0sR0FBdUIsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQztRQUNsRixPQUFPLE1BQU0sS0FBSyxzQkFBc0IsQ0FBQztJQUMzQyxDQUFDO0lBRUQsV0FBVztRQUNULElBQUksSUFBSSxDQUFDLFNBQVMsS0FBSyxTQUFTLEVBQUU7WUFDaEMsSUFBSSxDQUFDLFNBQVMsR0FBRyxFQUFFLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxLQUFLLEVBQUUsTUFBTSxDQUFDLENBQUM7U0FDdEQ7UUFDRCxPQUFPLElBQUksQ0FBQyxTQUFTLElBQUksRUFBRSxDQUFDO0lBQzlCLENBQUM7SUFFRCxRQUFRO1FBQ04sSUFBSSxJQUFJLENBQUMsZ0JBQWdCLEtBQUssU0FBUyxFQUFFO1lBQ3ZDLElBQUksQ0FBQyxnQkFBZ0IsR0FBRyxJQUFJLENBQUMsV0FBVyxFQUFFLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDO1NBQ3hEO1FBQ0QsT0FBTyxJQUFJLENBQUMsZ0JBQWdCLElBQUksRUFBRSxDQUFDO0lBQ3JDLENBQUM7SUFFRCxTQUFTO1FB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QUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxpQ0FBaUMsRUFBRSxDQUFDLE9BQTBCLEVBQUUsRUFBRTtJQUNwRixrQ0FBa0MsQ0FBQyxPQUFPLENBQUMsU0FBUyxFQUFFLEVBQUUsT0FBTyxDQUFDLENBQUM7QUFDbkUsQ0FBQyxDQUFDLENBQUM7QUFFSCxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQywrQkFBK0IsRUFBRSxDQUFDLE9BQTBCLEVBQUUsRUFBRTtJQUN2RixJQUFJLE9BQU8sQ0FBQyxTQUFTLEVBQUUsQ0FBQyxPQUFPLEVBQUU7UUFDL0IsS0FBSyxNQUFNLE1BQU0sSUFBSSxPQUFPLENBQUMsU0FBUyxFQUFFLENBQUMsT0FBTyxFQUFFO1lBQ2hELE1BQU0sQ0FBQyxPQUFPLENBQUMsaUJBQWlCLEVBQUUsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsQ0FBQztTQUN2RDtLQUNGO0FBQ0gsQ0FBQyxDQUFDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvLyBDb3B5cmlnaHQgQW1hem9uLmNvbSwgSW5jLiBvciBpdHMgYWZmaWxpYXRlcy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbi8vIFNQRFgtTGljZW5zZS1JZGVudGlmaWVyOiBBcGFjaGUtMi4wXG5pbXBvcnQgeyBSZWdleFJlZ2lzdHJ5LCBnZXRSZWdleFJlZ2lzdHJ5IH0gZnJvbSAnLi9yZWdleF9yZWdpc3RyeSc7XG5pbXBvcnQgKiBhcyBmcyBmcm9tICdmcyc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0ICogYXMgeWFtbCBmcm9tICdqcy15YW1sJztcblxuY2xhc3MgUnVuYm9va1Rlc3RIZWxwZXIge1xuICBfZmlsZTogc3RyaW5nO1xuICBfY29udGVudHM6IHN0cmluZyB8IHVuZGVmaW5lZDtcbiAgX2NvbnRlbnRzQXNMaW5lczogc3RyaW5nW10gfCB1bmRlZmluZWQ7XG4gIF9jb250ZW50c0FzT2JqZWN0OiBhbnkgfCB1bmRlZmluZWQ7XG4gIF92YWxpZFZhcmlhYmxlczogU2V0PHN0cmluZz4gfCB1bmRlZmluZWQ7XG5cbiAgY29uc3RydWN0b3IoZmlsZTogc3RyaW5nKSB7XG4gICAgdGhpcy5fZmlsZSA9IGZpbGU7XG4gIH1cblxuICBnZXRGaWxlKCk6IHN0cmluZyB7XG4gICAgcmV0dXJuIHRoaXMuX2ZpbGU7XG4gIH1cblxuICBpc1JlbWVkaWF0aW9uUnVuYm9vaygpOiBib29sZWFuIHtcbiAgICBjb25zdCBwYXJlbnQ6IHN0cmluZyB8IHVuZGVmaW5lZCA9IHBhdGguZGlybmFtZSh0aGlzLl9maWxlKS5zcGxpdChwYXRoLnNlcCkucG9wKCk7XG4gICAgcmV0dXJuIHBhcmVudCA9PT0gJ3JlbWVkaWF0aW9uX3J1bmJvb2tzJztcbiAgfVxuXG4gIGdldENvbnRlbnRzKCk6IHN0cmluZyB7XG4gICAgaWYgKHRoaXMuX2NvbnRlbnRzID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHRoaXMuX2NvbnRlbnRzID0gZnMucmVhZEZpbGVTeW5jKHRoaXMuX2ZpbGUsICd1dGY4Jyk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLl9jb250ZW50cyB8fCAnJztcbiAgfVxuXG4gIGdldExpbmVzKCk6IHN0cmluZ1tdIHtcbiAgICBpZiAodGhpcy5fY29udGVudHNBc0xpbmVzID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHRoaXMuX2NvbnRlbnRzQXNMaW5lcyA9IHRoaXMuZ2V0Q29udGVudHMoKS5zcGxpdCgnXFxuJyk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLl9jb250ZW50c0FzTGluZXMgfHwgW107XG4gIH1cblxuICBnZXRPYmplY3QoKTogYW55IHtcbiAgICBpZiAodGhpcy5fY29udGVudHNBc09iamVjdCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aGlzLl9jb250ZW50c0FzT2JqZWN0ID0geWFtbC5sb2FkKHRoaXMuZ2V0Q29udGVudHMoKSk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLl9jb250ZW50c0FzT2JqZWN0O1xuICB9XG5cbiAgdG9TdHJpbmcoKTogc3RyaW5nIHtcbiAgICByZXR1cm4gdGhpcy5fZmlsZTtcbiAgfVxuXG4gIGdldFZhbGlkVmFyaWFibGVzKCk6IFNldDxzdHJpbmc+IHtcbiAgICBpZiAodGhpcy5fdmFsaWRWYXJpYWJsZXMgIT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuIHRoaXMuX3ZhbGlkVmFyaWFibGVzO1xuICAgIH1cbiAgICB0aGlzLl92YWxpZFZhcmlhYmxlcyA9IG5ldyBTZXQoKTtcbiAgICBmb3IgKGNvbnN0IHBhcmFtZXRlciBvZiBPYmplY3Qua2V5cyh0aGlzLmdldE9iamVjdCgpLnBhcmFtZXRlcnMpKSB7XG4gICAgICBpZiAodGhpcy5fdmFsaWRWYXJpYWJsZXMuaGFzKHBhcmFtZXRlcikpIHtcbiAgICAgICAgdGhyb3cgRXJyb3IoYER1cGxpY2F0ZSBwYXJhbWV0ZXI6ICR7cGFyYW1ldGVyfWApO1xuICAgICAgfVxuICAgICAgdGhpcy5fdmFsaWRWYXJpYWJsZXMuYWRkKHBhcmFtZXRlcik7XG4gICAgfVxuICAgIGZvciAoY29uc3Qgc3RlcCBvZiB0aGlzLmdldE9iamVjdCgpLm1haW5TdGVwcykge1xuICAgICAgY29uc3QgbmFtZTogc3RyaW5nID0gc3RlcC5uYW1lO1xuICAgICAgaWYgKHN0ZXAub3V0cHV0cyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGZvciAoY29uc3Qgb3V0cHV0IG9mIHN0ZXAub3V0cHV0cykge1xuICAgICAgICAgIGNvbnN0IHZhcmlhYmxlOiBzdHJpbmcgPSBgJHtuYW1lfS4ke291dHB1dC5OYW1lfWA7XG4gICAgICAgICAgaWYgKHRoaXMuX3ZhbGlkVmFyaWFibGVzLmhhcyh2YXJpYWJsZSkpIHtcbiAgICAgICAgICAgIHRocm93IEVycm9yKGBEdXBsaWNhdGUgc3RlcCBvdXRwdXQ6ICR7dmFyaWFibGV9YCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHRoaXMuX3ZhbGlkVmFyaWFibGVzLmFkZCh2YXJpYWJsZSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgY29uc3QgZ2xvYmFsczogc3RyaW5nW10gPSBbXG4gICAgICAnZ2xvYmFsOkFDQ09VTlRfSUQnLFxuICAgICAgJ2dsb2JhbDpSRUdJT04nLFxuICAgICAgJ2dsb2JhbDpBV1NfUEFSVElUSU9OJ1xuICAgIF07XG4gICAgZm9yIChjb25zdCBnbG9iYWwgb2YgZ2xvYmFscykge1xuICAgICAgdGhpcy5fdmFsaWRWYXJpYWJsZXMuYWRkKGdsb2JhbCk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLl92YWxpZFZhcmlhYmxlcztcbiAgfVxuXG4gIGdldFN0YW5kYXJkTmFtZSgpOiBzdHJpbmcge1xuICAgIGlmICh0aGlzLmlzUmVtZWRpYXRpb25SdW5ib29rKCkpIHtcbiAgICAgIHRocm93IEVycm9yKCdSZW1lZGlhdGlvbiBydW5ib29rcyBhcmUgbm90IGF3YXJlIG9mIHN0YW5kYXJkcycpO1xuICAgIH1cbiAgICByZXR1cm4gcGF0aC5kaXJuYW1lKHBhdGguZGlybmFtZSh0aGlzLl9maWxlKSkuc3BsaXQocGF0aC5zZXApLnBvcCgpIHx8ICcnO1xuICB9XG5cbiAgZ2V0RG9jdW1lbnROYW1lKCk6IHN0cmluZyB7XG4gICAgcmV0dXJuIHBhdGguYmFzZW5hbWUodGhpcy5fZmlsZSwgcGF0aC5leHRuYW1lKHRoaXMuX2ZpbGUpKTtcbiAgfVxuXG4gIGdldENvbnRyb2xOYW1lKCk6IHN0cmluZyB7XG4gICAgaWYgKHRoaXMuaXNSZW1lZGlhdGlvblJ1bmJvb2soKSkge1xuICAgICAgdGhyb3cgRXJyb3IoJ1JlbWVkaWF0aW9uIHJ1bmJvb2tzIGFyZSBub3QgYXdhcmUgb2YgY29udHJvbHMnKTtcbiAgICB9XG4gICAgY29uc3Qgc3RhbmRhcmQ6IHN0cmluZyA9IHRoaXMuZ2V0U3RhbmRhcmROYW1lKCk7XG4gICAgc3dpdGNoKHN0YW5kYXJkKSB7XG4gICAgICBjYXNlICdBRlNCUCc6XG4gICAgICAgIHJldHVybiB0aGlzLmdldERvY3VtZW50TmFtZSgpLnN1YnN0cmluZyg2KTtcbiAgICAgIGNhc2UgJ0NJUzEyMCc6XG4gICAgICAgIHJldHVybiB0aGlzLmdldERvY3VtZW50TmFtZSgpLnN1YnN0cmluZyg0KTtcbiAgICAgIGNhc2UgJ1BDSTMyMSc6XG4gICAgICAgIHJldHVybiB0aGlzLmdldERvY3VtZW50TmFtZSgpLnN1YnN0cmluZyg0KTtcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHRocm93IEVycm9yKGBVbnJlY29nbml6ZWQgc3RhbmRhcmQ6ICR7c3RhbmRhcmR9YCk7XG4gICAgfVxuICB9XG59O1xuXG5mdW5jdGlvbiBnZXRSdW5ib29rc0Zyb21EaXJlY3RvcmllcyhkaXJlY3Rvcmllczogc3RyaW5nW10sIGV4Y2x1c2lvbnM6IHN0cmluZ1tdKTogUnVuYm9va1Rlc3RIZWxwZXJbXSB7XG4gIGxldCByZXN1bHQ6IFJ1bmJvb2tUZXN0SGVscGVyW10gPSBbXTtcbiAgZm9yIChjb25zdCBkaXJlY3Rvcnkgb2YgZGlyZWN0b3JpZXMpIHtcbiAgICBjb25zdCBkaXJlY3RvcnlDb250ZW50czogc3RyaW5nW10gPSBmcy5yZWFkZGlyU3luYyhkaXJlY3RvcnkpO1xuICAgIGZvciAoY29uc3QgZmlsZW5hbWUgb2YgZGlyZWN0b3J5Q29udGVudHMpIHtcbiAgICAgIGlmIChleGNsdXNpb25zLmluY2x1ZGVzKGZpbGVuYW1lKSkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IGZpbGUgPSBwYXRoLmpvaW4oZGlyZWN0b3J5LCBmaWxlbmFtZSk7XG4gICAgICBjb25zdCBzdGF0czogZnMuU3RhdHMgPSBmcy5zdGF0U3luYyhmaWxlKTtcbiAgICAgIGlmIChzdGF0cy5pc0ZpbGUoKSkge1xuICAgICAgICBjb25zdCBleHRlbnNpb246IHN0cmluZyB8IHVuZGVmaW5lZCA9IGZpbGVuYW1lLnNwbGl0KCcuJykucG9wKCk/LnRvTG93ZXJDYXNlKCk7XG4gICAgICAgIGlmIChleHRlbnNpb24gPT0gJ3lhbWwnIHx8IGV4dGVuc2lvbiA9PSAneW1sJykge1xuICAgICAgICAgIHJlc3VsdC5wdXNoKG5ldyBSdW5ib29rVGVzdEhlbHBlcihmaWxlKSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgcmV0dXJuIHJlc3VsdDtcbn1cblxuZnVuY3Rpb24gZ2V0Q29udHJvbFJ1bmJvb2tzKHJ1bmJvb2tzOiBSdW5ib29rVGVzdEhlbHBlcltdKTogUnVuYm9va1Rlc3RIZWxwZXJbXSB7XG4gIGxldCByZXN1bHQ6IFJ1bmJvb2tUZXN0SGVscGVyW10gPSBbXTtcbiAgZm9yIChjb25zdCBydW5ib29rIG9mIHJ1bmJvb2tzKSB7XG4gICAgaWYgKCFydW5ib29rLmlzUmVtZWRpYXRpb25SdW5ib29rKCkpIHtcbiAgICAgIHJlc3VsdC5wdXNoKHJ1bmJvb2spO1xuICAgIH1cbiAgfVxuICByZXR1cm4gcmVzdWx0O1xufVxuXG5mdW5jdGlvbiBnZXRSZW1lZGlhdGlvblJ1bmJvb2tzKHJ1bmJvb2tzOiBSdW5ib29rVGVzdEhlbHBlcltdKTogUnVuYm9va1Rlc3RIZWxwZXJbXSB7XG4gIGxldCByZXN1bHQ6IFJ1bmJvb2tUZXN0SGVscGVyW10gPSBbXTtcbiAgZm9yIChjb25zdCBydW5ib29rIG9mIHJ1bmJvb2tzKSB7XG4gICAgaWYgKHJ1bmJvb2suaXNSZW1lZGlhdGlvblJ1bmJvb2soKSkge1xuICAgICAgcmVzdWx0LnB1c2gocnVuYm9vayk7XG4gICAgfVxuICB9XG4gIHJldHVybiByZXN1bHQ7XG59XG5cbi8vIFRlc3RzIHJ1biBmcm9tIHRoZSBzb3VyY2UgZGlyZWN0b3J5XG5jb25zdCBydW5ib29rRGlyZWN0b3JpZXM6IHN0cmluZ1tdID0gW1xuICAnLi9wbGF5Ym9va3MvQUZTQlAvc3NtZG9jcycsXG4gICcuL3BsYXlib29rcy9DSVMxMjAvc3NtZG9jcycsXG4gICcuL3BsYXlib29rcy9QQ0kzMjEvc3NtZG9jcycsXG4gICcuL3JlbWVkaWF0aW9uX3J1bmJvb2tzJ1xuXTtcblxuLy8gRG9jdW1lbnRzIHRoYXQgYXJlIGNvcGllcyBvZiBBV1MgQ29uZmlnIHJlbWVkaWF0aW9uIGRvY3VtZW50cyBjYW4gdGVtcG9yYXJpbHkgYmUgZXhjbHVkZWQgZnJvbSB0ZXN0c1xuLy8gRG8gbm90IGFkZCBvdGhlciBydW5ib29rcyB0byB0aGlzIGxpc3Rcbi8vIFRPRE8gYWxsIHJlbWVkaWF0aW9uIGRvY3VtZW50cyBzaG91bGQgZXZlbnR1YWxseSBiZSB0ZXN0ZWRcbmNvbnN0IGV4Y2x1ZGVkUnVuYm9va3M6IHN0cmluZ1tdID0gW1xuICAnQ29uZmlndXJlUzNCdWNrZXRQdWJsaWNBY2Nlc3NCbG9jay55YW1sJyxcbiAgJ0NvbmZpZ3VyZVMzUHVibGljQWNjZXNzQmxvY2sueWFtbCcsXG4gICdEaXNhYmxlUHVibGljQWNjZXNzVG9SRFNJbnN0YW5jZS55YW1sJyxcbiAgJ0VuYWJsZUNsb3VkVHJhaWxMb2dGaWxlVmFsaWRhdGlvbi55YW1sJyxcbiAgJ0VuYWJsZUVic0VuY3J5cHRpb25CeURlZmF1bHQueWFtbCcsXG4gICdFbmFibGVFbmhhbmNlZE1vbml0b3JpbmdPblJEU0luc3RhbmNlLnlhbWwnLFxuICAnRW5hYmxlS2V5Um90YXRpb24ueWFtbCcsXG4gICdFbmFibGVSRFNDbHVzdGVyRGVsZXRpb25Qcm90ZWN0aW9uLnlhbWwnLFxuICAnUmVtb3ZlVlBDRGVmYXVsdFNlY3VyaXR5R3JvdXBSdWxlcy55YW1sJyxcbiAgJ1Jldm9rZVVudXNlZElBTVVzZXJDcmVkZW50aWFscy55YW1sJyxcbiAgJ1NldElBTVBhc3N3b3JkUG9saWN5LnlhbWwnXG5dO1xuXG5jb25zdCBydW5ib29rczogUnVuYm9va1Rlc3RIZWxwZXJbXSA9IGdldFJ1bmJvb2tzRnJvbURpcmVjdG9yaWVzKHJ1bmJvb2tEaXJlY3RvcmllcywgZXhjbHVkZWRSdW5ib29rcyk7XG5jb25zdCBjb250cm9sUnVuYm9va3M6IFJ1bmJvb2tUZXN0SGVscGVyW10gPSBnZXRDb250cm9sUnVuYm9va3MocnVuYm9va3MpO1xuY29uc3QgcmVtZWRpYXRpb25SdW5ib29rcyA9IGdldFJlbWVkaWF0aW9uUnVuYm9va3MocnVuYm9va3MpO1xuXG5jb25zdCByZWdleFJlZ2lzdHJ5OiBSZWdleFJlZ2lzdHJ5ID0gZ2V0UmVnZXhSZWdpc3RyeSgpO1xuXG50ZXN0LnNraXAuZWFjaChydW5ib29rcykoJyVzIGhhcyBjb3B5cmlnaHQgaGVhZGVyJywgKHJ1bmJvb2s6IFJ1bmJvb2tUZXN0SGVscGVyKSA9PiB7XG4gIGV4cGVjdChydW5ib29rLmdldExpbmVzKCkuc2xpY2UoMCwgMikpLnRvU3RyaWN0RXF1YWwoW1xuICAgICcjIENvcHlyaWdodCBBbWF6b24uY29tLCBJbmMuIG9yIGl0cyBhZmZpbGlhdGVzLiBBbGwgUmlnaHRzIFJlc2VydmVkLicsXG4gICAgJyMgU1BEWC1MaWNlbnNlLUlkZW50aWZpZXI6IEFwYWNoZS0yLjAnXG4gIF0pO1xufSk7XG5cbnRlc3Quc2tpcC5lYWNoKHJ1bmJvb2tzKSgnJXMgaGFzIGJlZ2luIGRvY3VtZW50IGluZGljYXRvcicsIChydW5ib29rOiBSdW5ib29rVGVzdEhlbHBlcikgPT4ge1xuICBleHBlY3QocnVuYm9vay5nZXRMaW5lcygpWzJdKS50b1N0cmljdEVxdWFsKCctLS0nKTtcbn0pO1xuXG50ZXN0LnNraXAuZWFjaChydW5ib29rcykoJyVzIGVuZHMgd2l0aCBuZXdsaW5lJywgKHJ1bmJvb2s6IFJ1bmJvb2tUZXN0SGVscGVyKSA9PiB7XG4gIGV4cGVjdChydW5ib29rLmdldExpbmVzKCkucG9wKCkpLnRvU3RyaWN0RXF1YWwoJycpO1xufSk7XG5cbnRlc3QuZWFjaChydW5ib29rcykoJyVzIGhhcyBjb3JyZWN0IHNjaGVtYSB2ZXJzaW9uJywgKHJ1bmJvb2s6IFJ1bmJvb2tUZXN0SGVscGVyKSA9PiB7XG4gIGV4cGVjdChydW5ib29rLmdldE9iamVjdCgpLnNjaGVtYVZlcnNpb24pLnRvU3RyaWN0RXF1YWwoJzAuMycpO1xufSk7XG5cbmZ1bmN0aW9uIGdldEV4cGVjdGVkRG9jdW1lbnROYW1lKHJ1bmJvb2s6IFJ1bmJvb2tUZXN0SGVscGVyKTogc3RyaW5nIHtcbiAgaWYgKHJ1bmJvb2suaXNSZW1lZGlhdGlvblJ1bmJvb2soKSkge1xuICAgIHJldHVybiBgU0hBUlItJHtydW5ib29rLmdldERvY3VtZW50TmFtZSgpfWA7XG4gIH1cbiAgY29uc3Qgc3RhbmRhcmQ6IHN0cmluZyA9IHJ1bmJvb2suZ2V0U3RhbmRhcmROYW1lKCk7XG4gIHN3aXRjaChzdGFuZGFyZCkge1xuICAgIGNhc2UgJ0FGU0JQJzpcbiAgICAgIHJldHVybiBgU0hBUlItQUZTQlBfMS4wLjBfJHtydW5ib29rLmdldENvbnRyb2xOYW1lKCl9YDtcbiAgICBjYXNlICdDSVMxMjAnOlxuICAgICAgcmV0dXJuIGBTSEFSUi1DSVNfMS4yLjBfJHtydW5ib29rLmdldENvbnRyb2xOYW1lKCl9YDtcbiAgICBjYXNlICdQQ0kzMjEnOlxuICAgICAgcmV0dXJuIGBTSEFSUi1QQ0lfMy4yLjFfJHtydW5ib29rLmdldENvbnRyb2xOYW1lKCl9YDtcbiAgICBkZWZhdWx0OlxuICAgICAgdGhyb3cgRXJyb3IoYFVucmVjb2duaXplZCBzdGFuZGFyZDogJHtzdGFuZGFyZH1gKTtcbiAgfVxufVxuXG50ZXN0LnNraXAuZWFjaChydW5ib29rcykoJyVzIGRlc2NyaXB0aW9uIGhhcyBjb3JyZWN0IGRvY3VtZW50IG5hbWUnLCAocnVuYm9vazogUnVuYm9va1Rlc3RIZWxwZXIpID0+IHtcbiAgY29uc3QgZXhwZWN0ZWROYW1lID0gZ2V0RXhwZWN0ZWREb2N1bWVudE5hbWUocnVuYm9vayk7XG4gIGNvbnN0IGRlc2NyaXB0aW9uOiBzdHJpbmcgPSBydW5ib29rLmdldE9iamVjdCgpLmRlc2NyaXB0aW9uO1xuICBleHBlY3QoZGVzY3JpcHRpb24uc3BsaXQoJ1xcbicpWzBdKS50b1N0cmljdEVxdWFsKGAjIyMgRG9jdW1lbnQgTmFtZSAtICR7ZXhwZWN0ZWROYW1lfWApXG59KTtcblxuZnVuY3Rpb24gc2VjdGlvbk5vdEVtcHR5KGRlc2NyaXB0aW9uOiBzdHJpbmcsIGhlYWRlcjogc3RyaW5nKSB7XG4gIGNvbnN0IGxpbmVzOiBzdHJpbmdbXSA9IGRlc2NyaXB0aW9uLnNwbGl0KCdcXG4nKTtcbiAgbGV0IGhlYWRlckZvdW5kOiBib29sZWFuID0gZmFsc2U7XG4gIGxldCBub25CbGFua0xpbmVzOiBudW1iZXIgPSAwO1xuICBmb3IgKGNvbnN0IGxpbmUgb2YgbGluZXMpIHtcbiAgICBpZiAoIWhlYWRlckZvdW5kKSB7XG4gICAgICBpZiAobGluZSA9PT0gaGVhZGVyKSB7XG4gICAgICAgIGhlYWRlckZvdW5kID0gdHJ1ZTtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGxpbmUgPT09ICcnIHx8IGxpbmUuc3RhcnRzV2l0aCgnIycpKSB7XG4gICAgICBicmVhaztcbiAgICB9IGVsc2Uge1xuICAgICAgKytub25CbGFua0xpbmVzO1xuICAgIH1cbiAgfVxuICByZXR1cm4gbm9uQmxhbmtMaW5lcyA+IDA7XG59XG5cbmZ1bmN0aW9uIGRlc2NyaXB0aW9uSGFzRXhwbGFuYXRpb24oZGVzY3JpcHRpb246IHN0cmluZyk6IGJvb2xlYW4ge1xuICByZXR1cm4gc2VjdGlvbk5vdEVtcHR5KGRlc2NyaXB0aW9uLCAnIyMgV2hhdCBkb2VzIHRoaXMgZG9jdW1lbnQgZG8/Jyk7XG59XG5cbnRlc3QuZWFjaChydW5ib29rcykoJyVzIGRlc2NyaXB0aW9uIGhhcyBleHBsYW5hdGlvbicsIChydW5ib29rOiBSdW5ib29rVGVzdEhlbHBlcikgPT4ge1xuICBjb25zdCBkZXNjcmlwdGlvbjogc3RyaW5nID0gcnVuYm9vay5nZXRPYmplY3QoKS5kZXNjcmlwdGlvbjtcbiAgZXhwZWN0KGRlc2NyaXB0aW9uSGFzRXhwbGFuYXRpb24oZGVzY3JpcHRpb24pKS50b0JlKHRydWUpO1xufSk7XG5cbmZ1bmN0aW9uIGRlc2NyaXB0aW9uRG9jdW1lbnRzSW5wdXRQYXJhbWV0ZXJzKGRlc2NyaXB0aW9uOiBzdHJpbmcsIHBhcmFtZXRlcnM6IGFueSk6IGJvb2xlYW4ge1xuICBpZiAoIXBhcmFtZXRlcnMpIHtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuICBsZXQgZXhwZWN0ZWREb2M6IFNldDxzdHJpbmc+ID0gbmV3IFNldCgpO1xuICBmb3IgKGNvbnN0IFtuYW1lLCBkZXRhaWxzXSBvZiBPYmplY3QuZW50cmllcyhwYXJhbWV0ZXJzKSkge1xuICAgIGV4cGVjdGVkRG9jLmFkZChgKiAke25hbWV9OiAkeyhkZXRhaWxzIGFzIGFueSkuZGVzY3JpcHRpb259YCk7XG4gIH1cbiAgY29uc3QgbGluZXM6IHN0cmluZ1tdID0gZGVzY3JpcHRpb24uc3BsaXQoJ1xcbicpO1xuICBsZXQgaW5wdXRQYXJhbWV0ZXJzSGVhZGVyRm91bmQgPSBmYWxzZTtcbiAgbGV0IGFjdHVhbERvYzogU2V0PHN0cmluZz4gPSBuZXcgU2V0KCk7XG4gIGZvciAoY29uc3QgbGluZSBvZiBsaW5lcykge1xuICAgIGlmICghaW5wdXRQYXJhbWV0ZXJzSGVhZGVyRm91bmQpIHtcbiAgICAgIGlmIChsaW5lID09PSAnIyMgSW5wdXQgUGFyYW1ldGVycycpIHtcbiAgICAgICAgaW5wdXRQYXJhbWV0ZXJzSGVhZGVyRm91bmQgPSB0cnVlO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAobGluZSA9PT0gJycgfHwgbGluZS5zdGFydHNXaXRoKCcjIycpKSB7XG4gICAgICAvLyBUaGUgc2VjdGlvbiBoYXMgZW5kZWRcbiAgICAgIGJyZWFrO1xuICAgIH0gZWxzZSB7XG4gICAgICBhY3R1YWxEb2MuYWRkKGxpbmUpO1xuICAgIH1cbiAgfVxuICBpZiAoZXhwZWN0ZWREb2Muc2l6ZSAhPSBhY3R1YWxEb2Muc2l6ZSkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBmb3IgKGNvbnN0IGVsZW1lbnQgb2YgZXhwZWN0ZWREb2MpIHtcbiAgICBpZiAoIWFjdHVhbERvYy5oYXMoZWxlbWVudCkpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHRydWU7XG59XG5cbnRlc3Quc2tpcC5lYWNoKHJ1bmJvb2tzKSgnJXMgZGVzY3JpcHRpb24gZG9jdW1lbnRzIGlucHV0IHBhcmFtZXRlcnMnLCAocnVuYm9vazogUnVuYm9va1Rlc3RIZWxwZXIpID0+IHtcbiAgY29uc3QgZGVzY3JpcHRpb246IHN0cmluZyA9IHJ1bmJvb2suZ2V0T2JqZWN0KCkuZGVzY3JpcHRpb247XG4gIGNvbnN0IHBhcmFtZXRlcnM6IGFueSA9IHJ1bmJvb2suZ2V0T2JqZWN0KCkucGFyYW1ldGVycztcbiAgZXhwZWN0KGRlc2NyaXB0aW9uRG9jdW1lbnRzSW5wdXRQYXJhbWV0ZXJzKGRlc2NyaXB0aW9uLCBwYXJhbWV0ZXJzKSkudG9CZSh0cnVlKTtcbn0pO1xuXG5mdW5jdGlvbiBkZXNjcmlwdGlvbkRvY3VtZW50c091dHB1dFBhcmFtZXRlcnMoZGVzY3JpcHRpb246IHN0cmluZywgb3V0cHV0czogc3RyaW5nW10pIHtcbiAgaWYgKCFvdXRwdXRzKSB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cbiAgbGV0IGV4cGVjdGVkRG9jOiBTZXQ8c3RyaW5nPiA9IG5ldyBTZXQoKTtcbiAgZm9yIChjb25zdCBvdXRwdXQgb2Ygb3V0cHV0cykge1xuICAgIGV4cGVjdGVkRG9jLmFkZChgKiAke291dHB1dH1gKTtcbiAgfVxuICBjb25zdCBsaW5lczogc3RyaW5nW10gPSBkZXNjcmlwdGlvbi5zcGxpdCgnXFxuJyk7XG4gIGxldCBvdXRwdXRQYXJhbWV0ZXJzSGVhZGVyRm91bmQgPSBmYWxzZTtcbiAgbGV0IGFjdHVhbERvYzogU2V0PHN0cmluZz4gPSBuZXcgU2V0KCk7XG4gIGZvciAoY29uc3QgbGluZSBvZiBsaW5lcykge1xuICAgIGlmICghb3V0cHV0UGFyYW1ldGVyc0hlYWRlckZvdW5kKSB7XG4gICAgICBpZiAobGluZSA9PT0gJyMjIE91dHB1dCBQYXJhbWV0ZXJzJykge1xuICAgICAgICBvdXRwdXRQYXJhbWV0ZXJzSGVhZGVyRm91bmQgPSB0cnVlO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAobGluZSA9PT0gJycgfHwgbGluZS5zdGFydHNXaXRoKCcjIycpKSB7XG4gICAgICAvLyBUaGUgc2VjdGlvbiBoYXMgZW5kZWRcbiAgICAgIGJyZWFrO1xuICAgIH0gZWxzZSB7XG4gICAgICBhY3R1YWxEb2MuYWRkKGxpbmUpO1xuICAgIH1cbiAgfVxuICBpZiAoZXhwZWN0ZWREb2Muc2l6ZSAhPSBhY3R1YWxEb2Muc2l6ZSkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBmb3IgKGNvbnN0IGVsZW1lbnQgb2YgZXhwZWN0ZWREb2MpIHtcbiAgICBpZiAoIWFjdHVhbERvYy5oYXMoZWxlbWVudCkpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHRydWU7XG59XG5cbnRlc3Quc2tpcC5lYWNoKHJ1bmJvb2tzKSgnJXMgZGVzY3JpcHRpb24gZG9jdW1lbnRzIG91dHB1dCBwYXJhbWV0ZXJzJywgKHJ1bmJvb2s6IFJ1bmJvb2tUZXN0SGVscGVyKSA9PiB7XG4gIGNvbnN0IGRlc2NyaXB0aW9uOiBzdHJpbmcgPSBydW5ib29rLmdldE9iamVjdCgpLmRlc2NyaXB0aW9uO1xuICBjb25zdCBvdXRwdXRzOiBhbnkgPSBydW5ib29rLmdldE9iamVjdCgpLm91dHB1dHM7XG4gIGV4cGVjdChkZXNjcmlwdGlvbkRvY3VtZW50c091dHB1dFBhcmFtZXRlcnMoZGVzY3JpcHRpb24sIG91dHB1dHMpKS50b0JlKHRydWUpO1xufSk7XG5cbmZ1bmN0aW9uIGRlc2NyaXB0aW9uSGFzRG9jdW1lbnRhdGlvbkxpbmtzKGRlc2NyaXB0aW9uOiBzdHJpbmcsIGZpbGU6IHN0cmluZykge1xuICByZXR1cm4gc2VjdGlvbk5vdEVtcHR5KGRlc2NyaXB0aW9uLCAnIyMgRG9jdW1lbnRhdGlvbiBMaW5rcycpO1xufVxuXG50ZXN0LnNraXAuZWFjaChjb250cm9sUnVuYm9va3MpKCclcyBkZXNjcmlwdGlvbiBoYXMgZG9jdW1lbnRhdGlvbiBsaW5rcycsIChydW5ib29rOiBSdW5ib29rVGVzdEhlbHBlcikgPT4ge1xuICBjb25zdCBkZXNjcmlwdGlvbjogc3RyaW5nID0gcnVuYm9vay5nZXRPYmplY3QoKS5kZXNjcmlwdGlvbjtcbiAgZXhwZWN0KGRlc2NyaXB0aW9uSGFzRG9jdW1lbnRhdGlvbkxpbmtzKGRlc2NyaXB0aW9uLCBydW5ib29rLmdldEZpbGUoKSkpLnRvQmUodHJ1ZSk7XG59KTtcblxuZnVuY3Rpb24gZGVzcmlwdGlvbkRvY3VtZW50c1NlY3VyaXR5U3RhbmRhcmRzKGRlc2NyaXB0aW9uOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgcmV0dXJuIHNlY3Rpb25Ob3RFbXB0eShkZXNjcmlwdGlvbiwgJyMjIFNlY3VyaXR5IFN0YW5kYXJkcyAvIENvbnRyb2xzJyk7XG59XG5cbnRlc3Quc2tpcC5lYWNoKHJlbWVkaWF0aW9uUnVuYm9va3MpKCclcyBkZXNjcmlwdGlvbiBkb2N1bWVudHMgc2VjdXJpdHkgc3RhbmRhcmRzIGFuZCBjb250cm9scycsIChydW5ib29rOiBSdW5ib29rVGVzdEhlbHBlcikgPT4ge1xuICBjb25zdCBkZXNjcmlwdGlvbjogc3RyaW5nID0gcnVuYm9vay5nZXRPYmplY3QoKS5kZXNjcmlwdGlvbjtcbiAgZXhwZWN0KGRlc3JpcHRpb25Eb2N1bWVudHNTZWN1cml0eVN0YW5kYXJkcyhkZXNjcmlwdGlvbikpLnRvQmUodHJ1ZSk7XG59KTtcblxuZnVuY3Rpb24gaXNBc3N1bWVSb2xlUGFyYW1ldGVyKHZhbHVlOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgcmV0dXJuIHZhbHVlID09PSAne3sgQXV0b21hdGlvbkFzc3VtZVJvbGUgfX0nIHx8IHZhbHVlID09ICd7e0F1dG9tYXRpb25Bc3N1bWVSb2xlfX0nO1xufVxuXG50ZXN0LmVhY2gocnVuYm9va3MpKCclcyB0YWtlcyBBc3N1bWVSb2xlIGFzIHBhcmFtZXRlcicsIChydW5ib29rOiBSdW5ib29rVGVzdEhlbHBlcikgPT4ge1xuICBleHBlY3QoaXNBc3N1bWVSb2xlUGFyYW1ldGVyKHJ1bmJvb2suZ2V0T2JqZWN0KCkuYXNzdW1lUm9sZSkpLnRvQmUodHJ1ZSk7XG4gIGV4cGVjdChydW5ib29rLmdldE9iamVjdCgpLnBhcmFtZXRlcnMuQXV0b21hdGlvbkFzc3VtZVJvbGUudHlwZSkudG9TdHJpY3RFcXVhbCgnU3RyaW5nJyk7XG4gIGV4cGVjdChydW5ib29rLmdldE9iamVjdCgpLnBhcmFtZXRlcnMuQXV0b21hdGlvbkFzc3VtZVJvbGUuZGVzY3JpcHRpb24pLnRvU3RyaWN0RXF1YWwoXG4gICAgJyhSZXF1aXJlZCkgVGhlIEFSTiBvZiB0aGUgcm9sZSB0aGF0IGFsbG93cyBBdXRvbWF0aW9uIHRvIHBlcmZvcm0gdGhlIGFjdGlvbnMgb24geW91ciBiZWhhbGYuJyk7XG4gIGV4cGVjdChydW5ib29rLmdldE9iamVjdCgpLnBhcmFtZXRlcnMuQXV0b21hdGlvbkFzc3VtZVJvbGUpLm5vdC50b0hhdmVQcm9wZXJ0eSgnZGVmYXVsdCcpO1xuICBleHBlY3QocnVuYm9vay5nZXRPYmplY3QoKS5wYXJhbWV0ZXJzLkF1dG9tYXRpb25Bc3N1bWVSb2xlLmFsbG93ZWRQYXR0ZXJuKS50b1N0cmljdEVxdWFsKFxuICAgIHJlZ2V4UmVnaXN0cnkuZ2V0UmVnZXhGb3JBdXRvbWF0aW9uQXNzdW1lUm9sZSgpKTtcbn0pO1xuXG50ZXN0LnNraXAuZWFjaChjb250cm9sUnVuYm9va3MpKCclcyBoYXMgY29ycmVjdCBvdXRwdXRzJywgKHJ1bmJvb2s6IFJ1bmJvb2tUZXN0SGVscGVyKSA9PiB7XG4gIGV4cGVjdChydW5ib29rLmdldE9iamVjdCgpLm91dHB1dHMpLnRvU3RyaWN0RXF1YWwoWydSZW1lZGlhdGlvbi5PdXRwdXQnLCAnUGFyc2VJbnB1dC5BZmZlY3RlZE9iamVjdCddKTtcbn0pO1xuXG50ZXN0LnNraXAuZWFjaChyZW1lZGlhdGlvblJ1bmJvb2tzKSgnJXMgaGFzIG91dHB1dHMnLCAocnVuYm9vazogUnVuYm9va1Rlc3RIZWxwZXIpID0+IHtcbiAgZXhwZWN0KHJ1bmJvb2suZ2V0T2JqZWN0KCkub3V0cHV0cykudG9CZVRydXRoeSgpO1xufSk7XG5cbnRlc3QuZWFjaChjb250cm9sUnVuYm9va3MpKCclcyB0YWtlcyBmaW5kaW5nIGFzIHBhcmFtZXRlcicsIChydW5ib29rOiBSdW5ib29rVGVzdEhlbHBlcikgPT4ge1xuICBleHBlY3QocnVuYm9vay5nZXRPYmplY3QoKS5wYXJhbWV0ZXJzLkZpbmRpbmcudHlwZSkudG9TdHJpY3RFcXVhbCgnU3RyaW5nTWFwJyk7XG4gIGV4cGVjdChydW5ib29rLmdldE9iamVjdCgpLnBhcmFtZXRlcnMuRmluZGluZy5kZXNjcmlwdGlvbikudG9TdHJpY3RFcXVhbChcbiAgICBgVGhlIGlucHV0IGZyb20gdGhlIE9yY2hlc3RyYXRvciBTdGVwIGZ1bmN0aW9uIGZvciB0aGUgJHtydW5ib29rLmdldENvbnRyb2xOYW1lKCl9IGZpbmRpbmdgKTtcbn0pO1xuXG50ZXN0LmVhY2gocnVuYm9va3MpKCclcyB0YWtlcyB2YWxpZCBwYXJhbWV0ZXJzJywgKHJ1bmJvb2s6IFJ1bmJvb2tUZXN0SGVscGVyKSA9PiB7XG4gIC8vIGh0dHBzOi8vZG9jcy5hd3MuYW1hem9uLmNvbS9zeXN0ZW1zLW1hbmFnZXIvbGF0ZXN0L3VzZXJndWlkZS9zeXNtYW4tZG9jLXN5bnRheC5odG1sXG4gIGNvbnN0IHBhcmFtZXRlcnM6IGFueSA9IHJ1bmJvb2suZ2V0T2JqZWN0KCkucGFyYW1ldGVycztcbiAgaWYgKCFwYXJhbWV0ZXJzKSB7XG4gICAgcmV0dXJuO1xuICB9XG4gIGZvciAobGV0IFtuYW1lLCBkZXRhaWxzT2JqXSBvZiBPYmplY3QuZW50cmllcyhwYXJhbWV0ZXJzKSkge1xuICAgIGNvbnN0IGRldGFpbHMgPSBkZXRhaWxzT2JqIGFzIGFueTtcbiAgICBzd2l0Y2ggKGRldGFpbHMudHlwZSkge1xuICAgICAgY2FzZSAnU3RyaW5nJzpcbiAgICAgICAgLy8gU3RyaW5nIHBhcmFtZXRlcnMgbXVzdCBiZSB2YWxpZGF0ZWRcbiAgICAgICAgZXhwZWN0KGRldGFpbHMuYWxsb3dlZFBhdHRlcm4gfHwgZGV0YWlscy5hbGxvd2VkVmFsdWVzKS50b0JlVHJ1dGh5KCk7XG4gICAgICAgIGlmIChkZXRhaWxzLmFsbG93ZWRQYXR0ZXJuKSB7XG4gICAgICAgICAgLy8gUmVndWxhciBleHByZXNzaW9ucyBtdXN0IGJlIHRlc3RlZFxuICAgICAgICAgIGV4cGVjdChyZWdleFJlZ2lzdHJ5LmhhcyhkZXRhaWxzLmFsbG93ZWRQYXR0ZXJuKSkudG9CZSh0cnVlKTtcbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJ1N0cmluZ0xpc3QnOlxuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJ0ludGVnZXInOlxuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJ0Jvb2xlYW4nOlxuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJ01hcExpc3QnOlxuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJ1N0cmluZ01hcCc6XG4gICAgICAgIGJyZWFrO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgdGhyb3cgRXJyb3IoYFVucmVjb2duaXplZCB0eXBlOiAke2RldGFpbHMudHlwZX1gKTtcbiAgICB9XG4gIH1cbiAgLy8gVE9ETzogY2hlY2sgdGhhdCBkZWZhdWx0IHZhbHVlcywgaWYgcHJvdmlkZWQsIGFyZSB0aGUgY29ycmVjdCB0eXBlXG4gIC8vIFRPRE86IHJlcXVpcmUgZGVzY3JpcHRpb25zXG4gIC8vIFRPRE86IGRpc2FsbG93IC4qXG59KTtcblxudGVzdC5lYWNoKGNvbnRyb2xSdW5ib29rcykoJyVzIGhhcyB2YWxpZCBwYXJzZSBpbnB1dCBzdGVwJywgKHJ1bmJvb2s6IFJ1bmJvb2tUZXN0SGVscGVyKSA9PiB7XG4gIGNvbnN0IHN0ZXBzOiBhbnkgPSBydW5ib29rLmdldE9iamVjdCgpLm1haW5TdGVwcztcbiAgY29uc3QgcGFyc2VTdGVwID0gc3RlcHNbMF07XG4gIGV4cGVjdChwYXJzZVN0ZXAubmFtZSkudG9TdHJpY3RFcXVhbCgnUGFyc2VJbnB1dCcpO1xuICBleHBlY3QocGFyc2VTdGVwLmFjdGlvbikudG9TdHJpY3RFcXVhbCgnYXdzOmV4ZWN1dGVTY3JpcHQnKTtcbiAgZXhwZWN0KHBhcnNlU3RlcC5pbnB1dHMuSGFuZGxlcikudG9TdHJpY3RFcXVhbCgncGFyc2VfZXZlbnQnKTtcbiAgZXhwZWN0KHBhcnNlU3RlcC5pbnB1dHMuU2NyaXB0KS50b1N0cmljdEVxdWFsKCclJVNDUklQVD1jb21tb24vcGFyc2VfaW5wdXQucHklJScpO1xuICBleHBlY3QocGFyc2VTdGVwLmlucHV0cy5JbnB1dFBheWxvYWQuRmluZGluZykudG9TdHJpY3RFcXVhbCgne3tGaW5kaW5nfX0nKTtcbiAgY29uc3QgcGFyc2VJZFBhdHRlcm46IHN0cmluZyA9IHBhcnNlU3RlcC5pbnB1dHMuSW5wdXRQYXlsb2FkLnBhcnNlX2lkX3BhdHRlcm47XG4gIC8vIEVtcHR5IHBhcnNlIElEIHBhdHRlcm4gaXMgb2sgaWYgbm8gaW5mb3JtYXRpb24gbmVlZHMgdG8gYmUgZXh0cmFjdGVkIGZyb20gdGhlIGZpbmRpbmcgcmVzb3VyY2UgSURcbiAgaWYgKHBhcnNlSWRQYXR0ZXJuICE9PSAnJykge1xuICAgIC8vIFBhdHRlcm5zIG11c3QgYmUgdGVzdGVkXG4gICAgZXhwZWN0KHJlZ2V4UmVnaXN0cnkuaGFzKHBhcnNlSWRQYXR0ZXJuKSkudG9CZSh0cnVlKTtcbiAgfVxuICBjb25zdCBleHBlY3RlZENvbnRyb2xJZDogYW55ID0gcGFyc2VTdGVwLmlucHV0cy5JbnB1dFBheWxvYWQuZXhwZWN0ZWRfY29udHJvbF9pZDtcbiAgZXhwZWN0KEFycmF5LmlzQXJyYXkoZXhwZWN0ZWRDb250cm9sSWQpKS50b0JlKHRydWUpO1xuICBleHBlY3QoZXhwZWN0ZWRDb250cm9sSWQgYXMgc3RyaW5nW10pLnRvRXF1YWwoZXhwZWN0LmFycmF5Q29udGFpbmluZyhbcnVuYm9vay5nZXRDb250cm9sTmFtZSgpXSkpO1xuICAvLyBUT0RPIG1hdGNoIGtub3duIG91dHB1dHMgb2YgcGFyc2VfaW5wdXQgYW5kIHR5cGVzXG59KTtcblxuZnVuY3Rpb24gdmFsaWRhdGVTY3JpcHRTdGVwKHJ1bmJvb2s6IFJ1bmJvb2tUZXN0SGVscGVyLCBzdGVwOiBhbnkpIHtcbiAgaWYgKHN0ZXAub3V0cHV0cykge1xuICAgIGZvciAoY29uc3Qgb3V0cHV0IG9mIHN0ZXAub3V0cHV0cykge1xuICAgICAgLy8gY2FwdHVyaW5nIHRoZSBlbnRpcmUgb3V0cHV0IHdpdGggJyQnIGlzIG9rXG4gICAgICBpZiAob3V0cHV0LlNlbGVjdG9yICE9PSAnJCcpIHtcbiAgICAgICAgLy8gc2VsZWN0b3JzIG11c3QgaGF2ZSB0aGUgY29ycmVjdCBwcmVmaXhcbiAgICAgICAgZXhwZWN0KG91dHB1dC5TZWxlY3RvcikudG9NYXRjaCgvXFwkXFwuUGF5bG9hZC4qLyk7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIC8vIFRPRE8gc2NyaXB0cyBtdXN0IGJlIHRlbXBsYXRlcyB0aGF0IGxpbmsgdG8gZmlsZXNcbiAgZXhwZWN0KHN0ZXAuaW5wdXRzLlJ1bnRpbWUpLnRvU3RyaWN0RXF1YWwoJ3B5dGhvbjMuOCcpO1xufVxuXG50ZXN0LmVhY2gocnVuYm9va3MpKCclcyBoYXMgdmFsaWQgc3RlcHMnLCAocnVuYm9vazogUnVuYm9va1Rlc3RIZWxwZXIpID0+IHtcbiAgY29uc3Qgc3RlcHM6IGFueVtdID0gcnVuYm9vay5nZXRPYmplY3QoKS5tYWluU3RlcHM7XG4gIC8vIE11c3QgaGF2ZSBhdCBsZWFzdCBvbmUgc3RlcFxuICBleHBlY3Qoc3RlcHMubGVuZ3RoKS50b0JlR3JlYXRlclRoYW4oMCk7XG4gIGZvciAoY29uc3Qgc3RlcCBvZiBzdGVwcykge1xuICAgIGNvbnN0IHN0ZXBOYW1lOiBzdHJpbmcgPSBzdGVwLm5hbWU7XG4gICAgLy8gTXVzdCBoYXZlIG5hbWVcbiAgICBleHBlY3Qoc3RlcE5hbWUubGVuZ3RoKS50b0JlR3JlYXRlclRoYW4oMCk7XG4gICAgY29uc3Qgc3RlcEFjdGlvbjogc3RyaW5nID0gc3RlcC5hY3Rpb25cbiAgICBzd2l0Y2goc3RlcEFjdGlvbikge1xuICAgICAgY2FzZSAnYXdzOmV4ZWN1dGVTY3JpcHQnOlxuICAgICAgICB2YWxpZGF0ZVNjcmlwdFN0ZXAocnVuYm9vaywgc3RlcCk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAnYXdzOmV4ZWN1dGVBdXRvbWF0aW9uJzpcbiAgICAgICAgLy8gVE9ET1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJ2F3czpleGVjdXRlQXdzQXBpJzpcbiAgICAgICAgLy8gVE9ET1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJ2F3czp3YWl0Rm9yQXdzUmVzb3VyY2VQcm9wZXJ0eSc6XG4gICAgICAgIC8vIFRPRE9cbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICdhd3M6YXNzZXJ0QXdzUmVzb3VyY2VQcm9wZXJ0eSc6XG4gICAgICAgIC8vIFRPRE9cbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICdhd3M6YnJhbmNoJzpcbiAgICAgICAgLy8gVE9ET1xuICAgICAgICBicmVhaztcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHRocm93IEVycm9yKGBVbnJlY29nbml6ZWQgc3RlcCBhY3Rpb246ICR7c3RlcEFjdGlvbn1gKVxuICAgIH1cbiAgfVxufSk7XG5cbmZ1bmN0aW9uIGlzU3NtUGFyYW1ldGVyKHBhcmFtZXRlcjogc3RyaW5nKTogYm9vbGVhbiB7XG4gIHJldHVybiBwYXJhbWV0ZXIuc3RhcnRzV2l0aCgnc3NtOi8nKTtcbn1cblxuZnVuY3Rpb24gdmFsaWRhdGVUZW1wbGF0ZVZhcmlhYmxlc1JlY3Vyc2l2ZShvYmo6IGFueSwgcnVuYm9vazogUnVuYm9va1Rlc3RIZWxwZXIpIHtcbiAgaWYgKG9iaiA9PT0gdW5kZWZpbmVkIHx8IG9iaiA9PT0gbnVsbCkge1xuICAgIHJldHVybjtcbiAgfSBlbHNlIGlmICh0eXBlb2Ygb2JqID09PSAnc3RyaW5nJykge1xuICAgIGNvbnN0IG9iakFzU3RyaW5nOiBzdHJpbmcgPSBvYmogYXMgc3RyaW5nO1xuICAgIGNvbnN0IHJlZ2V4OiBSZWdFeHAgPSAvKD88PXt7KSguKj8pKD89fX0pL2c7XG4gICAgbGV0IG1hdGNoZXM7XG4gICAgd2hpbGUgKG1hdGNoZXMgPSByZWdleC5leGVjKG9iakFzU3RyaW5nKSkge1xuICAgICAgY29uc3QgbWF0Y2g6IHN0cmluZyA9IG1hdGNoZXNbMV0udHJpbSgpO1xuICAgICAgaWYgKCFpc1NzbVBhcmFtZXRlcihtYXRjaCkpIHtcbiAgICAgICAgZXhwZWN0KHJ1bmJvb2suZ2V0VmFsaWRWYXJpYWJsZXMoKSkudG9Db250YWluKG1hdGNoKTtcbiAgICAgIH1cbiAgICB9XG4gIH0gZWxzZSBpZiAodHlwZW9mIG9ialtTeW1ib2wuaXRlcmF0b3JdID09PSAnZnVuY3Rpb24nKSB7XG4gICAgZm9yIChjb25zdCBlbGVtZW50IG9mIG9iaikge1xuICAgICAgdmFsaWRhdGVUZW1wbGF0ZVZhcmlhYmxlc1JlY3Vyc2l2ZShlbGVtZW50LCBydW5ib29rKTtcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgZm9yIChjb25zdCB2YWx1ZSBvZiBPYmplY3QudmFsdWVzKG9iaikpIHtcbiAgICAgIHZhbGlkYXRlVGVtcGxhdGVWYXJpYWJsZXNSZWN1cnNpdmUodmFsdWUsIHJ1bmJvb2spO1xuICAgIH1cbiAgfVxufVxuXG50ZXN0LmVhY2gocnVuYm9va3MpKCclcyBoYXMgdmFsaWQgdGVtcGxhdGUgdmFyaWFibGVzJywgKHJ1bmJvb2s6IFJ1bmJvb2tUZXN0SGVscGVyKSA9PiB7XG4gIHZhbGlkYXRlVGVtcGxhdGVWYXJpYWJsZXNSZWN1cnNpdmUocnVuYm9vay5nZXRPYmplY3QoKSwgcnVuYm9vayk7XG59KTtcblxudGVzdC5za2lwLmVhY2gocnVuYm9va3MpKCclcyBoYXMgdmFsaWQgb3V0cHV0IHZhcmlhYmxlcycsIChydW5ib29rOiBSdW5ib29rVGVzdEhlbHBlcikgPT4ge1xuICBpZiAocnVuYm9vay5nZXRPYmplY3QoKS5vdXRwdXRzKSB7XG4gICAgZm9yIChjb25zdCBvdXRwdXQgb2YgcnVuYm9vay5nZXRPYmplY3QoKS5vdXRwdXRzKSB7XG4gICAgICBleHBlY3QocnVuYm9vay5nZXRWYWxpZFZhcmlhYmxlcygpKS50b0NvbnRhaW4ob3V0cHV0KTtcbiAgICB9XG4gIH1cbn0pO1xuIl19