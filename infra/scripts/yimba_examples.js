/**
 * YIMBA.sk Scraper - Usage Examples
 *
 * Comprehensive examples showing all scraper capabilities
 */

const YimbaScraper = require('./yimba_scraper');
const fs = require('fs');

// Initialize scraper
const scraper = new YimbaScraper();

// ============================================================================
// EXAMPLE 1: Get all projects
// ============================================================================
async function example1_getAllProjects() {
    console.log('\n=== EXAMPLE 1: Get All Projects ===\n');

    const projects = await scraper.getProjects();
    console.log(`Total projects: ${projects.length}`);
    console.log('\nFirst 3 projects:');
    projects.slice(0, 3).forEach(p => {
        console.log(`- ${p.name} (${p.slug}) - Status: ${p.status}`);
    });

    return projects;
}

// ============================================================================
// EXAMPLE 2: Filter by status
// ============================================================================
async function example2_filterByStatus() {
    console.log('\n=== EXAMPLE 2: Filter by Status ===\n');

    // Get projects under construction
    const underConstruction = await scraper.getProjectsByStatus(2);
    console.log(`Projects under construction: ${underConstruction.length}`);

    // Get completed projects
    const completed = await scraper.getProjectsByStatus(3);
    console.log(`Completed projects: ${completed.length}`);

    // Get cancelled projects
    const cancelled = await scraper.getProjectsByStatus(4);
    console.log(`Cancelled projects: ${cancelled.length}`);

    return { underConstruction, completed, cancelled };
}

// ============================================================================
// EXAMPLE 3: Search functionality
// ============================================================================
async function example3_searchProjects() {
    console.log('\n=== EXAMPLE 3: Search Projects ===\n');

    // Search for apartments
    const apartments = await scraper.searchProjects('byt');
    console.log(`Found ${apartments.length} apartment projects`);
    if (apartments.length > 0) {
        console.log(`Example: ${apartments[0].name}`);
    }

    // Search for specific location
    const bratislava = await scraper.searchProjects('bratislava');
    console.log(`Found ${bratislava.length} projects with 'bratislava' in name`);

    return { apartments, bratislava };
}

// ============================================================================
// EXAMPLE 4: Get project statistics
// ============================================================================
async function example4_getStatistics() {
    console.log('\n=== EXAMPLE 4: Project Statistics ===\n');

    const stats = await scraper.getStatistics();
    console.log(JSON.stringify(stats, null, 2));

    // Calculate percentages
    const percentages = {
        planning: ((stats.byStatus.planning / stats.total) * 100).toFixed(1),
        construction: ((stats.byStatus.construction / stats.total) * 100).toFixed(1),
        completed: ((stats.byStatus.completed / stats.total) * 100).toFixed(1),
        cancelled: ((stats.byStatus.cancelled / stats.total) * 100).toFixed(1)
    };

    console.log('\nPercentages:');
    console.log(`- Planning: ${percentages.planning}%`);
    console.log(`- Under Construction: ${percentages.construction}%`);
    console.log(`- Completed: ${percentages.completed}%`);
    console.log(`- Cancelled: ${percentages.cancelled}%`);

    return stats;
}

// ============================================================================
// EXAMPLE 5: Get project detail (HTML)
// ============================================================================
async function example5_getProjectDetail() {
    console.log('\n=== EXAMPLE 5: Get Project Detail ===\n');

    // Get first project from list
    const projects = await scraper.getProjects();
    const firstProject = projects[0];

    console.log(`Fetching details for: ${firstProject.name}`);

    const html = await scraper.getProjectDetail(firstProject.slug);
    console.log(`HTML length: ${html.length} characters`);

    // Basic parsing example
    const hasGallery = html.includes('gallery');
    const hasMap = html.includes('map') || html.includes('mapa');

    console.log(`Has gallery: ${hasGallery}`);
    console.log(`Has map: ${hasMap}`);

    return html;
}

// ============================================================================
// EXAMPLE 6: Advanced filtering
// ============================================================================
async function example6_advancedFiltering() {
    console.log('\n=== EXAMPLE 6: Advanced Filtering ===\n');

    const projects = await scraper.getProjects();

    // Projects with images
    const withImages = projects.filter(p => p.image && p.image.length > 0);
    console.log(`Projects with images: ${withImages.length}`);

    // Projects with specific keywords in name
    const residential = projects.filter(p =>
        p.name.toLowerCase().includes('byt') ||
        p.name.toLowerCase().includes('obyt')
    );
    console.log(`Residential projects: ${residential.length}`);

    // Active projects (planning + construction)
    const active = projects.filter(p => p.status === '1' || p.status === '2');
    console.log(`Active projects: ${active.length}`);

    return { withImages, residential, active };
}

// ============================================================================
// EXAMPLE 7: Sort and organize data
// ============================================================================
async function example7_sortAndOrganize() {
    console.log('\n=== EXAMPLE 7: Sort and Organize Data ===\n');

    const projects = await scraper.getProjects();

    // Group by status
    const byStatus = {
        planning: projects.filter(p => p.status === '1'),
        construction: projects.filter(p => p.status === '2'),
        completed: projects.filter(p => p.status === '3'),
        cancelled: projects.filter(p => p.status === '4')
    };

    console.log('Projects grouped by status:');
    Object.entries(byStatus).forEach(([status, items]) => {
        console.log(`${status}: ${items.length} projects`);
    });

    // Sort alphabetically
    const sorted = [...projects].sort((a, b) =>
        a.name.localeCompare(b.name)
    );

    console.log('\nFirst 5 projects alphabetically:');
    sorted.slice(0, 5).forEach(p => console.log(`- ${p.name}`));

    return { byStatus, sorted };
}

