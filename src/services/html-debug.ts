import { ScholarInterface } from './scholar-interface.js';
import * as cheerio from 'cheerio';

async function debugHtml() {
  console.log('Debugging Google Scholar HTML structure...');
  
  const scholarInterface = new ScholarInterface();
  
  try {
    const searchUrl = scholarInterface.buildSearchUrl({
      keywords: ['machine learning'],
      maxResults: 3
    });
    
    const html = await scholarInterface.performRequest(searchUrl);
    const $ = cheerio.load(html);
    
    // Get the first few result items and examine their raw HTML
    const resultElements = $('.gs_r.gs_or.gs_scl').slice(0, 3);
    
    resultElements.each((index, element) => {
      const $item = $(element);
      
      console.log(`\n=== Result ${index + 1} HTML Structure ===`);
      
      // Show the raw HTML for the author info section
      const $authorInfo = $item.find('.gs_a');
      console.log('Author info HTML:', $authorInfo.html());
      console.log('Author info text:', $authorInfo.text());
      
      // Let's also look at the overall structure
      console.log('\nFull result HTML:');
      console.log($item.html());
      console.log('\n' + '='.repeat(80));
    });
    
  } catch (error) {
    console.error('Error during debugging:', error);
  }
}

// Run the debug
debugHtml().catch(console.error);