// Test specific parsing cases
function testSpecificParsing() {
  console.log('Testing specific parsing cases...');
  
  // Test cases from the debug output
  const testCases = [
    "ZH Zhou - 2021 - books.google.com",
    "E Alpaydin - 2021 - books.google.com", 
    "MI Jordan, TM Mitchell - Science, 2015 - science.org",
    "I El Naqa, MJ Murphy - Machine learning in radiation oncology: theory and …, 2015 - Springer",
    "TG Dietterich - Annual review of computer science, 1990 - engr.oregonstate.edu"
  ];
  
  testCases.forEach((testCase, index) => {
    console.log(`\n=== Test Case ${index + 1}: ${testCase} ===`);
    const result = parseAuthorInfoTest(testCase);
    console.log('Result:', result);
  });
}

function parseAuthorInfoTest(authorInfoText: string): { authors: string[], venue?: string, year?: number } {
  const authors: string[] = [];
  let venue: string | undefined;
  let year: number | undefined;

  if (!authorInfoText) {
    return { authors };
  }

  console.log('Input:', JSON.stringify(authorInfoText));

  // Split by ' - ' to separate different parts
  const parts = authorInfoText.split(' - ');
  console.log('Parts:', parts.map(p => JSON.stringify(p)));
  
  if (parts.length === 0) {
    return { authors };
  }

  const firstPart = parts[0].trim();
  console.log('First part:', JSON.stringify(firstPart));
  
  // Check if we have the format: "Authors - Venue, Year - Publisher"
  if (parts.length >= 3) {
    console.log('Format: Authors - Venue, Year - Publisher');
    // This is likely: "Author1, Author2 - Venue, Year - Publisher"
    // First part: authors
    // Second part: venue, year
    // Third part: publisher
    
    const authorNames = firstPart.split(',').map(name => name.trim()).filter(name => name.length > 0);
    authors.push(...authorNames);
    console.log('Authors:', authors);
    
    // Parse second part for venue and year
    const secondPart = parts[1].trim();
    console.log('Second part:', JSON.stringify(secondPart));
    const yearMatch = secondPart.match(/\b(\d{4})\b/);
    if (yearMatch) {
      year = parseInt(yearMatch[1], 10);
      venue = secondPart.replace(/\b\d{4}\b/, '').replace(/,\s*$/, '').trim();
      venue = venue.replace(/^,\s*/, '').replace(/,\s*$/, '').trim();
      if (venue === '') {
        venue = undefined;
      }
      console.log('Year:', year, 'Venue:', venue);
    } else {
      // No year in second part, treat as venue
      venue = secondPart;
      console.log('Venue (no year):', venue);
    }
  } else if (parts.length === 2) {
    console.log('Format: Two parts');
    // This could be: "Authors - Year" or "Authors - Venue" or "Authors - Venue, Year"
    const secondPart = parts[1].trim();
    console.log('Second part:', JSON.stringify(secondPart));
    
    // Check if second part is just a year
    const justYearMatch = secondPart.match(/^(\d{4})$/);
    if (justYearMatch) {
      console.log('Second part is just year');
      // Format: "Authors - Year"
      const authorNames = firstPart.split(',').map(name => name.trim()).filter(name => name.length > 0);
      authors.push(...authorNames);
      year = parseInt(justYearMatch[1], 10);
    } else {
      // Check if second part contains a year
      const yearMatch = secondPart.match(/\b(\d{4})\b/);
      if (yearMatch) {
        console.log('Second part contains year');
        // Format: "Authors - Venue, Year"
        const authorNames = firstPart.split(',').map(name => name.trim()).filter(name => name.length > 0);
        authors.push(...authorNames);
        year = parseInt(yearMatch[1], 10);
        venue = secondPart.replace(/\b\d{4}\b/, '').replace(/,\s*$/, '').trim();
        venue = venue.replace(/^,\s*/, '').replace(/,\s*$/, '').trim();
        if (venue === '') {
          venue = undefined;
        }
      } else {
        console.log('Second part is venue only');
        // Format: "Authors - Venue" (no year)
        const authorNames = firstPart.split(',').map(name => name.trim()).filter(name => name.length > 0);
        authors.push(...authorNames);
        venue = secondPart;
      }
    }
  } else {
    console.log('Format: Single part');
    // Only one part, treat as authors
    const authorNames = firstPart.split(',').map(name => name.trim()).filter(name => name.length > 0);
    authors.push(...authorNames);
  }

  return { authors, venue, year };
}

testSpecificParsing();