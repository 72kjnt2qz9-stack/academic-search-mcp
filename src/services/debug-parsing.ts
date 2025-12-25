import { ScholarInterface } from './scholar-interface.js';
import * as cheerio from 'cheerio';

async function debugParsing() {
  console.log('Debugging Google Scholar author info parsing...');
  
  const scholarInterface = new ScholarInterface();
  
  try {
    const searchUrl = scholarInterface.buildSearchUrl({
      keywords: ['machine learning'],
      maxResults: 5
    });
    
    const html = await scholarInterface.performRequest(searchUrl);
    const $ = cheerio.load(html);
    
    // Get the first few result items and examine their structure
    const resultElements = $('.gs_r.gs_or.gs_scl').slice(0, 5);
    
    resultElements.each((index, element) => {
      const $item = $(element);
      
      console.log(`\n=== Raw HTML Result ${index + 1} ===`);
      
      // Title
      const $titleLink = $item.find('.gs_rt a');
      const title = $titleLink.text().trim();
      console.log('Title:', title);
      
      // Author info raw text
      const $authorInfo = $item.find('.gs_a');
      const authorInfoText = $authorInfo.text().trim();
      console.log('Raw author info:', JSON.stringify(authorInfoText));
    });
    
    // Now parse using the actual parser
    const papers = await scholarInterface.parseSearchResults(html, false, false);
    
    console.log(`\n\nParsed Results:`);
    papers.slice(0, 5).forEach((paper, index) => {
      console.log(`\n=== Parsed Result ${index + 1} ===`);
      console.log('Title:', paper.citation.title);
      console.log('Authors:', paper.citation.authors);
      console.log('Venue:', paper.citation.venue || 'N/A');
      console.log('Year:', paper.citation.year || 'N/A');
    });
    
  } catch (error) {
    console.error('Error during debugging:', error);
  }
}

// Run the debug
debugParsing().catch(console.error);