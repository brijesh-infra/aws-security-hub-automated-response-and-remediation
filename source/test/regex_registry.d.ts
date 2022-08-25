export declare class RegexTestCase {
    _regex: string;
    _description: string;
    _validTestStrings: string[];
    _invalidTestStrings: string[];
    _disabled: boolean;
    constructor(regex: string, description: string, validTestStrings: string[], invalidTestStrings: string[]);
    getId(): string;
    runTests(): void;
    disable(): void;
    toString(): string;
}
export declare class RegexMatchTestCase extends RegexTestCase {
    _matchTestCases: {
        testString: string;
        matches: string[];
    }[];
    constructor(regex: string, description: string, validTestStrings: string[], invalidTestStrings: string[]);
    runTests(): void;
    addMatchTestCase(testString: string, matches: string[]): void;
}
export declare class RegexRegistry {
    _cases: Map<string, RegexTestCase>;
    _regexForAutomationAssumeRole: string | undefined;
    constructor();
    addCase(testCase: RegexTestCase): void;
    getAllCases(): RegexTestCase[];
    setRegexForAutomationAssumeRole(regex: string): void;
    getRegexForAutomationAssumeRole(): string;
    has(regex: string): boolean;
}
export declare function getRegexRegistry(): RegexRegistry;
