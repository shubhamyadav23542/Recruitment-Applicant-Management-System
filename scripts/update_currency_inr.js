const { dbAsync } = require('../database/database.js');
const { supabase } = require('../database/supabase.js');

async function updateCurrency() {
  console.log('--- Updating Job Salaries to Indian Rupees (INR / ₹) ---');

  const updates = [
    {
      id: 1,
      salary_range: '₹18,00,000 - ₹26,00,000 / year',
      location: 'Bangalore, KA (Hybrid / Remote)'
    },
    {
      id: 2,
      salary_range: '₹12,00,000 - ₹18,00,000 / year',
      location: 'Mumbai, MH (Hybrid)'
    },
    {
      id: 3,
      salary_range: '₹16,00,000 - ₹24,00,000 / year',
      location: 'Hyderabad, TS (Remote)'
    },
    {
      id: 4,
      salary_range: '₹6,50,000 - ₹9,50,000 / year',
      location: 'Pune, MH (On-site)'
    },
    {
      id: 5,
      salary_range: '₹7,00,000 - ₹11,00,000 / year',
      location: 'Gurgaon / Delhi NCR (Hybrid)'
    },
    {
      id: 6,
      salary_range: '₹28,00,000 - ₹38,00,000 / year',
      location: 'Bangalore, KA (Remote)'
    },
    {
      id: 7,
      salary_range: '₹28,00,000 - ₹38,00,000 / year',
      location: 'Bangalore, KA (Remote)'
    }
  ];

  // 1. Update SQLite
  for (const item of updates) {
    await dbAsync.run(
      'UPDATE jobs SET salary_range = ?, location = ? WHERE id = ?',
      [item.salary_range, item.location, item.id]
    );
  }
  // Any other jobs with '$' in SQLite
  const otherJobs = await dbAsync.all("SELECT id, salary_range FROM jobs WHERE salary_range LIKE '%$%'");
  for (const j of otherJobs) {
    const newSal = j.salary_range.replace(/\$/g, '₹');
    await dbAsync.run('UPDATE jobs SET salary_range = ? WHERE id = ?', [newSal, j.id]);
  }
  console.log('✓ SQLite database updated with INR (₹) salaries.');

  // 2. Update Supabase Cloud
  if (supabase) {
    for (const item of updates) {
      const { error } = await supabase
        .from('jobs')
        .update({ salary_range: item.salary_range, location: item.location })
        .eq('id', item.id);
      if (error) {
        console.error(`Failed to update job #${item.id} in Supabase:`, error.message);
      } else {
        console.log(`✓ Job #${item.id} updated in Supabase Cloud.`);
      }
    }
  }

  // Verify
  const verified = await dbAsync.all('SELECT id, title, location, salary_range FROM jobs');
  console.log('\n--- Current Jobs in Database ---');
  console.table(verified);

  process.exit(0);
}

setTimeout(updateCurrency, 500);
