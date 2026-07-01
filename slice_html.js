const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');

function extractSections() {
    let extracted = 0;
    while(true) {
        let startIdx = html.indexOf('<section id="tab-');
        if (startIdx === -1) break;
        
        let idMatch = html.substring(startIdx).match(/<section id="([^"]+)"/);
        if (!idMatch) break;
        let tabId = idMatch[1];
        
        // find matching closing tag
        let openTags = 0;
        let currentIdx = startIdx + 1; // move past the first '<'
        let endIdx = -1;
        
        while(currentIdx < html.length) {
            let nextOpen = html.indexOf('<section', currentIdx);
            let nextClose = html.indexOf('</section>', currentIdx);
            
            if (nextClose === -1) {
                console.error("Malformed HTML!");
                break;
            }
            
            if (nextOpen !== -1 && nextOpen < nextClose) {
                // Nested section
                openTags++;
                currentIdx = nextOpen + 1;
            } else {
                // Closing section
                if (openTags === 0) {
                    endIdx = nextClose + 10;
                    break;
                } else {
                    openTags--;
                    currentIdx = nextClose + 1;
                }
            }
        }
        
        if (endIdx !== -1) {
            let sectionHtml = html.substring(startIdx, endIdx);
            fs.writeFileSync(path.join(__dirname, 'pages', `${tabId.replace('tab-', '')}.html`), sectionHtml);
            html = html.substring(0, startIdx) + `<!-- Extracted ${tabId} -->\n` + html.substring(endIdx);
            extracted++;
        } else {
            break;
        }
    }
    
    // Replace the first extracted comment with the app-content div
    html = html.replace(/<!-- Extracted tab-[^>]+ -->\n/, '<div id="app-content"></div>\n');
    html = html.replace(/<!-- Extracted tab-[^>]+ -->\n/g, '');
    
    fs.writeFileSync(indexPath, html);
    console.log(`Extracted ${extracted} sections.`);
}

extractSections();