// ============================================================================
// EXAMPLE 8: Export data
// ============================================================================
async function example8_exportData() {
    console.log('\n=== EXAMPLE 8: Export Data ===\n');

    const projects = await scraper.getProjects();

    // Export as JSON
    const jsonPath = './yimba_projects.json';
    fs.writeFileSync(jsonPath, JSON.stringify(projects, null, 2));
    console.log(`Exported ${projects.length} projects to ${jsonPath}`);

    // Export as CSV
    const csvPath = './yimba_projects.csv';
    const csv = [
        'id,name,slug,status,image',
        ...projects.map(p =>
            `${p.id},"${p.name}",${p.slug},${p.status},"${p.image}"`
        )
    ].join('\n');
    fs.writeFileSync(csvPath, csv);
    console.log(`Exported ${projects.length} projects to ${csvPath}`);

    // Export summary
    const stats = await scraper.getStatistics();
    const summaryPath = './yimba_summary.json';
    fs.writeFileSync(summaryPath, JSON.stringify(stats, null, 2));
    console.log(`Exported statistics to ${summaryPath}`);
}

// ============================================================================
// EXAMPLE 9: Monitor for changes (conceptual)
// ============================================================================
async function example9_monitorChanges() {
    console.log('\n=== EXAMPLE 9: Monitor for Changes (Demo) ===\n');

    // First fetch
    const initialProjects = await scraper.getProjects();
    console.log(`Initial fetch: ${initialProjects.length} projects`);

    // Simulate waiting
    console.log('Waiting 5 seconds...');
    await scraper.delay(5000);

    // Second fetch
    const updatedProjects = await scraper.getProjects();
    console.log(`Updated fetch: ${updatedProjects.length} projects`);

    // Compare
    const initialIds = new Set(initialProjects.map(p => p.id));
    const updatedIds = new Set(updatedProjects.map(p => p.id));

    const newProjects = [...updatedIds].filter(id => !initialIds.has(id));
    const removedProjects = [...initialIds].filter(id => !updatedIds.has(id));

    console.log(`New projects: ${newProjects.length}`);
    console.log(`Removed projects: ${removedProjects.length}`);

    // In production, you would:
    // - Store previous state in database
    // - Run this check periodically (e.g., hourly)
    // - Send notifications on changes
}

// ============================================================================
// EXAMPLE 10: Bulk detail scraping (with rate limiting)
// ============================================================================
async function example10_bulkDetailScraping() {
    console.log('\n=== EXAMPLE 10: Bulk Detail Scraping (Sample) ===\n');

    // Get only a few projects for demo
    const underConstruction = await scraper.getProjectsByStatus(2);
    const sample = underConstruction.slice(0, 3); // Just 3 for demo

    console.log(`Scraping details for ${sample.length} projects...\n`);

    const detailedProjects = [];

    for (let i = 0; i < sample.length; i++) {
        const project = sample[i];
        console.log(`${i + 1}/${sample.length}: ${project.name}`);

        try {
            const html = await scraper.getProjectDetail(project.slug);

            detailedProjects.push({
                ...project,
                htmlLength: html.length,
                hasFetched: true
            });

            // Rate limiting
            await scraper.delay(1000);

        } catch (error) {
            console.error(`Error: ${error.message}`);
            detailedProjects.push({
                ...project,
                hasFetched: false,
                error: error.message
            });
        }
    }

    console.log('\nScraping complete!');
    console.log(`Successfully fetched: ${detailedProjects.filter(p => p.hasFetched).length}`);

    return detailedProjects;
}

// ============================================================================
// MAIN: Run all examples
// ============================================================================
async function runAllExamples() {
    console.log('='.repeat(80));
    console.log('YIMBA.sk Scraper - Complete Examples');
    console.log('='.repeat(80));

    try {
        await example1_getAllProjects();
        await example2_filterByStatus();
        await example3_searchProjects();
        await example4_getStatistics();
        await example5_getProjectDetail();
        await example6_advancedFiltering();
        await example7_sortAndOrganize();
        await example8_exportData();
        await example9_monitorChanges();
        await example10_bulkDetailScraping();

        console.log('\n' + '='.repeat(80));
        console.log('All examples completed successfully!');
        console.log('='.repeat(80));

    } catch (error) {
        console.error('\nError running examples:', error);
    }
}

// ============================================================================
// Run individual example or all
// ============================================================================
if (require.main === module) {
    // Get example number from command line
    const exampleNum = process.argv[2];

    if (exampleNum) {
        const exampleMap = {
            '1': example1_getAllProjects,
            '2': example2_filterByStatus,
            '3': example3_searchProjects,
            '4': example4_getStatistics,
            '5': example5_getProjectDetail,
            '6': example6_advancedFiltering,
            '7': example7_sortAndOrganize,
            '8': example8_exportData,
            '9': example9_monitorChanges,
            '10': example10_bulkDetailScraping
        };

        const example = exampleMap[exampleNum];
        if (example) {
            example().catch(console.error);
        } else {
            console.log('Usage: node yimba_examples.js [1-10]');
            console.log('Or run without arguments to execute all examples');
        }
    } else {
        runAllExamples();
    }
}

module.exports = {
    example1_getAllProjects,
    example2_filterByStatus,
    example3_searchProjects,
    example4_getStatistics,
    example5_getProjectDetail,
    example6_advancedFiltering,
    example7_sortAndOrganize,
    example8_exportData,
    example9_monitorChanges,
    example10_bulkDetailScraping
};
