import axios from 'axios';

interface UniquenessResult {
  category: string;
  categoryId: number;
  hashIds: Set<number>;
  totalFetched: number;
  uniqueCount: number;
  duplicates: number;
}

const categoryMap: Record<number, string> = {
  1: 'Apartments',
  2: 'Houses',
  3: 'Land',
  4: 'Commercial'
};

const getRandomUserAgent = (): string => {
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
  ];
  return userAgents[Math.floor(Math.random() * userAgents.length)];
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function testUniqueness() {
  console.log('🔍 SReality Hash ID Uniqueness Test');
  console.log('===================================\n');

  const allHashIds = new Map<number, string[]>(); // hashId -> categories
  const categoryResults: UniquenessResult[] = [];

  const categories = [1, 2, 3, 4];
  const userAgent = getRandomUserAgent();
  const perPage = 100;
  const tms = Date.now();

  for (const categoryId of categories) {
    const categoryName = categoryMap[categoryId];
    console.log(`\nScanning ${categoryName} (Category ${categoryId})...`);

    const hashIds = new Set<number>();
    let page = 1;
    let totalFetched = 0;
    let duplicatesInCategory = 0;

    while (page <= 5) { // Test first 5 pages per category
      try {
        const url = `https://www.sreality.cz/api/cs/v2/estates?page=${page}&per_page=${perPage}&category_main_cb=${categoryId}&tms=${tms}`;
        const response = await axios.get(url, {
          headers: { 'User-Agent': userAgent },
          timeout: 30000
        });

        const estates = response.data._embedded?.estates || [];
        if (estates.length === 0) break;

        estates.forEach((estate: any) => {
          if (estate.hash_id) {
            totalFetched++;
            if (hashIds.has(estate.hash_id)) {
              duplicatesInCategory++;
            } else {
              hashIds.add(estate.hash_id);
            }

            // Track across all categories
            if (!allHashIds.has(estate.hash_id)) {
              allHashIds.set(estate.hash_id, []);
            }
            allHashIds.get(estate.hash_id)!.push(categoryName);
          }
        });

        console.log(`  Page ${page}: ${estates.length} estates (${hashIds.size} unique)`);
        page++;
        await delay(300);
      } catch (error) {
        console.error(`  Error on page ${page}:`, (error as Error).message);
        break;
      }
    }

    categoryResults.push({
      category: categoryName,
      categoryId,
      hashIds,
      totalFetched,
      uniqueCount: hashIds.size,
      duplicates: duplicatesInCategory
    });
  }

  // Analyze cross-category duplicates
  console.log('\n\n📊 Cross-Category Uniqueness Analysis');
  console.log('=====================================\n');

  let crossCategoryDuplicates = 0;
  let multiCategoryListings = 0;

  allHashIds.forEach((categories, hashId) => {
    if (categories.length > 1) {
      crossCategoryDuplicates++;
      multiCategoryListings++;
      if (multiCategoryListings <= 5) {
        console.log(`Hash ${hashId}: Found in ${categories.join(', ')}`);
      }
    }
  });

  if (crossCategoryDuplicates > 5) {
    console.log(`... and ${crossCategoryDuplicates - 5} more\n`);
  }

  // Summary
  console.log('\n📋 Summary');
  console.log('==========\n');

  console.log('By Category:');
  let totalAcrossCategories = 0;
  categoryResults.forEach(result => {
    console.log(`  ${result.category}:`);
    console.log(`    - Total Fetched: ${result.totalFetched}`);
    console.log(`    - Unique: ${result.uniqueCount}`);
    console.log(`    - Duplicates in Category: ${result.duplicates}`);
    totalAcrossCategories += result.uniqueCount;
  });

  console.log(`\nTotal Unique Hash IDs (All Categories): ${allHashIds.size}`);
  console.log(`Total Unique per Category Sum: ${totalAcrossCategories}`);
  console.log(`Cross-Category Duplicates: ${crossCategoryDuplicates}`);
  console.log(`Listings in Multiple Categories: ${crossCategoryDuplicates}`);

  // Calculate uniqueness percentage
  const expectedTotal = categoryResults.reduce((sum, r) => sum + r.totalFetched, 0);
  const duplicatePercentage = ((expectedTotal - allHashIds.size) / expectedTotal * 100).toFixed(2);

  console.log(`\nDuplicate Percentage: ${duplicatePercentage}%`);
  console.log(`Uniqueness Score: ${(100 - parseFloat(duplicatePercentage)).toFixed(2)}%`);

  // Write report
  const report = {
    timestamp: new Date().toISOString(),
    categoryAnalysis: categoryResults.map(r => ({
      category: r.category,
      categoryId: r.categoryId,
      totalFetched: r.totalFetched,
      uniqueCount: r.uniqueCount,
      duplicatesInCategory: r.duplicates
    })),
    crossCategoryAnalysis: {
      totalUniqueHashIds: allHashIds.size,
      crossCategoryDuplicates,
      listingsInMultipleCategories: crossCategoryDuplicates,
      expectedTotalIfNoOverlap: expectedTotal,
      actualUnique: allHashIds.size,
      overlapPercentage: parseFloat(duplicatePercentage)
    },
    conclusion: crossCategoryDuplicates === 0
      ? 'No overlap - each listing appears in exactly one category'
      : `${crossCategoryDuplicates} listings appear in multiple categories`
  };

  const fs = await import('fs/promises');
  await fs.writeFile(
    '/Users/samuelseidel/Development/landomo-world/scrapers/Czech Republic/sreality/UNIQUENESS_TEST_REPORT.json',
    JSON.stringify(report, null, 2)
  );

  console.log('\n✅ Uniqueness report saved to UNIQUENESS_TEST_REPORT.json');
}

testUniqueness().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});
