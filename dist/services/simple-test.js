import { ScholarInterface } from './scholar-interface.js';
async function simpleTest() {
    const scholarInterface = new ScholarInterface();
    // Test the parseAuthorInfo method directly
    const testCases = [
        "MI Jordan, TM Mitchell - Science, 2015 - science.org"
    ];
    testCases.forEach(testCase => {
        console.log('Testing:', testCase);
        // Access the private method through any means necessary for testing
        const result = scholarInterface.parseAuthorInfo(testCase);
        console.log('Result:', result);
    });
}
simpleTest().catch(console.error);
//# sourceMappingURL=simple-test.js.map