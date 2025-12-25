"use strict";
// Test the year parsing logic specifically
function testYearParsing() {
    const testCases = [
        "ZH Zhou - 2021 - books.google.com",
        "E Alpaydin - 2021 - books.google.com",
        "MI Jordan, TM Mitchell - Science, 2015 - science.org",
        "I El Naqa, MJ Murphy - Machine learning in radiation oncology: theory and …, 2015 - Springer",
        "TG Dietterich - Annual review of computer science, 1990 - engr.oregonstate.edu"
    ];
    testCases.forEach((testCase, index) => {
        console.log(`\n=== Test Case ${index + 1} ===`);
        console.log('Input:', testCase);
        const result = parseAuthorInfo(testCase);
        console.log('Result:', result);
    });
}
function parseAuthorInfo(authorInfoText) {
    const authors = [];
    let venue;
    let year;
    if (!authorInfoText) {
        return { authors };
    }
    // Split by ' - ' to separate different parts
    const parts = authorInfoText.split(' - ');
    console.log('Parts:', parts);
    if (parts.length > 0) {
        // First part contains authors
        const authorPart = parts[0].trim();
        if (authorPart) {
            // Split authors by comma, but be careful about years that might be mixed in
            const cleanAuthorPart = authorPart.replace(/\s+/g, ' '); // normalize whitespace
            // Check if the author part contains a year (which would indicate it's actually venue info)
            const hasYear = /\b\d{4}\b/.test(cleanAuthorPart);
            console.log('Author part has year:', hasYear);
            if (!hasYear) {
                // Normal case: just authors
                const authorNames = cleanAuthorPart.split(',').map(name => name.trim()).filter(name => name.length > 0);
                authors.push(...authorNames);
            }
            else {
                // Edge case: the "author" part actually contains venue info
                // This happens when the format is different than expected
                // Try to extract just the authors before any venue/year info
                const authorMatch = cleanAuthorPart.match(/^([^-]+?)(?:\s*-\s*|\s*,\s*\d{4})/);
                if (authorMatch) {
                    const authorNames = authorMatch[1].split(',').map(name => name.trim()).filter(name => name.length > 0);
                    authors.push(...authorNames);
                }
                else {
                    // Fallback: treat the whole thing as authors
                    const authorNames = cleanAuthorPart.split(',').map(name => name.trim()).filter(name => name.length > 0);
                    authors.push(...authorNames);
                }
            }
        }
    }
    if (parts.length > 1) {
        // Second part typically contains venue and year, or just year
        const venueYearPart = parts[1].trim();
        console.log('Venue/Year part:', venueYearPart);
        // Check if this part is just a year (4 digits only)
        const justYearMatch = venueYearPart.match(/^(\d{4})$/);
        if (justYearMatch) {
            // Simple case: "Authors - Year - Publisher"
            year = parseInt(justYearMatch[1], 10);
            console.log('Found simple year:', year);
        }
        else {
            // Complex case: "Authors - Venue, Year - Publisher"
            // Extract year (4 digits) from this part
            const yearMatch = venueYearPart.match(/\b(\d{4})\b/);
            if (yearMatch) {
                year = parseInt(yearMatch[1], 10);
                console.log('Found year in complex part:', year);
                // Remove year from venue string
                venue = venueYearPart.replace(/\b\d{4}\b/, '').replace(/,\s*$/, '').trim();
                // Clean up extra commas and spaces
                venue = venue.replace(/^,\s*/, '').replace(/,\s*$/, '').trim();
                if (venue === '') {
                    venue = undefined;
                }
                console.log('Venue after cleanup:', venue);
            }
            else {
                venue = venueYearPart;
                console.log('No year found, using as venue:', venue);
            }
        }
    }
    return { authors, venue, year };
}
testYearParsing();
//# sourceMappingURL=test-year-parsing.js.map