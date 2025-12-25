import { ScholarInterface } from './scholar-interface.js';

async function testParsing() {
  console.log('Testing Google Scholar HTML parsing...');
  
  const scholarInterface = new ScholarInterface();
  
  try {
    // Test with a simple search
    const searchUrl = scholarInterface.buildSearchUrl({
      keywords: ['machine learning'],
      maxResults: 5
    });
    
    console.log('Search URL:', searchUrl);
    
    // Perform the request
    const html = await scholarInterface.performRequest(searchUrl);
    console.log('HTML length:', html.length);
    
    // Parse the results
    const papers = await scholarInterface.parseSearchResults(html, false, false);
    
    console.log(`\nFound ${papers.length} papers:`);
    
    papers.forEach((paper, index) => {
      console.log(`\n${index + 1}. ${paper.citation.title}`);
      console.log(`   Authors: ${paper.citation.authors.join(', ')}`);
      console.log(`   Venue: ${paper.citation.venue || 'N/A'}`);
      console.log(`   Year: ${paper.citation.year || 'N/A'}`);
      console.log(`   Citations: ${paper.citation.citationCount || 'N/A'}`);
      console.log(`   URL: ${paper.citation.url || 'N/A'}`);
      if (paper.abstract) {
        console.log(`   Abstract: ${paper.abstract.substring(0, 100)}...`);
      }
    });
    
    if (papers.length === 0) {
      console.log('\nNo papers found. This might indicate parsing issues.');
      // Let's examine the HTML structure
      console.log('\nLooking for result containers...');
      const cheerio = await import('cheerio');
      const $ = cheerio.load(html);
      
      const resultElements = $('.gs_r.gs_or.gs_scl');
      console.log(`Found ${resultElements.length} result containers with .gs_r.gs_or.gs_scl`);
      
      if (resultElements.length === 0) {
        // Try alternative selectors
        const altResults = $('.gs_r');
        console.log(`Found ${altResults.length} elements with .gs_r`);
        
        const altResults2 = $('[data-cid]');
        console.log(`Found ${altResults2.length} elements with data-cid attribute`);
      }
    }
    
  } catch (error) {
    console.error('Error during testing:', error);
  }
}

// Run the test
testParsing().catch(console.error);