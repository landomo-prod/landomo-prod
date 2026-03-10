const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const outputDir = './topreality_analysis';

async function analyzeHTML() {
    console.log('🔍 Analyzing TopReality.sk HTML structure...\n');

    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();

    try {
        // Navigate to search results page
        console.log('📍 Loading search page...');
        await page.goto('https://www.topreality.sk/hladanie/', { waitUntil: 'networkidle', timeout: 60000 });
        await page.waitForTimeout(3000);

        // Get the HTML structure of property listings
        console.log('📍 Analyzing property listing structure...');

        const listingInfo = await page.evaluate(() => {
            // Find all possible property card elements
            const cards = document.querySelectorAll('[class*="estate"], [class*="item"], [class*="property"], [class*="listing"], article, .row');

            const results = [];

            cards.forEach((card, index) => {
                if (index < 10) { // Only first 10
                    const data = {
                        index: index,
                        html: card.outerHTML.substring(0, 500),
                        classes: card.className,
                        id: card.id,
                        links: Array.from(card.querySelectorAll('a')).map(a => ({
                            href: a.href,
                            text: a.textContent.trim().substring(0, 50)
                        })),
                        images: Array.from(card.querySelectorAll('img')).map(img => ({
                            src: img.src,
                            alt: img.alt
                        })),
                        text: card.textContent.trim().substring(0, 200)
                    };
                    results.push(data);
                }
            });

            return {
                totalCards: cards.length,
                samples: results,
                documentStructure: {
                    hasMainContent: !!document.querySelector('main, #content, .content, [role="main"]'),
                    hasListingContainer: !!document.querySelector('[class*="listing"], [class*="results"], [class*="estates"]'),
                    bodyClasses: document.body.className,
                    mainContentClasses: document.querySelector('main, #content, .content')?.className
                }
            };
        });

        console.log('\n📊 Listing Structure Analysis:');
        console.log(`Total cards found: ${listingInfo.totalCards}`);
        console.log(`Document structure:`, JSON.stringify(listingInfo.documentStructure, null, 2));

        fs.writeFileSync(
            path.join(outputDir, 'html_structure.json'),
            JSON.stringify(listingInfo, null, 2)
        );

        // Get the full page HTML
        const fullHTML = await page.content();
        fs.writeFileSync(
            path.join(outputDir, 'full_page.html'),
            fullHTML
        );

        // Check for property detail page
        console.log('\n📍 Looking for property links...');

        const propertyUrls = await page.evaluate(() => {
            const links = Array.from(document.querySelectorAll('a'));
            return links
                .filter(a => a.href.includes('/nehnutelnost/') || a.href.includes('/detail/'))
                .map(a => a.href)
                .slice(0, 5);
        });

        console.log('Found property URLs:', propertyUrls);

        if (propertyUrls.length > 0) {
            console.log('\n📍 Analyzing property detail page...');
            await page.goto(propertyUrls[0], { waitUntil: 'networkidle', timeout: 60000 });
            await page.waitForTimeout(2000);

            const detailHTML = await page.content();
            fs.writeFileSync(
                path.join(outputDir, 'detail_page.html'),
                detailHTML
            );

            const detailInfo = await page.evaluate(() => {
                return {
                    title: document.title,
                    h1: document.querySelector('h1')?.textContent,
                    price: document.querySelector('[class*="price"], [class*="cena"]')?.textContent,
                    description: document.querySelector('[class*="description"], [class*="popis"]')?.textContent?.substring(0, 200),
                    images: Array.from(document.querySelectorAll('img')).map(img => img.src).slice(0, 5),
                    metaTags: Array.from(document.querySelectorAll('meta')).map(meta => ({
                        name: meta.getAttribute('name'),
                        property: meta.getAttribute('property'),
                        content: meta.getAttribute('content')
                    }))
                };
            });

            console.log('\n📊 Detail Page Info:', JSON.stringify(detailInfo, null, 2));

            fs.writeFileSync(
                path.join(outputDir, 'detail_page_info.json'),
                JSON.stringify(detailInfo, null, 2)
            );
        }

        console.log('\n✅ HTML analysis complete!');

    } catch (error) {
        console.error('❌ Error:', error.message);
    }

    await browser.close();
}

analyzeHTML().catch(console.error);
