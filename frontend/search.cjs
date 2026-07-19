const fs = require('fs');
const path = require('path');

function searchFiles(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        if (file === 'node_modules' || file === '.git' || file === 'dist' || file === 'build') continue;
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            searchFiles(fullPath);
        } else if (fullPath.endsWith('.js') || fullPath.endsWith('.jsx')) {
            const content = fs.readFileSync(fullPath, 'utf8');
            if (content.includes('Load More') || content.includes('load more')) {
                console.log(fullPath);
            }
        }
    }
}
searchFiles('c:/Users/Dell/Favorites/Documents/SHRUTI/OneDrive/Web development/EventSync/EventSync/frontend');
